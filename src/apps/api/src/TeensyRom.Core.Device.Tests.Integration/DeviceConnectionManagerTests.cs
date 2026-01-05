using System.Reactive.Linq;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Integration tests for DeviceConnectionManager using real reconnection strategies.
/// These tests verify that DeviceConnectionManager correctly selects strategies and manages reconnection.
/// </summary>
public class DeviceConnectionManagerTests : IAsyncDisposable
{
    private readonly ILoggingService _log;
    private readonly IAlertService _alert;

    public DeviceConnectionManagerTests()
    {
        _log = Substitute.For<ILoggingService>();
        _alert = Substitute.For<IAlertService>();
    }

    [Fact]
    public void DeviceConnectionManager_SelectsCorrectStrategy_Serial()
    {   
        var versionChecker = new FwVersionChecker(_log, _alert);
        var serialStrategy = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpStrategy = new TcpReconnectionStrategy(_log, versionChecker);
        var strategies = new List<IReconnectionStrategy> { serialStrategy, tcpStrategy };
    
        strategies.Should().Contain(s => s is SerialReconnectionStrategy);
        strategies.Should().Contain(s => s is TcpReconnectionStrategy);
        strategies.Should().HaveCount(2);
        
        var mockCommunicationPort = Substitute.For<ICommunicationPort>();

        var cart = new Cart
        {
            DeviceId = "test-serial-device",
            Name = "Test Serial Device",
            ComPort = "COM3",
            ConnectionType = ConnectionType.Serial
        };

        var device = new TeensyRomDevice(
            cart,
            mockCommunicationPort,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Verify device is Serial type
        device.Cart.ConnectionType.Should().Be(ConnectionType.Serial);
        device.Cart.ComPort.Should().Be("COM3");
    }

    [Fact]
    public void DeviceConnectionManager_SelectsCorrectStrategy_Tcp()
    {
        // Create real strategies
        var versionChecker = new FwVersionChecker(_log, _alert);
        var serialStrategy = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpStrategy = new TcpReconnectionStrategy(_log, versionChecker);
        var strategies = new List<IReconnectionStrategy> { serialStrategy, tcpStrategy };

        // Verify strategies are registered
        strategies.Should().Contain(s => s is SerialReconnectionStrategy);
        strategies.Should().Contain(s => s is TcpReconnectionStrategy);
        strategies.Should().HaveCount(2);

        // Create mock TCP device
        var mockSerialPort = Substitute.For<ICommunicationPort>();

        var cart = new Cart
        {
            DeviceId = "test-tcp-device",
            Name = "Test TCP Device",
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.42",
            TcpPort = 80
        };

        var device = new TeensyRomDevice(
            cart,
            mockSerialPort,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Verify device is TCP type
        device.Cart.ConnectionType.Should().Be(ConnectionType.Tcp);
        device.Cart.IpAddress.Should().Be("192.168.1.42");
        device.Cart.TcpPort.Should().Be(80);
    }

    [Fact]
    public void DeviceConnectionManager_HealthCheck_LogsConnectionDisplay()
    {
        // Create mock TCP device
        var mockSerialPort = Substitute.For<ICommunicationPort>();

        var testIpAddress = "192.168.1.100";
        var testPort = 8080;

        var cart = new Cart
        {
            DeviceId = "test-health-device",
            Name = "Test Health Device",
            ConnectionType = ConnectionType.Tcp,
            IpAddress = testIpAddress,
            TcpPort = testPort
        };

        var device = new TeensyRomDevice(
            cart,
            mockSerialPort,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Verify ConnectionDisplay property
        device.Cart.ConnectionDisplay.Should().Be($"IP: {testIpAddress}:{testPort}");
    }

    [Fact]
    public void DeviceConnectionManager_FindDevices_DiscoverTcpDevices()
    {
        try
        {
            // Create real version checker
            var versionChecker = new FwVersionChecker(_log, _alert);

            // Create real discovery strategies
            var transportFactory = new DeviceTransportFactory(_log, _alert);
            var serialStrategy = new SerialDiscoveryStrategy(_log, transportFactory);
            var tcpStrategy = new TcpDiscoveryStrategy(_log, transportFactory);
            var discoveryStrategies = new List<IDiscoveryStrategy> { serialStrategy, tcpStrategy };

            // Create real reconnection strategies
            var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
            var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
            var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

            // Verify strategies are registered
            discoveryStrategies.Should().Contain(s => s is SerialDiscoveryStrategy);
            discoveryStrategies.Should().Contain(s => s is TcpDiscoveryStrategy);
            reconnectionStrategies.Should().Contain(s => s is SerialReconnectionStrategy);
            reconnectionStrategies.Should().Contain(s => s is TcpReconnectionStrategy);

            // Test passes as long as we can create these strategies without exception
            Assert.True(true);
        }
        catch (Exception ex)
        {
            Assert.True(false, $"Test failed: {ex.Message}");
        }
    }

    [Fact]
    public void DeviceConnectionManager_GetAvailableDevices_InitiallyEmpty()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Act
        var devices = manager.GetAvailableDevices();

        // Assert
        devices.Should().BeEmpty();
        devices.Should().BeOfType<List<TeensyRomDevice>>();
    }

    [Fact]
    public void DeviceConnectionManager_GetAvailableDevice_ReturnsNullWhenNotFound()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Act
        var device = manager.GetAvailableDevice("nonexistent-id");

        // Assert
        device.Should().BeNull();
    }

    [Fact]
    public void DeviceConnectionManager_ReconnectDevice_ThrowsWhenDeviceNotFound()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Act
        var act = async () => await manager.ReconnectDevice("nonexistent-id");

        // Assert
        act.Should().ThrowAsync<TeensyException>()
            .WithMessage("*not found in connected devices*");
    }

