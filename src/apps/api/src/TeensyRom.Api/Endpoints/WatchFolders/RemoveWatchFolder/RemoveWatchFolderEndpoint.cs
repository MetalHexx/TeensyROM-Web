using TeensyRom.Api.WatchFolders;

namespace TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolder
{
    public class RemoveWatchFolderEndpoint(IWatchFolderStore store) : RadEndpoint<RemoveWatchFolderRequest, RemoveWatchFolderResponse>
    {
        public override void Configure()
        {
            Delete("/api/watch-folders/{watchFolderId}")
                .Produces<RemoveWatchFolderResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("RemoveWatchFolder")
                .WithSummary("Remove Watch Folder")
                .WithDescription(
                    "Stops watching a folder and removes all its destinations.\n\n" +
                    "- Never touches the folder on disk or anything on a device."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(RemoveWatchFolderRequest r, CancellationToken ct)
        {
            if (!store.RemoveFolder(r.WatchFolderId))
            {
                SendNotFound($"No watch folder was found with id {r.WatchFolderId}.");
                return Task.CompletedTask;
            }

            Response = new() { Message = "Watch folder removed." };
            Send();

            return Task.CompletedTask;
        }
    }
}
