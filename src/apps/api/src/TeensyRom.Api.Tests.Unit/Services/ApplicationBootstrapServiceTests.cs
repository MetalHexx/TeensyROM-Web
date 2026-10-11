using TeensyRom.Api.Services;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Unit.Services;

public class ApplicationBootstrapServiceTests
{
    private readonly ISettingsService _settingsService = Substitute.For<ISettingsService>();
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private ApplicationBootstrapService CreateService() => new(
        _settingsService,
        _deviceManager,
        Substitute.For<ITransferStagingStore>(),
        Substitute.For<ITransferScratchStore>(),
        _log);

    private void GivenSettingsFor(params string[] ids)
    {
        _settingsService.GetSettings().Returns(new TeensySettings
        {
            KnownDevices = ids.Select(id => new DeviceSettings { DeviceId = id }).ToList()
        });
        _settingsService.RemoveDeviceSettings(Arg.Any<string>()).Returns(true);
    }

    private static TeensyRomDevice AvailableDevice(string chipId) => new(
        new Cart { DeviceId = chipId },
        Substitute.For<ICommunicationPort>(),
        Substitute.For<IStorageService>(),
        Substitute.For<IStorageService>());

    private static OfflineDevice OfflineUnit(string chipId) =>
        new(chipId, "COM3", null, ConnectionType.Serial, "1.0.0", HardwareVariant.TeensyRom, true, chipId);

    private void GivenStartKnows(string[] availableIds, string[] offlineIds, bool startedFromSavedRecords = true)
    {
        var available = availableIds.Select(AvailableDevice).ToList();
        _deviceManager.StartedFromSavedRecords.Returns(startedFromSavedRecords);
        _deviceManager.ConnectAtStartAsync(Arg.Any<CancellationToken>()).Returns(available);
        _deviceManager.GetAvailableDevices().Returns(available);
        _deviceManager.GetOfflineDevices().Returns(offlineIds.Select(OfflineUnit).ToList());
    }

    [Fact]
    public async Task StartAsync_RemovesOnlyTheSettingsEntryNoRecordBacks()
    {
        GivenSettingsFor("AAAA", "BBBB", "OLDHASH");
        GivenStartKnows(availableIds: ["AAAA"], offlineIds: ["BBBB"]);

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.Received(1).RemoveDeviceSettings("OLDHASH");
        _settingsService.Received(1).RemoveDeviceSettings(Arg.Any<string>());
        _log.Received(1).Internal("ApplicationBootstrap: Removed orphaned settings for OLDHASH", Arg.Any<string?>());
    }

    [Fact]
    public async Task StartAsync_NothingAvailableButUnitsOffline_StillRunsTheCleanup()
    {
        GivenSettingsFor("AAAA", "OLDHASH");
        GivenStartKnows(availableIds: [], offlineIds: ["AAAA"]);

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.Received(1).RemoveDeviceSettings("OLDHASH");
    }

    [Fact]
    public async Task StartAsync_NoConnectionRecords_LeavesSettingsUntouched()
    {
        GivenSettingsFor("AAAA", "BBBB");
        GivenStartKnows(availableIds: [], offlineIds: []);

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
        _log.Received(1).Internal("ApplicationBootstrap: Orphan cleanup skipped - no connection records", Arg.Any<string?>());
    }

    [Fact]
    public async Task StartAsync_StartBeganWithNoSavedRecordsButDiscoveryFoundUnits_LeavesSettingsUntouched()
    {
        // A deleted ConnectionRecords.json: the start fell back to a full discovery that found only AAAA,
        // so the records now held are the discovery's own - BBBB and OLDHASH are not orphans, just unseen.
        GivenSettingsFor("AAAA", "BBBB", "OLDHASH");
        GivenStartKnows(availableIds: ["AAAA"], offlineIds: [], startedFromSavedRecords: false);

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
        _log.Received(1).Internal("ApplicationBootstrap: Orphan cleanup skipped - start began with no saved connection records", Arg.Any<string?>());
    }

    [Fact]
    public async Task StartAsync_OnlyStandInsAvailable_LeavesSettingsUntouched()
    {
        GivenSettingsFor("AAAA");
        GivenStartKnows(availableIds: ["Unknown"], offlineIds: []);

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
    }

    [Fact]
    public async Task StartAsync_DiscoveryFails_LeavesSettingsUntouched()
    {
        GivenSettingsFor("AAAA", "OLDHASH");
        _deviceManager.ConnectAtStartAsync(Arg.Any<CancellationToken>())
            .Returns<List<TeensyRomDevice>>(_ => throw new InvalidOperationException("boom"));

        await CreateService().StartAsync(CancellationToken.None);

        _settingsService.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
    }
}
