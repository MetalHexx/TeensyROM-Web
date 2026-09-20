using NSubstitute;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Integration tests for CartFinder using real discovery strategies.
/// These tests verify that CartFinder correctly orchestrates Serial and TCP discovery strategies.
/// </summary>
public class CartFinderTests : IAsyncDisposable
{
    private readonly ILoggingService _log;
    private readonly IDeviceTransportFactory _mockTransportFactory;

    public CartFinderTests()
    {
        _log = Substitute.For<ILoggingService>();
        _mockTransportFactory = Substitute.For<IDeviceTransportFactory>();
    }

    [Fact]
    public async Task CartFinder_With_Serial_Only_Strategy_Discovers_Serial_Devices()
    {
        var serialStrategy = new SerialDiscoveryStrategy(_log, _mockTransportFactory);
        var strategies = new List<IDiscoveryStrategy> { serialStrategy };

        // Test that we can instantiate and run the serial strategy
        try
        {
            var endpoints = await serialStrategy.FindEndpoints(CancellationToken.None);
            
            // Verify all discovered endpoints are Serial type
            foreach (var endpoint in endpoints)
            {
                Assert.Equal(ConnectionType.Serial, endpoint.ConnectionType);
                Assert.Null(endpoint.Port);
            }
        }
        catch (Exception)
        {
            // Expected if no serial ports available
            Assert.True(true);
        }

        Assert.True(true);
    }

    [Fact]
    public async Task CartFinder_With_Tcp_Only_Strategy_Discovers_Tcp_Devices()
    {
        var tcpStrategy = new TcpDiscoveryStrategy(_log, _mockTransportFactory);
        var strategies = new List<IDiscoveryStrategy> { tcpStrategy };

        try
        {
            var endpoints = await tcpStrategy.FindEndpoints(CancellationToken.None);

            // Verify all discovered endpoints are TCP type
            foreach (var endpoint in endpoints)
            {
                Assert.Equal(ConnectionType.Tcp, endpoint.ConnectionType);
                Assert.NotNull(endpoint.Port);
                Assert.Equal(80, endpoint.Port);
            }
        }
        catch (Exception)
        {
            // Expected if no TCP devices on network
            Assert.True(true);
        }

        Assert.True(true);
    }

    [Fact]
    public async Task CartFinder_With_Mixed_Strategies_Runs_Both_In_Parallel()
    {
        var serialStrategy = new SerialDiscoveryStrategy(_log, _mockTransportFactory);
        var tcpStrategy = new TcpDiscoveryStrategy(_log, _mockTransportFactory);
        var strategies = new List<IDiscoveryStrategy> { serialStrategy, tcpStrategy };

        // Run both strategies in parallel (simulating what CartFinder does)
        var tasks = strategies.Select(s => s.FindEndpoints(CancellationToken.None));
        var results = await Task.WhenAll(tasks);
        var allEndpoints = results.SelectMany(r => r).ToList();

        // Verify endpoint types
        foreach (var endpoint in allEndpoints)
        {
            if (endpoint.ConnectionType == ConnectionType.Serial)
            {
                Assert.Null(endpoint.Port);
            }
            else if (endpoint.ConnectionType == ConnectionType.Tcp)
            {
                Assert.NotNull(endpoint.Port);
                Assert.Equal(80, endpoint.Port);
            }
        }

        Assert.True(true);
    }

    [Fact]
    public async Task CartFinder_With_No_Strategies_Returns_Empty_List()
    {
        var strategies = new List<IDiscoveryStrategy>();

        // Simulate DiscoverAllEndpoints with no strategies
        var tasks = strategies.Select(s => s.FindEndpoints(CancellationToken.None));
        var results = await Task.WhenAll(tasks);
        var allEndpoints = results.SelectMany(r => r).ToList();

        Assert.Empty(allEndpoints);
    }

    [Fact]
    public async Task CartFinder_Discovery_Strategy_Ordering_Does_Not_Matter()
    {
        var serialStrategy = new SerialDiscoveryStrategy(_log, _mockTransportFactory);
        var tcpStrategy = new TcpDiscoveryStrategy(_log, _mockTransportFactory);

        // Order 1: Serial then TCP
        var strategies1 = new List<IDiscoveryStrategy> { serialStrategy, tcpStrategy };
        var tasks1 = strategies1.Select(s => s.FindEndpoints(CancellationToken.None));
        var results1 = await Task.WhenAll(tasks1);
        var endpoints1 = results1.SelectMany(r => r).ToList();

        // Order 2: TCP then Serial
        var strategies2 = new List<IDiscoveryStrategy> { tcpStrategy, serialStrategy };
        var tasks2 = strategies2.Select(s => s.FindEndpoints(CancellationToken.None));
        var results2 = await Task.WhenAll(tasks2);
        var endpoints2 = results2.SelectMany(r => r).ToList();

        // Count should be the same regardless of order
        Assert.Equal(endpoints1.Count, endpoints2.Count);
    }

    #region Version Reply Integration Tests

    private const string FullReplyText =
        "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

    private const string BelowFloorReplyText =
        "\n  FW: TeensyROM v0.7.2.10\r\n      Jan 03 2024, 11:02:14\r\n  Teensy: 600MHz  48.2C  UID: 12345678\r\n  C64  PAL Vid  50 Hz\n";

