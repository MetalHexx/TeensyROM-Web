using RadEndpoints;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Endpoints.Files.GetFileContent
{
    /// <summary>
    /// Request model for retrieving a file's raw bytes from a TeensyROM device's storage.
    /// </summary>
    public class GetFileContentRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The storage type to query (SD or USB).
        /// </summary>
        [FromRoute] public TeensyStorageType StorageType { get; set; } = TeensyStorageType.SD;

        /// <summary>
        /// The path to the file to retrieve. Must be a valid Unix-style file path.
        /// </summary>
        [FromQuery] public string? Path { get; set; } = string.Empty;
    }

    public class GetFileContentRequestValidator : AbstractValidator<GetFileContentRequest>
    {
        public GetFileContentRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidFilenameSafeHash()).WithMessage("Device ID must be a valid filename-safe hash of 8 characters long.");

            RuleFor(x => x.Path)
                .NotEmpty().WithMessage("Path is required.")
                .Must(path => path!.IsValidUnixFilePath()).WithMessage("Path must be a valid Unix-style file path.")
                .Must(path => !path!.Split('/').Contains("..")).WithMessage("Path must not contain '..' segments.");

            RuleFor(x => x.StorageType)
                .IsInEnum().WithMessage("Storage type must be a valid enum value.");
        }
    }

    /// <summary>
    /// Response model carrying a file's raw bytes (application/octet-stream).
    /// </summary>
    public class GetFileContentResponse : RadBytes
    {
    }
}
