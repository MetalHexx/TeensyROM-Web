using RadEndpoints;
using TeensyRom.Api.Models;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Files.GetDirectory
{
    public class GetDirectoryEndpoint(IDeviceConnectionManager deviceManager) : RadEndpoint<GetDirectoryRequest, GetDirectoryResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/{deviceId}/storage/{storageType}/directories")
                .Produces<GetDirectoryResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("GetDirectory")
                .WithSummary("Get Directory")
                .WithTags("Files")
                .WithDescription(
                    "Gets a directory for given storage device.\n\n" +
                    "- Returns metadata for all files in the directory.\n" +
                    "- This is not recursive and will only include the files for the requested directory.\n" +
                    "- Make another request to get subdirectory content."
                );
        }

        public override async Task Handle(GetDirectoryRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId!);
            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return;
            }
            var storage = device.GetStorage(r.StorageType);
            if (storage is null)
            {
                SendNotFound($"The storage {r.StorageType} is not available.");
                return;
            }
            var read = await storage.ReadDirectory(new DirectoryPath(r.Path!));
            if (read.Failure is not null)
            {
                SendExternalError(read.Failure);
                return;
            }
            if (read.Item is null)
            {
                SendNotFound($"The directory {r.Path} was not found.");
                return;
            }
            Response = new()
            {
                StorageItem = StorageCacheDto.FromCache(read.Item)
            };
            Send();
        }
    }
}