using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Files.BanFile;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class BanFileEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private const string Path = "/music/Tune.sid";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly ISettingsService _settingsService = Substitute.For<ISettingsService>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();
    private readonly TeensySettings _settings = new()
    {
        SearchSettings = new SearchSettings { BannedFiles = ["existing.sid"] }
    };
    private TeensySettings _latest;
    private int _saves;

    public BanFileEndpointTests()
    {
        _latest = _settings;
        _settingsService.GetSettings().Returns(_ => _latest);
        _settingsService.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(call =>
        {
            var updated = call.Arg<Func<TeensySettings, TeensySettings>>()(_latest);

            if (ReferenceEquals(updated, _latest)) return true;

            _latest = updated;
            _saves++;
            return true;
        });
    }

    private void Update(Func<TeensySettings, TeensySettings> change) => _latest = change(_latest);

    private TeensyRomDevice NewDevice(bool sdAvailable = true)
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, sdAvailable),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        return new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
    }

    private static BanFileRequest Request(string deviceId = DeviceId, string path = Path) => new()
    {
        DeviceId = deviceId,
        StorageType = TeensyStorageType.SD,
        FilePath = path
    };

    private BanFileEndpoint NewEndpoint() =>
        EndpointFactory.CreateEndpoint<BanFileEndpoint>(_deviceManager, _settingsService);

    [Fact]
    public async Task Handle_NewFile_AddsNameOnceAndSavesNewList()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.Found(new FileItem { Name = "Tune.sid" }));
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        var response = endpoint.Response!;
        response.AlreadyBanned.Should().BeFalse();
        response.BannedFileName.Should().Be("Tune.sid");
        response.Message.Should().NotBeEmpty();

        _saves.Should().Be(1);
        _latest.SearchSettings.BannedFiles.Should().Equal("existing.sid", "Tune.sid");
        _settings.SearchSettings.BannedFiles.Should().Equal("existing.sid");
    }

    [Fact]
    public async Task Handle_RecordedName_IsMatchedByBanMatcher()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.Found(new FileItem { Name = "Tune.sid" }));
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        BanMatcher.IsBannedFile(endpoint.Response!.BannedFileName, _latest.SearchSettings.BannedFiles).Should().BeTrue();
    }

    [Fact]
    public async Task Handle_BannedByAnotherRequestDuringTheFileLookup_AnswersAlreadyBannedAndAddsNothing()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(_ =>
        {
            Update(s => s with { SearchSettings = s.SearchSettings with { BannedFiles = [.. s.SearchSettings.BannedFiles, "Tune.sid"] } });
            return FileLookupResult.Found(new FileItem { Name = "Tune.sid" });
        });
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.AlreadyBanned.Should().BeTrue();
        endpoint.Response!.BannedFileName.Should().Be("Tune.sid");
        _saves.Should().Be(0);
        _latest.SearchSettings.BannedFiles.Should().Equal("existing.sid", "Tune.sid");
    }

    [Fact]
    public async Task Handle_SettingsSavedDuringTheFileLookup_AreNotRevertedByTheBan()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(_ =>
        {
            Update(s => s with { AppSettings = s.AppSettings with { FirstTimeSetup = false } });
            return FileLookupResult.Found(new FileItem { Name = "Tune.sid" });
        });
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.Response!.AlreadyBanned.Should().BeFalse();
        _latest.SearchSettings.BannedFiles.Should().Equal("existing.sid", "Tune.sid");
        _latest.AppSettings.FirstTimeSetup.Should().BeFalse();
    }

    [Theory]
    [InlineData("/music/existing.sid")]
    [InlineData("/music/EXISTING.SID")]
    public async Task Handle_AlreadyBanned_AnswersWithoutSavingEvenWhenFileLookupIsNull(string path)
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.NotFound());
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(path: path), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.AlreadyBanned.Should().BeTrue();
        endpoint.Response!.BannedFileName.Should().NotBeEmpty();
        endpoint.Response!.Message.Should().NotBeEmpty();
        _settingsService.DidNotReceive().UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>());
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.GetAvailableDevice("UNKNOWN1").Returns((TeensyRomDevice?)null);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(deviceId: "UNKNOWN1"), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        _settingsService.DidNotReceive().UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>());
    }

    [Fact]
    public async Task Handle_UnavailableStorage_SendsNotFound()
    {
        var device = NewDevice(sdAvailable: false);
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        _settingsService.DidNotReceive().UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>());
    }

    [Fact]
    public async Task Handle_FileNotFound_SendsNotFound()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.NotFound());
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().NotBeEmpty();
        _settingsService.DidNotReceive().UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>());
    }

    [Fact]
    public async Task Handle_SaveFails_SendsExternalError()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.Found(new FileItem { Name = "Tune.sid" }));
        _settingsService.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(false);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
    }

    [Fact]
    public async Task Handle_FileLookupFailed_SendsBadGatewayWithTheFailureAndBansNothing()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.Failed("The link dropped."));
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("The link dropped.");
        _settingsService.DidNotReceive().UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>());
    }
}
