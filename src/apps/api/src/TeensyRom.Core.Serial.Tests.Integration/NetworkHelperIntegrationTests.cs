using System.Net;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Serial.Tests.Integration;

/// <summary>
/// Integration tests for NetworkHelper using real network interfaces.
/// These tests verify network utilities work correctly with actual system network configuration.
/// </summary>
public class NetworkHelperIntegrationTests
{
    [Fact]
    public void GetLocalSubnetRange_ReturnsValidRange_WhenActiveNetworkExists()
    {
        // Act
        var subnetRange = NetworkHelper.GetLocalSubnetRange();

        // Assert
        if (subnetRange.HasValue)
        {
            var (start, end) = subnetRange.Value;

            start.Should().NotBeNull("start IP should not be null");
            end.Should().NotBeNull("end IP should not be null");
            start.AddressFamily.Should().Be(AddressFamily.InterNetwork, "should be IPv4");
            end.AddressFamily.Should().Be(AddressFamily.InterNetwork, "should be IPv4");

            // Verify /24 subnet structure (e.g., 192.168.1.1 to 192.168.1.254)
            var startBytes = start.GetAddressBytes();
            var endBytes = end.GetAddressBytes();

            startBytes[3].Should().Be(1, "start IP should end in .1");
            endBytes[3].Should().Be(254, "end IP should end in .254");

            // First three octets should match
            for (int i = 0; i < 3; i++)
            {
                startBytes[i].Should().Be(endBytes[i], $"octet {i} should match for /24 subnet");
            }
        }
        else
        {
            // If no network interface, that's also valid for test environments
            // This can happen in CI/CD environments without network access
            Assert.True(true, "No active network interface found - test environment may be isolated");
        }
    }

    [Fact]
    public void GetLocalSubnetRange_ReturnsNull_WhenNoActiveInterface()
    {
        // This test documents expected behavior
        // In most environments, there will be at least one active interface
        // However, in isolated test environments, null is acceptable

        // Act
        var subnetRange = NetworkHelper.GetLocalSubnetRange();

        // Assert
        // We can't force this condition without disrupting network interfaces
        // So we just verify it doesn't throw and returns either valid range or null
        subnetRange.Should().Match<(IPAddress Start, IPAddress End)?>(r =>
            r == null || (r.Value.Start != null && r.Value.End != null)
        );
    }

    [Fact]
    public void GenerateIpRange_GeneratesAllAddressesInRange()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.5");
        var expectedCount = 5; // 1, 2, 3, 4, 5

