using MediatR;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Unit tests for CartFinder's device validation: identity and hardware facts come from the
/// version reply, storage availability from the read-only root probe.
/// </summary>
public class CartFinderTests
{
    private const string ChipId = "19307720";

    private readonly ILoggingService _log;
    private readonly IStorageFactory _mockStorageFactory;
    private readonly IDeviceInterrogator _mockInterrogator;
    private readonly IAlertService _mockAlert;
    private readonly IMediator _mockMediator;
    private readonly IDeviceSettingsProvider _mockSettingsProvider;
    private readonly List<IDiscoveryStrategy> _mockDiscoveryStrategies;
    private readonly CartFinder _sut;

    public CartFinderTests()
    {
        _log = Substitute.For<ILoggingService>();
        _mockStorageFactory = Substitute.For<IStorageFactory>();
        _mockInterrogator = Substitute.For<IDeviceInterrogator>();
        _mockAlert = Substitute.For<IAlertService>();
        _mockMediator = Substitute.For<IMediator>();
        _mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        _mockDiscoveryStrategies = [];

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        _sut = new CartFinder(
            _log,
            _mockStorageFactory,
            _mockInterrogator,
            _mockAlert,
            _mockMediator,
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
        string address = "COM3",
        ConnectionType connectionType = ConnectionType.Serial) =>
        new(connectionType, address, connectionType == ConnectionType.Tcp ? 80 : null, VersionReply.Empty with { IsTeensyRom = true }, port);

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

    private void SetupReply(VersionReply reply) =>
        _mockInterrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(reply);

    private void SetupProbes(StoragePresence sd, StoragePresence usb)
    {
        _mockInterrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.SD).Returns(sd);
        _mockInterrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.USB).Returns(usb);
    }

    #endregion

    [Fact]
    public async Task FindDevices_WithCompatibleReply_BuildsCartFromReplyAndProbeResults()
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port));
        var reply = FullReply();
        SetupReply(reply);
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
        _mockSettingsProvider.Received(1).GetOrCreateDeviceSettings(ChipId);
    }

    [Fact]
    public async Task FindDevices_WithBelowFloorReply_ListsIncompatibleDeviceWithoutProbingOrSettings()
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port));
        SetupReply(BelowFloorReply());

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
            CreateTestEndpoint(CreatePort(), "COM3"),
            CreateTestEndpoint(CreatePort(), "COM4"));
        SetupReply(BelowFloorReply(chipId: null));

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
        SetupDiscoveryStrategy(CreateTestEndpoint(port));
        SetupReply(FullReply(chipId: null));
        SetupProbes(StoragePresence.Present, StoragePresence.Present);

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        result.Single().Cart.DeviceId.Should().Be("Unknown");
        result.Single().Cart.IsCompatible.Should().BeTrue();
        _mockSettingsProvider.DidNotReceive().GetOrCreateDeviceSettings(Arg.Any<string>());
    }

    [Fact]
    public async Task FindDevices_WithMinimalFirmwareReply_YieldsNoDeviceAndNoProbe()
    {
        var port = CreatePort();
        SetupDiscoveryStrategy(CreateTestEndpoint(port));
        SetupReply(FullReply() with { IsMinimalFirmware = true });

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().BeEmpty();
        _mockInterrogator.DidNotReceive().ProbeStorage(Arg.Any<ICommunicationPort>(), Arg.Any<TeensyStorageType>());
    }

    [Fact]
    public async Task FindDevices_WithSameChipIdOnSerialAndTcp_KeepsTcpAndDisposesSerialPort()
    {
        var serialPort = CreatePort();
        var tcpPort = CreatePort(ConnectionType.Tcp);
        SetupDiscoveryStrategy(
            CreateTestEndpoint(serialPort, "COM3"),
            CreateTestEndpoint(tcpPort, "192.168.1.10:80", connectionType: ConnectionType.Tcp));
        SetupReply(FullReply());
        SetupProbes(StoragePresence.Present, StoragePresence.Present);

        var result = await _sut.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        result.Single().ConnectionType.Should().Be(ConnectionType.Tcp);
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
        SetupDiscoveryStrategy(CreateTestEndpoint(port));
        SetupReply(FullReply());
        SetupProbes(presence, presence);

        var result = await _sut.FindDevices(CancellationToken.None);

        var cart = result.Single().Cart;
        cart.SdStorage.Available.Should().BeFalse();
        cart.UsbStorage.Available.Should().BeFalse();
    }
}
