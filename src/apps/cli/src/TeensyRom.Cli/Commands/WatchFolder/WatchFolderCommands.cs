using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.WatchFolder;

/// <summary>A watched folder on this computer, as the verbs that name an existing watch folder take it.</summary>
internal sealed class WatchFolderSettings : TromSettings
{
    [CommandArgument(0, "<FOLDER>")]
    [Description("The watched folder on this computer, as `trom watch-folder list` shows it; a relative path is taken from the current folder.")]
    public string Folder { get; set; } = string.Empty;
}

internal sealed class WatchFolderAddSettings : StorageSettings
{
    internal const string DefaultDevicePath = "/auto-transfer";

    [CommandArgument(0, "<FOLDER>")]
    [Description("The folder on this computer to watch; a relative path is taken from the current folder.")]
    public string Folder { get; set; } = string.Empty;

    [CommandOption("--path <DEVICE_FOLDER>")]
    [Description("The folder on the TeensyROM the files land in.")]
    [DefaultValue(DefaultDevicePath)]
    public string Path { get; set; } = DefaultDevicePath;

    [CommandOption("--launch")]
    [Description("Have the TeensyROM launch each file that lands.")]
    public bool Launch { get; set; }

    public override ValidationResult Validate() =>
        Path.IsValidUnixPath() ? base.Validate() : ValidationResult.Error($"--path must be a valid unix path, such as {DefaultDevicePath}, not '{Path}'.");
}

internal sealed class WatchFolderRemoveSettings : DeviceSettings
{
    [CommandArgument(0, "<FOLDER>")]
    [Description("The watched folder on this computer, as `trom watch-folder list` shows it; a relative path is taken from the current folder.")]
    public string Folder { get; set; } = string.Empty;
}

internal sealed class WatchFolderSetSettings : DeviceSettings
{
    [CommandArgument(0, "<FOLDER>")]
    [Description("The watched folder on this computer, as `trom watch-folder list` shows it; a relative path is taken from the current folder.")]
    public string Folder { get; set; } = string.Empty;

    [CommandOption("--path <DEVICE_FOLDER>")]
    [Description("The folder on the TeensyROM the files land in from now on.")]
    public string? Path { get; set; }

    [CommandOption("--launch")]
    [Description("Have the TeensyROM launch each file that lands.")]
    public bool Launch { get; set; }

    [CommandOption("--no-launch")]
    [Description("Stop the TeensyROM launching each file that lands.")]
    public bool NoLaunch { get; set; }

    /// <summary>True, false, or null when neither launch flag was given.</summary>
    public bool? LaunchValue => Launch ? true : NoLaunch ? false : null;

    public override ValidationResult Validate()
    {
        if (Launch && NoLaunch) return ValidationResult.Error("Give --launch or --no-launch, not both.");
        if (Path is null && LaunchValue is null) return ValidationResult.Error("Give --path, --launch or --no-launch: there is nothing to change.");
        if (Path is not null && !Path.IsValidUnixPath()) return ValidationResult.Error($"--path must be a valid unix path, such as {WatchFolderAddSettings.DefaultDevicePath}, not '{Path}'.");

        return base.Validate();
    }
}

internal sealed class WatchFolderListSettings : TromSettings;

/// <summary>Resolves which of a watch folder's devices a verb means.</summary>
internal static class WatchFolderDevices
{
    /// <summary>The device by id or name; a device tr-web has forgotten is still matched by the id its destinations carry.</summary>
    public static async Task<string> ChooseAsync(IDeviceChooser chooser, string requested, WatchFolderDto folder, CancellationToken ct)
    {
        try
        {
            return (await chooser.ChooseAsync(requested, DeviceScope.Known, ct)).Id;
        }
        catch (CliException error) when (error.Code == CliExitCode.NotFound && folder.Destinations.FirstOrDefault(d => d.DeviceId == requested.Trim()) is not null)
        {
            return requested.Trim();
        }
    }
}

/// <summary>Resolves what a person typed to the full path tr-web knows the folder by.</summary>
internal static class WatchFolderPaths
{
    public static string Resolve(string folder) => Path.GetFullPath(folder, Environment.CurrentDirectory);
}

/// <summary>
/// <c>trom watch-folder add &lt;FOLDER&gt;</c>: watches a folder on this computer and sends what lands in it to the
/// chosen TeensyROM. Adding a folder that is already watched adds the device's destination to it.
/// </summary>
internal sealed class WatchFolderAddCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IWatchFolderService watchFolders) : DeviceCommand<WatchFolderAddSettings>(output, engine, chooser, devices, storage, settingsService)
{
    private string _folder = string.Empty;

    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the folder doesn't exist on this computer.</exception>
    protected override async Task PrepareAsync(WatchFolderAddSettings settings, CancellationToken ct)
    {
        _folder = WatchFolderPaths.Resolve(settings.Folder);

        if (!Directory.Exists(_folder)) throw new CliException(CliExitCode.Usage, $"{settings.Folder} isn't a folder on this computer.");

        await base.PrepareAsync(settings, ct);
    }

