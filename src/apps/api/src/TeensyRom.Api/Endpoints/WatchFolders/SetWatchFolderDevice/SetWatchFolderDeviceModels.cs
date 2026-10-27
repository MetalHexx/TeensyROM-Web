using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.WatchFolders.SetWatchFolderDevice
{
    /// <summary>
    /// Request model for changing a device's destination on a watch folder.
    /// </summary>
    public class SetWatchFolderDeviceRequest
    {
        /// <summary>
        /// The ID of the watch folder.
        /// </summary>
        [FromRoute] public string WatchFolderId { get; set; } = string.Empty;

        /// <summary>
        /// The chip id of the device whose destination changes.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body, bound as a whole.
        /// </summary>
        [FromBody] public SetWatchFolderDeviceBody Body { get; set; } = new();
    }

    /// <summary>
    /// The JSON body of a set-device request. A null or absent value is left as it is; at least one must be present.
    /// </summary>
    public class SetWatchFolderDeviceBody
    {
        /// <summary>
        /// The directory on the device storage that receives the files.
        /// </summary>
        public string? DevicePath { get; set; }

        /// <summary>
        /// Launch one file after each completed transfer, even when the auto-launch setting is off.
        /// </summary>
        public bool? Launch { get; set; }
    }

    public class SetWatchFolderDeviceRequestValidator : AbstractValidator<SetWatchFolderDeviceRequest>
    {
        public SetWatchFolderDeviceRequestValidator()
        {
            RuleFor(x => x.WatchFolderId).NotEmpty().WithMessage("Watch folder ID is required.");

            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(id => id.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
        }
    }

    /// <summary>
    /// Response model for a changed watch folder destination.
    /// </summary>
    public class SetWatchFolderDeviceResponse
    {
        /// <summary>The watch folder as it is now.</summary>
        [Required] public WatchFolderDto WatchFolder { get; set; } = null!;
    }
}
