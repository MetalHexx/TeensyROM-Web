using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// <c>trom file unfavorite &lt;PATHS&gt;...</c>: untags each favorite, found by its exact path.
/// </summary>
internal sealed class FileUnfavoriteCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IStdinPaths stdin) : FilePathsCommand<FilePathResultJson>(output, engine, chooser, devices, storage, settingsService, stdin)
{
    protected override async Task<FilePathResultJson> ProcessAsync(string path)
    {
        var file = await storage.GetFile(path) ?? throw new CliException(CliExitCode.NotFound, $"There is no file at {path}.");

        await storage.RemoveFavorite(file);

        return new FilePathResultJson(path, true, $"{file.Path} was untagged as a favorite.");
    }

    protected override FilePathResultJson Failure(string path, string message) => new(path, false, message);
}
