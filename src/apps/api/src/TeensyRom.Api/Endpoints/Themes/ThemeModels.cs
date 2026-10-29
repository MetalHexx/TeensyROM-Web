using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Common;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes
{
    /// <summary>
    /// A theme: a named set of parts, one per surface. Shipped themes are read-only.
    /// </summary>
    public record ThemeDto
    {
        /// <summary>
        /// The theme id: lowercase letters, digits and single hyphens.
        /// </summary>
        [Required] public string Id { get; init; } = string.Empty;

        /// <summary>
        /// Display name, 1-24 characters after trimming, with no control characters.
        /// </summary>
        [Required] public string Name { get; init; } = string.Empty;

        /// <summary>
        /// Whether the theme ships with the app (read-only) or was saved by the user.
        /// </summary>
        [Required] public ThemeKind Kind { get; init; }

        /// <summary>
        /// The parts of the theme, one per surface.
        /// </summary>
        [Required] public ThemePartsDto Parts { get; init; } = new();
    }

    /// <summary>
    /// The parts of a theme. The web and CLI parts are added here as their surfaces define them.
    /// </summary>
    public record ThemePartsDto
    {
        /// <summary>
        /// The colors of the TeensyROM device menu.
        /// </summary>
        [Required] public DeviceThemePartDto Device { get; init; } = new();
    }

    /// <summary>
    /// The colors of the TeensyROM device menu, each a firmware color index 0 to 15.
    /// </summary>
    public record DeviceThemePartDto
    {
        /// <summary>Menu background color, 0-15.</summary>
        [Required] public int Background { get; init; }

        /// <summary>Menu border color, 0-15.</summary>
        [Required] public int Border { get; init; }

        /// <summary>Banner color, 0-15.</summary>
        [Required] public int Banner { get; init; }

        /// <summary>Clock color, 0-15.</summary>
        [Required] public int Time { get; init; }

        /// <summary>Menu option color, 0-15.</summary>
        [Required] public int Option { get; init; }

        /// <summary>Sources line color, 0-15.</summary>
        [Required] public int Sources { get; init; }

        /// <summary>Device name color, 0-15.</summary>
        [Required] public int Name { get; init; }
    }

    /// <summary>
    /// The JSON body of a create or update theme request.
    /// </summary>
    public record SaveThemeBody
    {
        /// <summary>
        /// The theme name: 1 to 24 characters after trimming, with no control characters. Names are unique among themes.
        /// </summary>
        [Required] public string Name { get; init; } = string.Empty;

        /// <summary>
        /// The device menu colors.
        /// </summary>
        [Required] public DeviceThemePartDto Device { get; init; } = new();
    }

    /// <summary>
    /// The JSON body of an apply device theme request.
    /// </summary>
    public record ApplyDeviceThemeBody
    {
        /// <summary>
        /// The colors to send to the device.
        /// </summary>
        [Required] public DeviceThemePartDto Colors { get; init; } = new();

        /// <summary>
        /// The theme the colors came from. It is recorded only when the theme exists and holds exactly these colors.
        /// </summary>
        public string? ThemeId { get; init; }
    }

    /// <summary>
    /// The colors last applied to a device.
    /// </summary>
    public record DeviceThemeRecordDto
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [Required] public string DeviceId { get; init; } = string.Empty;

        /// <summary>
        /// The colors the device holds.
        /// </summary>
        [Required] public DeviceThemePartDto Colors { get; init; } = new();

        /// <summary>
        /// The theme the colors came from, or null when they were not taken from a stored theme.
        /// </summary>
        public string? ThemeId { get; init; }

        /// <summary>
        /// When the colors were applied, or null when nothing has been recorded for the device.
        /// </summary>
        public DateTimeOffset? AppliedAt { get; init; }

        /// <summary>
        /// False when the device has no record and the factory colors are reported instead.
        /// </summary>
        [Required] public bool IsRecorded { get; init; }
    }

    public class DeviceThemePartDtoValidator : AbstractValidator<DeviceThemePartDto>
    {
        public DeviceThemePartDtoValidator()
        {
            RuleFor(x => x.Background).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Border).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Banner).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Time).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Option).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Sources).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
            RuleFor(x => x.Name).InclusiveBetween(0, 15).WithMessage("Colors must be between 0 and 15.");
        }
    }

    public class SaveThemeBodyValidator : AbstractValidator<SaveThemeBody>
    {
        public SaveThemeBodyValidator()
        {
            RuleFor(x => x.Name).MustBeThemeName();
            RuleFor(x => x.Device).SetValidator(new DeviceThemePartDtoValidator());
        }
    }

    /// <summary>
    /// The rules several theme requests share.
    /// </summary>
    internal static class ThemeRules
    {
        public static IRuleBuilderOptions<T, string> MustBeThemeId<T>(this IRuleBuilder<T, string> rule) =>
            rule.Must(ThemeIds.IsValid).WithMessage("Theme ID must be lowercase letters, digits and single hyphens.");

        public static IRuleBuilderOptions<T, string> MustBeThemeName<T>(this IRuleBuilder<T, string> rule) =>
            rule.Must(name => DeviceNameRules.TryNormalize(name, out _)).WithMessage("Name must be 1–24 characters with no control characters.");

        public static IRuleBuilderOptions<T, string> MustBeDeviceId<T>(this IRuleBuilder<T, string> rule) =>
            rule.NotEmpty().WithMessage("Device ID is required.")
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1–32 letters, digits, hyphens, or underscores.");
    }

    /// <summary>
    /// Maps between the theme DTOs and the Core theme records, shared by the endpoints.
    /// </summary>
    public static class ThemeMapping
    {
        public static ThemeDto ToDto(Theme theme) => new()
        {
            Id = theme.Id,
            Name = theme.Name,
            Kind = theme.Kind,
            Parts = new ThemePartsDto { Device = ToDto(theme.Parts.Device) }
        };

        public static DeviceThemePartDto ToDto(DeviceThemePart part) => new()
        {
            Background = part.Background,
            Border = part.Border,
            Banner = part.Banner,
            Time = part.Time,
            Option = part.Option,
            Sources = part.Sources,
            Name = part.Name
        };

        public static DeviceThemePart ToPart(DeviceThemePartDto dto) => new()
        {
            Background = dto.Background,
            Border = dto.Border,
            Banner = dto.Banner,
            Time = dto.Time,
            Option = dto.Option,
            Sources = dto.Sources,
            Name = dto.Name
        };

        public static DeviceThemeRecordDto ToDto(DeviceThemeRecord record) => new()
        {
            DeviceId = record.DeviceId,
            Colors = ToDto(record.Colors),
            ThemeId = record.ThemeId,
            AppliedAt = record.AppliedAt,
            IsRecorded = true
        };
    }
}
