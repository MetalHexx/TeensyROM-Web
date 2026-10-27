using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Dj
{
    /// <summary>
    /// Keeps sets, tune memory and the library state as JSON files under dj/ in the engine's home:
    /// sets/{setId}.json, tunes/{sidHash}.json and library.json. Every read-modify-write is serialized by one lock,
    /// and a write goes to a temp file that then replaces the target, so a failed write keeps the old file.
    /// A file that cannot be read, or whose stored id does not match its name, is warned about, left in place and read as missing.
    /// Set summaries are cached after the first list.
    /// </summary>
    public class DjLibraryService : IDjLibraryService
    {
        /// <summary>
        /// The most sets the library holds.
        /// </summary>
        public const int DefaultMaxSets = 1000;

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

        private static string RootPath => Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), DjLibraryPaths.RootFolder);
        private static string SetsPath => Path.Combine(RootPath, DjLibraryPaths.SetsFolder);
        private static string TunesPath => Path.Combine(RootPath, DjLibraryPaths.TunesFolder);
        private static string LibraryPath => Path.Combine(RootPath, DjLibraryPaths.LibraryFile);

        private readonly ILoggingService _log;
        private readonly int _maxSets;
        private readonly object _lock = new();
        private Dictionary<string, DjSetSummary>? _summaries;

        public DjLibraryService(ILoggingService log, int maxSets = DefaultMaxSets)
        {
            _log = log;
            _maxSets = maxSets;
        }

        public IReadOnlyList<DjSetSummary> ListSets()
        {
            lock (_lock)
            {
                return Sorted(LoadSummaries());
            }
        }

        public DjSet? GetSet(string setId)
        {
            RequireSetId(setId);
            lock (_lock)
            {
                return ReadSet(SetFilePath(setId), setId);
            }
        }

        public DjSaveResult SaveSet(DjSet set)
        {
            RequireSetId(set.Id);
            lock (_lock)
            {
                var path = SetFilePath(set.Id);
                var summaries = LoadSummaries();

                if (!File.Exists(path) && !summaries.ContainsKey(set.Id) && summaries.Count >= _maxSets)
                {
                    return DjSaveResult.LimitReached;
                }
                if (!Write(path, set, "DJ set")) return DjSaveResult.Failed;

                summaries[set.Id] = Summarize(set);
                return DjSaveResult.Saved;
            }
        }

        public bool DeleteSet(string setId)
        {
            RequireSetId(setId);
            lock (_lock)
            {
                var path = SetFilePath(setId);
                try
                {
                    File.Delete(path);
                }
                catch (DirectoryNotFoundException)
                {
                    // No sets folder yet, so the set is not there.
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    _log.InternalError($"Failed to delete the DJ set file '{path}': {ex.Message}");
                    return false;
                }

                _summaries?.Remove(setId);
                return true;
            }
        }

        public DjTuneMemory? GetTuneMemory(string sidHash)
        {
            RequireSidHash(sidHash);
            lock (_lock)
            {
                return Read<DjTuneMemory>(TuneFilePath(sidHash), "DJ tune memory", memory => memory.SidHash == sidHash);
            }
        }

        public bool SaveTuneMemory(DjTuneMemory memory)
        {
            RequireSidHash(memory.SidHash);
            lock (_lock)
            {
                return Write(TuneFilePath(memory.SidHash), memory, "DJ tune memory");
            }
        }

        public DjLibraryState GetLibraryState()
        {
            lock (_lock)
            {
                return Read<DjLibraryState>(LibraryPath, "DJ library state", state => state.CurrentSetId is null || DjLibraryIds.IsSetId(state.CurrentSetId))
                    ?? new DjLibraryState();
            }
        }

        public bool SaveLibraryState(DjLibraryState state)
        {
            if (state.CurrentSetId is not null) RequireSetId(state.CurrentSetId);
            lock (_lock)
            {
                return Write(LibraryPath, state, "DJ library state");
            }
        }

        private static void RequireSetId(string? setId)
        {
            if (!DjLibraryIds.IsSetId(setId)) throw new ArgumentException("A set id is a lowercase GUID in the hyphenated format.", nameof(setId));
        }

        private static void RequireSidHash(string? sidHash)
        {
            if (!DjLibraryIds.IsSidHash(sidHash)) throw new ArgumentException("A SID hash is 32 lowercase hexadecimal characters.", nameof(sidHash));
        }

        private static string SetFilePath(string setId) => Path.Combine(SetsPath, setId + DjLibraryPaths.Extension);

        private static string TuneFilePath(string sidHash) => Path.Combine(TunesPath, sidHash + DjLibraryPaths.Extension);

        private static DjSetSummary Summarize(DjSet set) => new(set.Id, set.Name, set.Rows?.Count ?? 0, set.Updated);

        private static IReadOnlyList<DjSetSummary> Sorted(Dictionary<string, DjSetSummary> summaries) => summaries.Values
            .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(s => s.Id, StringComparer.Ordinal)
            .ToList();

        private DjSet? ReadSet(string path, string setId) => Read<DjSet>(path, "DJ set", set => set.Id == setId);

        /// <summary>
        /// Reads every set file once and keeps the summaries. Callers hold the lock.
        /// </summary>
        private Dictionary<string, DjSetSummary> LoadSummaries()
        {
            if (_summaries is not null) return _summaries;

            var summaries = new Dictionary<string, DjSetSummary>(StringComparer.Ordinal);
            string[] files;
            try
            {
                files = Directory.Exists(SetsPath) ? Directory.GetFiles(SetsPath, "*" + DjLibraryPaths.Extension) : [];
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalWarning($"The DJ sets folder '{SetsPath}' could not be listed ({ex.Message}).");
                return summaries;
            }

            foreach (var file in files)
            {
                var setId = Path.GetFileNameWithoutExtension(file);
                if (!DjLibraryIds.IsSetId(setId) || !string.Equals(Path.GetExtension(file), DjLibraryPaths.Extension, StringComparison.Ordinal)) continue;

                var set = ReadSet(file, setId);
                if (set is not null) summaries[setId] = Summarize(set);
            }

            _summaries = summaries;
            return summaries;
        }

        /// <summary>
        /// Reads a document: null when the file is missing, or unreadable, unparsable or rejected by <paramref name="isValid"/> (warned about once).
        /// </summary>
        private T? Read<T>(string path, string what, Func<T, bool> isValid) where T : class
        {
            if (!File.Exists(path)) return null;

            try
            {
                var document = JsonSerializer.Deserialize<T>(File.ReadAllText(path), JsonOptions);
                if (document is not null && isValid(document)) return document;

                _log.InternalWarning($"The {what} file '{path}' is empty or does not match its name. Ignoring it.");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
            {
                _log.InternalWarning($"The {what} file '{path}' could not be read ({ex.Message}). Ignoring it.");
            }
            return null;
        }

        /// <summary>
        /// Writes to a temp file and moves it over the target. On failure the old file is kept and the temp file removed.
        /// </summary>
        private bool Write<T>(string path, T document, string what)
        {
            var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";

            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(tempPath, JsonSerializer.Serialize(document, JsonOptions));
                File.Move(tempPath, path, overwrite: true);
                return true;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalError($"Failed to save the {what} to '{path}': {ex.Message}");
                TryDelete(tempPath);
                return false;
            }
        }

        private void TryDelete(string path)
        {
            try
            {
                File.Delete(path);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalWarning($"Could not remove the temporary file '{path}': {ex.Message}");
            }
        }
    }
}
