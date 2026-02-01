using MediatR;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Device;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Focused unit tests for CartFinder's integration with ICartTagger.
/// Tests verify that CartFinder correctly uses CartTagResult to set DeviceId and storage objects.
/// Full device discovery pipeline is covered by integration tests.
/// </summary>
public class CartFinderTests
{
    private readonly ILoggingService _mockLog;
    private readonly IStorageFactory _mockStorageFactory;
    private readonly ICartTagger _mockTagger;
    private readonly IFwVersionChecker _mockVersionChecker;
    private readonly IMediator _mockMediator;
    private readonly IDeviceSettingsProvider _mockSettingsProvider;
    private readonly List<IDiscoveryStrategy> _mockDiscoveryStrategies;
    private readonly CartFinder _sut;

    public CartFinderTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockStorageFactory = Substitute.For<IStorageFactory>();
        _mockTagger = Substitute.For<ICartTagger>();
        _mockVersionChecker = Substitute.For<IFwVersionChecker>();
        _mockMediator = Substitute.For<IMediator>();
        _mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
        _mockDiscoveryStrategies = [];

        _sut = new CartFinder(
            _mockLog,
            _mockStorageFactory,
            _mockTagger,
            _mockVersionChecker,
            _mockMediator,
            _mockDiscoveryStrategies,
            _mockSettingsProvider
        );
    }

    #region Helper Methods

    /// <summary>
    /// Creates a test DiscoveredEndpoint with a mock communication port.
    /// </summary>
    private DiscoveredEndpoint CreateTestEndpoint(string address = "COM3", string pingResponse = "TeensyROM v1.0")
    {
        var mockPort = Substitute.For<ICommunicationPort>();
        return new DiscoveredEndpoint(
            ConnectionType.Serial,
            address,
            null,
            pingResponse,
            mockPort
        );
    }

    /// <summary>
    /// Configures a single discovery strategy to return the given endpoints.
    /// </summary>
    private void SetupDiscoveryStrategy(params DiscoveredEndpoint[] endpoints)
    {
        var mockStrategy = Substitute.For<IDiscoveryStrategy>();
        mockStrategy.FindEndpoints(Arg.Any<CancellationToken>(), Arg.Any<bool>())
            .Returns(endpoints.ToList());
        _mockDiscoveryStrategies.Add(mockStrategy);
    }

    #endregion

    #region Test 1: Calls EnsureTagsForDevice Once

    [Fact]
    public async Task FindDevices_WithSingleDevice_CallsEnsureTagsForDeviceOnce()
    {
        // Arrange
        var endpoint = CreateTestEndpoint();
        SetupDiscoveryStrategy(endpoint);

        _mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version(1, 0)));

        _mockTagger.EnsureTagsForDevice(Arg.Any<ICommunicationPort>())
            .Returns(new CartTagResult
            {
                DeviceId = "TEST123",
                SdStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = "TEST123",
                    Type = TeensyStorageType.SD
                },
                UsbStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = "TEST123",
                    Type = TeensyStorageType.USB
                }
            });

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        // Act
        var result = await _sut.FindDevices(CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        await _mockTagger.Received(1).EnsureTagsForDevice(Arg.Any<ICommunicationPort>());
    }

    #endregion

    #region Test 2: Sets Cart.DeviceId from Canonical DeviceId

    [Fact]
    public async Task FindDevices_WithValidDevice_SetsCartDeviceIdFromCanonicalId()
    {
        // Arrange
        var endpoint = CreateTestEndpoint();
        SetupDiscoveryStrategy(endpoint);

        var expectedDeviceId = "CANONICAL-ID-123";

        _mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version(1, 0)));

        _mockTagger.EnsureTagsForDevice(Arg.Any<ICommunicationPort>())
            .Returns(new CartTagResult
            {
                DeviceId = expectedDeviceId,
                SdStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = expectedDeviceId,
                    Type = TeensyStorageType.SD
                },
                UsbStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = expectedDeviceId,
                    Type = TeensyStorageType.USB
                }
            });

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        // Act
        var result = await _sut.FindDevices(CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        var device = result.First();
        device.Cart.DeviceId.Should().Be(expectedDeviceId);
    }

    #endregion

    #region Test 3: Assigns Storage Objects from CartTagResult

    [Fact]
    public async Task FindDevices_WithValidDevice_AssignsStorageObjectsFromTagResult()
    {
        // Arrange
        var endpoint = CreateTestEndpoint();
        SetupDiscoveryStrategy(endpoint);

        var expectedDeviceId = "TEST456";
        var expectedSdStorage = new CartStorage
        {
            Available = true,
            DeviceId = expectedDeviceId,
            Type = TeensyStorageType.SD
        };
        var expectedUsbStorage = new CartStorage
        {
            Available = true,
            DeviceId = expectedDeviceId,
            Type = TeensyStorageType.USB
        };

        _mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version(1, 0)));

        _mockTagger.EnsureTagsForDevice(Arg.Any<ICommunicationPort>())
            .Returns(new CartTagResult
            {
                DeviceId = expectedDeviceId,
                SdStorage = expectedSdStorage,
                UsbStorage = expectedUsbStorage
            });

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        // Act
        var result = await _sut.FindDevices(CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        var device = result.First();
        device.Cart.SdStorage.Should().Be(expectedSdStorage);
        device.Cart.UsbStorage.Should().Be(expectedUsbStorage);
    }

    #endregion

    #region Test 4: Handles Both Storage Unavailable

    [Fact]
    public async Task FindDevices_WithBothStorageUnavailable_HandlesGracefully()
    {
        // Arrange
        var endpoint = CreateTestEndpoint();
        SetupDiscoveryStrategy(endpoint);

        _mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version(1, 0)));

        _mockTagger.EnsureTagsForDevice(Arg.Any<ICommunicationPort>())
            .Returns(new CartTagResult
            {
                DeviceId = "", // Empty DeviceId when both unavailable
                SdStorage = new CartStorage
                {
                    Available = false,
                    DeviceId = "",
                    Type = TeensyStorageType.SD
                },
                UsbStorage = new CartStorage
                {
                    Available = false,
                    DeviceId = "",
                    Type = TeensyStorageType.USB
                }
            });

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        // Act
        var result = await _sut.FindDevices(CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        var device = result.First();
        
        // CartFinder assigns "Unidentified[0]" when DeviceId is empty
        device.Cart.DeviceId.Should().StartWith("Unidentified");
        device.Cart.SdStorage.Available.Should().BeFalse();
        device.Cart.UsbStorage.Available.Should().BeFalse();
    }

    #endregion

    #region Test 5: Multiple Devices Each Get Tagged Once

    [Fact]
    public async Task FindDevices_WithMultipleDevices_CallsEnsureTagsForEachDevice()
    {
        // Arrange
        var endpoint1 = CreateTestEndpoint("COM3", "TeensyROM v1.0");
        var endpoint2 = CreateTestEndpoint("COM4", "TeensyROM v1.0");
        SetupDiscoveryStrategy(endpoint1, endpoint2);

        _mockVersionChecker.VersionCheck(Arg.Any<string>())
            .Returns((true, new Version(1, 0)));

        // Return different DeviceIds for each call
        var callCount = 0;
        _mockTagger.EnsureTagsForDevice(Arg.Any<ICommunicationPort>())
            .Returns(_ => new CartTagResult
            {
                DeviceId = $"DEVICE-{++callCount}",
                SdStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = $"DEVICE-{callCount}",
                    Type = TeensyStorageType.SD
                },
                UsbStorage = new CartStorage
                {
                    Available = true,
                    DeviceId = $"DEVICE-{callCount}",
                    Type = TeensyStorageType.USB
                }
            });

        _mockStorageFactory.Create(Arg.Any<CartStorage>(), Arg.Any<ICommunicationPort>())
            .Returns(Substitute.For<IStorageService>());

        // Act
        var result = await _sut.FindDevices(CancellationToken.None);

        // Assert
        result.Should().HaveCount(2);
        await _mockTagger.Received(2).EnsureTagsForDevice(Arg.Any<ICommunicationPort>());
        
        // Verify each device has unique DeviceId
        result.Select(d => d.Cart.DeviceId).Should().BeEquivalentTo(["DEVICE-1", "DEVICE-2"]);
    }

    #endregion
}
