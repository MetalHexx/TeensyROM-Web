using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace TeensyRom.Core.Serial;

/// <summary>
/// A snapshot of one local network adapter - just the facts <see cref="NetworkHelper.SelectSubnetRanges"/>
/// needs to decide whether its subnet is worth sweeping.
/// </summary>
public sealed record LocalAdapter(
    string Name,
    string Description,
    NetworkInterfaceType Type,
    OperationalStatus Status,
    IReadOnlyList<IPAddress> IPv4Addresses,
    bool HasIPv4Gateway);

public static class NetworkHelper
{
    private static readonly string[] _virtualDescriptionMarkers = ["hyper-v", "virtual", "vmware", "virtualbox", "wsl", "docker"];
    private static readonly string[] _virtualNamePrefixes = ["vethernet", "docker", "br-", "veth", "virbr", "vmnet", "vboxnet", "lxcbr", "podman", "cni"];

    /// <summary>
    /// Gets a /24 range (x.x.x.1 to x.x.x.254) for every real network adapter the machine is on, so a
    /// device on any of them is found - not only on the adapter that carries internet traffic (a
    /// phone hotspot for internet plus a wired LAN for the TeensyROM is an ordinary setup).
    /// </summary>
    /// <returns>One range per distinct /24; empty when no adapter qualifies or the adapters cannot be read.</returns>
    public static List<(IPAddress Start, IPAddress End)> GetLocalSubnetRanges()
    {
        try
        {
            return SelectSubnetRanges(ReadAdapters());
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// Picks the subnets worth sweeping. Skips adapters that are not up, loopback and tunnel adapters,
    /// self-assigned 169.254.x.x addresses, and host-side virtual switches (Hyper-V, WSL, Docker,
    /// VMware, VirtualBox) - those only lead to VMs and containers. A virtual adapter that has a
    /// default gateway is kept: a Hyper-V external switch moves the machine's real LAN address onto a
    /// vEthernet adapter. Two adapters on the same /24 yield one range.
    /// </summary>
    public static List<(IPAddress Start, IPAddress End)> SelectSubnetRanges(IEnumerable<LocalAdapter> adapters)
    {
        var ranges = new List<(IPAddress Start, IPAddress End)>();

        foreach (var adapter in adapters)
        {
            if (adapter.Status != OperationalStatus.Up
                || adapter.Type is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel
                || (IsVirtual(adapter) && !adapter.HasIPv4Gateway))
            {
                continue;
            }

            foreach (var address in adapter.IPv4Addresses)
            {
                if (address.AddressFamily != AddressFamily.InterNetwork || IPAddress.IsLoopback(address))
                {
                    continue;
                }

                var bytes = address.GetAddressBytes();

                if (bytes[0] == 169 && bytes[1] == 254)
                {
                    continue;
                }

                bytes[3] = 1;
                var start = new IPAddress(bytes);

                if (ranges.Any(r => r.Start.Equals(start)))
                {
                    continue;
                }

                bytes[3] = 254;
                ranges.Add((start, new IPAddress(bytes)));
            }
        }

        return ranges;
    }

    private static bool IsVirtual(LocalAdapter adapter)
    {
        var description = adapter.Description.ToLowerInvariant();
        var name = adapter.Name.ToLowerInvariant();

        return _virtualDescriptionMarkers.Any(description.Contains)
            || _virtualNamePrefixes.Any(name.StartsWith);
    }

    private static IEnumerable<LocalAdapter> ReadAdapters()
    {
        foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
        {
            var properties = networkInterface.GetIPProperties();

            var ipv4Addresses = properties.UnicastAddresses
                .Select(u => u.Address)
                .Where(a => a.AddressFamily == AddressFamily.InterNetwork)
                .ToList();

            var hasIPv4Gateway = properties.GatewayAddresses
                .Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork && !g.Address.Equals(IPAddress.Any));

            yield return new LocalAdapter(
                networkInterface.Name,
                networkInterface.Description,
                networkInterface.NetworkInterfaceType,
                networkInterface.OperationalStatus,
                ipv4Addresses,
                hasIPv4Gateway);
        }
    }

    /// <summary>
    /// Generates all IP addresses between start and end (inclusive).
    /// </summary>
    /// <param name="start">The starting IP address.</param>
    /// <param name="end">The ending IP address.</param>
    /// <returns>A list of IP addresses from start to end (inclusive).</returns>
    public static List<IPAddress> GenerateIpRange(IPAddress start, IPAddress end)
    {
        var result = new List<IPAddress>();

        try
        {
            var startBytes = start.GetAddressBytes();
            var endBytes = end.GetAddressBytes();

            // Convert to integers for easier comparison
            var startInt = BitConverter.ToUInt32(startBytes.Reverse().ToArray(), 0);
            var endInt = BitConverter.ToUInt32(endBytes.Reverse().ToArray(), 0);

            // Ensure start is less than or equal to end
            if (startInt > endInt)
            {
                return result;
            }

            for (uint currentIp = startInt; currentIp <= endInt; currentIp++)
            {
                var currentBytes = BitConverter.GetBytes(currentIp).Reverse().ToArray();
                result.Add(new IPAddress(currentBytes));
            }
        }
        catch
        {
            // Return empty list on any error
        }

        return result;
    }

    /// <summary>
    /// Formats an IP address and port into an endpoint string.
    /// </summary>
    /// <param name="ip">The IP address.</param>
    /// <param name="port">The port number.</param>
    /// <returns>A string in the format "ip:port".</returns>
    public static string FormatEndpoint(string ip, int port)
    {
        return $"{ip}:{port}";
    }

    /// <summary>
    /// Formats an IP address and port into an endpoint string.
    /// </summary>
    /// <param name="ip">The IP address.</param>
    /// <param name="port">The port number.</param>
    /// <returns>A string in the format "ip:port".</returns>
    public static string FormatEndpoint(IPAddress ip, int port)
    {
        return $"{ip}:{port}";
    }

    /// <summary>
    /// Parses an endpoint string in the format "ip:port" into its components.
    /// </summary>
    /// <param name="endpoint">The endpoint string to parse.</param>
    /// <param name="host">The parsed IP address or hostname.</param>
    /// <param name="port">The parsed port number.</param>
    /// <returns>True if parsing succeeded, false otherwise.</returns>
    public static bool TryParseEndpoint(string? endpoint, out string host, out int port)
    {
        host = string.Empty;
        port = 0;

        if (string.IsNullOrWhiteSpace(endpoint))
        {
            return false;
        }

        var parts = endpoint.Split(':');
        if (parts.Length != 2)
        {
            return false;
        }

        var parsedHost = parts[0];
        if (string.IsNullOrWhiteSpace(parsedHost))
        {
            return false;
        }

        if (!int.TryParse(parts[1], out var parsedPort))
        {
            return false;
        }

        if (parsedPort < 1 || parsedPort > 65535)
        {
            return false;
        }

        host = parsedHost;
        port = parsedPort;
        return true;
    }
}
