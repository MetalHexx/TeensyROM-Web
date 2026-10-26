using TeensyRom.Api.WatchFolders;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

/// <summary>An in-memory <see cref="IWatchedFileSystem"/> whose files a test creates, grows, locks and removes.</summary>
internal sealed class FakeWatchedFileSystem : IWatchedFileSystem
{
    private static readonly StringComparer Comparer = StringComparer.FromComparison(WatchFolderPaths.Comparison);

    private readonly object _gate = new();
    private readonly Dictionary<string, FakeEntry> _entries = new(Comparer);

    public void AddFile(string path, long size, bool readable = true, bool isLink = false)
    {
        lock (_gate)
        {
            AddParents(path);
            _entries[path] = new FakeEntry(IsDirectory: false, size, readable, isLink);
        }
    }

    public void AddDirectory(string path)
    {
        lock (_gate)
        {
            AddParents(path);
            _entries[path] = new FakeEntry(IsDirectory: true, 0, false, false);
        }
    }

    public void SetSize(string path, long size)
    {
        lock (_gate) _entries[path] = _entries[path] with { Size = size };
    }

    public void SetReadable(string path, bool readable)
    {
        lock (_gate) _entries[path] = _entries[path] with { Readable = readable };
    }

    public void Remove(string path)
    {
        lock (_gate)
        {
            var prefix = path + Path.DirectorySeparatorChar;
            foreach (var key in _entries.Keys.Where(k => Comparer.Equals(k, path) || k.StartsWith(prefix, WatchFolderPaths.Comparison)).ToList())
            {
                _entries.Remove(key);
            }
        }
    }

    public bool DirectoryExists(string path)
    {
        lock (_gate) return _entries.TryGetValue(path, out var entry) && entry.IsDirectory;
    }

    public FileProbe Probe(string path)
    {
        lock (_gate)
        {
            return _entries.TryGetValue(path, out var entry)
                ? new FileProbe(Exists: true, entry.IsDirectory, entry.Size, entry.Readable, entry.IsLink)
                : new FileProbe(Exists: false, IsDirectory: false, Size: 0, Readable: false, IsLink: false);
        }
    }

    public IEnumerable<string> EnumerateFiles(string directory)
    {
        lock (_gate)
        {
            var prefix = directory + Path.DirectorySeparatorChar;
            return _entries
                .Where(e => !e.Value.IsDirectory && !e.Value.IsLink && e.Key.StartsWith(prefix, WatchFolderPaths.Comparison))
                .Select(e => e.Key)
                .ToList();
        }
    }

    public Stream OpenRead(string path)
    {
        lock (_gate)
        {
            if (!_entries.TryGetValue(path, out var entry) || entry.IsDirectory) throw new FileNotFoundException(path);

            return new MemoryStream(new byte[entry.Size]);
        }
    }

    private void AddParents(string path)
    {
        for (var parent = Path.GetDirectoryName(path); !string.IsNullOrEmpty(parent); parent = Path.GetDirectoryName(parent))
        {
            if (!_entries.TryAdd(parent, new FakeEntry(IsDirectory: true, 0, false, false))) break;
        }
    }

    private sealed record FakeEntry(bool IsDirectory, long Size, bool Readable, bool IsLink);
}
