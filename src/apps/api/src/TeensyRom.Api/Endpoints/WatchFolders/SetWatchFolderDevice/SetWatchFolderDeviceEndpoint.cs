using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.WatchFolders.SetWatchFolderDevice
{
    public class SetWatchFolderDeviceEndpoint(IWatchFolderStore store, IWatchFolderStatus status, IDeviceConnectionManager devices)
        : RadEndpoint<SetWatchFolderDeviceRequest, SetWatchFolderDeviceResponse>
    {
        public override void Configure()
        {
            Put("/api/watch-folders/{watchFolderId}/devices/{deviceId}")
                .Produces<SetWatchFolderDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("SetWatchFolderDevice")
                .WithSummary("Set Watch Folder Device")
                .WithDescription(
                    "Changes the device folder and/or the launch flag of a device's destination on a watch folder.\n\n" +
                    "- A null or absent value is left as it is; at least one must be given.\n" +
                    "- Only the device folder and launch flag change. A different device or storage is a different destination.\n" +
                    "- Setting the values it already has succeeds and changes nothing.\n" +
                    "- The change applies to the next set of files delivered."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(SetWatchFolderDeviceRequest r, CancellationToken ct)
        {
            var result = store.SetDestination(r.WatchFolderId, r.DeviceId, r.Body.DevicePath, r.Body.Launch);

            switch (result.Error)
            {
                case null:
                    Response = new() { WatchFolder = WatchFolderDto.From(result.Folder!, status, devices) };
                    Send();
                    break;
                case WatchFolderSetDestinationError.NotFound:
                    SendNotFound(result.Message!);
                    break;
                default:
                    SendValidationError(result.Message!);
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
