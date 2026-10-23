using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileLaunchOneShotSettings : FileLaunchingSettings
{
    [CommandArgument(0, "<PATH>")]
    [Description("The file to launch. Use - to read it from stdin.")]
    public string Path { get; set; } = string.Empty;

    public override ValidationResult Validate()
    {
        var path = FileCommandOptions.ValidatePath(Path);

        return path.Successful ? base.Validate() : path;
    }
}

/// <summary>
/// <c>trom file launch &lt;PATH&gt;</c>: launches one file and returns the prompt, leaving the player's record so that
/// <c>file next</c> carries on from it. With <c>--player</c> the player opens on it. The file is the one at exactly that
/// path: a neighbour whose path merely contains it is never launched instead.
/// </summary>
internal sealed class FileLaunchOneShotCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player,
    ITypeResolver resolver,
    IStdinPaths stdin) : FileLaunchingCommand<FileLaunchOneShotSettings>(output, engine, chooser, devices, storage, settingsService, player, resolver)
{
    protected override async Task<int> RunAsync(CommandContext context, FileLaunchOneShotSettings settings, CancellationToken ct)
    {
        var playerCommand = settings.Player ? OpenPlayer() : null;

        var path = FileCommandOptions.ReadPath(stdin, settings.Path);
        var item = await storage.GetFile(path)
            ?? throw new CliException(CliExitCode.NotFound, $"There is no launchable file at {path}.");

        Player.UseStorage(storage.StorageType);

        if (playerCommand is null)
        {
            return Report(await Player.LaunchOnceAsync(item), storage.StorageType, $"{path} wasn't found.");
        }

        Player.SetDirectoryMode(path);

        if (!await Player.LaunchItem(item)) throw new CliException(CliExitCode.Failed, $"Couldn't play {path}.");

        return ShowPlayer(context, playerCommand);
    }
}
