using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints;
using System.Net.Mime;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Files.GetFileContent
{
    public class GetFileContentEndpoint(IDeviceConnectionManager deviceManager)
        : RadEndpoint<GetFileContentRequest, GetFileContentResponse>
    {
        /// The cap is deliberately far above any SID (C64 memory bounds them) so the endpoint stays
        /// usable for other file types later without a change. A named constant is what the
        /// requirements' "configured cap" means here - there is no settings key for it.
        public const long MaxFileBytes = 10L * 1024 * 1024;

        public override void Configure()
        {
            Get("/api/devices/{deviceId}/storage/{storageType}/files/content")
                .Produces<Stream>(StatusCodes.Status200OK, MediaTypeNames.Application.Octet)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetFileContent")
                .WithSummary("Get File Content")
                .WithTags("Files")
                .WithDescription(
                    "Returns a file's raw bytes (application/octet-stream) from a device's storage.\n\n" +
                    "- Byte-identical to the file on the cartridge.\n" +
                    "- Refused with 413 above 10 MB.\n" +
                    "- The path must be a Unix-style file path with no '..' segment."
                );
        }

        public override async Task Handle(GetFileContentRequest r, CancellationToken ct)
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
            var filePath = new FilePath(r.Path!);

            var metadata = await storage.GetFile(filePath);
            if (metadata is not null && metadata.Size > MaxFileBytes)
            {
                SendTooLarge(r.Path!);
                return;
            }

            var result = await storage.ReadFileBytes(filePath, ct);

            switch (result.Error)
            {
                case FileBytesError.NotFound:
                    SendNotFound($"The file {r.Path} was not found.");
                    return;
                case FileBytesError.StorageUnavailable:
                    SendNotFound($"The storage {r.StorageType} is not available.");
                    return;
                case FileBytesError.Failed:
                    SendInternalError($"The file {r.Path} could not be read from the device.");
                    return;
            }

            var bytes = result.Bytes!;
            if (bytes.LongLength > MaxFileBytes)
            {
                SendTooLarge(r.Path!);
                return;
            }

            Response = new()
            {
                Bytes = bytes,
                ContentType = MediaTypeNames.Application.Octet,
                FileDownloadName = filePath.FileName
            };
            SendBytes(Response);
        }

        private void SendTooLarge(string path)
        {
            SendProblem(TypedResults.Problem(
                title: $"The file {path} is larger than the {MaxFileBytes / (1024 * 1024)} MB limit.",
                statusCode: StatusCodes.Status413PayloadTooLarge));
        }
    }
}
