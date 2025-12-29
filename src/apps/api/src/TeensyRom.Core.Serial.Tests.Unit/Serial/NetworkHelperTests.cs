using System.Net;
using FluentAssertions;

namespace TeensyRom.Core.Serial.Tests.Unit;

/// <summary>
/// Unit tests for NetworkHelper static utility class.
/// Tests focus on subnet detection, IP range generation, endpoint formatting, and endpoint parsing.
/// </summary>
public class NetworkHelperTests
{
    #region GetLocalSubnetRange Tests

    [Fact]
    public void GetLocalSubnetRange_ShouldReturnRange_WhenActiveNetworkInterfaceExists()
    {
        // Act
        var result = NetworkHelper.GetLocalSubnetRange();

        // Assert
        // Note: This test may fail on machines without active network interfaces
        // In CI environments, this might return null
        if (result.HasValue)
        {
            result.Value.Start.Should().NotBeNull();
            result.Value.End.Should().NotBeNull();

            // Verify it's a /24 subnet (last octet differs)
            var startBytes = result.Value.Start.GetAddressBytes();
            var endBytes = result.Value.End.GetAddressBytes();

            startBytes[0].Should().Be(endBytes[0]);
            startBytes[1].Should().Be(endBytes[1]);
            startBytes[2].Should().Be(endBytes[2]);
            startBytes[3].Should().Be(1);      // Start of /24 range
            endBytes[3].Should().Be(254);      // End of /24 range
        }
    }

    [Fact]
    public void GetLocalSubnetRange_ShouldNotThrow()
    {
        // Act & Assert
        var act = () => NetworkHelper.GetLocalSubnetRange();
        act.Should().NotThrow();
    }

    [Fact]
    public void GetLocalSubnetRange_ShouldReturnTupleWithValidIpAddresses()
    {
        // Act
        var result = NetworkHelper.GetLocalSubnetRange();

        // Assert
        if (result.HasValue)
        {
            result.Value.Start.ToString().Should().MatchRegex(@"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$");
            result.Value.End.ToString().Should().MatchRegex(@"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$");
        }
    }

    #endregion

    #region GenerateIpRange Tests

