using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Files.BanFile
{
    public class BanFileEndpoint(IDeviceConnectionManager deviceManager, ISettingsService settingsService)
        : RadEndpoint<BanFileRequest, BanFileResponse>
    {
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/storage/{storageType}/ban")
                .Produces<BanFileResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("BanFile")
                .WithSummary("Ban File")
                .WithDescription("Adds a file's name to the banned files list so it is hidden from listings and search. Banning an already banned file changes nothing.")
                .WithTags("Files");
        }

        public override async Task Handle(BanFileRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId);

            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return;
            }

            IStorageService storage = null!;

            if (r.StorageType is TeensyStorageType.SD)
            {
                if (!device.Cart.SdStorage.Available)
                {
                    SendNotFound($"The device {r.DeviceId} does not have an SD card.");
                    return;
                }
                storage = device.SdStorage;
            }
            else if (r.StorageType is TeensyStorageType.USB)
            {
                if (!device.Cart.UsbStorage.Available)
                {
                    SendNotFound($"The device {r.DeviceId} does not have USB storage.");
                    return;
                }
                storage = device.UsbStorage;
            }

            var filePath = new FilePath(r.FilePath);
            var settings = settingsService.GetSettings();

            // Banned files are hidden from storage lookups, so the ban list must be checked before GetFile.
            if (BanMatcher.IsBannedFile(filePath.FileName, settings.SearchSettings.BannedFiles))
            {
                Response = new()
                {
                    Message = $"The file {filePath.FileName} is already banned.",
                    BannedFileName = filePath.FileName,
                    AlreadyBanned = true
                };
                Send();
                return;
            }

            var file = await storage.GetFile(filePath);

            if (file is null)
            {
                SendNotFound($"The file {r.FilePath} was not found.");
                return;
            }

            // The lookup above awaited, so the settings read before it may be stale: check and add against the latest
            // settings, in one step, so overlapping bans and settings saves are never lost.
            var added = false;
            var saved = settingsService.UpdateSettings(latest =>
            {
                if (BanMatcher.IsBannedFile(file.Name, latest.SearchSettings.BannedFiles)) return latest;

                added = true;
                return latest with
                {
                    SearchSettings = latest.SearchSettings with
                    {
                        BannedFiles = [.. latest.SearchSettings.BannedFiles, file.Name]
                    }
                };
            });

            if (!saved)
            {
                SendExternalError("Failed to save settings to disk. Please check file permissions and try again.");
                return;
            }

            Response = new()
            {
                Message = added ? $"The file {file.Name} was banned." : $"The file {file.Name} is already banned.",
                BannedFileName = file.Name,
                AlreadyBanned = !added
            };
            Send();
        }
    }
}
