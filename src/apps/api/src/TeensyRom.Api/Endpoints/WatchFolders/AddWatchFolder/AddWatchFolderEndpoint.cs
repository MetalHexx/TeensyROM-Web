using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.WatchFolders.AddWatchFolder
{
    public class AddWatchFolderEndpoint(IWatchFolderStore store, IWatchFolderStatus status, IDeviceConnectionManager devices)
        : RadEndpoint<AddWatchFolderRequest, AddWatchFolderResponse>
    {
        public override void Configure()
        {
            Post("/api/watch-folders")
                .Produces<AddWatchFolderResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .WithName("AddWatchFolder")
                .WithSummary("Add Watch Folder")
                .WithDescription(
                    "Sends the files of a folder on the engine's machine to a device storage.\n\n" +
                    "- Adding a folder that is already watched adds a destination for another device to it.\n" +
                    "- A device receives a folder through one destination only; a second one is refused with 409.\n" +
                    "- A folder nested inside a watched folder, or containing one, is refused with 400.\n" +
                    "- The device must be connected and report its chip id, and the storage must be available."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(AddWatchFolderRequest r, CancellationToken ct)
        {
            var result = store.Add(new WatchFolderAdd(r.Body.Path, r.Body.DeviceId, r.Body.StorageType, r.Body.DevicePath, r.Body.Launch));

            switch (result.Error)
            {
                case null:
                    Response = new()
                    {
                        WatchFolder = WatchFolderDto.From(result.Folder!, status, devices),
                        Created = result.Created
                    };
                    Send();
                    break;
                case WatchFolderAddError.DeviceNotFound:
                case WatchFolderAddError.StorageUnavailable:
                    SendNotFound(result.Message!);
                    break;
                case WatchFolderAddError.DeviceAlreadyOnFolder:
                    // Clients print the title and fall back to the detail, so both carry the store's guidance.
                    SendProblem(TypedResults.Problem(
                        title: result.Message,
                        statusCode: StatusCodes.Status409Conflict,
                        detail: result.Message));
                    break;
                default:
                    SendValidationError(result.Message!);
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
