using System.Net;
using System.Net.NetworkInformation;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Tests;

/// <summary>Which of the machine's addresses are worth showing to other devices on the network.</summary>
public sealed class LanAddressesTests
{
    private static NetworkAdapter Adapter(
        string address,
        string name = "Ethernet",
        string description = "Realtek PCIe GbE",
        NetworkInterfaceType type = NetworkInterfaceType.Ethernet,
        OperationalStatus status = OperationalStatus.Up,
        bool gateway = true) =>
        new(name, description, type, status, [IPAddress.Parse(address)], gateway);

    [Fact]
    public void ARealAdapter_ContributesItsAddress() =>
        LanAddresses.Select([Adapter("192.168.1.20")]).Should().Equal("192.168.1.20");

    [Fact]
    public void AdaptersThatAreDown_Loopback_OrTunnels_AreSkipped() =>
        LanAddresses.Select(
        [
            Adapter("192.168.1.20", status: OperationalStatus.Down),
            Adapter("127.0.0.1", type: NetworkInterfaceType.Loopback),
            Adapter("10.1.1.1", type: NetworkInterfaceType.Tunnel)
        ]).Should().BeEmpty();

    [Fact]
    public void SelfAssignedAddresses_AreSkipped() =>
        LanAddresses.Select([Adapter("169.254.10.3")]).Should().BeEmpty();

    [Theory]
    [InlineData("vEthernet (WSL)", "Hyper-V Virtual Ethernet Adapter")]
    [InlineData("docker0", "Docker bridge")]
    [InlineData("VMware Network Adapter VMnet8", "VMware Virtual Ethernet Adapter")]
    public void AVirtualAdapterWithNoGateway_IsSkipped(string name, string description) =>
        LanAddresses.Select([Adapter("172.20.0.1", name, description, gateway: false)]).Should().BeEmpty();

    [Fact]
    public void AVirtualAdapterWithAGateway_IsKept_AsWithAHyperVExternalSwitch() =>
        LanAddresses.Select([Adapter("192.168.1.20", "vEthernet (External)", "Hyper-V Virtual Ethernet Adapter")]).Should().Equal("192.168.1.20");

    [Fact]
    public void AdaptersWithAGateway_ComeFirst_AndAnAddressIsListedOnce() =>
        LanAddresses.Select(
        [
            Adapter("10.0.0.7", gateway: false),
            Adapter("192.168.1.20"),
            Adapter("192.168.1.20", name: "Wi-Fi")
        ]).Should().Equal("192.168.1.20", "10.0.0.7");

    [Fact]
    public void AnIPv6Address_IsNotListed() =>
        LanAddresses.Select([Adapter("fe80::1")]).Should().BeEmpty();
}
