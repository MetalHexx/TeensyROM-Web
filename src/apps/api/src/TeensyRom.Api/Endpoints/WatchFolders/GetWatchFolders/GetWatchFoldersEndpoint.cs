using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.WatchFolders.GetWatchFolders
{
    public class GetWatchFoldersEndpoint(IWatchFolderStore store, IWatchFolderStatus status, IDeviceConnectionManager devices)
        : RadEndpointWithoutRequest<GetWatchFoldersResponse>
    {
        public override void Configure()
        {
            Get("/api/watch-folders")
                .Produces<GetWatchFoldersResponse>(StatusCodes.Status200OK)
                .WithName("GetWatchFolders")
                .WithSummary("Get Watch Folders")
                .WithDescription(
                    "Lists every watch folder with its destinations and what it is doing right now.\n\n" +
                    "- A watch folder is a folder on the engine's machine; its destinations are device storages that receive its files."
                )
                .WithTags("WatchFolders");
        }

        public override Task Handle(CancellationToken ct)
        {
            Response = new()
            {
                WatchFolders = store.GetAll().Select(f => WatchFolderDto.From(f, status, devices)).ToList()
            };
            Send();

            return Task.CompletedTask;
        }
    }
}
