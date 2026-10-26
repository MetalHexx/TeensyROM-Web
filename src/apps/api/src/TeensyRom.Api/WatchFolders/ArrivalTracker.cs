using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>A settled file; <c>RelativePath</c> is relative to the watch folder and uses '/' separators.</summary>
    public sealed record ArrivedFile(string FullPath, string RelativePath, long SizeBytes, bool IsArchive);

    /// <summary>The files that arrived in one watch folder close together, to go out as one transfer job.</summary>
    public sealed record ArrivalSet(string WatchFolderId, IReadOnlyList<ArrivedFile> Files);

    /// <summary>
    /// Turns the file-system events of one watch folder into sets of settled, transferable arrivals. Only what is new
    /// in the folder counts. It owns no timers and no threads: the caller passes the time in, so a single loop drives
    /// it and tests drive it with explicit times. Not thread-safe.
    /// </summary>
    public sealed class ArrivalTracker(
        string watchFolderId,
        string folderPath,
        WatchFolderOptions options,
        IWatchedFileSystem fileSystem,
        IArchiveReader archives,
        ILoggingService log)
    {
        private const string SafariPackageSuffix = ".download";

        private static readonly StringComparer PathComparer = StringComparer.FromComparison(WatchFolderPaths.Comparison);

        private readonly Dictionary<string, Pending> _pending = new(PathComparer);
        private readonly Dictionary<string, DateTimeOffset> _dispatched = new(PathComparer);
        private OpenSet? _open;

        private TimeSpan RecentDispatchWindow => options.SettleTime + options.GroupingWindow;

        /// <summary>Feeds one event in. Touches the file system only to ask whether a changed or renamed path is a directory.</summary>
        public void OnEvent(FolderEvent e, DateTimeOffset now)
        {
            // Safari writes game.prg.download/game.prg while downloading; nothing in such a package may become an arrival.
            if (!TryGetRelative(e.FullPath, out var relative) || IsInsideDownloadPackage(relative, includeLeaf: true)) return;

            switch (e.Kind)
            {
                case FolderEventKind.Created:
                    Start(e.FullPath, fromCreated: true);
                    break;
                case FolderEventKind.Changed:
                    OnChanged(e.FullPath, now);
                    break;
                case FolderEventKind.Renamed:
                    OnRenamed(e);
                    break;
            }
        }

        /// <summary>Probes the pending files and returns the sets whose grouping window has closed (at most one per call).</summary>
        public IReadOnlyList<ArrivalSet> Tick(DateTimeOffset now)
        {
            ForgetOldDispatches(now);
            SettlePending(now);
            return CloseSetIfDue(now);
        }

        private void OnChanged(string path, DateTimeOffset now)
        {
            if (_pending.TryGetValue(path, out var pending))
            {
                pending.Size = null;
                return;
            }

            // A subfolder reports a change whenever a file is added inside it; that file has its own event.
            var probe = fileSystem.Probe(path);
            if (!probe.Exists || probe.IsDirectory) return;

            if (_dispatched.TryGetValue(path, out var dispatchedAt) && now - dispatchedAt <= RecentDispatchWindow) return;

            Start(path, fromCreated: false);
        }

        private void OnRenamed(FolderEvent e)
        {
            if (e.OldFullPath is null) return;

            var probe = fileSystem.Probe(e.FullPath);
            if (probe.Exists && probe.IsDirectory) return;

            var leftSafariPackage = TryGetRelative(e.OldFullPath, out var oldRelative) && IsInsideDownloadPackage(oldRelative, includeLeaf: false);
            var wasPartialName = !TransferableFileTypes.IsTransferable(e.OldFullPath) && !archives.IsArchiveExtension(e.OldFullPath);

            if (leftSafariPackage || wasPartialName) Start(e.FullPath, fromCreated: false);
        }

        private void Start(string path, bool fromCreated)
        {
            if (_pending.TryGetValue(path, out var pending))
            {
                pending.Size = null;
                pending.FromCreated |= fromCreated;
                return;
            }

            // Written to again after it settled but before it went out: settle it afresh so it is never sent half-written.
            _open?.Remove(path);
            if (_open is { Files.Count: 0 }) _open = null;

            _pending[path] = new Pending(path, fromCreated);
        }

        private void SettlePending(DateTimeOffset now)
        {
            var work = new Queue<Pending>(_pending.Values);

            while (work.TryDequeue(out var pending))
            {
                var probe = fileSystem.Probe(pending.FullPath);

                if (!probe.Exists || probe.IsLink)
                {
                    _pending.Remove(pending.FullPath);
                    continue;
                }

                if (probe.IsDirectory)
                {
                    _pending.Remove(pending.FullPath);
                    if (pending.FromCreated) ExpandDirectory(pending.FullPath, work);
                    continue;
                }

                if (pending.Size != probe.Size)
                {
                    pending.Size = probe.Size;
                    pending.SizeSince = now;
                }

                // An empty file is a placeholder (Firefox leaves one under the final name while it writes name.part): it waits until it grows, is replaced or vanishes.
                if (probe.Size == 0 || now - pending.SizeSince < options.SettleTime || !probe.Readable) continue;

                _pending.Remove(pending.FullPath);
                Admit(pending.FullPath, probe.Size, now);
            }
        }

        private void ExpandDirectory(string directory, Queue<Pending> work)
        {
            foreach (var file in EnumerateSafely(directory))
            {
                if (_pending.ContainsKey(file) || (_open?.Contains(file) ?? false)) continue;
                if (!TryGetRelative(file, out var relative) || IsInsideDownloadPackage(relative, includeLeaf: false)) continue;

                var pending = new Pending(file, fromCreated: true);
                _pending[file] = pending;
                work.Enqueue(pending);
            }
        }

        private List<string> EnumerateSafely(string directory)
        {
            try
            {
                return fileSystem.EnumerateFiles(directory).ToList();
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return [];
            }
        }

        private void Admit(string path, long size, DateTimeOffset now)
        {
            var isArchive = archives.IsArchiveExtension(path);
            if (!isArchive && !TransferableFileTypes.IsTransferable(path)) return;
            if (!TryGetRelative(path, out var relative)) return;
            if (isArchive && !HasUsefulEntries(path, relative)) return;

            _open ??= new OpenSet(now);
            _open.Add(new ArrivedFile(path, relative, size, isArchive), now);
        }

        private bool HasUsefulEntries(string archivePath, string relative)
        {
            try
            {
                return archives.ReadIndex(archivePath).Entries.Any(entry =>
                    !entry.IsDirectory && (TransferableFileTypes.IsTransferable(entry.Path) || archives.IsArchiveExtension(entry.Path)));
            }
            catch (Exception ex) when (ex is ArchiveReadException or IOException or UnauthorizedAccessException)
            {
                log.InternalWarning($"Watch folder {folderPath}: skipped {relative}, it could not be read as an archive ({ex.Message}).");
                return false;
            }
        }

        private IReadOnlyList<ArrivalSet> CloseSetIfDue(DateTimeOffset now)
        {
            if (_open is null) return [];

            var held = now - _open.OpenedAt >= options.MaxSetHold;
            var quiet = now - _open.LastJoinedAt >= options.GroupingWindow && !_pending.Values.Any(p => p.Size > 0);
            if (!held && !quiet) return [];

            foreach (var file in _open.Files) _dispatched[file.FullPath] = now;

            var set = new ArrivalSet(watchFolderId, _open.Files.ToList());
            _open = null;
            return [set];
        }

        private void ForgetOldDispatches(DateTimeOffset now)
        {
            if (_dispatched.Count == 0) return;

            foreach (var path in _dispatched.Where(d => now - d.Value > RecentDispatchWindow).Select(d => d.Key).ToList())
            {
                _dispatched.Remove(path);
            }
        }

        private bool TryGetRelative(string fullPath, out string relative)
        {
            relative = string.Empty;
            var path = Path.GetRelativePath(folderPath, fullPath);

            var outside = path == "." || path == ".." || Path.IsPathRooted(path)
                || path.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal);
            if (outside) return false;

            relative = path.Replace(Path.DirectorySeparatorChar, '/');
            return true;
        }

        private static bool IsInsideDownloadPackage(string relative, bool includeLeaf)
        {
            var segments = relative.Split('/');
            var count = includeLeaf ? segments.Length : segments.Length - 1;

            for (var i = 0; i < count; i++)
            {
                if (segments[i].EndsWith(SafariPackageSuffix, StringComparison.OrdinalIgnoreCase)) return true;
            }

            return false;
        }

        private sealed class Pending(string fullPath, bool fromCreated)
        {
            public string FullPath { get; } = fullPath;

            /// <summary>Whether a directory at this path is expanded into its files.</summary>
            public bool FromCreated { get; set; } = fromCreated;

            /// <summary>The size last seen; null until probed, and again after an event refreshes the arrival.</summary>
            public long? Size { get; set; }

            /// <summary>When <see cref="Size"/> was first seen at its current value.</summary>
            public DateTimeOffset SizeSince { get; set; }
        }

        private sealed class OpenSet(DateTimeOffset openedAt)
        {
            private readonly HashSet<string> _paths = new(PathComparer);

            public DateTimeOffset OpenedAt { get; } = openedAt;
            public DateTimeOffset LastJoinedAt { get; private set; } = openedAt;
            public List<ArrivedFile> Files { get; } = [];

            public bool Contains(string path) => _paths.Contains(path);

            public void Add(ArrivedFile file, DateTimeOffset now)
            {
                if (!_paths.Add(file.FullPath)) return;

                Files.Add(file);
                LastJoinedAt = now;
            }

            public void Remove(string path)
            {
                if (_paths.Remove(path)) Files.RemoveAll(f => PathComparer.Equals(f.FullPath, path));
            }
        }
    }
}
