using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Endpoints.Files.BanFile
{
    /// <summary>
    /// Request model for banning a file so it is hidden from listings and search.
    /// </summary>
    public class BanFileRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute]
        public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The storage type where the file is located (SD or USB).
        /// </summary>
        [FromRoute]
        public TeensyStorageType StorageType { get; set; } = TeensyStorageType.SD;

        /// <summary>
        /// The path to the file to ban. Must be a valid Unix-style file path.
        /// </summary>
        [FromQuery]
        public string FilePath { get; set; } = string.Empty;
    }

    public class BanFileRequestValidator : AbstractValidator<BanFileRequest>
    {
        public BanFileRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.FilePath)
                .NotEmpty().WithMessage("Path is required.")
                .Must(path => path.IsValidUnixFilePath()).WithMessage("Path must be a valid Unix-style file path.");

            RuleFor(x => x.StorageType)
                .IsInEnum().WithMessage("Storage type must be a valid enum value.");
        }
    }

    /// <summary>
    /// Response model for the result of a ban file operation.
    /// </summary>
    public class BanFileResponse
    {
        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = string.Empty;

        /// <summary>
        /// The whole file name recorded in the banned files list.
        /// </summary>
        [Required] public string BannedFileName { get; set; } = string.Empty;

        /// <summary>
        /// True when the file name was already banned and nothing was changed.
        /// </summary>
        [Required] public bool AlreadyBanned { get; set; }
    }
}
