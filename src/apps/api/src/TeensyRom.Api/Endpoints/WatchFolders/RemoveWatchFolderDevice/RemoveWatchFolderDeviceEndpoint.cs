using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolderDevice
{
    public class RemoveWatchFolderDeviceEndpoint(IWatchFolderStore store, IWatchFolderStatus status, IDeviceConnectionManager devices)
        : RadEndpoint<RemoveWatchFolderDeviceRequest, RemoveWatchFolderDeviceResponse>
    {
        public override void Configure()
        {
            Delete("/api/watch-folders/{watchFolderId}/devices/{deviceId}")
                .Produces<RemoveWatchFolderDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("RemoveWatchFolderDevice")
                .WithSummary("Remove Watch Folder Device")
                .WithDescription(
                    "Stops sending a watch folder's files to a device.\n\n" +
                    "- Removes every destination of that device on the folder.\n" +
                    "- Removing the last destination removes the folder too.\n" +
                    "- Never touches the folder on disk or anything on a device."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(RemoveWatchFolderDeviceRequest r, CancellationToken ct)
        {
            var result = store.RemoveDevice(r.WatchFolderId, r.DeviceId);

            if (!result.Found)
            {
                SendNotFound($"Watch folder {r.WatchFolderId} has no destination for device {r.DeviceId}.");
                return Task.CompletedTask;
            }

            Response = new()
            {
                FolderRemoved = result.FolderRemoved,
                WatchFolder = result.Folder is null ? null : WatchFolderDto.From(result.Folder, status, devices)
            };
            Send();

            return Task.CompletedTask;
        }
    }
}