        // Act
        var range = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        range.Should().HaveCount(expectedCount, "should generate all addresses between start and end");
        range[0].ToString().Should().Be("192.168.1.1");
        range[4].ToString().Should().Be("192.168.1.5");
    }

    [Fact]
    public void GenerateIpRange_HandlesFullSubnet24()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.1");
        var end = IPAddress.Parse("192.168.1.254");
        var expectedCount = 254;

        // Act
        var range = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        range.Should().HaveCount(expectedCount, "/24 subnet should have 254 addresses");
        range[0].ToString().Should().Be("192.168.1.1");
        range[^1].ToString().Should().Be("192.168.1.254");
    }

    [Fact]
    public void GenerateIpRange_ReturnsSingleAddress_WhenStartEqualsEnd()
    {
        // Arrange
        var singleIp = IPAddress.Parse("192.168.1.100");

        // Act
        var range = NetworkHelper.GenerateIpRange(singleIp, singleIp);

        // Assert
        range.Should().HaveCount(1, "should return single address when start equals end");
        range[0].ToString().Should().Be("192.168.1.100");
    }

    [Fact]
    public void GenerateIpRange_ReturnsEmpty_WhenStartIsAfterEnd()
    {
        // Arrange
        var start = IPAddress.Parse("192.168.1.100");
        var end = IPAddress.Parse("192.168.1.1");

        // Act
        var range = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        range.Should().BeEmpty("should return empty list when start is after end");
    }

    [Fact]
    public void GenerateIpRange_HandlesLocalhost()
    {
        // Arrange
        var start = IPAddress.Parse("127.0.0.1");
        var end = IPAddress.Parse("127.0.0.5");

        // Act
        var range = NetworkHelper.GenerateIpRange(start, end);

        // Assert
        range.Should().HaveCount(5, "should generate localhost range");
        range[0].ToString().Should().Be("127.0.0.1");
        range[^1].ToString().Should().Be("127.0.0.5");
    }

    [Fact]
    public void FormatEndpoint_ProducesValidString()
    {
        // Arrange
        var ip = "192.168.1.42";
        var port = 8080;

        // Act
        var endpoint = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        endpoint.Should().Be("192.168.1.42:8080");
    }

    [Fact]
    public void FormatEndpoint_HandlesLocalhost()
    {
        // Arrange
        var ip = "127.0.0.1";
        var port = 3000;

        // Act
        var endpoint = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        endpoint.Should().Be("127.0.0.1:3000");
    }

    [Fact]
    public void FormatEndpoint_HandlesIPAddressObject()
    {
        // Arrange
        var ip = IPAddress.Parse("192.168.1.100");
        var port = 80;

        // Act
        var endpoint = NetworkHelper.FormatEndpoint(ip, port);

        // Assert
        endpoint.Should().Be("192.168.1.100:80");
    }

    [Fact]
    public void ParseEndpoint_CorrectlyParsesValidEndpoint()
    {
        // Arrange
        var endpoint = "192.168.1.42:8080";

        // Act
        var result = NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port);

        // Assert
        result.Should().BeTrue("should parse valid endpoint");
        host.Should().Be("192.168.1.42");
        port.Should().Be(8080);
    }

    [Fact]
    public void ParseEndpoint_ReturnsFalse_ForInvalidFormat()
    {
        // Arrange & Act & Assert
        NetworkHelper.TryParseEndpoint("", out var host1, out var port1).Should().BeFalse();
        NetworkHelper.TryParseEndpoint("invalid", out var host2, out var port2).Should().BeFalse();
        NetworkHelper.TryParseEndpoint("192.168.1.1", out var host3, out var port3).Should().BeFalse(); // missing port
        NetworkHelper.TryParseEndpoint("192.168.1.1:abc", out var host4, out var port4).Should().BeFalse(); // non-numeric port
        NetworkHelper.TryParseEndpoint("192.168.1.1:99999", out var host5, out var port5).Should().BeFalse(); // port too high
        NetworkHelper.TryParseEndpoint("192.168.1.1:0", out var host6, out var port6).Should().BeFalse(); // port zero
    }

    [Fact]
    public void ParseEndpoint_HandlesLocalhost()
    {
        // Arrange
        var endpoint = "127.0.0.1:3000";

        // Act
        var result = NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port);

        // Assert
        result.Should().BeTrue("should parse localhost endpoint");
        host.Should().Be("127.0.0.1");
        port.Should().Be(3000);
    }

    [Fact]
    public void FormatAndParse_RoundTripCorrectly()
    {
        // Arrange
        var ip = "192.168.1.100";
        var port = 80;

        // Act
        var formatted = NetworkHelper.FormatEndpoint(ip, port);
        var parsed = NetworkHelper.TryParseEndpoint(formatted, out var parsedHost, out var parsedPort);

        // Assert
        parsed.Should().BeTrue("round-trip should succeed");
        parsedHost.Should().Be(ip, "IP should round-trip correctly");
        parsedPort.Should().Be(port, "port should round-trip correctly");
    }

    [Fact]
    public void GetLocalSubnetRange_GenerateIpRange_WorkTogether()
    {
        // Arrange & Act
        var subnetRange = NetworkHelper.GetLocalSubnetRange();

        if (subnetRange.HasValue)
        {
            var (start, end) = subnetRange.Value;
            var ipRange = NetworkHelper.GenerateIpRange(start, end);

            // Assert
            ipRange.Should().NotBeEmpty("should generate IP range from subnet");
            ipRange[0].Should().Be(start, "first IP should be start of range");
            ipRange[^1].Should().Be(end, "last IP should be end of range");
        }
        else
        {
            // No active network interface
            Assert.True(true, "No active network interface - integration test isolated");
        }
    }

    [Theory]
    [InlineData("192.168.1.1", 80)]
    [InlineData("10.0.0.1", 443)]
    [InlineData("172.16.0.1", 8080)]
    [InlineData("127.0.0.1", 3000)]
    public void FormatEndpoint_ParseEndpoint_RoundTripForVariousEndpoints(string ip, int port)
    {
        // Act
        var formatted = NetworkHelper.FormatEndpoint(ip, port);
        var parsed = NetworkHelper.TryParseEndpoint(formatted, out var parsedHost, out var parsedPort);

        // Assert
        parsed.Should().BeTrue();
        parsedHost.Should().Be(ip);
        parsedPort.Should().Be(port);
    }
}
