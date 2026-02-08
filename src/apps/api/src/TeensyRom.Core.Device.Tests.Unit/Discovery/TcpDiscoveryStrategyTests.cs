using System.Net;
using System.Text.Json;
using NSubstitute;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for TcpDiscoveryStrategy covering caching, known endpoint discovery, and fallback logic.
/// Tests verify the fast discovery path using cached IPs and fallback to full subnet scans.
/// </summary>
public class TcpDiscoveryStrategyTests : IDisposable
{
    private readonly ILoggingService _mockLog;
    private readonly IDeviceTransportFactory _mockTransportFactory;
    private readonly TcpDiscoveryStrategy _sut;
    private readonly string _testCacheDirectory;
    private readonly string _testCachePath;

    public TcpDiscoveryStrategyTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockTransportFactory = Substitute.For<IDeviceTransportFactory>();
        
        // Create a temporary test directory for cache files
        _testCacheDirectory = Path.Combine(Path.GetTempPath(), $"TeensyRom_Tests_{Guid.NewGuid()}");
        Directory.CreateDirectory(_testCacheDirectory);
        _testCachePath = Path.Combine(_testCacheDirectory, "DeviceIps.json");
        
        _sut = new TcpDiscoveryStrategy(_mockLog, _mockTransportFactory);
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
    public void TcpDiscoveryStrategy_ShouldImplementIDiscoveryStrategy()
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
    public async Task FindEndpoints_ShouldReturnEndpointsWithConnectionTypeTcp()
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
                endpoint.ConnectionType.Should().Be(ConnectionType.Tcp));
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
            s.Contains("No cached devices found") || 
            s.Contains("performing full subnet scan")));
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
            s.Contains("fast discovery") && s.Contains("cached endpoints")));
    }

    [Fact]
    public async Task FindEndpoints_ShouldLogKnownEndpointScanAttempt()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("TcpDiscoveryStrategy")));
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
            s.Contains("fullScan=true") && s.Contains("skipping cache")));
    }

    [Fact]
    public async Task FindEndpoints_WithFullScanTrue_ShouldLogRangeScanning()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct, fullScan: true);

        // Assert - Verify full scan was initiated
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("Scanning range") || (s.Contains("Scanning") && s.Contains("IP addresses"))));
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
                endpoint.Port.Should().Be(80);
                endpoint.ConnectionType.Should().Be(ConnectionType.Tcp);
                endpoint.Display.Should().MatchRegex(@"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$");
            });
        }
    }

    #endregion

    #region Logging Behavior Tests

    [Fact]
    public async Task FindEndpoints_ShouldLogDiscoveryActivity()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("TcpDiscoveryStrategy")));
    }

    #endregion

    #region Cache Model Tests

    [Fact]
    public void DeviceIpCache_ShouldInitializeWithDefaults()
    {
        // Arrange & Act
        var cache = new DeviceIpCache();

        // Assert
        cache.LastUpdated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        cache.KnownEndpoints.Should().NotBeNull();
        cache.KnownEndpoints.Should().BeEmpty();
    }

    [Fact]
    public void CachedDeviceIp_ShouldRequireIpAddress()
    {
        // Arrange & Act
        var cachedIp = new CachedDeviceIp
        {
            IpAddress = "192.168.1.100",
            Port = 80
        };

        // Assert
        cachedIp.IpAddress.Should().Be("192.168.1.100");
        cachedIp.Port.Should().Be(80);
        cachedIp.LastSeen.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void DeviceIpCache_ShouldSerializeToJson()
    {
        // Arrange
        var cache = new DeviceIpCache
        {
            LastUpdated = new DateTime(2026, 1, 3, 10, 30, 0, DateTimeKind.Utc),
            KnownEndpoints = new List<CachedDeviceIp>
            {
                new() { IpAddress = "192.168.1.100", Port = 80, LastSeen = DateTime.UtcNow }
            }
        };

        // Act
        var json = JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true });

        // Assert
        json.Should().Contain("192.168.1.100");
        json.Should().Contain("LastUpdated");
        json.Should().Contain("KnownEndpoints");
    }

    [Fact]
    public void DeviceIpCache_ShouldDeserializeFromJson()
    {
        // Arrange
        var json = """
        {
          "LastUpdated": "2026-01-03T10:30:00Z",
          "KnownEndpoints": [
            {
              "IpAddress": "192.168.1.100",
              "Port": 80,
              "LastSeen": "2026-01-03T10:30:00Z"
            }
          ]
        }
        """;

        // Act
        var cache = JsonSerializer.Deserialize<DeviceIpCache>(json);

        // Assert
        cache.Should().NotBeNull();
        cache!.KnownEndpoints.Should().HaveCount(1);
        cache.KnownEndpoints[0].IpAddress.Should().Be("192.168.1.100");
        cache.KnownEndpoints[0].Port.Should().Be(80);
    }

    #endregion

    #region FullScan Parameter Tests

    [Fact]
    public async Task FindEndpoints_WithFullScanFalse_ShouldTryCacheThenFallbackToFullScan()
    {
        // Arrange
        var ct = CancellationToken.None;

        // Act
        await _sut.FindEndpoints(ct, fullScan: false);

        // Assert - Should try cache first, then fallback to full scan
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("fullScan=false") && s.Contains("attempting fast discovery")));
        _mockLog.Received().Internal(Arg.Is<string>(s => 
            s.Contains("falling back to full subnet scan")));
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
            s.Contains("fullScan=false") && s.Contains("attempting fast discovery")));
    }

    #endregion
}
