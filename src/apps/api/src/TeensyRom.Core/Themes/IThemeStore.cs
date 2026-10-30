namespace TeensyRom.Core.Themes;

public enum ThemeSaveStatus { Saved, NotFound, ShippedReadOnly, NameTaken, Failed }

public sealed record ThemeSaveResult(ThemeSaveStatus Status, Theme? Theme = null);

public enum ThemeDeleteStatus { Deleted, NotFound, ShippedReadOnly, Failed }

/// <summary>
/// Shipped themes, custom themes and the colors last applied to each device. Every method that takes an id throws
/// <see cref="ArgumentException"/> for one that is not a valid theme or device id; so do create and update for an invalid name or colors.
/// </summary>
public interface IThemeStore
{
    /// <summary>Shipped themes by sort order, then custom themes by name.</summary>
    IReadOnlyList<Theme> ListThemes();

    Theme? GetTheme(string themeId);

    /// <summary>Creates a custom theme with an id generated from <paramref name="name"/>.</summary>
    ThemeSaveResult CreateCustom(string name, DeviceThemePart device);

    ThemeSaveResult UpdateCustom(string themeId, string name, DeviceThemePart device);

    ThemeDeleteStatus DeleteCustom(string themeId);

    DeviceThemeRecord? GetDeviceRecord(string deviceId);

    bool SaveDeviceRecord(DeviceThemeRecord record);
}
