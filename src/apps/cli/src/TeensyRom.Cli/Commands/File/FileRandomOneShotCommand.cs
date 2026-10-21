using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileRandomOneShotSettings : FileLaunchingSettings
{
    [CommandOption("-f|--filter <FILTER>")]
    [Description("Pick only these files: all, games, music, images or hex. Defaults to all.")]
    public string? Filter { get; set; }

    [CommandOption("--scope <SCOPE>")]
    [Description("Where to pick from: storage, dir-deep or dir-shallow. Defaults to dir-deep.")]
    public string? Scope { get; set; }

    [CommandOption("--directory <DIR>")]
    [Description("The directory to pick from. Defaults to the root of the storage. Use - to read it from stdin.")]
    public string? Directory { get; set; }

    [CommandOption("-t|--timer <TIMER>")]
    [Description("With --player: how long each file plays: none, 5s, 15s, 30s, 1m, 3m, 5m, 15m, 30m or 1h. Defaults to none.")]
    public string? Timer { get; set; }

    [CommandOption("--override")]
    [Description("With --player: let --timer end SIDs too, rather than their song length.")]
    public bool Override { get; set; }

    public override ValidationResult Validate()
    {
        var options = FileCommandOptions.Check(() =>
        {
            FileCommandOptions.ParseFilter(Filter);
            FileCommandOptions.ParseScope(Scope);
            FileCommandOptions.ParseTimer(Timer);
        });
        if (!options.Successful) return options;

        if (!Player && Timer is not null) return ValidationResult.Error("--timer only works with --player.");

        if (!Player && Override) return ValidationResult.Error("--override only works with --player.");

        if (Player && FileCommandOptions.ParseScope(Scope) != StorageScope.DirDeep)
        {
            return ValidationResult.Error("--scope can't be changed with --player: the player always picks from the directory and everything below it.");
        }
        var directory = Directory is null ? ValidationResult.Success() : FileCommandOptions.ValidatePath(Directory);

        return directory.Successful ? base.Validate() : directory;
    }
}

/// <summary>
/// <c>trom file random</c>: has tr-web pick a random file and launch it, then returns the prompt. With <c>--player</c>
/// the player picks and opens on it, so it can carry on to the next one by itself with a timer.
/// </summary>
internal sealed class FileRandomOneShotCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    ILaunchService launchService,
    IPlayerService player,
    ITypeResolver resolver,
    IStdinPaths stdin) : FileLaunchingCommand<FileRandomOneShotSettings>(output, engine, chooser, devices, storage, settingsService, launchService, player, resolver)
{
    protected override async Task<int> RunAsync(CommandContext context, FileRandomOneShotSettings settings, CancellationToken ct)
    {
        var playerCommand = settings.Player ? OpenPlayer() : null;

        var filter = FileCommandOptions.ParseFilter(settings.Filter);
        var directory = settings.Directory is null ? "/" : FileCommandOptions.ReadPath(stdin, settings.Directory);

        if (playerCommand is null)
        {
            var outcome = await Launches.LaunchRandom(storage.StorageType, FileCommandOptions.ParseScope(settings.Scope), directory, filter);

            NoticeWhenIndexIncomplete();

            return Report(outcome, storage.StorageType, LaunchOutcome.NoFilesFoundMessage);
        }

        Player.UseStorage(storage.StorageType);
        Player.SetDirectoryScope(directory);
        Player.SetFilter(filter);
        Player.SetStreamTime(FileCommandOptions.ParseTimer(settings.Timer));
        Player.SetSidTimer(settings.Override ? SidTimer.TimerOverride : SidTimer.SongLength);

        await Player.PlayRandom();

        NoticeWhenIndexIncomplete();

        var state = Player.GetState();

        if (state.CurrentItem is null) throw new CliException(CliExitCode.NotFound, LaunchOutcome.NoFilesFoundMessage);

        if (!Player.IsPlaying()) throw new CliException(CliExitCode.Failed, "Couldn't play a random file.");

        return ShowPlayer(context, playerCommand);
    }
}
