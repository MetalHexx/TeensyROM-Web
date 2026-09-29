using System.Net;
using System.Net.NetworkInformation;
using FluentAssertions;

namespace TeensyRom.Core.Serial.Tests.Unit;

/// <summary>
/// Unit tests for NetworkHelper static utility class.
/// Tests focus on subnet detection, IP range generation, endpoint formatting, and endpoint parsing.
/// </summary>
public class NetworkHelperTests
{
    #region GetLocalSubnetRanges Tests

    [Fact]
    public void GetLocalSubnetRanges_ShouldReturnOnlySlash24Ranges()
    {
        // Act
        var result = NetworkHelper.GetLocalSubnetRanges();

        // Assert
        // Note: In CI environments without a real network adapter, this may be empty
        foreach (var (start, end) in result)
        {
            var startBytes = start.GetAddressBytes();
            var endBytes = end.GetAddressBytes();

            startBytes[0].Should().Be(endBytes[0]);
            startBytes[1].Should().Be(endBytes[1]);
            startBytes[2].Should().Be(endBytes[2]);
            startBytes[3].Should().Be(1);      // Start of /24 range
            endBytes[3].Should().Be(254);      // End of /24 range
        }
    }

    [Fact]
    public void GetLocalSubnetRanges_ShouldNotThrow()
    {
        // Act & Assert
        var act = () => NetworkHelper.GetLocalSubnetRanges();
        act.Should().NotThrow();
    }

    #endregion

    #region SelectSubnetRanges Tests

    private static LocalAdapter Adapter(
        string address,
        string name = "Ethernet",
        string description = "Intel(R) Ethernet Connection",
        NetworkInterfaceType type = NetworkInterfaceType.Ethernet,
        OperationalStatus status = OperationalStatus.Up,
        bool hasGateway = true) =>
        new(name, description, type, status, [IPAddress.Parse(address)], hasGateway);

    [Fact]
    public void SelectSubnetRanges_ReturnsARangeForEveryRealAdapter_NotOnlyTheInternetOne()
    {
        // Arrange - a wired LAN with the TeensyROM plus a phone hotspot carrying internet
        var adapters = new[]
        {
            Adapter("192.168.1.113", name: "Ethernet 3"),
            Adapter("10.84.215.225", name: "Wi-Fi", description: "Intel(R) Wi-Fi 6 AX200 160MHz", type: NetworkInterfaceType.Wireless80211)
        };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().BeEquivalentTo(new[]
        {
            (IPAddress.Parse("192.168.1.1"), IPAddress.Parse("192.168.1.254")),
            (IPAddress.Parse("10.84.215.1"), IPAddress.Parse("10.84.215.254"))
        });
    }

    [Theory]
    [InlineData("vEthernet (Default Switch)", "Hyper-V Virtual Ethernet Adapter")]
    [InlineData("vEthernet (WSLCore)", "Hyper-V Virtual Ethernet Adapter #2")]
    [InlineData("VMware Network Adapter VMnet8", "VMware Virtual Ethernet Adapter for VMnet8")]
    [InlineData("Ethernet 5", "VirtualBox Host-Only Ethernet Adapter")]
    [InlineData("docker0", "docker0")]
    [InlineData("br-3f2a1c", "br-3f2a1c")]
    [InlineData("virbr0", "virbr0")]
    public void SelectSubnetRanges_SkipsHostSideVirtualAdapters(string name, string description)
    {
        // Arrange
        var adapters = new[] { Adapter("172.17.32.1", name: name, description: description, hasGateway: false) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void SelectSubnetRanges_KeepsAVirtualAdapterWithAGateway_BecauseAHyperVExternalSwitchCarriesTheRealLan()
    {
        // Arrange
        var adapters = new[] { Adapter("192.168.1.113", name: "vEthernet (External)", description: "Hyper-V Virtual Ethernet Adapter", hasGateway: true) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().ContainSingle().Which.Start.Should().Be(IPAddress.Parse("192.168.1.1"));
    }

    [Fact]
    public void SelectSubnetRanges_KeepsARealAdapterWithoutAGateway()
    {
        // Arrange - a direct cable to the TeensyROM with static addresses and no router
        var adapters = new[] { Adapter("192.168.50.2", hasGateway: false) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().ContainSingle().Which.Start.Should().Be(IPAddress.Parse("192.168.50.1"));
    }

    [Fact]
    public void SelectSubnetRanges_SkipsAdaptersThatAreNotUp()
    {
        // Arrange
        var adapters = new[] { Adapter("192.168.1.113", status: OperationalStatus.Down) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().BeEmpty();
    }

    [Theory]
    [InlineData(NetworkInterfaceType.Loopback, "127.0.0.1")]
    [InlineData(NetworkInterfaceType.Tunnel, "10.8.0.2")]
    public void SelectSubnetRanges_SkipsLoopbackAndTunnelAdapters(NetworkInterfaceType type, string address)
    {
        // Arrange
        var adapters = new[] { Adapter(address, type: type) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void SelectSubnetRanges_SkipsSelfAssignedLinkLocalAddresses()
    {
        // Arrange - a disconnected adapter that gave itself 169.254.x.x
        var adapters = new[] { Adapter("169.254.194.56", hasGateway: false) };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void SelectSubnetRanges_ReturnsOneRange_WhenTwoAdaptersShareASubnet()
    {
        // Arrange
        var adapters = new[]
        {
            Adapter("192.168.1.113", name: "Ethernet"),
            Adapter("192.168.1.114", name: "Wi-Fi", type: NetworkInterfaceType.Wireless80211)
        };

        // Act
        var result = NetworkHelper.SelectSubnetRanges(adapters);

        // Assert
        result.Should().ContainSingle().Which.Start.Should().Be(IPAddress.Parse("192.168.1.1"));
    }

    [Fact]
    public void SelectSubnetRanges_ReturnsEmpty_WhenThereAreNoAdapters()
    {
        // Act
        var result = NetworkHelper.SelectSubnetRanges([]);

        // Assert
        result.Should().BeEmpty();
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
    public void GetLocalSubnetRanges_GenerateIpRange_ShouldWorkTogether()
    {
        // Arrange
        var subnetRanges = NetworkHelper.GetLocalSubnetRanges();

        // Act & Assert
        foreach (var (start, end) in subnetRanges)
        {
            var ipRange = NetworkHelper.GenerateIpRange(start, end);

            // Should generate 254 addresses for a /24 subnet
            ipRange.Should().HaveCount(254);

            // First and last should match
            ipRange.First().Should().Be(start);
            ipRange.Last().Should().Be(end);
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
                NetworkHelper.GetLocalSubnetRanges();
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
