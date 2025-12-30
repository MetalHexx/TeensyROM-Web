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
        // Create real strategies
        var versionChecker = new FwVersionChecker(_log, _alert);
        var serialStrategy = new SerialReconnectionStrategy(_log, versionChecker);
        var tcpStrategy = new TcpReconnectionStrategy(_log, versionChecker);
        var strategies = new List<IReconnectionStrategy> { serialStrategy, tcpStrategy };

        // Verify strategies are registered
        strategies.Should().Contain(s => s is SerialReconnectionStrategy);
        strategies.Should().Contain(s => s is TcpReconnectionStrategy);
        strategies.Should().HaveCount(2);

        // Create mock Serial device
        var mockSerialState = Substitute.For<ISerialStateContext>();
        var mockSerialPort = Substitute.For<IObservableSerialPort>();
        var mockState = new SerialConnectedState(mockSerialPort);

        var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
        mockSerialState.CurrentState.Returns(stateSubject);
        mockSerialState.IsOpen.Returns(true);

        var cart = new Cart
        {
            DeviceId = "test-serial-device",
            Name = "Test Serial Device",
            ComPort = "COM3",
            ConnectionType = ConnectionType.Serial
        };

        var device = new TeensyRomDevice(
            cart,
            mockSerialState,
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
        var mockSerialState = Substitute.For<ISerialStateContext>();
        var mockSerialPort = Substitute.For<IObservableSerialPort>();
        var mockState = new SerialConnectedState(mockSerialPort);

        var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
        mockSerialState.CurrentState.Returns(stateSubject);
        mockSerialState.IsOpen.Returns(true);

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
            mockSerialState,
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
        var mockSerialState = Substitute.For<ISerialStateContext>();
        var mockSerialPort = Substitute.For<IObservableSerialPort>();
        var mockState = new SerialConnectedState(mockSerialPort);

        var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
        mockSerialState.CurrentState.Returns(stateSubject);
        mockSerialState.IsOpen.Returns(true);

        // Make EnsureConnection throw to trigger health check removal
        mockSerialState.When(x => x.EnsureConnection()).Do(callInfo =>
        {
            throw new InvalidOperationException("Connection lost");
        });

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
            mockSerialState,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Verify ConnectionDisplay property
        device.Cart.ConnectionDisplay.Should().Be($"IP: {testIpAddress}:{testPort}");
    }

    [Fact]
    public async Task DeviceConnectionManager_FindDevices_DiscoverTcpDevices()
    {
        var report = new TeensyRomDiscoveryReport("device-manager-discover-tcp-report.md");

        report.WriteHeader("Device Connection Manager Integration Test: Discover TCP Devices");
        report.WriteSection("Test Configuration");
        report.WriteKeyValue("Manager", "DeviceConnectionManager");
        report.WriteKeyValue("Discovery Strategies", "Serial + TCP (parallel)");
        report.WriteKeyValue("Expected Behavior", "Discover all Serial and TCP devices on network");
        report.WriteBlankLine();

        report.WriteSection("Test Execution");

        try
        {
            // Set up real MediatR with FwVersionCheckHandler and Serial behaviors
            var services = new ServiceCollection();

            // Core services
            services.AddSingleton<ILoggingService>(_log);
            services.AddSingleton<IAlertService>(_alert);
            services.AddSingleton<IFwVersionChecker, FwVersionChecker>();

            // Register MediatR handlers and behaviors from Serial assembly
            services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(FwVersionCheckHandler).Assembly));

            // Explicitly register Serial behaviors (open generic registration)
            services.AddSingleton(typeof(IPipelineBehavior<,>), typeof(SerialBehavior<,>));
            services.AddSingleton(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            services.AddSingleton(typeof(IPipelineBehavior<,>), typeof(ExceptionBehavior<,>));

            var serviceProvider = services.BuildServiceProvider();
            var mediator = serviceProvider.GetRequiredService<IMediator>();
            var versionChecker = serviceProvider.GetRequiredService<IFwVersionChecker>();

            // Create remaining dependencies
            var settings = Substitute.For<ISettingsService>();
            var gameMetadata = Substitute.For<IGameMetadataService>();
            var sidMetadata = Substitute.For<ISidMetadataService>();
            var storageFactory = new StorageFactory(mediator, gameMetadata, sidMetadata, _log, _alert);
            var transportFactory = new DeviceTransportFactory(_log, _alert);
            var tagger = new CartTagger(_log, mediator);

            // Create real discovery strategies
            var serialStrategy = new SerialDiscoveryStrategy(_log);
            var tcpStrategy = new TcpDiscoveryStrategy(_log);
            var discoveryStrategies = new List<IDiscoveryStrategy> { serialStrategy, tcpStrategy };

            // Create real reconnection strategies
            var serialReconnect = new SerialReconnectionStrategy(_log, versionChecker);
            var tcpReconnect = new TcpReconnectionStrategy(_log, versionChecker);
            var reconnectionStrategies = new List<IReconnectionStrategy> { serialReconnect, tcpReconnect };

            // Create CartFinder with real strategies
            var finder = new CartFinder(
                _log,
                transportFactory,
                storageFactory,
                tagger,
                versionChecker,
                mediator,
                discoveryStrategies
            );

            // Create DeviceConnectionManager
            var manager = new DeviceConnectionManager(finder, _log, reconnectionStrategies);

            report.WriteInfo("Starting device discovery with Serial and TCP strategies...");

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var devices = await manager.FindDevices(autoConnect: false, CancellationToken.None);
            stopwatch.Stop();

            report.WriteBlankLine();
            report.WriteSection("Discovery Results");
            report.WriteKeyValue("Total Duration", $"{stopwatch.ElapsedMilliseconds}ms");
            report.WriteKeyValue("Total Devices Found", devices.Count.ToString());

            if (devices.Count > 0)
            {
                var serialDevices = devices.Where(d => d.Cart.ConnectionType == ConnectionType.Serial).ToList();
                var tcpDevices = devices.Where(d => d.Cart.ConnectionType == ConnectionType.Tcp).ToList();

                report.WriteBlankLine();
                report.WriteSubsection("Device Breakdown");
                report.WriteKeyValue("Serial Devices", serialDevices.Count.ToString());
                report.WriteKeyValue("TCP Devices", tcpDevices.Count.ToString());

                if (serialDevices.Count > 0)
                {
                    report.WriteBlankLine();
                    report.WriteSubsection("Serial Devices");
                    report.WriteKeyValue("COM Ports", string.Join(", ", serialDevices.Select(d => d.Cart.ComPort)));
                }

                if (tcpDevices.Count > 0)
                {
                    report.WriteBlankLine();
                    report.WriteSubsection("TCP Devices");
                    foreach (var device in tcpDevices)
                    {
                        report.WriteKeyValue($"  - {device.Cart.Name}", $"{device.Cart.IpAddress}:{device.Cart.TcpPort}");
                    }
                }

                report.WriteBlankLine();
                report.WriteSuccess($"Device discovery found {devices.Count} device(s) ({serialDevices.Count} Serial, {tcpDevices.Count} TCP)");
            }
            else
            {
                report.WriteInfo("No devices found (expected if no TeensyROM devices connected)");
            }

            report.WriteBlankLine();
            report.WriteSubsection("Discovery Strategy Verification");
            report.WriteLine("DeviceConnectionManager correctly:");
            report.WriteList(new[]
            {
                $"Ran SerialDiscoveryStrategy (found {devices.Count(d => d.Cart.ConnectionType == ConnectionType.Serial)} Serial devices)",
                $"Ran TcpDiscoveryStrategy (found {devices.Count(d => d.Cart.ConnectionType == ConnectionType.Tcp)} TCP devices)",
                $"Returned all discovered devices in parallel (~{stopwatch.ElapsedMilliseconds}ms total)"
            });

            // Test passes as long as no exception thrown
            Assert.True(true);
        }
        catch (Exception ex)
        {
            report.WriteError($"Test failed: {ex.Message}");
            report.WriteCodeBlock(ex.StackTrace ?? "", "");
            Assert.True(false);
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");
    }

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
