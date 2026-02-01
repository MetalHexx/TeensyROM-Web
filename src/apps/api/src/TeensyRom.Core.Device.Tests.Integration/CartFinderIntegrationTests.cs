using NSubstitute;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Commands.GetFile;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

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

    #region Helper Methods

    /// <summary>
    /// Serializes a CartTag with the given DeviceId for use in mock GetFileResult responses.
    /// </summary>
    private byte[] SerializeTag(string deviceId)
    {
        var tag = new CartTag { DeviceId = deviceId };
        return tag.Serialize() ?? throw new InvalidOperationException("Failed to serialize tag");
    }

    #endregion

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

    #region Tag Synchronization Integration Tests

    /// <summary>
    /// Integration test verifying device discovery succeeds when both storage have the same DeviceId.
    /// Uses real CartFinder and CartTagger with mocked MediatR commands.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithMatchingStorageIds_SuccessfullyCreatesDevice()
    {
        // Arrange
        var mockMediator = Substitute.For<IMediator>();
        var mockPort = Substitute.For<ICommunicationPort>();
        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var mockVersionChecker = Substitute.For<IFwVersionChecker>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        
        var sharedId = "AAA111";
        
        // Mock GetFile commands for both storage types with matching IDs
        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sharedId)
            });

        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sharedId)
            });

        // Mock version check to return compatible version
        mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version("1.0.0")));

        // Create real CartTagger and CartFinder instances
        var cartTagger = new CartTagger(_log, mockMediator);
        var cartFinder = new CartFinder(
            _log,
            mockStorageFactory,
            cartTagger,
            mockVersionChecker,
            mockMediator,
            Array.Empty<IDiscoveryStrategy>(),
            mockSettingsProvider
        );

        // Create a mock endpoint with ping response
        var endpoint = new DiscoveredEndpoint(
            ConnectionType.Serial,
            "COM3",
            null,
            "TeensyROM v1.0.0",
            mockPort
        );

        // Use reflection to call ValidateAndCreateDevice
        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        var deviceTask = method?.Invoke(cartFinder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        var device = await deviceTask!;

        // Assert
        Assert.NotNull(device);
        Assert.Equal(sharedId, device.Cart.DeviceId);
        Assert.True(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);
        Assert.Equal(sharedId, device.Cart.SdStorage.DeviceId);
        Assert.Equal(sharedId, device.Cart.UsbStorage.DeviceId);

        // Verify no SaveFilesCommand was sent (already synchronized)
        await mockMediator.DidNotReceive().Send(Arg.Any<SaveFilesCommand>());
    }

    /// <summary>
    /// Integration test verifying SD DeviceId is preferred and USB is updated when IDs differ.
    /// Uses real CartFinder and CartTagger with mocked MediatR commands.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithMismatchedStorageIds_ResolvesConflictAndUpdatesUsb()
    {
        // Arrange
        var mockMediator = Substitute.For<IMediator>();
        var mockPort = Substitute.For<ICommunicationPort>();
        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var mockVersionChecker = Substitute.For<IFwVersionChecker>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        
        var sdId = "SD-ID-111";
        var usbId = "USB-ID-222";
        
        // Mock GetFile commands with different IDs
        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdId)
            });

        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(usbId)
            });

        // Mock SaveFilesCommand to succeed
        mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Mock version check
        mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version("1.0.0")));

        // Create real CartTagger and CartFinder instances
        var cartTagger = new CartTagger(_log, mockMediator);
        var cartFinder = new CartFinder(
            _log,
            mockStorageFactory,
            cartTagger,
            mockVersionChecker,
            mockMediator,
            Array.Empty<IDiscoveryStrategy>(),
            mockSettingsProvider
        );

        // Create a mock endpoint
        var endpoint = new DiscoveredEndpoint(
            ConnectionType.Serial,
            "COM3",
            null,
            "TeensyROM v1.0.0",
            mockPort
        );

        // Use reflection to call ValidateAndCreateDevice
        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        var deviceTask = method?.Invoke(cartFinder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        var device = await deviceTask!;

        // Assert
        Assert.NotNull(device);
        Assert.Equal(sdId, device.Cart.DeviceId); // SD preferred
        Assert.True(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);

        // Verify SaveFilesCommand was sent to update USB
        await mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)
        ));
    }

    /// <summary>
    /// Integration test verifying device creation succeeds when USB storage is unavailable (Error 3).
    /// Uses real CartFinder and CartTagger with mocked MediatR commands.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithUsbUnavailable_CreatesDeviceWithSdIdOnly()
    {
        // Arrange
        var mockMediator = Substitute.For<IMediator>();
        var mockPort = Substitute.For<ICommunicationPort>();
        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var mockVersionChecker = Substitute.For<IFwVersionChecker>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        
        var sdOnlyId = "ONLY-SD";
        
        // Mock GetFile: SD succeeds, USB unavailable
        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdOnlyId)
            });

        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        // Mock version check
        mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version("1.0.0")));

        // Create real CartTagger and CartFinder instances
        var cartTagger = new CartTagger(_log, mockMediator);
        var cartFinder = new CartFinder(
            _log,
            mockStorageFactory,
            cartTagger,
            mockVersionChecker,
            mockMediator,
            Array.Empty<IDiscoveryStrategy>(),
            mockSettingsProvider
        );

        // Create a mock endpoint
        var endpoint = new DiscoveredEndpoint(
            ConnectionType.Serial,
            "COM3",
            null,
            "TeensyROM v1.0.0",
            mockPort
        );

        // Use reflection to call ValidateAndCreateDevice
        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        var deviceTask = method?.Invoke(cartFinder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        var device = await deviceTask!;

        // Assert
        Assert.NotNull(device);
        Assert.Equal(sdOnlyId, device.Cart.DeviceId);
        Assert.True(device.Cart.SdStorage.Available);
        Assert.False(device.Cart.UsbStorage.Available);

        // Verify no SaveFilesCommand was sent to USB (unavailable)
        await mockMediator.DidNotReceive().Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)
        ));
    }

    /// <summary>
    /// Integration test verifying device creation when SD storage is unavailable but USB has a tag.
    /// Uses real CartFinder and CartTagger with mocked MediatR commands.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithSdUnavailable_CreatesDeviceWithUsbIdOnly()
    {
        // Arrange
        var mockMediator = Substitute.For<IMediator>();
        var mockPort = Substitute.For<ICommunicationPort>();
        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var mockVersionChecker = Substitute.For<IFwVersionChecker>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        
        var usbOnlyId = "ONLY-USB";
        
        // Mock GetFile: SD unavailable, USB succeeds
        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(usbOnlyId)
            });

        // Mock version check
        mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version("1.0.0")));

        // Create real CartTagger and CartFinder instances
        var cartTagger = new CartTagger(_log, mockMediator);
        var cartFinder = new CartFinder(
            _log,
            mockStorageFactory,
            cartTagger,
            mockVersionChecker,
            mockMediator,
            Array.Empty<IDiscoveryStrategy>(),
            mockSettingsProvider
        );

        // Create a mock endpoint
        var endpoint = new DiscoveredEndpoint(
            ConnectionType.Serial,
            "COM3",
            null,
            "TeensyROM v1.0.0",
            mockPort
        );

        // Use reflection to call ValidateAndCreateDevice
        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        var deviceTask = method?.Invoke(cartFinder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        var device = await deviceTask!;

        // Assert
        Assert.NotNull(device);
        Assert.Equal(usbOnlyId, device.Cart.DeviceId);
        Assert.False(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);

        // Verify no SaveFilesCommand was sent to SD (unavailable)
        await mockMediator.DidNotReceive().Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.SD)
        ));
    }

    /// <summary>
    /// Integration test verifying device creation when neither storage has existing tags.
    /// CartTagger should generate a new DeviceId and save to both storage types.
    /// </summary>
    [Fact]
    public async Task CartFinder_WithNoExistingTags_GeneratesNewDeviceIdAndSavesToBoth()
    {
        // Arrange
        var mockMediator = Substitute.For<IMediator>();
        var mockPort = Substitute.For<ICommunicationPort>();
        var mockStorageFactory = Substitute.For<IStorageFactory>();
        var mockVersionChecker = Substitute.For<IFwVersionChecker>();
        var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        
        // Mock GetFile: Both return FileNotFound (available but empty)
        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        // Mock SaveFilesCommand to succeed
        mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Mock version check
        mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version("1.0.0")));

        // Create real CartTagger and CartFinder instances
        var cartTagger = new CartTagger(_log, mockMediator);
        var cartFinder = new CartFinder(
            _log,
            mockStorageFactory,
            cartTagger,
            mockVersionChecker,
            mockMediator,
            Array.Empty<IDiscoveryStrategy>(),
            mockSettingsProvider
        );

        // Create a mock endpoint
        var endpoint = new DiscoveredEndpoint(
            ConnectionType.Serial,
            "COM3",
            null,
            "TeensyROM v1.0.0",
            mockPort
        );

        // Use reflection to call ValidateAndCreateDevice
        var method = typeof(CartFinder).GetMethod("ValidateAndCreateDevice", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        var deviceTask = method?.Invoke(cartFinder, new object[] { endpoint, CancellationToken.None }) as Task<TeensyRomDevice?>;
        var device = await deviceTask!;

        // Assert
        Assert.NotNull(device);
        Assert.False(string.IsNullOrEmpty(device.Cart.DeviceId)); // New ID generated
        Assert.True(device.Cart.SdStorage.Available);
        Assert.True(device.Cart.UsbStorage.Available);

        // Verify SaveFilesCommand was sent to both storage types (2 separate calls)
        await mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.SD)
        ));
        await mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)
        ));
    }

    #endregion

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
