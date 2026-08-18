using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Tools.StorageBenchmark.Scenarios;

namespace TeensyRom.Tools.StorageBenchmark;

public static class Program
{
    public static int Main(string[] args)
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

        var cartStorage = new CartStorage(options.Storage, available: true) { DeviceId = options.DeviceId };
        var settings = new StorageSettings
        {
            CartStorage = cartStorage,
            BannedDirectories = [],
            BannedFiles = []
        };

        var runner = new BenchmarkRunner(options.Iterations);

        var runResult = options.Scenarios switch
        {
            "legacy" => LegacyCacheScenarios.Run(runner, cartStorage, settings, options.DataDir),
            _ => throw new ArgumentException($"Unknown scenario set '{options.Scenarios}'. Supported: legacy.")
        };

        var report = BenchmarkReport.Build(options, runResult.Results, runResult.IndexFiles);

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
    string Scenarios)
{
    public const string Usage =
        "Usage: StorageBenchmark --data-dir <dir> --device <deviceId> [--storage sd|usb] " +
        "[--iterations 5] [--out <path.md>] [--scenarios legacy]";

    public static BenchmarkOptions Parse(string[] args)
    {
        string? dataDir = null;
        string? deviceId = null;
        var storage = TeensyStorageType.SD;
        var iterations = 5;
        string? outPath = null;
        var scenarios = "legacy";

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
                    scenarios = RequireValue(args, ref i, "--scenarios");
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

        return new BenchmarkOptions(dataDir, deviceId, storage, iterations, outPath, scenarios);
    }

    private static TeensyStorageType ParseStorage(string value) => value.ToLowerInvariant() switch
    {
        "sd" => TeensyStorageType.SD,
        "usb" => TeensyStorageType.USB,
        _ => throw new ArgumentException($"Unknown storage type '{value}'. Expected sd or usb.")
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
