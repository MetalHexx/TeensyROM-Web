using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Services;

internal sealed class WatchFolderService(ITeensyRomApiClient api) : IWatchFolderService
{
    public async Task<IReadOnlyList<WatchFolderDto>> ListAsync(CancellationToken ct) =>
        (await ApiErrors.Call(() => api.GetWatchFoldersAsync(ct))).WatchFolders.ToList();

    public Task<AddWatchFolderResponse> AddAsync(string folder, string deviceId, TeensyStorageType storage, string? devicePath, bool launch, CancellationToken ct)
    {
        var body = new AddWatchFolderBody { Path = folder, DeviceId = deviceId, StorageType = storage.ToApi(), DevicePath = devicePath, Launch = launch };

        return ApiErrors.Call(() => api.AddWatchFolderAsync(body, ct));
    }

    public async Task RemoveAsync(string watchFolderId, CancellationToken ct) =>
        await ApiErrors.Call(() => api.RemoveWatchFolderAsync(watchFolderId, ct));

    public Task<RemoveWatchFolderDeviceResponse> RemoveDeviceAsync(string watchFolderId, string deviceId, CancellationToken ct) =>
        ApiErrors.Call(() => api.RemoveWatchFolderDeviceAsync(watchFolderId, deviceId, ct));

    public async Task<WatchFolderDto> SetEnabledAsync(string watchFolderId, bool enabled, CancellationToken ct) =>
        (await ApiErrors.Call(() => api.SetWatchFolderEnabledAsync(watchFolderId, new SetWatchFolderEnabledBody { Enabled = enabled }, ct))).WatchFolder;

    public async Task<WatchFolderDto> FindAsync(string folder, CancellationToken ct)
    {
        var wanted = Normalize(folder);

        return (await ListAsync(ct)).FirstOrDefault(watched => string.Equals(Normalize(watched.Path), wanted, PathComparison))
            ?? throw new CliException(CliExitCode.NotFound, $"{folder} isn't a watch folder.");
    }

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private static string Normalize(string path)
    {
        var full = Path.GetFullPath(path);
        var root = Path.GetPathRoot(full);

        return full == root ? full : full.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }
}
