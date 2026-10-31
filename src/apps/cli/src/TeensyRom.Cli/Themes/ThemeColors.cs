using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Themes;

/// <summary>The seven menu colors a TeensyROM theme sets, in the firmware's slot order.</summary>
internal enum ThemeSlot { Background, Border, Banner, Time, Keys, Sources, Names }

internal static class ThemeSlots
{
    public static IReadOnlyList<ThemeSlot> All { get; } = Enum.GetValues<ThemeSlot>();

    /// <summary>The slot's flag name and JSON key.</summary>
    public static string Key(ThemeSlot slot) => slot switch
    {
        ThemeSlot.Background => "background",
        ThemeSlot.Border => "border",
        ThemeSlot.Banner => "banner",
        ThemeSlot.Time => "time",
        ThemeSlot.Keys => "keys",
        ThemeSlot.Sources => "sources",
        ThemeSlot.Names => "names",
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, null)
    };

    /// <summary>What the slot colors, in words for the screen.</summary>
    public static string Label(ThemeSlot slot) => slot switch
    {
        ThemeSlot.Background => "Screen background",
        ThemeSlot.Border => "Border",
        ThemeSlot.Banner => "Top banner",
        ThemeSlot.Time => "Time display",
        ThemeSlot.Keys => "Option keys",
        ThemeSlot.Sources => "Sources text",
        ThemeSlot.Names => "Names",
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, null)
    };
}

/// <summary>
/// Seven C64 color indexes, one per slot. The only place tr-web's <c>option</c> and <c>name</c> become
/// <c>keys</c> and <c>names</c>.
/// </summary>
internal sealed record ThemeColors(int Background, int Border, int Banner, int Time, int Keys, int Sources, int Names)
{
    public int this[ThemeSlot slot] => slot switch
    {
        ThemeSlot.Background => Background,
        ThemeSlot.Border => Border,
        ThemeSlot.Banner => Banner,
        ThemeSlot.Time => Time,
        ThemeSlot.Keys => Keys,
        ThemeSlot.Sources => Sources,
        ThemeSlot.Names => Names,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, null)
    };

    /// <summary>These colors with one slot set to <paramref name="index"/>.</summary>
    public ThemeColors With(ThemeSlot slot, int index) => slot switch
    {
        ThemeSlot.Background => this with { Background = index },
        ThemeSlot.Border => this with { Border = index },
        ThemeSlot.Banner => this with { Banner = index },
        ThemeSlot.Time => this with { Time = index },
        ThemeSlot.Keys => this with { Keys = index },
        ThemeSlot.Sources => this with { Sources = index },
        ThemeSlot.Names => this with { Names = index },
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, null)
    };

    /// <summary>These colors with every slot in <paramref name="overrides"/> replaced.</summary>
    public ThemeColors With(IReadOnlyDictionary<ThemeSlot, int> overrides) =>
        overrides.Aggregate(this, (colors, change) => colors.With(change.Key, change.Value));

    /// <summary>The id of the shipped theme tr-web answers with for a device that has no record.</summary>
    public const string FactoryThemeId = "tr-default";

    public static ThemeColors From(DeviceThemePartDto colors) =>
        new(colors.Background, colors.Border, colors.Banner, colors.Time, colors.Option, colors.Sources, colors.Name);

    /// <summary>The listed theme the record names, only while that theme still has the colors the device was given; otherwise null.</summary>
    public static ThemeDto? MatchingTheme(DeviceThemeRecordDto record, IEnumerable<ThemeDto> themes)
    {
        var colors = From(record.Colors);

        return themes.FirstOrDefault(theme => theme.Id == record.ThemeId && From(theme.Parts.Device) == colors);
    }

    public DeviceThemePartDto ToDto() => new()
    {
        Background = Background,
        Border = Border,
        Banner = Banner,
        Time = Time,
        Option = Keys,
        Sources = Sources,
        Name = Names
    };
}
