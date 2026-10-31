using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Tests;

public class ThemeColorsTests
{
    private static readonly ThemeColors Sample = new(1, 2, 3, 4, 5, 6, 7);

    [Fact]
    public void Indexer_ReadsEachSlot()
    {
        ThemeSlots.All.Select(slot => Sample[slot]).Should().Equal(1, 2, 3, 4, 5, 6, 7);
    }

    [Fact]
    public void With_ReplacesOnlyTheNamedSlots()
    {
        var changed = Sample.With(new Dictionary<ThemeSlot, int> { [ThemeSlot.Keys] = 12, [ThemeSlot.Background] = 0 });

        changed.Should().Be(new ThemeColors(0, 2, 3, 4, 12, 6, 7));
        Sample.With(ThemeSlot.Names, 9).Should().Be(new ThemeColors(1, 2, 3, 4, 5, 6, 9));
    }

    [Fact]
    public void ToDto_MapsKeysToOptionAndNamesToName()
    {
        var dto = Sample.ToDto();

        dto.Option.Should().Be(5);
        dto.Name.Should().Be(7);
        (dto.Background, dto.Border, dto.Banner, dto.Time, dto.Sources).Should().Be((1, 2, 3, 4, 6));
    }

    [Fact]
    public void From_ReadsOptionAsKeysAndNameAsNames()
    {
        var colors = ThemeColors.From(new DeviceThemePartDto { Background = 1, Border = 2, Banner = 3, Time = 4, Option = 5, Sources = 6, Name = 7 });

        colors.Should().Be(Sample);
        ThemeColors.From(Sample.ToDto()).Should().Be(Sample);
    }

    [Fact]
    public void SlotKeys_AreTheFlagNamesInFirmwareOrder()
    {
        ThemeSlots.All.Select(ThemeSlots.Key).Should().Equal("background", "border", "banner", "time", "keys", "sources", "names");
    }
}
