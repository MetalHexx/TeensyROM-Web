using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolderDevice
{
    /// <summary>
    /// Request model for removing a device's destinations from a watch folder.
    /// </summary>
    public class RemoveWatchFolderDeviceRequest
    {
        /// <summary>
        /// The ID of the watch folder.
        /// </summary>
        [FromRoute] public string WatchFolderId { get; set; } = string.Empty;

        /// <summary>
        /// The chip id of the device to stop sending the folder to.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;
    }

    public class RemoveWatchFolderDeviceRequestValidator : AbstractValidator<RemoveWatchFolderDeviceRequest>
    {
        public RemoveWatchFolderDeviceRequestValidator()
        {
            RuleFor(x => x.WatchFolderId).NotEmpty().WithMessage("Watch folder ID is required.");

            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(id => id.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
        }
    }

    /// <summary>
    /// Response model for a device removed from a watch folder.
    /// </summary>
    public class RemoveWatchFolderDeviceResponse
    {
        /// <summary>True when that was the folder's last destination and the folder was removed with it.</summary>
        [Required] public bool FolderRemoved { get; set; }

        /// <summary>The watch folder as it remains; null when it was removed.</summary>
        public WatchFolderDto? WatchFolder { get; set; }
    }
}
