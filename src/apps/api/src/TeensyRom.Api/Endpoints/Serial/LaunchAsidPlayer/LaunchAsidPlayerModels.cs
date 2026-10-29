using RadEndpoints;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.LaunchAsidPlayer
{
    /// <summary>
    /// Request model for starting a TeensyROM device's built-in ASID player.
    /// </summary>
    public class LaunchAsidPlayerRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute]
        public string DeviceId { get; set; } = string.Empty;
    }

    public class LaunchAsidPlayerRequestValidator : AbstractValidator<LaunchAsidPlayerRequest>
    {
        public LaunchAsidPlayerRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
        }
    }

    /// <summary>
    /// Response model for the result of launching the ASID player.
    /// </summary>
    public class LaunchAsidPlayerResponse
    {
        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Success!";

        /// <summary>
        /// Whether the device moved onto its USB serial port for this launch; it stays there until the next reconnect.
        /// </summary>
        [Required] public bool MovedToSerial { get; set; }
    }
}
