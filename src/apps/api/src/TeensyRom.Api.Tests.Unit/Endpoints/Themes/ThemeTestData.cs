using TeensyRom.Api.Endpoints.Themes;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Themes;

internal static class ThemeTestData
{
    public static DeviceThemePartDto ColorsDto(int color = 3) => new()
    {
        Background = color, Border = color, Banner = color, Time = color, Option = color, Sources = color, Name = color
    };

    public static DeviceThemePart Colors(int color = 3) => ThemeMapping.ToPart(ColorsDto(color));

    public static Theme Custom(string id = "mine", string name = "Mine", int color = 3) =>
        new(id, name, ThemeKind.Custom, new ThemeParts { Device = Colors(color) });

    public static SaveThemeBody Body(string name = "Mine", int color = 3) => new() { Name = name, Device = ColorsDto(color) };
}
