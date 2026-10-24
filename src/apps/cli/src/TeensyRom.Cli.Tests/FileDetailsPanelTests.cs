using Spectre.Console.Testing;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

public class FileDetailsPanelTests
{
    private const string Esc = "\u001b";

    private static string Render(IFileItem item, bool ansi = false)
    {
        var console = ansi ? new TestConsole().EmitAnsiSequences() : new TestConsole();
        console.Profile.Width = 120;
        console.Write(FileDetailsPanel.Build(item));
        return console.Output;
    }

    private static SongItem Song(FileItemDto? record = null) => new()
    {
        Title = "Commando",
        Path = "/music/Commando.sid",
        IsFavorite = true,
        ApiRecord = record
    };

    private static FileItemDto FullRecord() => new()
    {
        Title = "Commando",
        Creator = "Rob Hubbard",
        ReleaseInfo = "1985 Elite",
        PlayLength = "00:03:20",
        Meta1 = "PAL",
        Meta2 = "MOS6581",
        Type = FileItemType.Song,
        AvgRating = 4.26,
        RatingCount = 12,
        Tags = [new FileTagDto { Name = "Classic", Type = "x" }, new FileTagDto { Name = "Cover", Type = "x" }],
        Competitions = [new CompetitionDto { Name = "Party 1", Place = 2 }, new CompetitionDto { Name = "Party 2" }],
        Links = [new FileLinkDto { Name = "DeepSID", Url = "https://deepsid.chordian.net/x" }],
        YouTubeVideos = [new YouTubeVideoDto { Channel = "SIDChannel", Url = "https://youtube.com/watch?v=abc" }],
        Description = "A fine tune."
    };

    [Fact]
    public void Build_ShowsEverySectionInOrder_WithTheDescriptionLast()
    {
        var output = Render(Song(FullRecord()));

        string[] expected =
        [
            "Now Playing: Commando", "Creator: Rob Hubbard", "Release: 1985 Elite", "Length: 00:03:20", "SID: MOS6581", "Clock: PAL",
            "Rating: 4.3 (12 ratings)", "Tags: Classic, Cover", "2. Party 1", "Party 2", "DeepSID — https://deepsid.chordian.net/x",
            "SIDChannel — https://youtube.com/watch?v=abc", "Path: /music/Commando.sid", "Favorite: Yes", "A fine tune."
        ];
        var positions = expected.Select(text => output.IndexOf(text, StringComparison.Ordinal)).ToList();

        positions.Should().OnlyContain(position => position >= 0);
        positions.Should().BeInAscendingOrder();
    }

    [Fact]
    public void Build_LeavesOutEmptySections()
    {
        var record = new FileItemDto { Title = "Commando", Creator = "Rob Hubbard", ReleaseInfo = "", PlayLength = "", Meta1 = "", Meta2 = "", Description = "", Type = FileItemType.Song };

        var output = Render(Song(record));

        output.Should().Contain("Creator: Rob Hubbard").And.Contain("Path:").And.Contain("Favorite:");
        output.Should().NotContain("Release:").And.NotContain("Length:").And.NotContain("Rating:").And.NotContain("Tags:")
            .And.NotContain("Competitions:").And.NotContain("Links:").And.NotContain("YouTube:").And.NotContain("SID Comments");
    }

    [Fact]
    public void Build_ShowsMarkupAndEscapeSequencesAsText_WithoutControlBytes()
    {
        var record = FullRecord();
        record.Title = $"[red]Hot[/] {Esc}[31mtune";
        record.Creator = "[bold]Rob[/]";
        record.Description = $"line [blue]one[/]{Esc}]0;pwned\u0007";

        var output = Render(Song(record));

        output.Should().Contain("Now Playing: [red]Hot[/] [31mtune").And.Contain("Creator: [bold]Rob[/]").And.Contain("line [blue]one[/]]0;pwned");
        output.Should().NotContain(Esc).And.NotContain("\u0007");
    }

    [Fact]
    public void Build_OnlyHttpAndHttpsLinksAreHyperlinks()
    {
        var record = FullRecord();
        record.Links =
        [
            new FileLinkDto { Name = "Evil", Url = "javascript:alert(1)" },
            new FileLinkDto { Name = "Rel", Url = "/some/path" }
        ];
        record.YouTubeVideos = [];

        var output = Render(Song(record), ansi: true);

        output.Should().Contain("Evil — javascript:alert(1)").And.Contain("Rel — /some/path").And.NotContain($"{Esc}]8;");
    }

    [Fact]
    public void Build_WithHttpLinks_EmitsHyperlinksOnAnAnsiTerminal_AndKeepsTheAddressEitherWay()
    {
        var withLinks = Render(Song(FullRecord()), ansi: true);
        var withoutLinks = Render(Song(FullRecord()), ansi: false);

        withLinks.Should().Contain($"{Esc}]8;");
        withoutLinks.Should().NotContain($"{Esc}]8;");
        withoutLinks.Should().Contain("https://deepsid.chordian.net/x").And.Contain("https://youtube.com/watch?v=abc");
    }

    [Fact]
    public void Build_WithoutAnApiRecord_FallsBackToTheItemsOwnFields()
    {
        var song = Song();
        song.Creator = "Jeroen Tel";
        song.ReleaseInfo = "1990 Maniacs";
        song.Meta1 = "NTSC";
        song.Meta2 = "MOS8580";
        song.PlayLength = TimeSpan.FromMinutes(2);
        song.Description = "Comment text";

        var output = Render(song);

        output.Should().Contain("Creator: Jeroen Tel").And.Contain("Release: 1990 Maniacs").And.Contain("Length: 00:02:00")
            .And.Contain("SID: MOS8580").And.Contain("Clock: NTSC").And.Contain("Comment text").And.Contain("SID Comments");
        output.Should().NotContain("Rating:").And.NotContain("Tags:");
    }

    [Fact]
    public void Build_ForANonSong_OmitsTheSidFacts()
    {
        var record = FullRecord();
        record.Type = FileItemType.Game;

        var output = Render(new GameItem { Title = "Game", Path = "/games/g.crt", ApiRecord = record });

        output.Should().NotContain("SID:").And.NotContain("Clock:").And.NotContain("SID Comments");
    }
}
