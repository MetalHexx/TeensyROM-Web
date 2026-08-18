using System.Diagnostics;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Tools.StorageBenchmark.Scenarios;

/// <summary>
/// The results of one store benchmark run: per-scenario timings, the provenance of the fixture that seeded
/// the database, and the seeding duration - reported separately because seeding is setup, not one of the
/// measured operations.
/// </summary>
public record IndexStoreScenarioRunResult(List<ScenarioResult> Results, List<IndexFileInfo> IndexFiles, TimeSpan SeedElapsed);

/// <summary>
/// Benchmark scenarios exercised against <see cref="IIndexStore"/>, mirroring <see cref="LegacyCacheScenarios"/>
/// operation for operation - the same exclude paths, the same file types, the same scope paths, and the same
/// iteration count - so the two sides describe the same workload. The store's surface is asynchronous, so
/// every measured action is driven and timed without ever blocking on <c>.Result</c>; the blocking cost would
/// otherwise land in the measurement.
/// </summary>
public static class IndexStoreScenarios
{
    private const int BulkUpsertBatchSize = 500;

    // The store enforces a result cap the legacy in-memory scan does not; large enough that every scenario's
    // few-substring match set is returned in full, so the comparison is not skewed by truncation.
    private const int SearchLimit = 200;

    /// <summary>
    /// The exact operation names this scenario set emits, in run order - kept equal to
    /// <see cref="LegacyCacheScenarios"/>'s own names so every store operation has a legacy counterpart to
    /// compare against. Exposed statically so the pairing can be asserted without running a real benchmark.
    /// </summary>
    public static readonly IReadOnlyList<string> OperationNames =
    [
        "Cold start to queryable",
        "Directory listing by path",
        "Search",
        "Random by scope (Storage)",
        "Random by scope (DirDeep)",
        "Random by scope (DirShallow)",
        "Parent lookup by identity",
        "Sibling lookup by identity",
        "Single upsert",
        "Bulk upsert (500) + parent lookup (identity map rebuild)",
        "Peak memory with every discovered index loaded"
    ];