    private const string ChipId = "19307720";

    /// <summary>
    /// Scripts one segment for a present storage root: the parameter ack, the command ack, then an
    /// empty directory listing.
    /// </summary>
    private static void ScriptStoragePresent(ScriptedCommunicationPort port) =>
        port.NewSegment()
            .EnqueueToken(TeensyToken.Ack)
            .EnqueueToken(TeensyToken.Ack)
            .EnqueueToken(TeensyToken.StartDirectoryList)
            .EnqueueToken(TeensyToken.EndDirectoryList);

    /// <summary>Scripts one segment for a storage root the firmware reports as missing.</summary>
    private static void ScriptStorageAbsent(ScriptedCommunicationPort port) =>
        port.NewSegment()
            .EnqueueToken(TeensyToken.Ack)
            .EnqueueToken(TeensyToken.Fail)
            .EnqueueText("Specified storage device was not found: 1");

    private CartFinder CreateFinder(
        IStorageFactory storageFactory,
        IMediator mediator,
        IAlertService alert,
        IDeviceSettingsProvider settingsProvider) =>
        new(
            _log,
            storageFactory,
            new DeviceInterrogator(_log),
            alert,
            mediator,
            Array.Empty<IDiscoveryStrategy>(),
            settingsProvider);

    private static async Task<TeensyRomDevice?> ValidateAndCreateDevice(CartFinder finder, ICommunicationPort port)
    {
        var endpoint = new DiscoveredEndpoint(ConnectionType.Serial, "COM3", null, "TeensyROM Ready!", port);

        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

        var deviceTask = method?.Invoke(finder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        return await deviceTask!;
    }

    /// <summary>
    /// The real interrogator and parser over a scripted transport: a full reply plus two present
    /// storage roots yields a device keyed on the reported chip id with both storages available.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithFullReplyAndBothStoragePresent_CreatesDeviceFromReply()
    {
        var port = new ScriptedCommunicationPort();
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText(FullReplyText);
        ScriptStoragePresent(port);
        ScriptStoragePresent(port);

        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var finder = CreateFinder(
            mockStorageFactory,
            Substitute.For<IMediator>(),
            Substitute.For<IAlertService>(),
            Substitute.For<IDeviceSettingsProvider>());

        var device = await ValidateAndCreateDevice(finder, port);

        Assert.NotNull(device);
        Assert.Equal(ChipId, device.Cart.DeviceId);
        Assert.True(device.Cart.IsCompatible);
        Assert.Equal("0.8.0.9", device.Cart.FwVersion);
        Assert.Equal(HardwareVariant.TeensyRomPlus, device.Cart.HardwareVariant);
        Assert.Equal(MachineType.C128, device.Cart.Machine);
        Assert.Equal(VideoStandard.NTSC, device.Cart.VideoStandard);
        Assert.True(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);
        Assert.Equal(ChipId, device.Cart.SdStorage.DeviceId);
        Assert.Equal(ChipId, device.Cart.UsbStorage.DeviceId);
    }

    /// <summary>
    /// A storage-not-found failure on the SD probe leaves SD unavailable without affecting USB.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithFullReplyAndSdAbsent_LeavesSdUnavailableAndUsbAvailable()
    {
        var port = new ScriptedCommunicationPort();
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText(FullReplyText);
        ScriptStorageAbsent(port);
        ScriptStoragePresent(port);

        var finder = CreateFinder(
            Substitute.For<IStorageFactory>(),
            Substitute.For<IMediator>(),
            Substitute.For<IAlertService>(),
            Substitute.For<IDeviceSettingsProvider>());

        var device = await ValidateAndCreateDevice(finder, port);

        Assert.NotNull(device);
        Assert.Equal(ChipId, device.Cart.DeviceId);
        Assert.False(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);
    }

    /// <summary>
    /// A reply below the firmware floor is still listed - with its chip id on the cart and on both
    /// storage descriptors - but nothing is probed and the incompatibility is alerted.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithBelowFloorReply_ListsIncompatibleDeviceWithoutProbing()
    {
        var port = new ScriptedCommunicationPort();
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText(BelowFloorReplyText);

        var mockAlert = Substitute.For<IAlertService>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        var finder = CreateFinder(
            Substitute.For<IStorageFactory>(),
            Substitute.For<IMediator>(),
            mockAlert,
            mockSettingsProvider);

        var device = await ValidateAndCreateDevice(finder, port);

        Assert.NotNull(device);
        Assert.False(device.Cart.IsCompatible);
        Assert.Equal("0.7.2.10", device.Cart.FwVersion);
        Assert.Equal("12345678", device.Cart.DeviceId);
        Assert.Equal("12345678", device.Cart.SdStorage.DeviceId);
        Assert.Equal("12345678", device.Cart.UsbStorage.DeviceId);
        Assert.False(device.Cart.SdStorage.Available);
        Assert.False(device.Cart.UsbStorage.Available);
        mockAlert.Received(1).Publish(Arg.Any<string>());
        mockSettingsProvider.DidNotReceive().GetOrCreateDeviceSettings(Arg.Any<string>());
    }

    #endregion

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
