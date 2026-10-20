using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.Index;

internal sealed class IndexBuildSettings : StorageSettings
{
    [CommandArgument(0, "[PATH]")]
    [Description("The directory to index, with everything below it. Use - to read it from stdin.")]
    public string Path { get; set; } = "/";

    public override ValidationResult Validate() =>
        Path != StdinPaths.Marker && !Path.IsValidUnixPath() ? ValidationResult.Error("The path must be a valid unix path, such as /music.") : base.Validate();
}

/// <summary>The JSON result of <c>trom index build</c>.</summary>
internal sealed record IndexBuildResult(IReadOnlyList<string> Storages, string Path);

/// <summary>
/// <c>trom index build [PATH]</c>: has tr-web index a directory so search and random launches can use it. With
/// <c>--storage</c> that storage is indexed; without it every storage the device reports as available is, one after the
/// other. tr-web's indexing progress goes to stderr as it is logged.
/// </summary>
internal sealed class IndexBuildCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IDeviceLogStream deviceLog,
    IStdinPaths stdin) : DeviceCommand<IndexBuildSettings>(output, engine, chooser, devices, storage, settingsService)
{
    protected override async Task<int> RunAsync(CommandContext context, IndexBuildSettings settings, CancellationToken ct)
    {
        var path = stdin.ExpandOne(settings.Path);
        var storages = StoragesToIndex(settings, devices.SelectedDevice);

        await using var progress = await FollowIndexingAsync(ct);

        foreach (var storageType in storages)
        {
            storage.UseStorage(storageType);
            await storage.Index(path);
        }

        var saved = settingsService.GetSettings();
        saved.HasIndexed = true;
        settingsService.SaveSettings(saved);

        var names = storages.Select(Name).ToList();

        if (Output.Mode == OutputMode.Json) Output.Json(new IndexBuildResult(names, path));
        else Output.Lines(names.Select(name => $"Indexed {name} storage from {path}."));

        return 0;
    }

    private static List<TeensyStorageType> StoragesToIndex(IndexBuildSettings settings, DeviceSummary? device)
    {
        if (!string.IsNullOrWhiteSpace(settings.Storage))
        {
            return [settings.Storage.Equals("usb", StringComparison.OrdinalIgnoreCase) ? TeensyStorageType.USB : TeensyStorageType.SD];
        }

        var available = new List<TeensyStorageType>();
        if (device?.SdAvailable == true) available.Add(TeensyStorageType.SD);
        if (device?.UsbAvailable == true) available.Add(TeensyStorageType.USB);

        return available.Count > 0
            ? available
            : throw new CliException(CliExitCode.NotFound, $"{device?.Name ?? "The TeensyROM"} has no SD card or USB storage available.");
    }

    private static string Name(TeensyStorageType storageType) => storageType == TeensyStorageType.USB ? "usb" : "sd";

    /// <summary>
    /// Shows tr-web's indexing lines on stderr while indexing runs. When the log can't be followed it says so and
    /// returns a handle that does nothing: indexing still runs.
    /// </summary>
    private async Task<IAsyncDisposable> FollowIndexingAsync(CancellationToken ct)
    {
        try
        {
            return await deviceLog.FollowAsync(ShowIndexingLine, ct);
        }
        catch (TeensyApiException ex)
        {
            Output.Notice($"Indexing will run without showing its progress. {ex.Message}");
            return NoProgress.Instance;
        }
    }

    private void ShowIndexingLine(string line)
    {
        if (line.Contains("Indexing", StringComparison.Ordinal)) Output.Notice(line);
    }

    private sealed class NoProgress : IAsyncDisposable
    {
        public static readonly NoProgress Instance = new();

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