    public static async Task<IndexStoreScenarioRunResult> RunAsync(
        BenchmarkRunner runner, IIndexStore store, IIndexDatabase database, IndexScope scope,
        string fixturePath, string dbPath, CancellationToken ct)
    {
        var seeder = new IndexFixtureSeeder(store, database, projection: null);
        var seedResult = await seeder.SeedAsync(scope, fixturePath, new SeedOptions(RunProjection: false), null, ct);

        var results = new List<ScenarioResult>();
        var excludePaths = GetExcludePaths();
        var allFileTypes = Enum.GetValues<TeensyFileType>();
        var iterations = runner.Iterations;

        results.Add(await MeasureAsync("Cold start to queryable", iterations, async () =>
        {
            var coldDatabase = new IndexDatabase(dbPath);

            try
            {
                var coldStore = new SqliteIndexStore(coldDatabase);
                await coldStore.GetDirectoryAsync(scope, new DirectoryPath("/"), ct);
            }
            finally
            {
                coldDatabase.Dispose();
            }
        }));

        var sampleDirectory = await FindDirectoryWithFilesAsync(store, scope, ct)
            ?? throw new InvalidOperationException(
                "The index has no directory containing files to sample scenarios from.");
        var sampleFile = sampleDirectory.Files[0];
        var searchText = sampleFile.Name.Length > 3 ? sampleFile.Name[..3] : sampleFile.Name;

        results.Add(await MeasureAsync("Directory listing by path", iterations, () =>
            store.GetDirectoryAsync(scope, sampleDirectory.Path, ct)));

        results.Add(await MeasureAsync("Search", iterations, () =>
            store.SearchAsync(scope, searchText, excludePaths, allFileTypes, SearchLimit, ct)));

        foreach (var storageScope in Enum.GetValues<StorageScope>())
        {
            var scopePath = storageScope == StorageScope.Storage ? new DirectoryPath("/") : sampleDirectory.Path;

            results.Add(await MeasureAsync($"Random by scope ({storageScope})", iterations, () =>
                store.GetRandomFileAsync(scope, storageScope, scopePath, excludePaths, allFileTypes, ct)));
        }

        results.Add(await MeasureAsync("Parent lookup by identity", iterations, () =>
            store.FindParentFileAsync(scope, sampleFile, ct)));

        results.Add(await MeasureAsync("Sibling lookup by identity", iterations, () =>
            store.FindSiblingsAsync(scope, sampleFile, ct)));

        results.Add(await MeasureAsync("Single upsert", iterations, () =>
            store.UpsertFileAsync(scope, BuildSyntheticFile(scope, sampleDirectory.Path, Guid.NewGuid().ToString("N")), ct)));

        var bulkBatch = Enumerable.Range(0, BulkUpsertBatchSize)
            .Select(i => BuildSyntheticFile(scope, sampleDirectory.Path, $"bulk-{i}"))
            .ToList();

        results.Add(await MeasureAsync(
            "Bulk upsert (500) + parent lookup (identity map rebuild)", iterations, async () =>
            {
                await store.UpsertFilesAsync(scope, bulkBatch, ct);
                await store.FindParentFileAsync(scope, bulkBatch[0], ct);
            }));

        results.Add(await MeasureAsync("Peak memory with every discovered index loaded", iterations, async () =>
        {
            // The analogue of the legacy run's "every index loaded": every scope this database serves is
            // queried, and the point being measured is that none of them requires the full collection in
            // memory - unlike the legacy cache, which holds it all resident regardless of what is queried.
            foreach (var storageScope in Enum.GetValues<StorageScope>())
            {
                var scopePath = storageScope == StorageScope.Storage ? new DirectoryPath("/") : sampleDirectory.Path;
                await store.GetRandomFileAsync(scope, storageScope, scopePath, excludePaths, allFileTypes, ct);
            }
        }));

        var fixtureHeader = IndexFixtureReader.ReadHeader(fixturePath);
        var indexFiles = new List<IndexFileInfo>
        {
            new(fixturePath, new FileInfo(fixturePath).Length, fixtureHeader.FileCount)
        };

        return new IndexStoreScenarioRunResult(results, indexFiles, seedResult.Elapsed);
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

    private static async Task<IStorageCacheItem?> FindDirectoryWithFilesAsync(IIndexStore store, IndexScope scope, CancellationToken ct)
    {
        var visited = new HashSet<string>();
        var queue = new Queue<DirectoryPath>();
        queue.Enqueue(new DirectoryPath("/"));

        while (queue.Count > 0)
        {
            var path = queue.Dequeue();
            if (!visited.Add(path.Value)) continue;

            var item = await store.GetDirectoryAsync(scope, path, ct);
            if (item is null) continue;

            if (item.Files.Count > 0) return item;

            foreach (var subDirectory in item.Directories)
            {
                queue.Enqueue(subDirectory.Path);
            }
        }

        return null;
    }

    private static FileItem BuildSyntheticFile(IndexScope scope, DirectoryPath directory, string suffix)
    {
        var path = directory.Combine(new FilePath($"benchmark-{suffix}.sid"));

        return new FileItem
        {
            Name = path.FileName,
            Path = path,
            Size = 1024,
            StorageType = scope.StorageType
        };
    }

    /// <summary>
    /// Times and memory-samples an asynchronous scenario with the same discipline as
    /// <see cref="BenchmarkRunner.Measure"/> - one discarded warm-up iteration, a forced-GC managed-memory
    /// delta, and a process peak-working-set reading - reimplemented here because the store's surface is
    /// asynchronous and <see cref="BenchmarkRunner"/>'s is not.
    /// </summary>
    private static async Task<ScenarioResult> MeasureAsync(string operation, int iterations, Func<Task> action)
    {
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var managedBefore = GC.GetTotalMemory(true);

        var durationsMs = new List<double>(iterations + 1);
        var stopwatch = new Stopwatch();

        for (var i = 0; i < iterations + 1; i++)
        {
            stopwatch.Restart();
            await action();
            stopwatch.Stop();
            durationsMs.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var managedAfter = GC.GetTotalMemory(true);

        var (median, min, max) = TimingStatistics.ComputeExcludingWarmup(durationsMs);

        var process = Process.GetCurrentProcess();
        process.Refresh();

        return new ScenarioResult(
            operation, iterations, median, min, max, managedAfter - managedBefore, process.PeakWorkingSet64);
    }
}
