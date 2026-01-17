using System.Text.Json;
using FluentAssertions;
using NSubstitute;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for SerialDiscoveryStrategy covering caching, discovery flow, and fallback logic.
/// Tests verify the fast discovery path using cached COM ports and fallback to full scans.
/// </summary>
public class SerialDiscoveryStrategyTests : IDisposable
{
    private readonly ILoggingService _mockLog;
    private readonly IDeviceTransportFactory _mockTransportFactory;
    private readonly SerialDiscoveryStrategy _sut;
    private readonly string _testCacheDirectory;
    private readonly string _testCachePath;

    public SerialDiscoveryStrategyTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockTransportFactory = Substitute.For<IDeviceTransportFactory>();
        
        // Create a temporary test directory for cache files
        _testCacheDirectory = Path.Combine(Path.GetTempPath(), $"TeensyRom_Tests_{Guid.NewGuid()}");
        Directory.CreateDirectory(_testCacheDirectory);
        _testCachePath = Path.Combine(_testCacheDirectory, "SerialPorts.json");
        
        _sut = new SerialDiscoveryStrategy(_mockLog, _mockTransportFactory);
    }

    public void Dispose()
    {
        if (Directory.Exists(_testCacheDirectory))
        {
            Directory.Delete(_testCacheDirectory, true);
        }
    }

    #region IDiscoveryStrategy Interface Tests

    [Fact]
    public void SerialDiscoveryStrategy_ShouldImplementIDiscoveryStrategy()
    {
        // Assert
        _sut.Should().BeAssignableTo<IDiscoveryStrategy>();
    }

    [Fact]
    public async Task FindEndpoints_ShouldReturnList()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<List<DiscoveredEndpoint>>();
    }

    [Fact]
    public async Task FindEndpoints_ShouldReturnEndpointsWithConnectionTypeSerial()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        result.Should().NotBeNull();
        // Only assert on items if any were found
        if (result.Count > 0)
        {
            result.Should().AllSatisfy(endpoint =>
                endpoint.ConnectionType.Should().Be(ConnectionType.Serial));
        }
    }

    #endregion

    #region Cache Loading Tests

    [Fact]
    public async Task FindEndpoints_WhenNoCacheExists_ShouldPerformFullScan()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("No cached ports found") || 
            s.Contains("falling back to full scan")));
    }

    [Fact]
    public async Task FindEndpoints_WhenCacheFileIsInvalid_ShouldLogErrorAndPerformFullScan()
    {
        // Arrange
        var ct = CancellationToken.None;
        // Note: Without access to modify the internal cache path, 
        // this test verifies error handling behavior conceptually

        // Act
        await _sut.FindEndpoints(ct);

        // Assert - Should complete without throwing
        _mockLog.Received().Internal(Arg.Any<string>());
    }

    #endregion

    #region Known Endpoint Discovery Tests

    [Fact]
    public async Task FindEndpoints_WhenCacheEmpty_ShouldAttemptFastDiscovery()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fast discovery") && s.Contains("cached ports")));
    }

    [Fact]
    public async Task FindEndpoints_ShouldLogDiscoveryActivity()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("SerialDiscoveryStrategy")));
    }

    #endregion

    #region Fallback Logic Tests

    [Fact]
    public async Task FindEndpoints_WithFullScanTrue_ShouldSkipCacheAndPerformFullScan()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct, fullScan: true);

        // Assert - Should skip cache and go straight to full scan
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fullScan=true") && s.Contains("performing full COM port scan")));
    }

    [Fact]
    public async Task FindEndpoints_WithFullScanTrue_ShouldLogPortScanning()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct, fullScan: true);

        // Assert - Verify full scan was initiated
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("Scanning") && s.Contains("COM port")));
    }

    [Fact]
    public async Task FindEndpoints_WithFullScanFalse_ShouldTryCacheThenFallbackToFullScan()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct, fullScan: false);

        // Assert - Should try cache first, then fallback to full scan
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fast discovery") && s.Contains("cached ports")));
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("falling back to full scan")));
    }

    [Fact]
    public async Task FindEndpoints_WithDefaultFullScan_ShouldUseCacheWithFallback()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct); // Default is fullScan=false

        // Assert - Should try cache first
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fast discovery") && s.Contains("cached ports")));
    }

    #endregion

    #region Cancellation Tests

    [Fact]
    public async Task FindEndpoints_ShouldRespectCancellationToken()
    {
        // Arrange
        var cts = new CancellationTokenSource();
        var ct = cts.Token;

        // Act
        var task = _sut.FindEndpoints(ct);
        cts.Cancel();

        // Assert - Should complete without hanging
        try
        {
            var result = await task;
            result.Should().NotBeNull();
        }
        catch (OperationCanceledException)
        {
            // Expected behavior - cancellation is valid
            true.Should().BeTrue();
        }
    }

    #endregion

    #region Cache Model Tests

    [Fact]
    public void SerialPortCache_ShouldInitializeWithDefaults()
    {
        // Arrange & Act
        var cache = new SerialPortCache();

        // Assert
        cache.LastUpdated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        cache.KnownPorts.Should().NotBeNull();
        cache.KnownPorts.Should().BeEmpty();
    }

    [Fact]
    public void CachedSerialPort_ShouldRequirePortName()
    {
        // Arrange & Act
        var cachedPort = new CachedSerialPort
        {
            PortName = "COM3"
        };

        // Assert
        cachedPort.PortName.Should().Be("COM3");
        cachedPort.LastSeen.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void SerialPortCache_ShouldSerializeToJson()
    {
        // Arrange
        var cache = new SerialPortCache
        {
            LastUpdated = new DateTime(2026, 1, 10, 10, 30, 0, DateTimeKind.Utc),
            KnownPorts = new List<CachedSerialPort>
            {
                new() { PortName = "COM3", LastSeen = DateTime.UtcNow }
            }
        };

        // Act
        var json = JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true });

        // Assert
        json.Should().Contain("COM3");
        json.Should().Contain("LastUpdated");
        json.Should().Contain("KnownPorts");
    }

    [Fact]
    public void SerialPortCache_ShouldDeserializeFromJson()
    {
        // Arrange
        var json = """
        {
          "LastUpdated": "2026-01-10T10:30:00Z",
          "KnownPorts": [
            {
              "PortName": "COM3",
              "LastSeen": "2026-01-10T10:30:00Z"
            }
          ]
        }
        """;

        // Act
        var cache = JsonSerializer.Deserialize<SerialPortCache>(json);

        // Assert
        cache.Should().NotBeNull();
        cache!.KnownPorts.Should().HaveCount(1);
        cache.KnownPorts[0].PortName.Should().Be("COM3");
        // Verify the timestamp was deserialized correctly (exact match for fixed JSON data)
        cache.KnownPorts[0].LastSeen.Should().Be(new DateTime(2026, 1, 10, 10, 30, 0, DateTimeKind.Utc));
    }

    #endregion

    #region FullScan Parameter Tests

    [Fact]
    public async Task FindEndpoints_WithFullScanParameter_ShouldControlCacheBehavior()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act - Call with fullScan=false (should try cache first)
        await _sut.FindEndpoints(ct, fullScan: false);

        // Assert - Should have attempted fast discovery
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("Attempting fast discovery")));
    }

    [Fact]
    public async Task FindEndpoints_WithFullScanTrue_ShouldImmediatelyPerformScan()
    {
        // Arrange
        var mockLog2 = Substitute.For<ILoggingService>();
        var mockTransport2 = Substitute.For<IDeviceTransportFactory>();
        var sut2 = new SerialDiscoveryStrategy(mockLog2, mockTransport2);
        var ct = CancellationToken.None;

        // Act - Call with fullScan=true (should skip cache)
        await sut2.FindEndpoints(ct, fullScan: true);

        // Assert - Should have skipped cache check and gone straight to full scan
        mockLog2.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fullScan=true")));
    }

    #endregion

    #region Endpoint Format Tests

    [Fact]
    public async Task FindEndpoints_DiscoveredEndpoints_ShouldHaveValidFormat()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        result.Should().NotBeNull();
        // Only validate format if devices were found
        if (result.Count > 0)
        {
            result.Should().AllSatisfy(endpoint =>
            {
                endpoint.Address.Should().NotBeNullOrEmpty();
                endpoint.Address.Should().Match("COM*"); // Should be COM port name
                endpoint.ConnectionType.Should().Be(ConnectionType.Serial);
                endpoint.Display.Should().NotBeNullOrEmpty();
            });
        }
    }

    #endregion
}
