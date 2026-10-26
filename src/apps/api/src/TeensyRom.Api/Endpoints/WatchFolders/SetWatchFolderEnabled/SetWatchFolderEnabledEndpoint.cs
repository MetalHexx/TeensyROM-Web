using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.WatchFolders.SetWatchFolderEnabled
{
    public class SetWatchFolderEnabledEndpoint(IWatchFolderStore store, IWatchFolderStatus status, IDeviceConnectionManager devices)
        : RadEndpoint<SetWatchFolderEnabledRequest, SetWatchFolderEnabledResponse>
    {
        public override void Configure()
        {
            Put("/api/watch-folders/{watchFolderId}/enabled")
                .Produces<SetWatchFolderEnabledResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("SetWatchFolderEnabled")
                .WithSummary("Set Watch Folder Enabled")
                .WithDescription(
                    "Turns a watch folder on or off without changing its destinations.\n\n" +
                    "- Files that land while the folder is off are not sent later, not even after it is turned back on."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(SetWatchFolderEnabledRequest r, CancellationToken ct)
        {
            var folder = store.SetEnabled(r.WatchFolderId, r.Body.Enabled);

            if (folder is null)
            {
                SendNotFound($"No watch folder was found with id {r.WatchFolderId}.");
                return Task.CompletedTask;
            }

            Response = new() { WatchFolder = WatchFolderDto.From(folder, status, devices) };
            Send();

            return Task.CompletedTask;
        }
    }
}
