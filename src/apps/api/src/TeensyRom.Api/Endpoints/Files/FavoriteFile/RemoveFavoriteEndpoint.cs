using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Endpoints.Files.FavoriteFile;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Files.FavoriteFile
{
    public class RemoveFavoriteEndpoint(IDeviceConnectionManager deviceManager, IDeviceTransferLease lease) : RadEndpoint<RemoveFavoriteRequest, RemoveFavoriteResponse>
    {
        public override void Configure()
        {
            Delete("/api/devices/{deviceId}/storage/{storageType}/favorite")
                .Produces<RemoveFavoriteResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("RemoveFavorite")
                .WithSummary("Remove Favorite")
                .WithDescription(
                    "Removes a file from favorites, deleting the favorite copy and updating the original file's favorite status.\n\n" +
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer."
                )
                .WithTags("Files");
        }

        public override async Task Handle(RemoveFavoriteRequest r, CancellationToken ct)
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

            var lookup = await storage.LookupFile(new FilePath(r.FilePath));

            if (lookup.Failure is not null)
            {
                if (DeviceBusyProblem.For(lease, r.DeviceId, device.Cart.Name) is { } busy)
                {
                    SendProblem(busy);
                    return;
                }
                SendExternalError(lookup.Failure);
                return;
            }

            var file = lookup.File;

            if (file is null)
            {
                SendNotFound($"The file {r.FilePath} was not found.");
                return;
            }

            if (file is not LaunchableItem launchItem)
            {
                SendValidationError($"The file {r.FilePath} is not a valid file type for unfavoriting.");
                return;
            }

            var success = await storage.RemoveFavorite(launchItem, r.StorageType, ct);

            if (!success)
            {
                if (DeviceBusyProblem.For(lease, r.DeviceId, device.Cart.Name) is { } busy)
                {
                    SendProblem(busy);
                    return;
                }
                SendExternalError("Failed to remove favorite. Please try again.");
                return;
            }

            var favPath = StorageHelper.GetFavoritePath(launchItem.FileType);

            Response = new()
            {
                Message = $"Favorite untagged and removed from {favPath.Value}"
            };
            Send();
        }
    }
}
