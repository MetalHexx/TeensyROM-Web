using System.Text.Json.Serialization;

namespace TeensyRom.Core.Themes;

/// <summary>The seven colored parts of the device menu, in the order the firmware stores them.</summary>
public enum ColorSlot { Background = 0, Border = 1, Banner = 2, Time = 3, Option = 4, Sources = 5, Name = 6 }

public enum ThemeKind { Shipped, Custom }

/// <summary>The colors of the device menu, each a firmware color index 0..15.</summary>
public sealed record DeviceThemePart
{
    public const int ColorCount = 16;

    public int Background { get; init; }
    public int Border { get; init; }
    public int Banner { get; init; }
    public int Time { get; init; }
    public int Option { get; init; }
    public int Sources { get; init; }
    public int Name { get; init; }

    /// <summary>The colors as (slot, color) pairs, Background through Name.</summary>
    public IReadOnlyList<(ColorSlot Slot, int Color)> InSlotOrder() =>
    [
        (ColorSlot.Background, Background),
        (ColorSlot.Border, Border),
        (ColorSlot.Banner, Banner),
        (ColorSlot.Time, Time),
        (ColorSlot.Option, Option),
        (ColorSlot.Sources, Sources),
        (ColorSlot.Name, Name)
    ];

    /// <summary>True when every slot holds a color index 0..15.</summary>
    public bool IsValid() => InSlotOrder().All(s => s.Color is >= 0 and < ColorCount);
}

/// <summary>The web and CLI parts join this record when their surfaces define them; adding one never changes Device.</summary>
public sealed record ThemeParts
{
    public required DeviceThemePart Device { get; init; }
}

public sealed record Theme(string Id, string Name, ThemeKind Kind, ThemeParts Parts);

/// <summary>The colors last applied to a device, and the theme they came from when one was chosen.</summary>
public sealed record DeviceThemeRecord(string DeviceId, DeviceThemePart Colors, string? ThemeId, DateTimeOffset AppliedAt);

public static class ThemeDefaults
{
    public const string FactoryThemeId = "tr-default";

    /// <summary>The colors a fresh device has.</summary>
    public static DeviceThemePart FactoryColors { get; } = new()
    {
        Background = 0,
        Border = 4,
        Banner = 4,
        Time = 10,
        Option = 7,
        Sources = 14,
        Name = 13
    };
}

/// <summary>A theme file on disk. The kind comes from the folder it sits in and sortOrder is written only in shipped files.</summary>
internal sealed class ThemeFile
{
    public string? Id { get; init; }
    public string? Name { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? SortOrder { get; init; }

    public ThemePartsFile? Parts { get; init; }
}

internal sealed class ThemePartsFile
{
    public DeviceThemePart? Device { get; init; }
}

/// <summary>The device-records file: the last applied colors per device id.</summary>
internal sealed class DeviceRecordsFile
{
    public Dictionary<string, DeviceRecordEntry>? Records { get; init; }
}

internal sealed class DeviceRecordEntry
{
    public DeviceThemePart? Colors { get; init; }
    public string? ThemeId { get; init; }
    public DateTimeOffset AppliedAt { get; init; }
}
