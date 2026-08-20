using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Tools.StorageBenchmark.Scenarios;

/// <summary>
/// The results of one legacy-cache benchmark run: per-scenario timings plus the provenance of every
/// index file the run touched.
/// </summary>
public record LegacyScenarioRunResult(List<ScenarioResult> Results, List<IndexFileInfo> IndexFiles);

/// <summary>
/// Benchmark scenarios exercised against <see cref="SimpleStorageCache"/> as it exists today, covering
/// the operations the application actually performs, including the cost an upsert defers onto the next
/// identity lookup.
/// </summary>
public static class LegacyCacheScenarios
{
    private const int BulkUpsertBatchSize = 500;

    public static LegacyScenarioRunResult Run(
        BenchmarkRunner runner, CartStorage cartStorage, StorageSettings settings, string dataDir)
    {
        var results = new List<ScenarioResult>();
        var excludePaths = GetExcludePaths();
        var allFileTypes = Enum.GetValues<TeensyFileType>();

        results.Add(runner.Measure("Cold start to queryable", () =>
        {
            _ = new SimpleStorageCache(cartStorage, settings);
        }));

        var cache = new SimpleStorageCache(cartStorage, settings);
        var sampleDirectory = FindDirectoryWithFiles(cache)
            ?? throw new InvalidOperationException(
                "The index has no directory containing files to sample scenarios from.");
        var sampleFile = sampleDirectory.Files[0];
        var searchText = sampleFile.Name.Length > 3 ? sampleFile.Name[..3] : sampleFile.Name;

        results.Add(runner.Measure("Directory listing by path", () =>
        {
            cache.GetByDirPath(sampleDirectory.Path);
        }));

        results.Add(runner.Measure("Search", () =>
        {
            cache.Search(searchText, excludePaths, allFileTypes).ToList();
        }));

        foreach (var scope in Enum.GetValues<StorageScope>())
        {
            var scopePath = scope == StorageScope.Storage ? new DirectoryPath("/") : sampleDirectory.Path;

            results.Add(runner.Measure($"Random by scope ({scope})", () =>
            {
                cache.GetRandomFile(scope, scopePath, excludePaths, allFileTypes);
            }));
        }

        results.Add(runner.Measure("Parent lookup by identity", () =>
        {
            cache.FindParentFile(sampleFile);
        }));

        results.Add(runner.Measure("Sibling lookup by identity", () =>
        {
            cache.FindSiblings(sampleFile);
        }));

        results.Add(runner.Measure("Single upsert", () =>
        {
            cache.UpsertFile(BuildSyntheticFile(sampleDirectory.Path, Guid.NewGuid().ToString("N")));
        }));

        var bulkBatch = Enumerable.Range(0, BulkUpsertBatchSize)
            .Select(i => BuildSyntheticFile(sampleDirectory.Path, $"bulk-{i}"))
            .ToList();

        results.Add(runner.Measure(
            $"Bulk upsert ({BulkUpsertBatchSize}) + parent lookup (identity map rebuild)", () =>
            {
                foreach (var file in bulkBatch)
                {
                    cache.UpsertFile(file);
                }
                cache.FindParentFile(bulkBatch[0]);
            }));

        results.Add(runner.Measure("Peak memory with every discovered index loaded", () =>
        {
            LoadAllDiscoveredIndexes(dataDir);
        }));

        var indexFiles = BuildIndexFileInfos(dataDir);

        return new LegacyScenarioRunResult(results, indexFiles);
    }

    /// <summary>
    /// The same exclude-path set the application passes to search, random, parent and sibling lookups:
    /// every favorite path plus the playlist path.
    /// </summary>
    private static List<DirectoryPath> GetExcludePaths()
    {
        return StorageHelper.FavoritePaths
            .Append(new DirectoryPath(StorageHelper.Playlist_Path))
            .ToList();
    }

    private static IStorageCacheItem? FindDirectoryWithFiles(IStorageCache cache)
    {
        var visited = new HashSet<string>();
        var queue = new Queue<DirectoryPath>();
        queue.Enqueue(new DirectoryPath("/"));

        while (queue.Count > 0)
        {
            var path = queue.Dequeue();
            if (!visited.Add(path.Value)) continue;

            var item = cache.GetByDirPath(path);
            if (item is null) continue;

            if (item.Files.Count > 0) return item;

            foreach (var subDirectory in item.Directories)
            {
                queue.Enqueue(subDirectory.Path);
            }
        }

        return null;
    }

    private static FileItem BuildSyntheticFile(DirectoryPath directory, string suffix)
    {
        var path = directory.Combine(new FilePath($"benchmark-{suffix}.sid"));

        return new FileItem
        {
            Name = path.FileName,
            Path = path,
            Size = 1024,
            StorageType = TeensyStorageType.SD
        };
    }

    private static void LoadAllDiscoveredIndexes(string dataDir)
    {
        foreach (var (_, deviceId, storageType) in DiscoverIndexFiles(dataDir))
        {
            BuildCache(deviceId, storageType);
        }
    }

    private static List<IndexFileInfo> BuildIndexFileInfos(string dataDir)
    {
        var infos = new List<IndexFileInfo>();

        foreach (var (path, deviceId, storageType) in DiscoverIndexFiles(dataDir))
        {
            var cache = BuildCache(deviceId, storageType);
            infos.Add(new IndexFileInfo(path, new FileInfo(path).Length, cache.GetCacheSize()));
        }

        return infos;
    }

    private static SimpleStorageCache BuildCache(string deviceId, TeensyStorageType storageType)
    {
        var cartStorage = new CartStorage(storageType, available: true) { DeviceId = deviceId };
        var settings = new StorageSettings
        {
            CartStorage = cartStorage,
            BannedDirectories = [],
            BannedFiles = []
        };

        return new SimpleStorageCache(cartStorage, settings);
    }

    /// <summary>
    /// Every Sd-*.json / Usb-*.json index file under &lt;dataDir&gt;/Assets/System/Cache/, with the
    /// device id and storage type parsed from its filename.
    /// </summary>
    private static IEnumerable<(string Path, string DeviceId, TeensyStorageType StorageType)> DiscoverIndexFiles(
        string dataDir)
    {
        var cacheDir = Path.Combine(dataDir, StorageHelper.Cache_File_Relative_Path);
        if (!Directory.Exists(cacheDir)) yield break;

        foreach (var file in Directory.EnumerateFiles(cacheDir, $"*{StorageHelper.Cache_File_Extension}"))
        {
            var name = Path.GetFileNameWithoutExtension(file);

            if (name.StartsWith(StorageHelper.Sd_Cache_File_Name, StringComparison.Ordinal))
            {
                yield return (file, name[StorageHelper.Sd_Cache_File_Name.Length..], TeensyStorageType.SD);
            }
            else if (name.StartsWith(StorageHelper.Usb_Cache_File_Name, StringComparison.Ordinal))
            {
                yield return (file, name[StorageHelper.Usb_Cache_File_Name.Length..], TeensyStorageType.USB);
            }
        }
    }
}