    protected override async Task<int> RunAsync(CommandContext context, WatchFolderAddSettings settings, CancellationToken ct)
    {
        var added = await watchFolders.AddAsync(_folder, devices.RequireDeviceId(), storage.StorageType, settings.Path, settings.Launch, ct);
        var folder = WatchFolderOutput.ToJson(added.WatchFolder);

        if (Output.Mode == OutputMode.Json) Output.Json(new WatchFolderAddJson(added.Created, folder));
        else WatchFolderOutput.Show(Output, folder);

        return 0;
    }
}

/// <summary>
/// <c>trom watch-folder remove &lt;FOLDER&gt;</c>: stops watching a folder; with <c>--device</c>, only stops sending its
/// files to that TeensyROM, and the folder goes with its last destination. Works for a TeensyROM tr-web no longer knows.
/// </summary>
internal sealed class WatchFolderRemoveCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IWatchFolderService watchFolders)
    : EngineCommand<WatchFolderRemoveSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, WatchFolderRemoveSettings settings, CancellationToken ct)
    {
        var folder = await watchFolders.FindAsync(WatchFolderPaths.Resolve(settings.Folder), ct);
        string? deviceId = null;
        var folderRemoved = true;

        if (string.IsNullOrWhiteSpace(settings.Device))
        {
            await watchFolders.RemoveAsync(folder.Id, ct);
        }
        else
        {
            deviceId = await WatchFolderDevices.ChooseAsync(chooser, settings.Device, folder, ct);
            folderRemoved = (await watchFolders.RemoveDeviceAsync(folder.Id, deviceId, ct)).FolderRemoved;
        }
        Show(folder.Path, deviceId, folderRemoved);

        return 0;
    }

    private void Show(string path, string? deviceId, bool folderRemoved)
    {
        if (Output.Mode == OutputMode.Json)
        {
            Output.Json(new WatchFolderRemoveJson(path, deviceId, folderRemoved));
            return;
        }
        Output.Notice(deviceId is null ? $"Stopped watching {path}." : folderRemoved ? $"Stopped watching {path}: {deviceId} was its last destination." : $"{path} no longer sends to {deviceId}.");
    }
}

/// <summary>
/// <c>trom watch-folder set &lt;FOLDER&gt;</c>: changes where a watched folder's files land on a TeensyROM, and whether the
/// TeensyROM launches them, without removing and re-adding the destination.
/// </summary>
internal sealed class WatchFolderSetCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IWatchFolderService watchFolders)
    : EngineCommand<WatchFolderSetSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, WatchFolderSetSettings settings, CancellationToken ct)
    {
        var folder = await watchFolders.FindAsync(WatchFolderPaths.Resolve(settings.Folder), ct);
        var deviceId = string.IsNullOrWhiteSpace(settings.Device)
            ? SoleDestination(folder)
            : await WatchFolderDevices.ChooseAsync(chooser, settings.Device, folder, ct);

        var updated = await watchFolders.SetDeviceAsync(folder.Id, deviceId, settings.Path, settings.LaunchValue, ct);

        WatchFolderOutput.Show(Output, WatchFolderOutput.ToJson(updated));

        return 0;
    }

    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the folder has no destination or several, so --device is needed.</exception>
    private static string SoleDestination(WatchFolderDto folder) => folder.Destinations.Count switch
    {
        1 => folder.Destinations.Single().DeviceId,
        0 => throw new CliException(CliExitCode.Usage, $"{folder.Path} has no destinations."),
        _ => throw new CliException(CliExitCode.Usage,
            $"{folder.Path} sends to several TeensyROMs ({string.Join(", ", folder.Destinations.Select(d => $"{d.DeviceName} ({d.DeviceId})"))}); name one with --device.")
    };
}

/// <summary><c>trom watch-folder list</c>: every watch folder, with where each one's files go. Needs no device.</summary>
internal sealed class WatchFolderListCommand(ICliOutput output, IEngineControl engine, IWatchFolderService watchFolders)
    : EngineCommand<WatchFolderListSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, WatchFolderListSettings settings, CancellationToken ct)
    {
        WatchFolderOutput.ShowList(Output, (await watchFolders.ListAsync(ct)).Select(WatchFolderOutput.ToJson).ToList());

        return 0;
    }
}

/// <summary>
/// <c>trom watch-folder pause &lt;FOLDER&gt;</c> stops sending a watched folder's files until <c>resume</c> turns it
/// back on; the folder stays on the list.
/// </summary>
internal sealed class WatchFolderEnabledCommand(ICliOutput output, IEngineControl engine, IWatchFolderService watchFolders)
    : EngineCommand<WatchFolderSettings>(output, engine)
{
    internal const string ResumeVerb = "resume";

    protected override async Task<int> RunAsync(CommandContext context, WatchFolderSettings settings, CancellationToken ct)
    {
        var folder = await watchFolders.FindAsync(WatchFolderPaths.Resolve(settings.Folder), ct);
        var updated = await watchFolders.SetEnabledAsync(folder.Id, context.Name == ResumeVerb, ct);

        WatchFolderOutput.Show(Output, WatchFolderOutput.ToJson(updated));

        return 0;
    }
}
