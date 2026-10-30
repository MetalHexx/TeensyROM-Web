using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.ApplyDeviceTheme
{
    /// <summary>
    /// Request model for applying colors to a device.
    /// </summary>
    public record ApplyDeviceThemeRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the colors and, optionally, the theme they came from.
        /// </summary>
        [FromBody] public ApplyDeviceThemeBody Body { get; set; } = new();
    }

    /// <summary>
    /// Response model carrying the record of what the device now holds.
    /// </summary>
    public record ApplyDeviceThemeResponse
    {
        /// <summary>
        /// The colors applied to the device.
        /// </summary>
        [Required] public DeviceThemeRecordDto Record { get; init; } = new();
    }

    public class ApplyDeviceThemeRequestValidator : AbstractValidator<ApplyDeviceThemeRequest>
    {
        public ApplyDeviceThemeRequestValidator()
        {
            RuleFor(x => x.DeviceId).MustBeDeviceId();
            RuleFor(x => x.Body.Colors).SetValidator(new DeviceThemePartDtoValidator());
            RuleFor(x => x.Body.ThemeId!).MustBeThemeId().When(x => x.Body.ThemeId is not null);
        }
    }
}
