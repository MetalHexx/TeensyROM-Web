using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileLaunchOneShotSettings : FileLaunchingSettings
{
    [CommandArgument(0, "<PATH>")]
    [Description("The file to launch. Use - to read it from stdin.")]
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// A path that isn't a valid unix path is, when it names a file on this computer, a mistake worth explaining: the
    /// user means <c>file upload --launch</c>.
    /// </summary>
    public override ValidationResult Validate()
    {
        var path = FileCommandOptions.ValidatePath(Path);

        if (path.Successful) return base.Validate();

        return IsLocalFile(Path) ? ValidationResult.Error(LocalFileHint(Path)) : path;
    }

    /// <summary>Whether <paramref name="path"/> is a file on this computer.</summary>
    internal static bool IsLocalFile(string path) => System.IO.File.Exists(path);

    /// <summary>What to tell someone who gave <c>file launch</c> a file that lives on this computer.</summary>
    internal static string LocalFileHint(string path) =>
        $"{path} is a file on this computer, not on the TeensyROM — use `trom file upload --launch {path} --to <device folder>`.";
}

/// <summary>
/// <c>trom file launch &lt;PATH&gt;</c>: launches one file and returns the prompt, leaving the player's record so that
/// <c>file next</c> carries on from it. With <c>--player</c> the player opens on it. The file is the one at exactly that
/// path: a neighbour whose path merely contains it is never launched instead. A path that names a file on this computer,
/// not on the TeensyROM, is answered with a hint toward <c>file upload --launch</c>.
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
        var item = await FindAsync(path)
            ?? throw new CliException(CliExitCode.NotFound, FileLaunchOneShotSettings.IsLocalFile(path)
                ? FileLaunchOneShotSettings.LocalFileHint(path)
                : $"There is no launchable file at {path}.");

        Player.UseStorage(storage.StorageType);

        if (playerCommand is null)
        {
            return Report(await Player.LaunchOnceAsync(item), storage.StorageType, $"{path} wasn't found.");
        }

        Player.SetDirectoryMode(path);

        var played = await Player.LaunchItem(item);

        ThrowWhenBusy();

        if (!played) throw new CliException(CliExitCode.Failed, $"Couldn't play {path}.");

        return ShowPlayer(context, playerCommand);
    }

    /// <summary>
    /// The file at <paramref name="path"/>, or null when there is none. A missing parent folder on the device answers 404
    /// rather than null; that too means a local file was named, and not a device one, when such a file exists here.
    /// </summary>
    private async Task<ILaunchableItem?> FindAsync(string path)
    {
        try
        {
            return await storage.GetFile(path);
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 404 && FileLaunchOneShotSettings.IsLocalFile(path))
        {
            return null;
        }
    }
}
