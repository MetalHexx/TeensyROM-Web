using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Unit tests for CartFinder's device building: identity and hardware facts come from the endpoint's
/// version reply, storage availability from the read-only root probe, minimal firmware is carried
/// through recovery, and a busy storage probe is reset and re-probed once.
/// </summary>
public class CartFinderTests
{
    private const string ChipId = "19307720";

    private readonly ILoggingService _log;
    private readonly IStorageFactory _mockStorageFactory;
    private readonly IDeviceInterrogator _mockInterrogator;
    private readonly IAlertService _mockAlert;
    private readonly IDeviceRecovery _mockRecovery;
    private readonly IDeviceSettingsProvider _mockSettingsProvider;
    private readonly List<IDiscoveryStrategy> _mockDiscoveryStrategies;
    private readonly CartFinder _sut;

    public CartFinderTests()
    {
        _log = Substitute.For<ILoggingService>();
        _mockStorageFactory = Substitute.For<IStorageFactory>();
        _mockInterrogator = Substitute.For<IDeviceInterrogator>();
        _mockAlert = Substitute.For<IAlertService>();
        _mockRecovery = Substitute.For<IDeviceRecovery>();
        _mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        _mockDiscoveryStrategies = [];

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        _sut = new CartFinder(
            _log,
            _mockStorageFactory,
            _mockInterrogator,
            _mockAlert,
            _mockRecovery,
            _mockDiscoveryStrategies,
            _mockSettingsProvider
        );
    }

    #region Helper Methods

    private static ICommunicationPort CreatePort(ConnectionType connectionType = ConnectionType.Serial)
    {
        var port = Substitute.For<ICommunicationPort>();
        port.GetConnectionType().Returns(connectionType);
        return port;
    }

    private static DiscoveredEndpoint CreateTestEndpoint(
        ICommunicationPort port,
        VersionReply reply,
        string address = "COM3",
        ConnectionType connectionType = ConnectionType.Serial) =>
        new(connectionType, address, connectionType == ConnectionType.Tcp ? 80 : null, reply, port);

    private void SetupDiscoveryStrategy(params DiscoveredEndpoint[] endpoints)
    {
        var mockStrategy = Substitute.For<IDiscoveryStrategy>();
        mockStrategy.FindEndpoints(Arg.Any<CancellationToken>())
            .Returns(endpoints.ToList());
        _mockDiscoveryStrategies.Add(mockStrategy);
    }

    /// <summary>A fully populated reply at the compatibility floor.</summary>
    private static VersionReply FullReply(string? chipId = ChipId) => new()
    {
        IsTeensyRom = true,
        HardwareVariant = HardwareVariant.TeensyRomPlus,
        FirmwareVersion = new Version(0, 8, 0, 9),
        BuildTimestamp = "Sep 18 2026, 09:41:32",
        CpuMhz = 816,
        TemperatureC = 59.1m,
        ChipId = chipId,
        Machine = MachineType.C128,
        VideoStandard = VideoStandard.NTSC,
        TodClockHz = 60
    };

    private static VersionReply BelowFloorReply(string? chipId = ChipId) => new()
    {
        IsTeensyRom = true,
        HardwareVariant = HardwareVariant.TeensyRom,
        FirmwareVersion = new Version(0, 7, 2, 10),
        ChipId = chipId
    };

    private static VersionReply MinimalReply(string? chipId = ChipId) => new()
    {
        IsTeensyRom = true,
        IsMinimalFirmware = true,
        ChipId = chipId
    };

    private void SetupProbes(StoragePresence sd, StoragePresence usb) =>
        SetupProbes(new Queue<StoragePresence>([sd]), new Queue<StoragePresence>([usb]));

