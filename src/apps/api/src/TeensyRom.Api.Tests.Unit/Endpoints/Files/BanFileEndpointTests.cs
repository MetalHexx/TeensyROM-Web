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

    public BanFileEndpointTests()
    {
        _settingsService.GetSettings().Returns(_settings);
        _settingsService.SaveSettings(Arg.Any<TeensySettings>()).Returns(true);
    }

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
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns(new FileItem { Name = "Tune.sid" });
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        var response = endpoint.Response!;
        response.AlreadyBanned.Should().BeFalse();
        response.BannedFileName.Should().Be("Tune.sid");
        response.Message.Should().NotBeEmpty();

        _settingsService.Received(1).SaveSettings(Arg.Is<TeensySettings>(s =>
            s.SearchSettings.BannedFiles.SequenceEqual(new[] { "existing.sid", "Tune.sid" })));
        _settings.SearchSettings.BannedFiles.Should().Equal("existing.sid");
    }

    [Fact]
    public async Task Handle_RecordedName_IsMatchedByBanMatcher()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns(new FileItem { Name = "Tune.sid" });
        TeensySettings? saved = null;
        _settingsService.SaveSettings(Arg.Do<TeensySettings>(s => saved = s)).Returns(true);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        saved.Should().NotBeNull();
        BanMatcher.IsBannedFile(endpoint.Response!.BannedFileName, saved!.SearchSettings.BannedFiles).Should().BeTrue();
    }

    [Theory]
    [InlineData("/music/existing.sid")]
    [InlineData("/music/EXISTING.SID")]
    public async Task Handle_AlreadyBanned_AnswersWithoutSavingEvenWhenFileLookupIsNull(string path)
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(path: path), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.AlreadyBanned.Should().BeTrue();
        endpoint.Response!.BannedFileName.Should().NotBeEmpty();
        endpoint.Response!.Message.Should().NotBeEmpty();
        _settingsService.DidNotReceive().SaveSettings(Arg.Any<TeensySettings>());
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.GetAvailableDevice("UNKNOWN1").Returns((TeensyRomDevice?)null);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(deviceId: "UNKNOWN1"), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        _settingsService.DidNotReceive().SaveSettings(Arg.Any<TeensySettings>());
    }

    [Fact]
    public async Task Handle_UnavailableStorage_SendsNotFound()
    {
        var device = NewDevice(sdAvailable: false);
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        _settingsService.DidNotReceive().SaveSettings(Arg.Any<TeensySettings>());
    }

    [Fact]
    public async Task Handle_FileNotFound_SendsNotFound()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().NotBeEmpty();
        _settingsService.DidNotReceive().SaveSettings(Arg.Any<TeensySettings>());
    }

    [Fact]
    public async Task Handle_SaveFails_SendsExternalError()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns(new FileItem { Name = "Tune.sid" });
        _settingsService.SaveSettings(Arg.Any<TeensySettings>()).Returns(false);
        var endpoint = NewEndpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
    }
}
