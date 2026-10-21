using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// <c>trom file favorite &lt;PATHS&gt;...</c>: tags each file, found by its exact path, as a favorite.
/// </summary>
internal sealed class FileFavoriteCommand(
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

        await storage.SaveFavorite(file);

        return new FilePathResultJson(path, true, $"{file.Name} was tagged as a favorite.");
    }

    protected override FilePathResultJson Failure(string path, string message) => new(path, false, message);
}
