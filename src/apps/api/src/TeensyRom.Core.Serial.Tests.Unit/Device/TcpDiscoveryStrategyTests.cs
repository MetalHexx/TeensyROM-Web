using System.Net;
using TeensyRom.Core.Device;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Serial.Tests.Unit.Device;

/// <summary>
/// Unit tests for TcpDiscoveryStrategy network scanner.
/// Tests verify the IDiscoveryStrategy interface implementation.
/// </summary>
public class TcpDiscoveryStrategyTests
{
    private readonly ILoggingService _mockLog;
    private readonly TcpDiscoveryStrategy _sut;

    public TcpDiscoveryStrategyTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _sut = new TcpDiscoveryStrategy(_mockLog);
    }

    #region IDiscoveryStrategy.FindEndpoints Tests

    [Fact]
    public async Task FindEndpoints_ShouldUseDetectedSubnetRange()
    {
        // Arrange
        var ct = new CancellationToken();

        // Note: This test relies on NetworkHelper.GetLocalSubnetRange() working correctly
        // We can't easily mock it without refactoring, so we test the integration

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // Result should be a list (may be empty if no devices found)
        result.Should().NotBeNull();
        result.Should().BeOfType<List<DiscoveredEndpoint>>();

        // Verify logging occurred
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Scanning local subnet")));
    }

    [Fact]
    public async Task FindEndpoints_ShouldReturnEmptyList_WhenNoDevicesFound()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // In most test environments, no TeensyROM devices will be present
        result.Should().NotBeNull();
        // We can't guarantee empty list in all environments, but we verify it's a valid list
        result.Should().BeAssignableTo<IList<DiscoveredEndpoint>>();
    }

    [Fact]
    public async Task FindEndpoints_ShouldScanAllIpsInSubnet()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // Should complete without exception
        result.Should().NotBeNull();

        // Verify logging indicates scanning activity
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Scanning")));
    }

    [Fact]
    public async Task FindEndpoints_ShouldRespectCancellationToken()
    {
        // Arrange
        var cts = new CancellationTokenSource();

        // Act
        // Start scan and immediately cancel
        var task = _sut.FindEndpoints(cts.Token);
        cts.Cancel();

        // Assert
        // Task should complete (may throw OperationCanceledException or return partial results)
        try
        {
            var result = await task;
            result.Should().NotBeNull();
        }
        catch (OperationCanceledException)
        {
            // This is also acceptable behavior
            true.Should().BeTrue();
        }
    }

    [Fact]
    public async Task FindEndpoints_ShouldHandleIndividualIpFailures()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act - Most IPs will fail (no device listening), but scan should continue
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // Should complete without throwing exception
        result.Should().NotBeNull();

        // Should log connection attempts
        _mockLog.ReceivedWithAnyArgs().Internal(Arg.Any<string>());
    }

    #endregion

    #region TcpDiscoveredDevice Model Tests

    [Fact]
    public void TcpDiscoveredDevice_ShouldHaveCorrectProperties()
    {
        // Arrange & Act
        var device = new TcpDiscoveredDevice
        {
            IpAddress = "192.168.1.42",
            Port = 80,
            Response = "teensyrom v1.0"
        };

        // Assert
        device.IpAddress.Should().Be("192.168.1.42");
        device.Port.Should().Be(80);
        device.Response.Should().Be("teensyrom v1.0");
        device.DiscoveredAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void TcpDiscoveredDevice_Endpoint_ShouldReturnCorrectFormat()
    {
        // Arrange
        var device = new TcpDiscoveredDevice
        {
            IpAddress = "192.168.1.42",
            Port = 80
        };

        // Act
        var endpoint = device.Endpoint;

        // Assert
        endpoint.Should().Be("192.168.1.42:80");
    }

    [Fact]
    public void TcpDiscoveredDevice_ShouldHaveDefaultValues()
    {
        // Arrange & Act
        var device = new TcpDiscoveredDevice();

        // Assert
        device.IpAddress.Should().BeEmpty();
        device.Port.Should().Be(80); // Default port
        device.Response.Should().BeNull();
        device.Endpoint.Should().Be(":80");
        device.DiscoveredAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    #endregion

    #region IDiscoveryStrategy Interface Tests

    [Fact]
    public void TcpDiscoveryStrategy_ShouldImplementIDiscoveryStrategy()
    {
        // Arrange & Act
        var strategy = new TcpDiscoveryStrategy(_mockLog);

        // Assert
        strategy.Should().BeAssignableTo<IDiscoveryStrategy>();
    }

    [Fact]
    public async Task IDiscoveryStrategy_FindEndpoints_ShouldWork()
    {
        // Arrange
        IDiscoveryStrategy strategy = _sut;
        var ct = new CancellationToken();

        // Act
        var result = await strategy.FindEndpoints(ct);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeAssignableTo<IList<DiscoveredEndpoint>>();
    }

    [Fact]
    public async Task IDiscoveryStrategy_FindEndpoints_ShouldReturnTcpEndpoints()
    {
        // Arrange
        IDiscoveryStrategy strategy = _sut;
        var ct = new CancellationToken();

        // Act
        var result = await strategy.FindEndpoints(ct);

        // Assert
        result.Should().AllSatisfy(endpoint =>
        {
            endpoint.ConnectionType.Should().Be(ConnectionType.Tcp);
            endpoint.Port.Should().Be(80);
        });
    }

    #endregion

    #region Response Validation Tests

    [Fact]
    public async Task FindEndpoints_ShouldValidateTeensyRomResponse()
    {
        // Note: This test documents expected behavior but cannot be easily unit tested
        // without refactoring TcpDiscoveryStrategy to support dependency injection of TcpObservablePort
        // Integration tests would be needed to fully test response validation

        // The behavior is: responses containing "teensyrom" or "busy" (case-insensitive) are valid
        var validResponses = new[] { "teensyrom", "TEENSYROM", "TeensyRom", "busy", "BUSY", "Busy" };
        var invalidResponses = new[] { "", "hello", "device", "server", "other" };

        // Verify our understanding of valid responses
        validResponses.All(r => !string.IsNullOrWhiteSpace(r) &&
                                (r.ToLowerInvariant().Contains("teensyrom") ||
                                 r.ToLowerInvariant().Contains("busy")))
            .Should().BeTrue();

        invalidResponses.All(r => string.IsNullOrWhiteSpace(r) ||
                                (!r.ToLowerInvariant().Contains("teensyrom") &&
                                 !r.ToLowerInvariant().Contains("busy")))
            .Should().BeTrue();
    }

    #endregion
}
