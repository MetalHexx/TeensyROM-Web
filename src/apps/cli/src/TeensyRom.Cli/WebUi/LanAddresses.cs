using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace TeensyRom.Cli.WebUi;

/// <summary>A snapshot of one local network adapter: the facts that decide whether its addresses reach the LAN.</summary>
internal sealed record NetworkAdapter(
    string Name,
    string Description,
    NetworkInterfaceType Type,
    OperationalStatus Status,
    IReadOnlyList<IPAddress> IPv4Addresses,
    bool HasIPv4Gateway);

/// <summary>Finds the addresses other devices on the network can reach this computer at.</summary>
internal interface ILanAddresses
{
    /// <summary>This computer's IPv4 addresses on real networks, adapters with a gateway first; empty when none can be read.</summary>
    IReadOnlyList<string> Find();
}

/// <summary>
/// Reads the machine's adapters. <see cref="Select"/> repeats the engine's filter for the subnets it sweeps for devices
/// (<c>NetworkHelper.SelectSubnetRanges</c>) rather than sharing it: the CLI does not reference the engine's projects.
/// </summary>
internal sealed class LanAddresses : ILanAddresses
{
    private static readonly string[] VirtualDescriptionMarkers = ["hyper-v", "virtual", "vmware", "virtualbox", "wsl", "docker"];
    private static readonly string[] VirtualNamePrefixes = ["vethernet", "docker", "br-", "veth", "virbr", "vmnet", "vboxnet", "lxcbr", "podman", "cni"];

    public IReadOnlyList<string> Find()
    {
        try
        {
            return Select(Read());
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// Skips adapters that are down, loopback and tunnel adapters, 169.254 addresses, and virtual adapters with no gateway
    /// (a Hyper-V external switch keeps the real LAN address on a virtual adapter that has one).
    /// </summary>
    public static IReadOnlyList<string> Select(IEnumerable<NetworkAdapter> adapters) =>
        adapters
            .Where(adapter => adapter.Status == OperationalStatus.Up
                && adapter.Type is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                && (!IsVirtual(adapter) || adapter.HasIPv4Gateway))
            .OrderByDescending(adapter => adapter.HasIPv4Gateway)
            .SelectMany(adapter => adapter.IPv4Addresses)
            .Where(address => address.AddressFamily == AddressFamily.InterNetwork
                && !IPAddress.IsLoopback(address)
                && !IsLinkLocal(address))
            .Select(address => address.ToString())
            .Distinct()
            .ToList();

    private static bool IsLinkLocal(IPAddress address)
    {
        var bytes = address.GetAddressBytes();

        return bytes[0] == 169 && bytes[1] == 254;
    }

    private static bool IsVirtual(NetworkAdapter adapter)
    {
        var description = adapter.Description.ToLowerInvariant();
        var name = adapter.Name.ToLowerInvariant();

        return VirtualDescriptionMarkers.Any(description.Contains) || VirtualNamePrefixes.Any(name.StartsWith);
    }

    private static IEnumerable<NetworkAdapter> Read()
    {
        foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
        {
            var properties = networkInterface.GetIPProperties();

            yield return new NetworkAdapter(
                networkInterface.Name,
                networkInterface.Description,
                networkInterface.NetworkInterfaceType,
                networkInterface.OperationalStatus,
                properties.UnicastAddresses.Select(u => u.Address).Where(a => a.AddressFamily == AddressFamily.InterNetwork).ToList(),
                properties.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork && !g.Address.Equals(IPAddress.Any)));
        }
    }
}
