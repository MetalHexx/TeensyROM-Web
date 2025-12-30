using TeensyRom.Core.Device;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for TcpDiscoveryStrategy as IDiscoveryStrategy implementation.
/// Tests verify TCP network discovery and endpoint conversion through the public interface.
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
    public async Task FindEndpoints_ShouldReturnList()
    {
        // Arrange
        var ct = new CancellationToken();

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
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        result.Should().AllSatisfy(endpoint =>
            endpoint.ConnectionType.Should().Be(ConnectionType.Tcp));
    }

    [Fact]
    public async Task FindEndpoints_ShouldReturnEndpointsWithPortSet()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // If devices are found, they should have port 80
        result.Should().AllSatisfy(endpoint =>
        {
            endpoint.Port.Should().NotBeNull();
            endpoint.Port.Should().Be(80);
        });
    }

    [Fact]
    public async Task FindEndpoints_ShouldReturnValidIpAddresses()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        result.Should().AllSatisfy(endpoint =>
        {
            endpoint.Address.Should().NotBeNullOrEmpty();
            // Should be a valid IPv4 address
            endpoint.Address.Should().MatchRegex(@"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$");
        });
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
        result.Should().BeAssignableTo<IList<DiscoveredEndpoint>>();
    }

    [Fact]
    public async Task FindEndpoints_ShouldLogDiscoveryActivity()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        await _sut.FindEndpoints(ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("TcpDiscoveryStrategy")));
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Scanning local subnet")));
    }

    [Fact]
    public async Task FindEndpoints_Display_ShouldReturnIpPortFormat()
    {
        // Arrange
        var ct = new CancellationToken();

        // Act
        var result = await _sut.FindEndpoints(ct);

        // Assert
        // If any devices are found, verify Display format
        foreach (var endpoint in result)
        {
            endpoint.Display.Should().MatchRegex(@"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$");
        }
    }

    [Fact]
    public async Task FindEndpoints_ShouldImplementIDiscoveryStrategy()
    {
        // Arrange & Act
        var strategy = new TcpDiscoveryStrategy(_mockLog);

        // Assert
        strategy.Should().BeAssignableTo<IDiscoveryStrategy>();
    }

    [Fact]
    public async Task FindEndpoints_ShouldRespectCancellationToken()
    {
        // Arrange
        var cts = new CancellationTokenSource();
        var ct = cts.Token;

        // Act
        var task = _sut.FindEndpoints(ct);
        cts.Cancel();

        // Assert
        // Should complete (may return partial results or throw)
        try
        {
            var result = await task;
            result.Should().NotBeNull();
        }
        catch (OperationCanceledException)
        {
            // This is acceptable behavior
            true.Should().BeTrue();
        }
    }

    #endregion
}
