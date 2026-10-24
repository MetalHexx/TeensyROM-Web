using Spectre.Console.Cli;
using System.Text.Json.Nodes;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>The options of a <c>file</c> playback command. There is no storage option: it comes from what the device last launched.</summary>
internal sealed class FilePlaybackSettings : DeviceSettings { }

/// <summary>
/// The JSON result of <c>trom file pause</c> and <c>trom file stop</c>. <c>action</c> is <c>paused</c>, <c>resumed</c>,
/// <c>stopped</c>, <c>relaunched</c> or <c>toggled</c>; <c>reason</c> and <c>file</c> are left out when there is none.
/// <c>file</c> is the full record, see <see cref="FileItemJson.Full"/>.
/// </summary>
internal sealed record PlaybackJson(string Action, string? Reason, JsonObject? File);

/// <summary>
/// A <c>file</c> command that carries on from the file the selected TeensyROM last launched, whether that was in this
/// process or an earlier one, through <see cref="IPlayerService"/>.
/// </summary>
internal abstract class FilePlaybackCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : DeviceCommand<FilePlaybackSettings>(output, engine, chooser, devices, storage, settingsService)
{
    protected IPlayerService Player { get; } = player;

    /// <summary>The selected device's name, for sentences about it.</summary>
    protected string DeviceName => devices.SelectedDevice?.Name ?? "the TeensyROM";

    /// <summary>Writes what was done: the JSON document, the sentence on a terminal, or just the action word when redirected.</summary>
    protected void Write(string action, string? reason, ILaunchableItem? item, string sentence)
    {
        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(new PlaybackJson(action, reason, item is null ? null : FileItemJson.Full(item, Player.GetState().StorageType)));
                break;
            case OutputMode.Plain:
                Output.Lines([action]);
                break;
            default:
                Output.Lines([sentence]);
                break;
        }
    }
}

/// <summary>
/// Launches the file before or after the one last launched. Without anything to carry on from it fails, and says how to start.
/// </summary>
internal abstract class FileStepCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : FilePlaybackCommand(output, engine, chooser, devices, storage, settingsService, player)
{
    /// <summary>What to say when tr-web didn't say why the file wasn't found.</summary>
    protected abstract string NotFoundMessage { get; }

    protected abstract Task<LaunchOutcome?> StepAsync();

    protected sealed override async Task<int> RunAsync(CommandContext context, FilePlaybackSettings settings, CancellationToken ct)
    {
        if (Player.GetState().CurrentItem is null) throw NothingToCarryOnFrom();

        var outcome = await StepAsync() ?? throw NothingToCarryOnFrom();

        return new LaunchReport(Output).Report(outcome, Player.GetState().StorageType, NotFoundMessage);
    }

    private CliException NothingToCarryOnFrom() =>
        new(CliExitCode.Failed, $"There's nothing to carry on from on {DeviceName} yet — start with `trom file launch <path>` or `trom file random`.");
}

/// <summary><c>trom file next</c>: launches the file after the one last launched on the TeensyROM.</summary>
internal sealed class FileNextCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : FileStepCommand(output, engine, chooser, devices, storage, settingsService, player)
{
    protected override string NotFoundMessage => "The next file wasn't found.";

    protected override Task<LaunchOutcome?> StepAsync() => Player.NextAsync();
}

/// <summary><c>trom file previous</c>: launches the file before the one last launched on the TeensyROM.</summary>
internal sealed class FilePreviousCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : FileStepCommand(output, engine, chooser, devices, storage, settingsService, player)
{
    protected override string NotFoundMessage => "The previous file wasn't found.";

    protected override Task<LaunchOutcome?> StepAsync() => Player.PreviousAsync();
}

/// <summary>
/// <c>trom file pause</c>: pauses or resumes the song playing; stops anything that can't be paused; launches again what was stopped.
/// </summary>
internal sealed class FilePauseCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : FilePlaybackCommand(output, engine, chooser, devices, storage, settingsService, player)
{
    protected override async Task<int> RunAsync(CommandContext context, FilePlaybackSettings settings, CancellationToken ct)
    {
        var result = await Player.ToggleAsync();
        var failure = result.Relaunch is { } relaunch ? LaunchReport.Failure(relaunch, $"{result.Item?.Name ?? "The file"} wasn't found.") : null;
        var action = result.Action.ToString().ToLowerInvariant();

        // A relaunch that failed has nothing to say on stdout but its JSON document: the error on stderr is the human message.
        if (failure is null || Output.Mode == OutputMode.Json)
        {
            Write(action, result.Reason, result.Item, Sentence(result));
        }
        return failure is null ? 0 : throw failure;
    }

    private string Sentence(PlayToggleResult result)
    {
        var name = result.Item?.Name ?? DeviceName;

        return result.Action switch
        {
            PlayToggleAction.Paused => $"Paused {name}.",
            PlayToggleAction.Resumed => $"Resumed {name}.",
            PlayToggleAction.Stopped => result.Reason is null ? $"Stopped {name}." : $"Stopped {name} — {result.Reason}.",
            PlayToggleAction.Relaunched => $"Launched {name} again.",
            _ => $"Toggled the music on {DeviceName}."
        };
    }
}

/// <summary><c>trom file stop</c>: stops whatever is running by resetting the TeensyROM.</summary>
internal sealed class FileStopCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player) : FilePlaybackCommand(output, engine, chooser, devices, storage, settingsService, player)
{
    protected override async Task<int> RunAsync(CommandContext context, FilePlaybackSettings settings, CancellationToken ct)
    {
        var stopped = await Player.StopAsync();

        Write("stopped", null, stopped, $"Stopped {stopped?.Name ?? DeviceName}.");

        return 0;
    }
}