    [Fact]
    public void GenerateIpRange_ShouldReturnSingleAddress_WhenStartEqualsEnd()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.1");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().ContainSingle();
        result[0].Should().Be(start);
    }

    [Fact]
    public void GenerateIpRange_ShouldReturnAllAddressesInRange_Small()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.5");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().HaveCount(5);
        result[0].Should().Be(IPAddress.Parse("192.168.1.1"));
        result[1].Should().Be(IPAddress.Parse("192.168.1.2"));
        result[2].Should().Be(IPAddress.Parse("192.168.1.3"));
        result[3].Should().Be(IPAddress.Parse("192.168.1.4"));
        result[4].Should().Be(IPAddress.Parse("192.168.1.5"));
    }

    [Fact]
    public void GenerateIpRange_ShouldHandleFullSubnet_24()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.254");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().HaveCount(254);
        result.First().Should().Be(start);
        result.Last().Should().Be(end);
    }

    [Fact]
    public void GenerateIpRange_ShouldHandleCrossOctetBoundary()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.254");
        var end = IPAddress.Parse("192.168.2.2");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().HaveCount(5);
        result[0].Should().Be(IPAddress.Parse("192.168.1.254"));
        result[1].Should().Be(IPAddress.Parse("192.168.1.255"));
        result[2].Should().Be(IPAddress.Parse("192.168.2.0"));
        result[3].Should().Be(IPAddress.Parse("192.168.2.1"));
        result[4].Should().Be(IPAddress.Parse("192.168.2.2"));
    }

    [Fact]
    public void GenerateIpRange_ShouldReturnEmptyList_WhenStartIsAfterEnd()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.10");
        var end = IPAddress.Parse("192.168.1.1");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void GenerateIpRange_ShouldHandleLocalhostRange()
    {
        // Arrange
        var start = IPAddress.Parse("127.0.0.1");
        var end = IPAddress.Parse("127.0.0.3");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().HaveCount(3);
        result[0].Should().Be(IPAddress.Parse("127.0.0.1"));
        result[1].Should().Be(IPAddress.Parse("127.0.0.2"));
        result[2].Should().Be(IPAddress.Parse("127.0.0.3"));
    }

    [Fact]
    public void GenerateIpRange_ShouldBeEfficient_ForLargeRanges()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.100");

        // Act
        var result = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        result.Should().HaveCount(100);
        // Verify order is maintained
        result[0].Should().Be(start);
        result[99].Should().Be(end);
    }

    #endregion

    #region FormatEndpoint Tests (String IP)

    [Fact]
    public void FormatEndpoint_ShouldReturnCorrectFormat_StringIp()
    {
        // Arrange
        const string ip = "192.168.1.42";
        const int port = 8080;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("192.168.1.42:8080");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleLocalhost_StringIp()
    {
        // Arrange
        const string ip = "127.0.0.1";
        const int port = 3000;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("127.0.0.1:3000");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleMinimumPort_StringIp()
    {
        // Arrange
        const string ip = "192.168.1.1";
        const int port = 1;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("192.168.1.1:1");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleMaximumPort_StringIp()
    {
        // Arrange
        const string ip = "192.168.1.1";
        const int port = 65535;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("192.168.1.1:65535");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleCommonPorts_StringIp()
    {
        // Arrange & Act
        var http = NetworkHelper.FormatEndpoint("192.168.1.1", 80);
        var https = NetworkHelper.FormatEndpoint("192.168.1.1", 443);
        var ftp = NetworkHelper.FormatEndpoint("192.168.1.1", 21);

        // Assert
        http.Should().Be("192.168.1.1:80");
        https.Should().Be("192.168.1.1:443");
        ftp.Should().Be("192.168.1.1:21");
    }

    #endregion

    #region FormatEndpoint Tests (IPAddress)

    [Fact]
    public void FormatEndpoint_ShouldReturnCorrectFormat_IPAddress()
    {
        // Arrange
        var ip = IPAddress.Parse("192.168.1.42");
        const int port = 8080;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("192.168.1.42:8080");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleLocalhost_IPAddress()
    {
        // Arrange
        var ip = IPAddress.Parse("127.0.0.1");
        const int port = 3000;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        result.Should().Be("127.0.0.1:3000");
    }

    [Fact]
    public void FormatEndpoint_ShouldHandleIPv6Address_IPAddress()
    {
        // Arrange
        var ip = IPAddress.Parse("::1");
        const int port = 8080;

        // Act
        var result = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        // IPv6 addresses are formatted with brackets in endpoints
        result.Should().Contain("::1");
        result.Should().Contain("8080");
    }

    [Fact]
    public void FormatEndpoint_ShouldRoundTripWithTryParseEndpoint()
    {
        // Arrange
        var originalIp = "192.168.1.42";
        const int originalPort = 8080;

        // Act
        var formatted = NetworkHelper.FormatEndpoint(originalIp, originalPort);
        var parsed = NetworkHelper.TryParseEndpoint(formatted, out var ip, out var port);

        // Assert
        parsed.Should().BeTrue();
        ip.Should().Be(originalIp);
        port.Should().Be(originalPort);
    }

    #endregion

    #region TryParseEndpoint Tests

    [Theory]
    [InlineData("192.168.1.42:8080", "192.168.1.42", 8080)]
    [InlineData("127.0.0.1:3000", "127.0.0.1", 3000)]
    [InlineData("192.168.1.1:1", "192.168.1.1", 1)]
    [InlineData("192.168.1.1:65535", "192.168.1.1", 65535)]
    [InlineData("192.168.1.1:80", "192.168.1.1", 80)]
    [InlineData("192.168.1.1:443", "192.168.1.1", 443)]
    [InlineData("192.168.1.1:21", "192.168.1.1", 21)]
    public void TryParseEndpoint_ShouldReturnTrue_WhenValid(string endpoint, string expectedHost, int expectedPort)
    {
        // Act
        var result = NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port);

        // Assert
        result.Should().BeTrue();
        host.Should().Be(expectedHost);
        port.Should().Be(expectedPort);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("192.168.1.42")]
    [InlineData("192.168.1.42:abc")]
    [InlineData("192.168.1.42:0")]
    [InlineData("192.168.1.42:-1")]
    [InlineData("192.168.1.42:99999")]
    [InlineData(":8080")]
    [InlineData("   :8080")]
    public void TryParseEndpoint_ShouldReturnFalse_WhenInvalid(string? endpoint)
    {
        // Act
        var result = NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port);

        // Assert
        result.Should().BeFalse();
        host.Should().BeEmpty();
        port.Should().Be(0);
    }

    #endregion

    #region Integration Tests

    [Fact]
    public void GetLocalSubnetRange_GenerateIpRange_ShouldWorkTogether()
    {
        // Arrange
        var subnetRange = NetworkHelper.GetLocalSubnetRange();

        // Act & Assert
        if (subnetRange.HasValue)
        {
            var ipRange = NetworkHelper.GenerateIpRange(subnetRange.Value.Start, subnetRange.Value.End);

            // Should generate 254 addresses for a /24 subnet
            ipRange.Should().HaveCount(254);

            // First and last should match
            ipRange.First().Should().Be(subnetRange.Value.Start);
            ipRange.Last().Should().Be(subnetRange.Value.End);
        }
    }

    [Fact]
    public void FormatEndpoint_TryParseEndpoint_ShouldRoundTrip()
    {
        // Arrange
        const string ip = "192.168.1.42";
        const int port = 8080;

        // Act
        var formatted = NetworkHelper.FormatEndpoint(ip, port);
        var parsed = NetworkHelper.TryParseEndpoint(formatted, out var parsedIp, out var parsedPort);

        // Assert
        parsed.Should().BeTrue();
        parsedIp.Should().Be(ip);
        parsedPort.Should().Be(port);
    }

    [Fact]
    public void GenerateIpRange_FormatEndpoint_ShouldWorkTogether()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.3");
        const int port = 8080;

        // Act
        var ipRange = NetworkHelper.GenerateIpRange(start, end);
        var endpoints = ipRange.Select(ip => NetworkHelper.FormatEndpoint(ip, port)).ToList();

        // Assert
        endpoints.Should().HaveCount(3);
        endpoints[0].Should().Be("192.168.1.1:8080");
        endpoints[1].Should().Be("192.168.1.2:8080");
        endpoints[2].Should().Be("192.168.1.3:8080");
    }

    #endregion

    #region Thread Safety Tests

    [Fact]
    public async Task AllMethods_ShouldBeThreadSafe()
    {
        // Arrange
        var tasks = new List<Task>();

        // Act - Call all methods from multiple threads
        for (int i = 0; i < 100; i++)
        {
            tasks.Add(Task.Run(() =>
            {
                NetworkHelper.GetLocalSubnetRange();
                NetworkHelper.GenerateIpRange(IPAddress.Parse("192.168.1.1"), IPAddress.Parse("192.168.1.10"));
                NetworkHelper.FormatEndpoint("192.168.1.1", 8080);
                NetworkHelper.TryParseEndpoint("192.168.1.1:8080", out var host, out var port);
            }));
        }

        // Assert
        var act = async () => await Task.WhenAll(tasks);
        await act.Should().NotThrowAsync();
    }

    #endregion
}
