using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Tools.StorageBenchmark.Scenarios;

namespace TeensyRom.Tools.StorageBenchmark;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        BenchmarkOptions options;

        try
        {
            options = BenchmarkOptions.Parse(args);
        }
        catch (ArgumentException ex)
        {
            Console.Error.WriteLine(ex.Message);
            Console.Error.WriteLine(BenchmarkOptions.Usage);
            return 1;
        }

        // Must be set before constructing anything that resolves a cache file path - it is the only
        // seam SimpleStorageCache exposes for pointing at a different index file.
        Environment.SetEnvironmentVariable("TEENSYROM_DATA_DIR", options.DataDir);

        var runner = new BenchmarkRunner(options.Iterations);
        string report;

        try
        {
            report = options.Scenarios switch
            {
                "legacy" => BuildLegacyReport(runner, options),
                "store" => await BuildStoreReportAsync(runner, options),
                "both" => await BuildComparisonReportAsync(runner, options),
                _ => throw new InvalidOperationException($"Unhandled scenario set '{options.Scenarios}'.")
            };
        }
        catch (FileNotFoundException ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }

        if (options.OutPath is not null)
        {
            var outDirectory = Path.GetDirectoryName(Path.GetFullPath(options.OutPath));
            if (!string.IsNullOrEmpty(outDirectory))
            {
                Directory.CreateDirectory(outDirectory);
            }

            File.WriteAllText(options.OutPath, report);
            Console.WriteLine($"Report written to {options.OutPath}");
        }
        else
        {
            Console.WriteLine(report);
        }

        return 0;
    }

    private static string BuildLegacyReport(BenchmarkRunner runner, BenchmarkOptions options)
    {
        var runResult = RunLegacy(runner, options);

        return BenchmarkReport.Build(options, runResult.Results, runResult.IndexFiles);
    }

    private static LegacyScenarioRunResult RunLegacy(BenchmarkRunner runner, BenchmarkOptions options)
    {
        var cartStorage = new CartStorage(options.Storage, available: true) { DeviceId = options.DeviceId };
        var settings = new StorageSettings
        {
            CartStorage = cartStorage,
            BannedDirectories = [],
            BannedFiles = []
        };

        return LegacyCacheScenarios.Run(runner, cartStorage, settings, options.DataDir);
    }

    private static async Task<string> BuildStoreReportAsync(BenchmarkRunner runner, BenchmarkOptions options)
    {
        var (results, indexFiles, seedElapsed) = await RunStoreAsync(runner, options, CancellationToken.None);

        return BenchmarkReport.Build(options, results, indexFiles, seedElapsed);
    }

    private static async Task<string> BuildComparisonReportAsync(BenchmarkRunner runner, BenchmarkOptions options)
    {
        var legacyRunResult = RunLegacy(runner, options);
        var (storeResults, storeIndexFiles, seedElapsed) = await RunStoreAsync(runner, options, CancellationToken.None);

        var indexFiles = legacyRunResult.IndexFiles.Concat(storeIndexFiles).ToList();

        return BenchmarkReport.BuildComparison(options, legacyRunResult.Results, storeResults, indexFiles, seedElapsed);
    }

    private static async Task<(List<ScenarioResult> Results, List<IndexFileInfo> IndexFiles, TimeSpan SeedElapsed)> RunStoreAsync(
        BenchmarkRunner runner, BenchmarkOptions options, CancellationToken ct)
    {
        var fixturePath = ResolveFixturePath(options);

        if (!File.Exists(fixturePath))
        {
            throw new FileNotFoundException(
                $"No index fixture found at '{fixturePath}'. Pass --fixture <path>, or use the fixture seeder " +
                "to extract one from a real index.", fixturePath);
        }

        var dbPath = ResolveDbPath(options);
        var scope = new IndexScope(options.DeviceId, options.Storage);
        var database = new IndexDatabase(dbPath);

        try
        {
            var store = new SqliteIndexStore(database);
            var runResult = await IndexStoreScenarios.RunAsync(runner, store, database, scope, fixturePath, dbPath, ct);

            return (runResult.Results, runResult.IndexFiles, runResult.SeedElapsed);
        }
        finally
        {
            database.Dispose();

            if (!options.KeepDb)
            {
                DeleteDatabaseFiles(dbPath);
            }
        }
    }

    private static string ResolveFixturePath(BenchmarkOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.FixturePath))
        {
            return options.FixturePath;
        }

        var prefix = options.Storage == TeensyStorageType.SD ? "Sd-" : "Usb-";

        return Path.Combine(IndexFixturePaths.ResolveDirectory(), $"{prefix}{options.DeviceId}.tsv");
    }

    private static string ResolveDbPath(BenchmarkOptions options) =>
        string.IsNullOrWhiteSpace(options.DbPath)
            ? Path.Combine(Path.GetTempPath(), $"teensyrom-benchmark-{Guid.NewGuid():N}.db")
            : options.DbPath;

    private static void DeleteDatabaseFiles(string dbPath)
    {
        // WAL journal mode leaves a -wal/-shm sidecar until checkpointed; Dispose() (above) clears the pool
        // that would otherwise keep an OS handle on all three open.
        foreach (var path in new[] { dbPath, $"{dbPath}-wal", $"{dbPath}-shm" })
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }
}

