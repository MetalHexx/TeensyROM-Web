using RadEndpoints;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.ForgetDevice
{
    /// <summary>
    /// Request model for forgetting a known, offline TeensyROM device.
    /// </summary>
    public class ForgetDeviceRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute]
        public string DeviceId { get; set; } = string.Empty;
    }

    public class ForgetDeviceRequestValidator : AbstractValidator<ForgetDeviceRequest>
    {
        public ForgetDeviceRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
        }
    }

    /// <summary>
    /// Response model for the result of a forget device operation.
    /// </summary>
    public class ForgetDeviceResponse
    {
        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Success!";
    }
}
