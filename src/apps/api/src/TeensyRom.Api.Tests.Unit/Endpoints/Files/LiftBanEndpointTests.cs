using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Files.LiftBan;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class LiftBanEndpointTests
{
    private readonly ISettingsService _settingsService = Substitute.For<ISettingsService>();
    private TeensySettings _latest;
    private int _saves;

    public LiftBanEndpointTests()
    {
        _latest = new TeensySettings
        {
            SearchSettings = new SearchSettings
            {
                BannedFiles = ["Tune.sid", "other.sid"],
                BannedDirectories = ["/games/bad/", "bad/"]
            }
        };
        _settingsService.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(call =>
        {
            var updated = call.Arg<Func<TeensySettings, TeensySettings>>()(_latest);

            if (ReferenceEquals(updated, _latest)) return true;

            _latest = updated;
            _saves++;
            return true;
        });
    }

    private LiftBanEndpoint NewEndpoint() => EndpointFactory.CreateEndpoint<LiftBanEndpoint>(_settingsService);

    private async Task<LiftBanEndpoint> Lift(string entry, BanKind kind = BanKind.File)
    {
        var endpoint = NewEndpoint();
        await endpoint.Handle(new LiftBanRequest { Entry = entry, Kind = kind }, CancellationToken.None);
        return endpoint;
    }

    [Fact]
    public async Task Handle_BannedFileName_RemovesItAndSavesOnce()
    {
        var endpoint = await Lift("Tune.sid");

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        var response = endpoint.Response!;
        response.Lifted.Should().BeTrue();
        response.Entry.Should().Be("Tune.sid");
        response.Kind.Should().Be(BanKind.File);
        response.Message.Should().NotBeEmpty();
        _saves.Should().Be(1);
        _latest.SearchSettings.BannedFiles.Should().Equal("other.sid");
    }

    [Fact]
    public async Task Handle_SecondLift_AnswersNotLiftedAndSavesNothing()
    {
        await Lift("Tune.sid");

        var endpoint = await Lift("Tune.sid");

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Lifted.Should().BeFalse();
        endpoint.Response!.Message.Should().NotBeEmpty();
        _saves.Should().Be(1);
    }

    [Theory]
    [InlineData("/music/Tune.sid")]
    [InlineData("music/sub/Tune.sid/")]
    public async Task Handle_FilePath_LiftsTheLastSegment(string entry)
    {
        var endpoint = await Lift(entry);

        endpoint.Response!.Lifted.Should().BeTrue();
        endpoint.Response!.Entry.Should().Be("Tune.sid");
        _latest.SearchSettings.BannedFiles.Should().Equal("other.sid");
    }

    [Fact]
    public async Task Handle_DifferentCase_StillLifts()
    {
        var endpoint = await Lift("TUNE.SID");

        endpoint.Response!.Lifted.Should().BeTrue();
        _latest.SearchSettings.BannedFiles.Should().Equal("other.sid");
    }

    [Fact]
    public async Task Handle_AnchoredFolder_LeavesTheUnanchoredEntryAlone()
    {
        var endpoint = await Lift("/games/bad", BanKind.Folder);

        endpoint.Response!.Lifted.Should().BeTrue();
        endpoint.Response!.Entry.Should().Be("/games/bad");
        endpoint.Response!.Kind.Should().Be(BanKind.Folder);
        _latest.SearchSettings.BannedDirectories.Should().Equal("bad/");
    }

    [Fact]
    public async Task Handle_UnanchoredFolder_LeavesTheAnchoredEntryAlone()
    {
        var endpoint = await Lift("bad", BanKind.Folder);

        endpoint.Response!.Lifted.Should().BeTrue();
        _latest.SearchSettings.BannedDirectories.Should().Equal("/games/bad/");
    }

    [Fact]
    public async Task Handle_SlashOnlyFolderEntry_NeverMatches()
    {
        _latest = _latest with { SearchSettings = _latest.SearchSettings with { BannedDirectories = ["/", "/games/"] } };

        var endpoint = await Lift("/", BanKind.Folder);

        endpoint.Response!.Lifted.Should().BeFalse();
        _saves.Should().Be(0);
        _latest.SearchSettings.BannedDirectories.Should().Equal("/", "/games/");
    }

    [Fact]
    public async Task Handle_NotBanned_AnswersNotLiftedAndSavesNothing()
    {
        var endpoint = await Lift("missing.sid");

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Lifted.Should().BeFalse();
        endpoint.Response!.Entry.Should().Be("missing.sid");
        _saves.Should().Be(0);
        _latest.SearchSettings.BannedFiles.Should().Equal("Tune.sid", "other.sid");
    }

    [Fact]
    public async Task Handle_SettingsChangedJustBeforeTheUpdate_AreNotReverted()
    {
        _settingsService.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(call =>
        {
            _latest = _latest with { AppSettings = _latest.AppSettings with { FirstTimeSetup = false } };
            _latest = call.Arg<Func<TeensySettings, TeensySettings>>()(_latest);
            return true;
        });

        var endpoint = await Lift("Tune.sid");

        endpoint.Response!.Lifted.Should().BeTrue();
        _latest.AppSettings.FirstTimeSetup.Should().BeFalse();
        _latest.SearchSettings.BannedFiles.Should().Equal("other.sid");
    }

    [Fact]
    public async Task Handle_SaveFails_SendsExternalError()
    {
        _settingsService.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(false);

        var endpoint = await Lift("Tune.sid");

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
    }

    [Fact]
    public async Task Handle_FileLift_ChangesOnlyTheBannedFilesList()
    {
        var before = _latest.SearchSettings;

        await Lift("Tune.sid");

        _latest.SearchSettings.BannedDirectories.Should().Equal(before.BannedDirectories);
        _latest.SearchSettings.Should().BeEquivalentTo(before, o => o.Excluding(s => s.BannedFiles));
    }

    [Fact]
    public async Task Handle_FolderLift_ChangesOnlyTheBannedFoldersList()
    {
        var before = _latest.SearchSettings;

        await Lift("/games/bad/", BanKind.Folder);

        _latest.SearchSettings.BannedFiles.Should().Equal(before.BannedFiles);
        _latest.SearchSettings.Should().BeEquivalentTo(before, o => o.Excluding(s => s.BannedDirectories));
    }
}