/// <summary>
/// Parsed command-line options for a benchmark run.
/// </summary>
public sealed record BenchmarkOptions(
    string DataDir,
    string DeviceId,
    TeensyStorageType Storage,
    int Iterations,
    string? OutPath,
    string Scenarios,
    string? FixturePath = null,
    string? DbPath = null,
    bool KeepDb = false)
{
    public const string Usage =
        "Usage: StorageBenchmark --data-dir <dir> --device <deviceId> [--storage sd|usb] " +
        "[--iterations 5] [--out <path.md>] [--scenarios legacy|store|both] [--fixture <path>] " +
        "[--db <path>] [--keep-db]";

    public static BenchmarkOptions Parse(string[] args)
    {
        string? dataDir = null;
        string? deviceId = null;
        var storage = TeensyStorageType.SD;
        var iterations = 5;
        string? outPath = null;
        var scenarios = "legacy";
        string? fixturePath = null;
        string? dbPath = null;
        var keepDb = false;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--data-dir":
                    dataDir = RequireValue(args, ref i, "--data-dir");
                    break;
                case "--device":
                    deviceId = RequireValue(args, ref i, "--device");
                    break;
                case "--storage":
                    storage = ParseStorage(RequireValue(args, ref i, "--storage"));
                    break;
                case "--iterations":
                    iterations = ParseIterations(RequireValue(args, ref i, "--iterations"));
                    break;
                case "--out":
                    outPath = RequireValue(args, ref i, "--out");
                    break;
                case "--scenarios":
                    scenarios = ParseScenarios(RequireValue(args, ref i, "--scenarios"));
                    break;
                case "--fixture":
                    fixturePath = RequireValue(args, ref i, "--fixture");
                    break;
                case "--db":
                    dbPath = RequireValue(args, ref i, "--db");
                    break;
                case "--keep-db":
                    keepDb = true;
                    break;
                default:
                    throw new ArgumentException($"Unrecognized argument '{args[i]}'.");
            }
        }

        if (string.IsNullOrWhiteSpace(dataDir))
        {
            throw new ArgumentException("--data-dir is required.");
        }

        if (string.IsNullOrWhiteSpace(deviceId))
        {
            throw new ArgumentException("--device is required.");
        }

        return new BenchmarkOptions(dataDir, deviceId, storage, iterations, outPath, scenarios, fixturePath, dbPath, keepDb);
    }

    private static TeensyStorageType ParseStorage(string value) => value.ToLowerInvariant() switch
    {
        "sd" => TeensyStorageType.SD,
        "usb" => TeensyStorageType.USB,
        _ => throw new ArgumentException($"Unknown storage type '{value}'. Expected sd or usb.")
    };

    private static string ParseScenarios(string value) => value.ToLowerInvariant() switch
    {
        "legacy" => "legacy",
        "store" => "store",
        "both" => "both",
        _ => throw new ArgumentException($"Unknown scenario set '{value}'. Supported: legacy, store, both.")
    };

    private static int ParseIterations(string value)
    {
        if (!int.TryParse(value, out var iterations) || iterations < 1)
        {
            throw new ArgumentException($"--iterations must be a positive integer, got '{value}'.");
        }

        return iterations;
    }

    private static string RequireValue(string[] args, ref int index, string flag)
    {
        if (index + 1 >= args.Length)
        {
            throw new ArgumentException($"{flag} requires a value.");
        }

        index++;
        return args[index];
    }
}