    private void SetupProbes(Queue<StoragePresence> sd, Queue<StoragePresence> usb)
    {
        _mockInterrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.SD).Returns(_ => sd.Dequeue());
        _mockInterrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.USB).Returns(_ => usb.Dequeue());
    }

    #endregion

    [Fact]
    public async Task FindDevices_WithCompatibleReply_BuildsCartFromReplyAndProbeResults()
    {
        var port = CreatePort();
        var reply = FullReply();
        SetupDiscoveryStrategy(CreateTestEndpoint(port, reply));
        SetupProbes(StoragePresence.Present, StoragePresence.Absent);

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        var cart = result.Single().Cart;
        cart.DeviceId.Should().Be(ChipId);
        cart.IsCompatible.Should().BeTrue();
        cart.FwVersion.Should().Be("0.8.0.9");
        cart.HardwareVariant.Should().Be(reply.HardwareVariant);
        cart.IsMinimalFirmware.Should().BeFalse();
        cart.BuildTimestamp.Should().Be(reply.BuildTimestamp);
        cart.CpuMhz.Should().Be(reply.CpuMhz);
        cart.TemperatureC.Should().Be(reply.TemperatureC);
        cart.Machine.Should().Be(reply.Machine);
        cart.VideoStandard.Should().Be(reply.VideoStandard);
        cart.TodClockHz.Should().Be(reply.TodClockHz);
        cart.SdStorage.Available.Should().BeTrue();
        cart.UsbStorage.Available.Should().BeFalse();
        cart.SdStorage.DeviceId.Should().Be(ChipId);
        cart.UsbStorage.DeviceId.Should().Be(ChipId);
        result.Single().Connection.Mode.Should().Be(DeviceMode.FullIdle);
        _mockSettingsProvider.Received(1).GetOrCreateDeviceSettings(ChipId);
    }

    [Fact]
    public async Task FindDevices_WithBelowFloorReply_ListsIncompatibleDeviceWithoutProbingOrSettings()
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port, BelowFloorReply()));

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        var cart = result.Single().Cart;
        cart.IsCompatible.Should().BeFalse();
        cart.FwVersion.Should().Be("0.7.2.10");
        cart.DeviceId.Should().Be(ChipId);
        cart.SdStorage.DeviceId.Should().Be(ChipId);
        cart.UsbStorage.DeviceId.Should().Be(ChipId);
        cart.SdStorage.Available.Should().BeFalse();
        cart.UsbStorage.Available.Should().BeFalse();
        _mockInterrogator.DidNotReceive().ProbeStorage(Arg.Any<ICommunicationPort>(), Arg.Any<TeensyStorageType>());
        _mockSettingsProvider.DidNotReceive().GetOrCreateDeviceSettings(Arg.Any<string>());
        _mockAlert.Received(1).Publish(Arg.Any<string>());
    }

    [Fact]
    public async Task FindDevices_WithTwoRepliesMissingChipId_AssignsNumberedUnknownStandIns()
    {
        SetupDiscoveryStrategy(
            CreateTestEndpoint(CreatePort(), BelowFloorReply(chipId: null), "COM3"),
            CreateTestEndpoint(CreatePort(), BelowFloorReply(chipId: null), "COM4"));

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Select(d => d.Cart.DeviceId).Should().Equal("Unknown", "Unknown-2");
        result.Select(d => d.Cart.SdStorage.DeviceId).Should().Equal("Unknown", "Unknown-2");
        result.Select(d => d.Cart.UsbStorage.DeviceId).Should().Equal("Unknown", "Unknown-2");
        _mockInterrogator.DidNotReceive().ProbeStorage(Arg.Any<ICommunicationPort>(), Arg.Any<TeensyStorageType>());
        _mockSettingsProvider.DidNotReceive().GetOrCreateDeviceSettings(Arg.Any<string>());
    }

    [Fact]
    public async Task FindDevices_WithCompatibleReplyMissingChipId_ListsStandInAndSkipsSettings()
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port, FullReply(chipId: null)));
        SetupProbes(StoragePresence.Present, StoragePresence.Present);

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        result.Single().Cart.DeviceId.Should().Be("Unknown");
        result.Single().Cart.IsCompatible.Should().BeTrue();
        _mockSettingsProvider.DidNotReceive().GetOrCreateDeviceSettings(Arg.Any<string>());
    }

    [Fact]
    public async Task FindDevices_WithSameChipIdOnSerialAndTcp_KeepsTcpAndDisposesSerialPort()
    {
        var serialPort = CreatePort();
        var tcpPort = CreatePort(ConnectionType.Tcp);
        SetupDiscoveryStrategy(
            CreateTestEndpoint(serialPort, FullReply(), "COM3"),
            CreateTestEndpoint(tcpPort, FullReply(), "192.168.1.10:80", connectionType: ConnectionType.Tcp));
        SetupProbes(
            new Queue<StoragePresence>([StoragePresence.Present, StoragePresence.Present]),
            new Queue<StoragePresence>([StoragePresence.Present, StoragePresence.Present]));

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        var device = result.Single();
        device.ConnectionType.Should().Be(ConnectionType.Tcp);
        device.Connection.TransportInUse.Should().Be(ConnectionType.Tcp);
        device.Connection.SerialPortName.Should().Be("COM3");
        device.Connection.TcpEndpoint.Should().NotBeNull();
        serialPort.Received(1).Dispose();
        tcpPort.DidNotReceive().Dispose();
        _mockSettingsProvider.Received(1).GetOrCreateDeviceSettings(ChipId);
    }

    [Theory]
    [InlineData(StoragePresence.Unknown)]
    [InlineData(StoragePresence.Absent)]
    public async Task FindDevices_WithNonPresentProbeResult_MarksStorageUnavailable(StoragePresence presence)
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port, FullReply()));
        SetupProbes(presence, presence);

        var result = await _sut.FindDevices(CancellationToken.None);

        var cart = result.Single().Cart;
        cart.SdStorage.Available.Should().BeFalse();
        cart.UsbStorage.Available.Should().BeFalse();
    }

    [Fact]
    public async Task BuildDevice_WithMinimalFirmwareReply_ResetsThenRecoversBeforeReturningDevice()
    {
        var port = CreatePort();
        var endpoint = CreateTestEndpoint(port, MinimalReply());
        _mockRecovery.RecoverAsync(Arg.Any<TeensyRomDevice>(), RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.Zero, null));

        var device = await _sut.BuildDevice(endpoint, CancellationToken.None);

        device.Should().NotBeNull();
        port.Received(1).SendIntBytes(TeensyToken.Reset, 2);
        await _mockRecovery.Received(1).RecoverAsync(
            Arg.Is<TeensyRomDevice>(d => d.DeviceId == ChipId),
            RecoveryReason.LeaveMinimal,
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(DeviceMode.Minimal)]
    [InlineData(DeviceMode.Unreachable)]
    public async Task BuildDevice_WithMinimalFirmwareReply_WhenRecoveryDoesNotReachFull_ReturnsNull(DeviceMode outcomeMode)
    {
        var port = CreatePort();
        var endpoint = CreateTestEndpoint(port, MinimalReply());
        _mockRecovery.RecoverAsync(Arg.Any<TeensyRomDevice>(), RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(outcomeMode, TimeSpan.Zero, TimeSpan.Zero, "did not reach full"));

        var device = await _sut.BuildDevice(endpoint, CancellationToken.None);

        device.Should().BeNull();
    }

    [Fact]
    public async Task BuildDevice_WithStorageBusyOnce_ResetsAndReprobesThenListsIdle()
    {
        var port = CreatePort();
        var endpoint = CreateTestEndpoint(port, FullReply());
        SetupProbes(
            new Queue<StoragePresence>([StoragePresence.Busy, StoragePresence.Present]),
            new Queue<StoragePresence>([StoragePresence.Busy, StoragePresence.Present]));

        var device = await _sut.BuildDevice(endpoint, CancellationToken.None);

        device.Should().NotBeNull();
        device!.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Cart.SdStorage.Available.Should().BeTrue();
        device.Cart.UsbStorage.Available.Should().BeTrue();
        port.Received(1).SendIntBytes(TeensyToken.Reset, 2);
        _mockInterrogator.Received(2).ProbeStorage(port, TeensyStorageType.SD);
    }

    [Fact]
    public async Task BuildDevice_WithStorageBusyAfterReset_ListsAsBusyWithStorageUnknown()
    {
        var port = CreatePort();
        var endpoint = CreateTestEndpoint(port, FullReply());
        SetupProbes(
            new Queue<StoragePresence>([StoragePresence.Busy, StoragePresence.Busy]),
            new Queue<StoragePresence>([StoragePresence.Busy, StoragePresence.Busy]));

        var device = await _sut.BuildDevice(endpoint, CancellationToken.None);

        device.Should().NotBeNull();
        device!.Connection.Mode.Should().Be(DeviceMode.FullBusy);
        port.Received(1).SendIntBytes(TeensyToken.Reset, 2);
        _mockInterrogator.Received(2).ProbeStorage(port, TeensyStorageType.SD);
        _mockInterrogator.Received(2).ProbeStorage(port, TeensyStorageType.USB);
    }
}
