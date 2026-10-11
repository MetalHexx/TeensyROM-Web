using TeensyRom.Api.Services;

namespace TeensyRom.Api.Tests.Unit.Services;

public class SettingsOrphansTests
{
    [Fact]
    public void Find_ReturnsSettingsIdsMissingFromTheKnownSet()
    {
        var known = SettingsOrphans.KnownIds(["AAAA", "BBBB"]);

        var orphans = SettingsOrphans.Find(["AAAA", "OLDHASH", "BBBB"], known);

        orphans.Should().Equal("OLDHASH");
    }

    [Fact]
    public void Find_EmptyKnownSet_RemovesNothing()
    {
        var known = SettingsOrphans.KnownIds([]);

        var orphans = SettingsOrphans.Find(["AAAA", "BBBB"], known);

        orphans.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Unknown")]
    [InlineData("Unknown-2")]
    public void KnownIds_ExcludesStandIns(string standIn)
    {
        var known = SettingsOrphans.KnownIds(["AAAA", standIn]);

        known.Should().BeEquivalentTo(["AAAA"]);
    }

    [Fact]
    public void Find_KnownSetOfOnlyStandIns_RemovesNothing()
    {
        var known = SettingsOrphans.KnownIds(["Unknown", "Unknown-2"]);

        var orphans = SettingsOrphans.Find(["AAAA", "BBBB"], known);

        orphans.Should().BeEmpty();
    }
}