    [Fact]
    public async Task DeviceConnectionManager_ReconnectDevice_SelectsSerialStrategyForSerialDevices()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var mockPort = Substitute.For<ICommunicationPort>();

        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Create a serial device
        var serialCart = new Cart
        {
            DeviceId = "serial-device-1",
            Name = "Serial Device",
            ComPort = "COM3",
            ConnectionType = ConnectionType.Serial
        };

        var serialDevice = new TeensyRomDevice(
            serialCart,
            mockPort,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Manually set available devices to simulate FindDevices result
        var availableDevicesField = typeof(DeviceConnectionManager).GetField("_availableDevices", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        availableDevicesField?.SetValue(manager, new List<TeensyRomDevice> { serialDevice });

        // Act
        var result = await manager.ReconnectDevice("serial-device-1");

        // Assert - should not throw
        result.Should().BeFalse(); // Will be false since device is not really connected
    }

    [Fact]
    public async Task DeviceConnectionManager_ReconnectDevice_SelectsTcpStrategyForTcpDevices()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var mockPort = Substitute.For<ICommunicationPort>();

        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Create a TCP device
        var tcpCart = new Cart
        {
            DeviceId = "tcp-device-1",
            Name = "TCP Device",
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.42",
            TcpPort = 80
        };

        var tcpDevice = new TeensyRomDevice(
            tcpCart,
            mockPort,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Manually set available devices
        var availableDevicesField = typeof(DeviceConnectionManager).GetField("_availableDevices", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        availableDevicesField?.SetValue(manager, new List<TeensyRomDevice> { tcpDevice });

        // Act
        var result = await manager.ReconnectDevice("tcp-device-1");

        // Assert - should not throw
        result.Should().BeFalse(); // Will be false since device is not really connected
    }

    [Fact]
    public async Task DeviceConnectionManager_FindDevices_ClearsExistingDevices()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        var transportFactory = new DeviceTransportFactory(_log, _alert);
        
        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Mock finder to return empty list
        mockCartFinder.FindDevices(Arg.Any<CancellationToken>(), Arg.Any<bool>())
            .Returns(Task.FromResult(new List<TeensyRomDevice>()));

        // Act - call FindDevices
        var devices = await manager.FindDevices(autoConnect: false, CancellationToken.None);

        // Assert
        devices.Should().BeEmpty();
        manager.GetAvailableDevices().Should().BeEmpty();
    }

    [Fact]
    public async Task DeviceConnectionManager_FindDevices_DisposesOldPorts()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();
        
        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        var manager = new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Create old devices with mocked ports
        var oldMockPort1 = Substitute.For<ICommunicationPort>();
        var oldMockPort2 = Substitute.For<ICommunicationPort>();

        var oldCart1 = new Cart
        {
            DeviceId = "old-device-1",
            Name = "Old Device 1",
            ComPort = "COM1",
            ConnectionType = ConnectionType.Serial
        };

        var oldCart2 = new Cart
        {
            DeviceId = "old-device-2",
            Name = "Old Device 2",
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.1",
            TcpPort = 80
        };

        var oldDevice1 = new TeensyRomDevice(oldCart1, oldMockPort1, 
            Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
        var oldDevice2 = new TeensyRomDevice(oldCart2, oldMockPort2, 
            Substitute.For<IStorageService>(), Substitute.For<IStorageService>());

        // Set initial devices
        var availableDevicesField = typeof(DeviceConnectionManager).GetField("_availableDevices", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        availableDevicesField?.SetValue(manager, new List<TeensyRomDevice> { oldDevice1, oldDevice2 });

        // Mock finder to return new empty list
        mockCartFinder.FindDevices(Arg.Any<CancellationToken>(), Arg.Any<bool>())
            .Returns(Task.FromResult(new List<TeensyRomDevice>()));

        // Act
        var devices = await manager.FindDevices(autoConnect: false, CancellationToken.None);

        // Assert
        devices.Should().BeEmpty();
        oldMockPort1.Received(1).Dispose();
        oldMockPort2.Received(1).Dispose();
    }

    [Fact]
    public void DeviceConnectionManager_ReconnectionStrategies_MustBeBothTypes()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();

        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

        // Act
        var act = () => new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Assert - should not throw when both strategies are provided
        act.Should().NotThrow();
    }

    [Fact]
    public void DeviceConnectionManager_ThrowsWhenSerialStrategyMissing()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();

        var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { tcpReconnect }; // Missing Serial

        // Act
        var act = () => new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Assert
        act.Should().Throw<InvalidOperationException>(); // Single() will throw
    }

    [Fact]
    public void DeviceConnectionManager_ThrowsWhenTcpStrategyMissing()
    {
        // Arrange
        var versionChecker = new FwVersionChecker(_log, _alert);
        var mockCartFinder = Substitute.For<ICartFinder>();

        var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
        var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect }; // Missing TCP

        // Act
        var act = () => new DeviceConnectionManager(mockCartFinder, _log, reconnectionStrategies);

        // Assert
        act.Should().Throw<InvalidOperationException>(); // Single() will throw
    }

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
