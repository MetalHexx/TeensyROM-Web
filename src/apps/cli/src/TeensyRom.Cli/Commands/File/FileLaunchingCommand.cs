using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>A <c>file</c> command that launches on the device and can then open the player on what it launched.</summary>
internal class FileLaunchingSettings : StorageSettings
{
    [CommandOption("--player")]
    [Description("Open the player on what was launched. Needs a terminal.")]
    public bool Player { get; set; }
}

/// <summary>
/// Launches through <see cref="IPlayerService"/>, so the launch is recorded for <c>file next</c> and the like, and prints
/// what launched. With <c>--player</c> the launch goes through the menu's side of the player instead, which is then opened
/// on the same terminal and left with exit code 0.
/// </summary>
internal abstract class FileLaunchingCommand<T>(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player,
    ITypeResolver resolver) : DeviceCommand<T>(output, engine, chooser, devices, storage, settingsService)
    where T : FileLaunchingSettings
{
    protected IPlayerService Player { get; } = player;

    /// <summary>Refuses <c>--player</c> before the engine starts or anything launches when the player couldn't be used.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when there is no terminal to open the player on, or the output is JSON.</exception>
    protected override async Task PrepareAsync(T settings, CancellationToken ct)
    {
        if (settings.Player)
        {
            if (settings.Json) throw new CliException(CliExitCode.Usage, "--player can't be combined with --json: the player would follow the JSON on stdout.");

            if (!Output.CanPrompt) throw new CliException(CliExitCode.Usage, "--player needs an interactive terminal.");
        }
        await base.PrepareAsync(settings, ct);
    }

    /// <summary>
    /// Resolves the player command and points Spectre's console at stdout, where the player draws. The command has to
    /// exist before anything launches: it subscribes to the launches in its constructor and nothing replays them.
    /// </summary>
    protected PlayerCommand OpenPlayer()
    {
        var playerCommand = resolver.Resolve(typeof(PlayerCommand)) as PlayerCommand
            ?? throw new InvalidOperationException("The player command isn't registered.");

        AnsiConsole.Console = Output.Out;
        Player.AnnounceBusyRefusals = false;

        return playerCommand;
    }

    /// <summary>Shows the player until the user leaves it.</summary>
    protected int ShowPlayer(CommandContext context, PlayerCommand playerCommand)
    {
        Player.AnnounceBusyRefusals = true;
        playerCommand.Execute(context, new PlayerSettings());

        return 0;
    }

    /// <summary>Ends the command with <see cref="CliExitCode.DeviceBusy"/> when the player's latest launch was refused as busy.</summary>
    /// <exception cref="CliException">The device is busy with a transfer.</exception>
    protected void ThrowWhenBusy()
    {
        if (Player.LastBusyRefusal is { } refusal) throw new CliException(CliExitCode.DeviceBusy, refusal.Message);
    }

    /// <summary>
    /// Prints the file a launch picked or was given and turns every outcome but a launch into the exit code it deserves.
    /// An incompatible file is still printed: the caller can read what was picked.
    /// </summary>
    /// <param name="notFoundMessage">What to say when tr-web didn't say why it found nothing.</param>
    /// <exception cref="CliException">The file didn't launch.</exception>
    protected int Report(LaunchOutcome outcome, TeensyStorageType storageType, string notFoundMessage) =>
        new LaunchReport(Output).Report(outcome, storageType, notFoundMessage);
}
