using RadEndpoints;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.RenameDevice
{
    /// <summary>
    /// Request model for renaming a known TeensyROM device.
    /// </summary>
    public class RenameDeviceRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute]
        public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the new name.
        /// </summary>
        [FromBody]
        public RenameDeviceBody Body { get; set; } = new();
    }

    /// <summary>
    /// The JSON body of a rename-device request.
    /// </summary>
    public class RenameDeviceBody
    {
        /// <summary>
        /// The new device name: 1 to 24 characters after trimming, with no control characters.
        /// </summary>
        [Required] public string Name { get; set; } = string.Empty;
    }

    public class RenameDeviceRequestValidator : AbstractValidator<RenameDeviceRequest>
    {
        public RenameDeviceRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.Body.Name)
                .Must(name => DeviceNameRules.TryNormalize(name, out _)).WithMessage("Name must be 1–24 characters with no control characters.");
        }
    }

    /// <summary>
    /// Response model for the result of a rename device operation.
    /// </summary>
    public class RenameDeviceResponse
    {
        /// <summary>
        /// The renamed device, available or offline.
        /// </summary>
        [Required] public CartDto Device { get; set; } = null!;

        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Success!";
    }
}
