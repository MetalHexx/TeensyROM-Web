using NSubstitute;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;
using static TeensyRom.Cli.Tests.ApiTestSupport;
using ApiStorageType = TeensyRom.Cli.Api.Generated.TeensyStorageType;
using TeensyFilterType = TeensyRom.Cli.Settings.TeensyFilterType;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

public class StorageServiceTests
{
    private const string DeviceId = "abc123";

    private readonly ITeensyRomApiClient _api = Substitute.For<ITeensyRomApiClient>();
    private readonly IDeviceService _devices = Substitute.For<IDeviceService>();
    private readonly ISettingsService _settings = Substitute.For<ISettingsService>();
    private readonly IAlertService _alert = Substitute.For<IAlertService>();
    private readonly StorageService _sut;

    public StorageServiceTests()
    {
        _devices.RequireDeviceId().Returns(DeviceId);
        _settings.GetSettings().Returns(_ => new TeensySettings { StorageType = TeensyStorageType.SD });
        _sut = new StorageService(_api, _devices, _settings, _alert);
    }

    private static FileItemDto File(string path, FileItemType type = FileItemType.Song, ApiStorageType storage = ApiStorageType.SD) => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path,
        Type = type,
        StorageType = storage,
        IsCompatible = true
    };

    private static SongItem Song(string path = "/music/Commando.sid") => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path
    };

    [Fact]
    public void StorageType_StartsAsTheSavedPreference()
    {
        _settings.GetSettings().Returns(_ => new TeensySettings { StorageType = TeensyStorageType.USB });

        new StorageService(_api, _devices, _settings, _alert).StorageType.Should().Be(TeensyStorageType.USB);
    }

    [Fact]
    public void SwitchStorage_ChangesTheStorage_AndSavesItAsThePreference()
    {
        _sut.SwitchStorage(TeensyStorageType.USB);

        _sut.StorageType.Should().Be(TeensyStorageType.USB);
        _settings.Received(1).SaveSettings(Arg.Is<TeensySettings>(s => s.StorageType == TeensyStorageType.USB));
    }

    [Fact]
    public async Task UseStorage_ChangesTheStorageForThisSession_WithoutSavingThePreference()
    {
        _sut.UseStorage(TeensyStorageType.USB);

        _sut.StorageType.Should().Be(TeensyStorageType.USB);
        _settings.DidNotReceiveWithAnyArgs().SaveSettings(default!);

        await _sut.Index("/");
        await _api.Received(1).IndexAsync(DeviceId, ApiStorageType.USB, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetDirectory_ListsTheChosenStorage_AsTheCliModels()
    {
        _sut.SwitchStorage(TeensyStorageType.USB);
        _api.GetDirectoryAsync(DeviceId, ApiStorageType.USB, "/music", Arg.Any<CancellationToken>()).Returns(new GetDirectoryResponse
        {
            StorageItem = new StorageCacheDto
            {
                Path = "/music",
                Directories = [new DirectoryItemDto { Name = "MUSICIANS", Path = "/music/MUSICIANS" }],
                Files = [File("/music/a.sid"), File("/music/b.crt", FileItemType.Game)]
            }
        });

        var listing = await _sut.GetDirectory("/music");

        listing.Path.Should().Be("/music");
        listing.Directories.Should().ContainSingle().Which.Should().BeEquivalentTo(new { Name = "MUSICIANS", Path = "/music/MUSICIANS" });
        listing.Files.Should().HaveCount(2);
        listing.Files[0].Should().BeOfType<SongItem>();
        listing.Files[1].Should().BeOfType<GameItem>();
    }

    [Fact]
    public async Task GetDirectory_WhenTheStorageIsNotAvailable_SurfacesTheApisMessage()
    {
        _api.GetDirectoryAsync(DeviceId, Arg.Any<ApiStorageType>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<GetDirectoryResponse>(ApiFailure(404, "\"The storage USB is not available.\"")));

        var act = () => _sut.GetDirectory("/");

        var failure = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        failure.Message.Should().Be("The storage USB is not available.");
        failure.StatusCode.Should().Be(404);
    }

    private void DirectoryReads(params object[] outcomes)
    {
        var calls = 0;
        _api.GetDirectoryAsync(DeviceId, ApiStorageType.SD, "/music/H/", Arg.Any<CancellationToken>()).Returns(_ =>
            outcomes[Math.Min(calls++, outcomes.Length - 1)] switch
            {
                GetDirectoryResponse ok => Task.FromResult(ok),
                var failure => Task.FromException<GetDirectoryResponse>((Exception)failure)
            });
    }

    private static ApiException DirectoryNotFound() => ApiFailure(404, "\"The directory /music/H/ was not found.\"");

    [Fact]
    public async Task GetDirectory_RetriesA404_AndSucceedsOnTheThirdAttempt()
    {
        DirectoryReads(
            DirectoryNotFound(),
            DirectoryNotFound(),
            new GetDirectoryResponse { StorageItem = new StorageCacheDto { Path = "/music/H/", Directories = [], Files = [File("/music/H/a.sid")] } });

        var listing = await _sut.GetDirectory("/music/H/");

        listing.Files.Should().ContainSingle();
        await _api.Received(3).GetDirectoryAsync(DeviceId, ApiStorageType.SD, "/music/H/", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetDirectory_WhenEveryAttemptIs404_FailsAfterThree_SayingMissingOrNotAnswering_WithDetails()
    {
        _devices.SelectedDevice.Returns(new DeviceSummary(DeviceId, "TR-1", true, "Ethernet 1.2.3.4", "Connected"));
        DirectoryReads(DirectoryNotFound());

        var act = () => _sut.GetDirectory("/music/H/");

        var failure = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        failure.StatusCode.Should().Be(404);
        failure.Message.Should().Contain("/music/H/ was not found").And.Contain("TR-1 did not answer").And.Contain("3 attempts");
        failure.Details.Should().NotBeNull();
        failure.Details!.Path.Should().Be("/music/H/");
        failure.Details.Device.Should().Be("TR-1");
        failure.Details.Attempts.Should().Be(3);
        failure.Details.PossibleCauses.Should().HaveCountGreaterThan(1);
        await _api.Received(3).GetDirectoryAsync(DeviceId, ApiStorageType.SD, "/music/H/", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetDirectory_DoesNotRetryAFailureThatIsNot404()
    {
        DirectoryReads(ApiFailure(500, "\"boom\""));

        var act = () => _sut.GetDirectory("/music/H/");

        await act.Should().ThrowAsync<TeensyApiException>();
        await _api.Received(1).GetDirectoryAsync(DeviceId, ApiStorageType.SD, "/music/H/", Arg.Any<CancellationToken>());
    }

    private void ListDirectory(string path, params FileItemDto[] files) =>
        _api.GetDirectoryAsync(DeviceId, ApiStorageType.SD, path, Arg.Any<CancellationToken>())
            .Returns(new GetDirectoryResponse { StorageItem = new StorageCacheDto { Path = path, Directories = [], Files = [.. files] } });

    [Fact]
    public async Task GetFile_MatchesThePathExactly_NotAFileWhosePathMerelyContainsIt()
    {
        ListDirectory("/music/", File("/music/11.sid"), File("/music/1.sid"), File("/music/1.sid.bak", FileItemType.Unknown));

        var file = await _sut.GetFile("/music/1.sid");

        file.Should().NotBeNull();
        file!.Path.Should().Be("/music/1.sid");
    }

    [Fact]
    public async Task GetFile_WhenOnlyALongerPathContainsIt_FindsNothing()
    {
        ListDirectory("/music/", File("/music/11.sid"));

        (await _sut.GetFile("/music/1.sid")).Should().BeNull();
    }

    [Fact]
    public async Task GetFile_IgnoresCase_AsTheStorageDoes()
    {
        ListDirectory("/music/", File("/music/Commando.SID"));

        var file = await _sut.GetFile("/music/commando.sid");

        file.Should().NotBeNull();
        file!.Path.Should().Be("/music/Commando.SID");
    }

    [Fact]
    public async Task GetFile_OfAFileThatCantBeLaunched_FindsNothing()
    {
        ListDirectory("/docs/", File("/docs/notes.txt", FileItemType.Unknown));

        (await _sut.GetFile("/docs/notes.txt")).Should().BeNull();
    }

    [Fact]
    public async Task GetFile_ListsTheFilesParentDirectory()
    {
        ListDirectory("/");

        await _sut.GetFile("/top.sid");

        await _api.Received(1).GetDirectoryAsync(DeviceId, ApiStorageType.SD, "/", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Search_KeepsOnlyTheChosenStorage_AndOnlyLaunchableFiles()
    {
        _sut.SwitchStorage(TeensyStorageType.USB);
        _api.SearchAsync(DeviceId, "iron maiden", 0, 1000, NullableOfTeensyFilterType.Music, Arg.Any<CancellationToken>()).Returns(new SearchResponse
        {
            Files =
            [
                File("/music/sd.sid", storage: ApiStorageType.SD),
                File("/music/first.sid", storage: ApiStorageType.USB),
                File("/music/notes.txt", FileItemType.Unknown, ApiStorageType.USB),
                File("/games/second.crt", FileItemType.Game, ApiStorageType.USB)
            ]
        });

        var results = await _sut.Search("iron maiden", TeensyFilterType.Music);

        results.Select(r => r.Path).Should().Equal("/music/first.sid", "/games/second.crt");
        await _api.Received(1).SearchAsync(DeviceId, "iron maiden", 0, 1000, NullableOfTeensyFilterType.Music, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Search_WhenTheApiHasMoreResults_KeepsPagingAndKeepsTheChosenStoragesFilesFromEveryPage()
    {
        _sut.SwitchStorage(TeensyStorageType.USB);
        _api.SearchAsync(DeviceId, "sid", 0, 1000, Arg.Any<NullableOfTeensyFilterType?>(), Arg.Any<CancellationToken>()).Returns(new SearchResponse
        {
            Files = [File("/music/sd-a.sid", storage: ApiStorageType.SD), File("/music/usb-a.sid", storage: ApiStorageType.USB)],
            HasMore = true
        });
        _api.SearchAsync(DeviceId, "sid", 1000, 1000, Arg.Any<NullableOfTeensyFilterType?>(), Arg.Any<CancellationToken>()).Returns(new SearchResponse
        {
            Files = [File("/music/usb-b.sid", storage: ApiStorageType.USB)],
            HasMore = false
        });

        var results = await _sut.Search("sid", TeensyFilterType.All);

        results.Select(r => r.Path).Should().Equal("/music/usb-a.sid", "/music/usb-b.sid");
        await _api.Received(2).SearchAsync(DeviceId, "sid", Arg.Any<int>(), 1000, Arg.Any<NullableOfTeensyFilterType?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Index_SendsTheChosenDeviceStorageAndPath()
    {
        _sut.SwitchStorage(TeensyStorageType.USB);

        await _sut.Index("/music/MUSICIANS");

        await _api.Received(1).IndexAsync(DeviceId, ApiStorageType.USB, "/music/MUSICIANS", Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("")]
    [InlineData("/")]
    public async Task Index_OfTheRoot_IndexesTheWholeStorage(string path)
    {
        await _sut.Index(path);

        await _api.Received(1).IndexAsync(DeviceId, ApiStorageType.SD, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveFavorite_TagsTheFile_AndFlipsItsFlag()
    {
        var song = Song();
        _api.SaveFavoriteAsync(DeviceId, ApiStorageType.SD, song.Path, Arg.Any<CancellationToken>())
            .Returns(new SaveFavoriteResponse { FavoritePath = "/favorites/music" });

        await _sut.SaveFavorite(song);

        song.IsFavorite.Should().BeTrue();
        _alert.Received(1).Publish("A copy was placed in /favorites/music.");
    }

    [Fact]
    public async Task SaveFavorite_WhenTheApiFails_LeavesTheFlagAlone()
    {
        var song = Song();
        _api.SaveFavoriteAsync(DeviceId, Arg.Any<ApiStorageType>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<SaveFavoriteResponse>(ApiFailure(502, """{"title":"Failed to save favorite. Please try again."}""")));

        var act = () => _sut.SaveFavorite(song);

        await act.Should().ThrowAsync<TeensyApiException>().WithMessage("Failed to save favorite. Please try again.");
        song.IsFavorite.Should().BeFalse();
    }

    [Fact]
    public async Task RemoveFavorite_UntagsTheFile_AndClearsItsFlag()
    {
        var song = Song("/favorites/music/Commando.sid");
        song.IsFavorite = true;

        await _sut.RemoveFavorite(song);

        song.IsFavorite.Should().BeFalse();
        await _api.Received(1).RemoveFavoriteAsync(DeviceId, ApiStorageType.SD, "/favorites/music/Commando.sid", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BanFile_AsksTrWebToBanThePathOnTheGivenStorage_AndReturnsItsAnswer()
    {
        _api.BanFileAsync(DeviceId, ApiStorageType.USB, "/music/Commando.sid", Arg.Any<CancellationToken>())
            .Returns(new BanFileResponse { Message = "Commando.sid is now banned.", BannedFileName = "Commando.sid", AlreadyBanned = false });

        var result = await _sut.BanFile("/music/Commando.sid", TeensyStorageType.USB);

        result.Should().Be(new BanResult("Commando.sid", false, "Commando.sid is now banned."));
        _alert.Received(1).Publish("Commando.sid is now banned.");
    }

    [Fact]
    public async Task BanFile_OfAnAlreadyBannedFile_ReportsItWasAlreadyBanned()
    {
        _api.BanFileAsync(DeviceId, ApiStorageType.SD, "/music/Commando.sid", Arg.Any<CancellationToken>())
            .Returns(new BanFileResponse { Message = "Already banned.", BannedFileName = "Commando.sid", AlreadyBanned = true });

        var result = await _sut.BanFile("/music/Commando.sid", TeensyStorageType.SD);

        result.AlreadyBanned.Should().BeTrue();
    }

    [Fact]
    public async Task BanFile_NeverReadsOrWritesTheSettingsDocument_NorListsADirectory()
    {
        _api.BanFileAsync(Arg.Any<string>(), Arg.Any<ApiStorageType>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new BanFileResponse { Message = "Banned.", BannedFileName = "Commando.sid" });

        await _sut.BanFile("/music/Commando.sid", TeensyStorageType.SD);

        await _api.DidNotReceive().GetSettingsAsync(Arg.Any<CancellationToken>());
        await _api.DidNotReceive().SaveSettingsAsync(Arg.Any<SaveSettingsRequest>(), Arg.Any<CancellationToken>());
        await _api.DidNotReceive().GetDirectoryAsync(Arg.Any<string>(), Arg.Any<ApiStorageType>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BanFile_WithNoSelectedDevice_Throws()
    {
        _devices.RequireDeviceId().Returns(_ => throw new TeensyApiException("No TeensyROM is selected."));

        var act = () => _sut.BanFile("/music/Commando.sid", TeensyStorageType.SD);

        await act.Should().ThrowAsync<TeensyApiException>().WithMessage("No TeensyROM is selected.");
    }
    [Fact]
    public async Task GetDirectory_WithNoSelectedDevice_Throws()
    {
        _devices.RequireDeviceId().Returns(_ => throw new TeensyApiException("No TeensyROM is selected."));

        var act = () => _sut.GetDirectory("/");

        await act.Should().ThrowAsync<TeensyApiException>().WithMessage("No TeensyROM is selected.");
    }
}
