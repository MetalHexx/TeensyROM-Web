using TeensyRom.Core.Storage;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class BanMatcherTests
{
    [Theory]
    [InlineData("1.sid", "1.sid", true)]
    [InlineData("1.SID", "1.sid", true)]
    [InlineData("1.sid", "1.SID", true)]
    [InlineData("Commando_1.sid", "1.sid", false)]
    [InlineData("1.sid", "Commando_1.sid", false)]
    [InlineData("1.sid.bak", "1.sid", false)]
    [InlineData("1.sid", "/1.sid/", true)]
    [InlineData("/1.sid", "1.sid", true)]
    [InlineData("", "1.sid", false)]
    public void IsBannedFile_MatchesWholeNamesIgnoringCaseAndSlashes(string fileName, string entry, bool expected)
    {
        BanMatcher.IsBannedFile(fileName, [entry]).Should().Be(expected);
    }

    [Fact]
    public void IsBannedFile_BlankEntriesAndEmptyList_BanNothing()
    {
        BanMatcher.IsBannedFile("1.sid", ["", "  ", "/"]).Should().BeFalse();
        BanMatcher.IsBannedFile("", ["", "  "]).Should().BeFalse();
        BanMatcher.IsBannedFile("1.sid", []).Should().BeFalse();
    }

    [Theory]
    [InlineData("/games", "/games/", true)]
    [InlineData("/games", "/games/x/", true)]
    [InlineData("/games", "/games", true)]
    [InlineData("/games/", "/games/x/", true)]
    [InlineData("/games", "/games2/", false)]
    [InlineData("/games", "/music/games/", false)]
    [InlineData("/GAMES", "/games/x/", true)]
    [InlineData("/music/hvsc", "/music/hvsc/a/b/", true)]
    [InlineData("/music/hvsc", "/music/", false)]
    [InlineData("/music/hvsc", "/x/music/hvsc/", false)]
    [InlineData("Docs", "/Docs/", true)]
    [InlineData("Docs", "/music/Docs/", true)]
    [InlineData("Docs", "/music/Docs/manuals/", true)]
    [InlineData("docs", "/DOCS/", true)]
    [InlineData("Docs", "/MyDocs/", false)]
    [InlineData("Docs", "/Docs2/", false)]
    [InlineData("MUSICIANS/S/Szachista", "/music/MUSICIANS/S/Szachista/", true)]
    [InlineData("MUSICIANS/S/Szachista", "/music/MUSICIANS/S/Szachista/tunes/", true)]
    [InlineData("MUSICIANS/S/Szachista", "/music/MUSICIANS/S/", false)]
    [InlineData("MUSICIANS/S/Szachista", "/music/MUSICIANS/S/Szachista2/", false)]
    [InlineData("MUSICIANS/S/Szachista", "/music/MUSICIANS/X/S/Szachista/", false)]
    [InlineData("System Volume Information", "/System Volume Information/", true)]
    public void IsBannedDirectory_MatchesWholePathSegments(string entry, string path, bool expected)
    {
        BanMatcher.IsBannedDirectory(path, [entry]).Should().Be(expected);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("Docs")]
    [InlineData("")]
    public void IsBannedDirectory_RootIsNeverBanned(string entry)
    {
        BanMatcher.IsBannedDirectory("/", [entry]).Should().BeFalse();
    }

    [Fact]
    public void IsBannedDirectory_BlankEntriesAndRootEntryBanNothing()
    {
        BanMatcher.IsBannedDirectory("/music/", ["", "  ", "/"]).Should().BeFalse();
        BanMatcher.IsBannedDirectory("/music/", []).Should().BeFalse();
    }

    [Fact]
    public void IsBannedDirectory_AnyMatchingEntryBans()
    {
        BanMatcher.IsBannedDirectory("/music/Docs/", ["/games", "Docs"]).Should().BeTrue();
    }
}
