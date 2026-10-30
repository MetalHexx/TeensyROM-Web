using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.GetDeviceTheme
{
    /// <summary>
    /// Request model for reading the colors last applied to a device.
    /// </summary>
    public record GetDeviceThemeRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model carrying the device's theme record.
    /// </summary>
    public record GetDeviceThemeResponse
    {
        /// <summary>
        /// The colors last applied to the device, or the factory colors when nothing was recorded.
        /// </summary>
        [Required] public DeviceThemeRecordDto Record { get; init; } = new();
    }

    public class GetDeviceThemeRequestValidator : AbstractValidator<GetDeviceThemeRequest>
    {
        public GetDeviceThemeRequestValidator()
        {
            RuleFor(x => x.DeviceId).MustBeDeviceId();
        }
    }
}
