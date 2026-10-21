using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;
using TeensyFilterType = TeensyRom.Cli.Settings.TeensyFilterType;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Services;

internal sealed class StorageService(ITeensyRomApiClient api, IDeviceService devices, ISettingsService settingsService, IAlertService alert) : IStorageService
{
    // The most tr-web's search validator accepts. It ranks both storages together, so a search keeps paging until
    // tr-web has no more and only then drops the other storage's files.
    private const int SearchPageSize = 1000;

    // tr-web answers 404 for any directory read that fails, including a read over a stale link to the device, which the
    // next attempt re-establishes. A path that is really missing fails every attempt.
    private const int DirectoryAttempts = 3;

    private static readonly string[] DirectoryFailureCauses =
    [
        "The directory does not exist on this storage.",
        "The device did not answer: its connection may have gone stale, or it may be busy or powered off."
    ];

    public TeensyStorageType StorageType { get; private set; } = settingsService.GetSettings().StorageType;

    public void SwitchStorage(TeensyStorageType storageType)
    {
        StorageType = storageType;

        var settings = settingsService.GetSettings();
        settings.StorageType = storageType;
        settingsService.SaveSettings(settings);
    }

    public void UseStorage(TeensyStorageType storageType) => StorageType = storageType;

    public async Task<DirectoryListing> GetDirectory(string path)
    {
        var deviceId = devices.RequireDeviceId();
        var storage = StorageType.ToApi();

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var response = await ApiErrors.Call(() => api.GetDirectoryAsync(deviceId, storage, path));
                return ApiMapper.ToListing(response.StorageItem);
            }
            catch (TeensyApiException ex) when (ex.StatusCode == 404)
            {
                if (attempt < DirectoryAttempts) continue;

                // Only tr-web's directory 404 can be a failed read; "storage not available" and "device not found" are answers.
                if (!ex.Message.StartsWith("The directory ", StringComparison.Ordinal)) throw;

                var device = devices.SelectedDevice?.Name ?? deviceId;

                throw new TeensyApiException(
                    $"The directory {path} was not found, or {device} did not answer, after {attempt} attempts — check the path with `trom file ls`, or the device with `trom device ping`.",
                    ex.StatusCode,
                    ex,
                    new ErrorDetails(path, device, attempt, DirectoryFailureCauses));
            }
        }
    }

    public async Task<ILaunchableItem?> GetFile(string path)
    {
        var directory = await GetDirectory(path.GetUnixParentPath());

        return directory.Files
            .OfType<ILaunchableItem>()
            .FirstOrDefault(file => file.Path.Equals(path, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IReadOnlyList<ILaunchableItem>> Search(string query, TeensyFilterType filter)
    {
        var deviceId = devices.RequireDeviceId();
        var storage = StorageType.ToApi();

        var apiFilter = filter.ToApi();

        var files = new List<FileItemDto>();
        var skip = 0;
        bool hasMore;
        do
        {
            var pageStart = skip;
            var response = await ApiErrors.Call(() => api.SearchAsync(deviceId, query, pageStart, SearchPageSize, apiFilter));

            files.AddRange(response.Files.Where(file => file.StorageType == storage));
            hasMore = response.HasMore;
            skip += SearchPageSize;
        }
        while (hasMore);

        return files
            .Select(ApiMapper.ToLaunchable)
            .OfType<ILaunchableItem>()
            .ToList();
    }

    public async Task Index(string path)
    {
        var deviceId = devices.RequireDeviceId();
        var storage = StorageType.ToApi();
        string? startingPath = path is "" or "/" ? null : path;

        await ApiErrors.Call(() => api.IndexAsync(deviceId, storage, startingPath));
    }

    public async Task SaveFavorite(ILaunchableItem item)
    {
        var deviceId = devices.RequireDeviceId();
        var storage = StorageType.ToApi();

        var response = await ApiErrors.Call(() => api.SaveFavoriteAsync(deviceId, storage, item.Path));

        item.IsFavorite = true;
        alert.Publish($"{item.Name} has been tagged as a favorite.");
        alert.Publish($"A copy was placed in {response.FavoritePath}.");
    }

    public async Task RemoveFavorite(ILaunchableItem item)
    {
        var deviceId = devices.RequireDeviceId();
        var storage = StorageType.ToApi();

        await ApiErrors.Call(() => api.RemoveFavoriteAsync(deviceId, storage, item.Path));

        item.IsFavorite = false;
        alert.Publish($"{item.Path} was untagged as a favorite.");
    }

    public async Task<BanResult> BanFile(string path, TeensyStorageType storage)
    {
        var deviceId = devices.RequireDeviceId();
        var apiStorage = storage.ToApi();

        var response = await ApiErrors.Call(() => api.BanFileAsync(deviceId, apiStorage, path));

        alert.Publish(response.Message);
        return new BanResult(response.BannedFileName, response.AlreadyBanned, response.Message);
    }
}
