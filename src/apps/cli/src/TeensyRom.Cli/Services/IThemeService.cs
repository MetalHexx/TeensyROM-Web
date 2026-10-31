using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Services;

/// <summary>
/// What <see cref="IThemeService.ApplyAsync"/> sends. <paramref name="Colors"/> null means each device starts from its
/// own recorded colors (factory when it has no record); <paramref name="Overrides"/> replace slots on top.
/// <paramref name="ThemeId"/> is passed to tr-web, which records it only when the colors sent are exactly that theme's.
/// </summary>
internal sealed record ThemeApplyRequest(ThemeColors? Colors, string? ThemeId, IReadOnlyDictionary<ThemeSlot, int> Overrides);

internal enum ThemeApplyStatus { Applied, Busy, Failed }

/// <summary>
/// One device's result. <paramref name="Colors"/> is what was sent (null when the base could not be read);
/// <paramref name="Message"/> is tr-web's sentence for Busy and Failed; <paramref name="IsRecorded"/> is tr-web's flag for Applied.
/// </summary>
internal sealed record ThemeApplyOutcome(DeviceSummary Device, ThemeApplyStatus Status, ThemeColors? Colors, bool IsRecorded, string? Message);

/// <summary>
/// tr-web's themes: named sets of the seven menu colors, and the colors each TeensyROM was last given.
/// </summary>
/// <remarks>Every failure arrives as a <see cref="Api.TeensyApiException"/> carrying tr-web's own wording.</remarks>
internal interface IThemeService
{
    /// <summary>Shipped themes first, then custom ones by name.</summary>
    Task<IReadOnlyList<ThemeDto>> ListAsync(CancellationToken ct);

    /// <summary>Finds a theme by exact id, else by name ignoring case after trimming.</summary>
    /// <exception cref="Errors.CliException"><see cref="Errors.CliExitCode.NotFound"/> when nothing matches; <see cref="Errors.CliExitCode.Usage"/> naming the ids when two names match.</exception>
    Task<ThemeDto> FindAsync(string nameOrId, CancellationToken ct);

    /// <summary>Finds a theme by name ignoring case after trimming, the rule tr-web enforces for unique names; null when none has that name.</summary>
    /// <exception cref="Errors.CliException"><see cref="Errors.CliExitCode.Usage"/> naming the ids when two names match.</exception>
    Task<ThemeDto?> FindByNameAsync(string name, CancellationToken ct);

    /// <summary>The colors tr-web last applied to the device; the factory colors when it has no record.</summary>
    Task<DeviceThemeRecordDto> GetDeviceRecordAsync(string deviceId, CancellationToken ct);

    /// <summary>
    /// Applies to each device in turn, in the order given; one device's failure never stops the next.
    /// Cancelling <paramref name="ct"/> propagates instead of being reported as a device's failure.
    /// </summary>
    Task<IReadOnlyList<ThemeApplyOutcome>> ApplyAsync(IReadOnlyList<DeviceSummary> devices, ThemeApplyRequest request, CancellationToken ct);

    Task<ThemeDto> CreateAsync(string name, ThemeColors colors, CancellationToken ct);

    Task<ThemeDto> UpdateAsync(string themeId, string name, ThemeColors colors, CancellationToken ct);

    Task DeleteAsync(string themeId, CancellationToken ct);
}
