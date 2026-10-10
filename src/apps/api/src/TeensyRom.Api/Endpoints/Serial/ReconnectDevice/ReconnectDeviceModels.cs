using RadEndpoints;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.ReconnectDevice
{
    /// <summary>
    /// Request model for reconnecting a known, currently offline TeensyROM device.
    /// </summary>
    public class ReconnectDeviceRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute]
        public string DeviceId { get; set; } = string.Empty;
    }

    public class ReconnectDeviceRequestValidator : AbstractValidator<ReconnectDeviceRequest>
    {
        public ReconnectDeviceRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
        }
    }

    /// <summary>
    /// Response model for the result of a reconnect device operation.
    /// </summary>
    public class ReconnectDeviceResponse
    {
        /// <summary>
        /// The reconnected (or already available) device.
        /// </summary>
        [Required] public CartDto Device { get; set; } = null!;

        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Success!";
    }
}
