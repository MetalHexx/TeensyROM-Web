using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// <c>trom file ban &lt;PATHS&gt;...</c>: bans each file. The files are never looked up first: banned files are invisible
/// to listings, so banning one again must report it as already banned, not as missing.
/// </summary>
internal sealed class FileBanCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IStdinPaths stdin) : FilePathsCommand<FileBanResultJson>(output, engine, chooser, devices, storage, settingsService, stdin)
{
    protected override async Task<FileBanResultJson> ProcessAsync(string path)
    {
        var banned = await storage.BanFile(path, storage.StorageType);

        return new FileBanResultJson(path, true, banned.Message, banned.BannedFileName, banned.AlreadyBanned);
    }

    protected override FileBanResultJson Failure(string path, string message) => new(path, false, message, string.Empty, false);
}
