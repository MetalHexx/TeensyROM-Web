namespace TeensyRom.Tools.IndexExtractor;

/// <summary>
/// Parsed command-line options for an extraction run.
/// </summary>
sealed record ExtractorOptions(string InputPath, string OutputPath, string DeviceId, string StorageType)
{
    public const string Usage =
        "Usage: IndexExtractor --input <path-to-Sd-XXXX.json> --output <path.tsv> [--device <id>] [--storage sd|usb]";

    public static ExtractorOptions Parse(string[] args)
    {
        string? inputPath = null;
        string? outputPath = null;
        string? deviceId = null;
        string? storageType = null;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--input":
                    inputPath = RequireValue(args, ref i, "--input");
                    break;
                case "--output":
                    outputPath = RequireValue(args, ref i, "--output");
                    break;
                case "--device":
                    deviceId = RequireValue(args, ref i, "--device");
                    break;
                case "--storage":
                    storageType = ParseStorage(RequireValue(args, ref i, "--storage"));
                    break;
                default:
                    throw new ArgumentException($"Unrecognized argument '{args[i]}'.");
            }
        }

        if (string.IsNullOrWhiteSpace(inputPath))
        {
            throw new ArgumentException("--input is required.");
        }

        if (string.IsNullOrWhiteSpace(outputPath))
        {
            throw new ArgumentException("--output is required.");
        }

        var (derivedDeviceId, derivedStorageType) = DeriveFromFileName(Path.GetFileName(inputPath));

        deviceId ??= derivedDeviceId
            ?? throw new ArgumentException($"Could not derive --device from '{Path.GetFileName(inputPath)}'; pass it explicitly.");
        storageType ??= derivedStorageType ?? "sd";

        return new ExtractorOptions(inputPath, outputPath, deviceId, storageType);
    }

    private static string ParseStorage(string value) => value.ToLowerInvariant() switch
    {
        "sd" => "sd",
        "usb" => "usb",
        _ => throw new ArgumentException($"Unknown storage type '{value}'. Expected sd or usb.")
    };

    // "Sd-YRTCPIRY.json" -> ("YRTCPIRY", "sd")
    private static (string? DeviceId, string? StorageType) DeriveFromFileName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName);
        var dash = name.IndexOf('-');

        if (dash <= 0 || dash == name.Length - 1)
        {
            return (null, null);
        }

        return (name[(dash + 1)..], name[..dash].ToLowerInvariant());
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
