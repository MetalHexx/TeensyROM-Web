using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Integration coverage for the one behavior that genuinely spans a discovery strategy and the finder:
/// the same chip answering on both Serial and TCP is resolved to a single listed device, Ethernet
/// preferred, with the serial port disposed. Hardware-free - two scripted <see cref="IDiscoveryStrategy"/>
/// fakes stand in for the real Serial/TCP strategies, and the finder under test is otherwise real.
/// </summary>
public class CartFinderIntegrationTests
{
    private const string ChipId = "19307720";

    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly IStorageFactory _storageFactory = Substitute.For<IStorageFactory>();
    private readonly IDeviceInterrogator _interrogator = Substitute.For<IDeviceInterrogator>();
    private readonly IAlertService _alert = Substitute.For<IAlertService>();
    private readonly IDeviceRecovery _recovery = Substitute.For<IDeviceRecovery>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    private static VersionReply FullReply() => new()
    {
        IsTeensyRom = true,
        HardwareVariant = HardwareVariant.TeensyRomPlus,
        FirmwareVersion = new Version(0, 8, 0, 9),
        ChipId = ChipId,
        Machine = MachineType.C128,
        VideoStandard = VideoStandard.NTSC
    };

    private static ICommunicationPort CreatePort(ConnectionType connectionType)
    {
        var port = Substitute.For<ICommunicationPort>();
        port.GetConnectionType().Returns(connectionType);
        return port;
    }

    private static IDiscoveryStrategy ScriptedStrategy(DiscoveredEndpoint endpoint)
    {
        var strategy = Substitute.For<IDiscoveryStrategy>();
        strategy.FindEndpoints(Arg.Any<CancellationToken>()).Returns([endpoint]);
        return strategy;
    }

    [Fact]
    public async Task FindDevices_WithSameChipOnSerialAndTcpStrategies_PrefersEthernetAndDisposesSerialPort()
    {
        var serialPort = CreatePort(ConnectionType.Serial);
        var tcpPort = CreatePort(ConnectionType.Tcp);

        var serialEndpoint = new DiscoveredEndpoint(ConnectionType.Serial, "COM3", null, FullReply(), serialPort);
        var tcpEndpoint = new DiscoveredEndpoint(ConnectionType.Tcp, "192.168.1.42", 80, FullReply(), tcpPort);

        var strategies = new List<IDiscoveryStrategy>
        {
            ScriptedStrategy(serialEndpoint),
            ScriptedStrategy(tcpEndpoint)
        };

        _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), Arg.Any<TeensyStorageType>()).Returns(StoragePresence.Present);
        _storageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>()).Returns(Substitute.For<IStorageService>());

        var finder = new CartFinder(_log, _storageFactory, _interrogator, _alert, _recovery, strategies, _settingsProvider);

        var result = await finder.FindDevices(CancellationToken.None);

        result.Should().HaveCount(1);
        var device = result.Single();
        device.ConnectionType.Should().Be(ConnectionType.Tcp);
        device.Connection.TransportInUse.Should().Be(ConnectionType.Tcp);
        device.Connection.SerialPortName.Should().Be("COM3");
        device.Connection.TcpEndpoint.Should().Be("192.168.1.42:80");

        serialPort.Received(1).Dispose();
        tcpPort.DidNotReceive().Dispose();
    }
}
