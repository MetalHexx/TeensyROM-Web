using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.Index;

internal sealed class IndexBuildSettings : DeviceSettings
{
    [Description("The storage to index: sd or usb. Defaults to every storage the device has available.")]
    [CommandOption("-s|--storage <STORAGE>")]
    public string? Storage { get; set; }

    [CommandArgument(0, "[PATH]")]
    [Description("The directory to index, with everything below it. Use - to read it from stdin.")]
    public string Path { get; set; } = "/";

    [CommandOption("--all")]
    [Description("Index every storage on every connected TeensyROM at once. Can't be combined with --device, --storage or a path.")]
    public bool All { get; set; }

    public override ValidationResult Validate()
    {
        if (All && (Device is not null || Storage is not null || Path != "/"))
        {
            return ValidationResult.Error("--all indexes every storage on every device, so it can't be combined with --device, --storage or a path.");
        }

        var path = FileCommandOptions.ValidatePath(Path);
        if (!path.Successful) return path;

        return Storage is null ? base.Validate() : Storage.ValidateStorageDevice();
    }
}

/// <summary>The JSON result of <c>trom index build</c>; <paramref name="AllDevices"/> is true for <c>--all</c>.</summary>
internal sealed record IndexBuildResult(IReadOnlyList<string> Storages, string Path, bool AllDevices = false);

/// <summary>
/// <c>trom index build [PATH]</c>: has tr-web index a directory so search and random launches can use it. With
/// <c>--storage</c> that storage is indexed; without it every storage the device reports as available is, one after the
/// other. With <c>--all</c> no device is chosen: tr-web indexes every storage on every connected device. tr-web's
/// indexing progress goes to stderr as it is logged.
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
    protected override bool NeedsDevice(IndexBuildSettings settings) => !settings.All;

    protected override async Task<int> RunAsync(CommandContext context, IndexBuildSettings settings, CancellationToken ct)
    {
        if (settings.All) return await IndexEveryDeviceAsync(ct);

        var path = FileCommandOptions.ReadPath(stdin, settings.Path);
        var storages = StoragesToIndex(settings, devices.SelectedDevice);

        await using var progress = await FollowIndexingAsync(token => deviceLog.FollowAsync(ShowIndexingLine, token), ct);

        foreach (var storageType in storages)
        {
            storage.UseStorage(storageType);
            await storage.Index(path);
        }

        MarkIndexed();

        var names = storages.Select(Name).ToList();

        if (Output.Mode == OutputMode.Json) Output.Json(new IndexBuildResult(names, path));
        else Output.Lines(names.Select(name => $"Indexed {name} storage from {path}."));

        return 0;
    }

    /// <exception cref="CliException"><see cref="CliExitCode.NoDevice"/> when tr-web finds no connected device.</exception>
    private async Task<int> IndexEveryDeviceAsync(CancellationToken ct)
    {
        await using var progress = await FollowIndexingAsync(
            token => deviceLog.FollowEveryDeviceAsync(ShowIndexingLine, token), ct);

        try
        {
            await storage.IndexAllAsync(ct);
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 404)
        {
            throw new CliException(CliExitCode.NoDevice, "No TeensyROM is online. Connect one, then run `trom device discover`.");
        }

        MarkIndexed();

        if (Output.Mode == OutputMode.Json) Output.Json(new IndexBuildResult(["sd", "usb"], "/") { AllDevices = true });
        else Output.Lines(["Indexed every storage on every connected TeensyROM."]);

        return 0;
    }

    private void MarkIndexed()
    {
        var saved = settingsService.GetSettings();
        saved.HasIndexed = true;
        settingsService.SaveSettings(saved);
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
    private async Task<IAsyncDisposable> FollowIndexingAsync(Func<CancellationToken, Task<IAsyncDisposable>> follow, CancellationToken ct)
    {
        try
        {
            return await follow(ct);
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

    private void ShowIndexingLine(string deviceId, string line)
    {
        if (line.Contains("Indexing", StringComparison.Ordinal)) Output.Notice($"{deviceId}: {line}");
    }

    private sealed class NoProgress : IAsyncDisposable
    {
        public static readonly NoProgress Instance = new();

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
