using System.Globalization;
using Microsoft.Data.Sqlite;
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
        var (results, indexFiles, seedElapsed, queryPlans) = await RunStoreAsync(runner, options, explain: options.Explain, CancellationToken.None);

        var report = BenchmarkReport.Build(options, results, indexFiles, seedElapsed);

        if (queryPlans is not null)
        {
            report += Environment.NewLine + BenchmarkReport.BuildQueryPlans(queryPlans);
        }

        return report;
    }

    private static async Task<string> BuildComparisonReportAsync(BenchmarkRunner runner, BenchmarkOptions options)
    {
        var legacyRunResult = RunLegacy(runner, options);
        var (storeResults, storeIndexFiles, seedElapsed, queryPlans) =
            await RunStoreAsync(runner, options, options.Explain, CancellationToken.None);

        var indexFiles = legacyRunResult.IndexFiles.Concat(storeIndexFiles).ToList();
        var priorMedians = options.PriorPath is not null ? LoadPriorMedians(options.PriorPath) : null;

        var report = BenchmarkReport.BuildComparison(
            options, legacyRunResult.Results, storeResults, indexFiles, seedElapsed, priorMedians);

        if (queryPlans is not null)
        {
            report += Environment.NewLine + BenchmarkReport.BuildQueryPlans(queryPlans);
        }

        return report;
    }

    /// <summary>
    /// Loads a two-column <c>operation&lt;TAB&gt;medianMs</c> TSV with an ordinal key comparer, so a key that
    /// only differs from the real operation name by case is treated as unmatched rather than silently accepted.
    /// </summary>
    private static IReadOnlyDictionary<string, double> LoadPriorMedians(string path)
    {
        var medians = new Dictionary<string, double>(StringComparer.Ordinal);

        foreach (var line in File.ReadAllLines(path))
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var columns = line.Split('\t');

            if (columns.Length != 2 || !double.TryParse(columns[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var medianMs))
            {
                throw new ArgumentException($"Malformed prior median line in '{path}': '{line}'.");
            }

            medians[columns[0]] = medianMs;
        }

        return medians;
    }

    private static async Task<(List<ScenarioResult> Results, List<IndexFileInfo> IndexFiles, TimeSpan SeedElapsed, IReadOnlyList<QueryPlanEntry>? QueryPlans)> RunStoreAsync(
        BenchmarkRunner runner, BenchmarkOptions options, bool explain, CancellationToken ct)
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

            // Captured against the already-seeded database, after the scenarios that just ran against it -
            // EXPLAIN QUERY PLAN never executes the statement it plans, so this adds nothing to any measured
            // operation's timing regardless of which side of the run it runs on.
            var queryPlans = explain ? await CaptureQueryPlansAsync(store, database, scope, ct) : null;

            return (runResult.Results, runResult.IndexFiles, runResult.SeedElapsed, queryPlans);
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

    /// <summary>
    /// Runs <c>EXPLAIN QUERY PLAN</c> for every <see cref="IndexSql"/> statement that backs one of
    /// <see cref="IndexStoreScenarios.OperationNames"/>'s measured operations, bound against one representative
    /// seeded row so the plan reflects the real schema and indexes rather than an empty database.
    /// </summary>
    private static async Task<IReadOnlyList<QueryPlanEntry>> CaptureQueryPlansAsync(
        IIndexStore store, IIndexDatabase database, IndexScope scope, CancellationToken ct)
    {
        var storageId = await store.EnsureStorageAsync(scope, ct);

        using var connection = database.OpenRead();
        var sample = ReadSampleFile(connection, storageId);
        var storageType = (int)scope.StorageType;

        var entries = new List<QueryPlanEntry>();

        void Capture(string statement, string sql, Action<SqliteCommand> bind)
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"EXPLAIN QUERY PLAN {sql}";
            bind(command);

            using var reader = command.ExecuteReader();
            var planRows = new List<string>();

            while (reader.Read())
            {
                planRows.Add(reader.GetString(3));
            }

            entries.Add(new QueryPlanEntry(statement, planRows));
        }

        Capture("FilesByParent", IndexSql.FilesByParent, command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$path", "/");
            command.Parameters.AddWithValue("$storageType", storageType);
        });

        Capture("Search", IndexSql.Search(1, 0), command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$match", "\"a\"*");
            command.Parameters.AddWithValue("$limit", 200);
            command.Parameters.AddWithValue("$storageType", storageType);
            command.Parameters.AddWithValue("$type0", (int)TeensyFileType.Sid);
        });

        foreach (var storageScope in Enum.GetValues<StorageScope>())
        {
            void BindCandidateParameters(SqliteCommand command)
            {
                command.Parameters.AddWithValue("$storage", storageId);

                if (storageScope == StorageScope.DirShallow)
                {
                    command.Parameters.AddWithValue("$scopePath", sample.ParentPath);
                }
                else
                {
                    var scopePath = storageScope == StorageScope.Storage ? "/" : sample.ParentPath;
                    command.Parameters.AddWithValue("$scopePrefix", IndexPathPatterns.PrefixPattern(scopePath));
                }

                command.Parameters.AddWithValue("$type0", (int)TeensyFileType.Sid);
            }

            Capture($"RandomCount ({storageScope})", IndexSql.RandomCount(storageScope, 1, 0), BindCandidateParameters);

            Capture($"RandomCandidate ({storageScope})", IndexSql.RandomCandidate(storageScope, 1, 0), command =>
            {
                BindCandidateParameters(command);
                command.Parameters.AddWithValue("$offset", 0);
            });
        }

        Capture("FileById", IndexSql.FileById, command =>
        {
            command.Parameters.AddWithValue("$id", sample.Id);
            command.Parameters.AddWithValue("$storageType", storageType);
        });

        Capture("ParentLookup", IndexSql.ParentLookup(), command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$contentId", sample.ContentId);
            command.Parameters.AddWithValue("$storageType", storageType);
            IndexPathPatterns.BindLinkedCopyParameters(command);
        });

        Capture("SiblingLookup", IndexSql.SiblingLookup(), command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$contentId", sample.ContentId);
            command.Parameters.AddWithValue("$ownPath", sample.Path);
            command.Parameters.AddWithValue("$storageType", storageType);
            IndexPathPatterns.BindLinkedCopyParameters(command);
        });

        Capture("FileUpsert", IndexSql.FileUpsert, command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$directory", sample.DirectoryId);
            command.Parameters.AddWithValue("$path", sample.Path);
            command.Parameters.AddWithValue("$parent", sample.ParentPath);
            command.Parameters.AddWithValue("$name", "explain-plan-probe.sid");
            command.Parameters.AddWithValue("$size", 0);
            command.Parameters.AddWithValue("$fileType", (int)TeensyFileType.Sid);
            command.Parameters.AddWithValue("$contentId", sample.ContentId);
            command.Parameters.AddWithValue("$isCompatible", 1);
        });

        Capture("DirectoryUpsert", IndexSql.DirectoryUpsert, command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$path", sample.ParentPath);
            command.Parameters.AddWithValue("$parent", "/");
            command.Parameters.AddWithValue("$name", "explain-plan-probe");
        });

        Capture("FileSearchDelete", IndexSql.FileSearchDelete, command =>
        {
            command.Parameters.AddWithValue("$fileId", sample.Id);
        });

        Capture("FileSearchInsert", IndexSql.FileSearchInsert, command =>
        {
            command.Parameters.AddWithValue("$fileId", sample.Id);
            command.Parameters.AddWithValue("$name", "explain-plan-probe.sid");
            command.Parameters.AddWithValue("$path", sample.Path);
        });

        Capture("FavoriteRecompute", IndexSql.FavoriteRecompute(), command =>
        {
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$contentId", sample.ContentId);
            IndexPathPatterns.BindFavoriteParameters(command);
        });

        return entries;
    }

    /// <summary>One seeded file row, real enough to bind representative parameters for every captured plan.</summary>
    private sealed record SampleFile(long Id, long DirectoryId, string Path, string ParentPath, string ContentId);

    private static SampleFile ReadSampleFile(SqliteConnection connection, int storageId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id, directory_id, path, parent_path, content_id FROM file WHERE storage_id = $storage LIMIT 1;";
        command.Parameters.AddWithValue("$storage", storageId);

        using var reader = command.ExecuteReader();

        if (!reader.Read())
        {
            throw new InvalidOperationException(
                "The seeded database has no file rows to build representative query plan parameters from.");
        }

        return new SampleFile(reader.GetInt64(0), reader.GetInt64(1), reader.GetString(2), reader.GetString(3), reader.GetString(4));
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
    bool KeepDb = false,
    string? PriorPath = null,
    bool Explain = false)
{
    public const string Usage =
        "Usage: StorageBenchmark --data-dir <dir> --device <deviceId> [--storage sd|usb] " +
        "[--iterations 5] [--out <path.md>] [--scenarios legacy|store|both] [--fixture <path>] " +
        "[--db <path>] [--keep-db] [--prior <path.tsv>] [--explain]";

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
        string? priorPath = null;
        var explain = false;

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
                case "--prior":
                    priorPath = RequireValue(args, ref i, "--prior");
                    break;
                case "--explain":
                    explain = true;
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

        return new BenchmarkOptions(
            dataDir, deviceId, storage, iterations, outPath, scenarios, fixturePath, dbPath, keepDb, priorPath, explain);
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
