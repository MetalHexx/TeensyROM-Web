using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Endpoints.WatchFolders.AddWatchFolder
{
    /// <summary>
    /// Request model for sending a watch folder's files to a device storage.
    /// </summary>
    public class AddWatchFolderRequest
    {
        /// <summary>
        /// The JSON request body, bound as a whole.
        /// </summary>
        [FromBody] public AddWatchFolderBody Body { get; set; } = new();
    }

    /// <summary>
    /// The JSON body of an add-watch-folder request.
    /// </summary>
    public class AddWatchFolderBody
    {
        /// <summary>
        /// The absolute path of the folder to watch, on the engine's machine.
        /// </summary>
        public string Path { get; set; } = string.Empty;

        /// <summary>
        /// The chip id of the device that receives the folder's files.
        /// </summary>
        public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The storage that receives the files (SD or USB).
        /// </summary>
        public TeensyStorageType StorageType { get; set; } = TeensyStorageType.SD;

        /// <summary>
        /// The directory on the device storage that receives the files. Defaults to <c>/auto-transfer</c>.
        /// </summary>
        public string? DevicePath { get; set; }

        /// <summary>
        /// Launch one file after each completed transfer, even when the auto-launch setting is off.
        /// </summary>
        public bool Launch { get; set; }
    }

    public class AddWatchFolderRequestValidator : AbstractValidator<AddWatchFolderRequest>
    {
        public AddWatchFolderRequestValidator()
        {
            RuleFor(x => x.Body.Path)
                .NotEmpty().WithMessage("Path is required.")
                .Must(path => System.IO.Path.IsPathFullyQualified(path)).WithMessage("Path must be a fully qualified absolute path.");

            RuleFor(x => x.Body.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(id => id.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.Body.StorageType)
                .IsInEnum().WithMessage("Storage type must be a valid enum value.");
        }
    }

    /// <summary>
    /// Response model for an added watch folder destination.
    /// </summary>
    public class AddWatchFolderResponse
    {
        /// <summary>The watch folder as it is after the add.</summary>
        [Required] public WatchFolderDto WatchFolder { get; set; } = null!;

        /// <summary>True when a new watch folder was created; false when the destination joined a folder that was already watched.</summary>
        [Required] public bool Created { get; set; }
    }
}
