using System.Net;
using System.Net.NetworkInformation;

namespace TeensyRom.Core.Serial;

public static class NetworkHelper
{
    /// <summary>
    /// Gets the local subnet range for the first active non-loopback IPv4 network interface.
    /// Returns a /24 subnet range (e.g., for 192.168.1.13, returns 192.168.1.1 to 192.168.1.254).
    /// </summary>
    /// <returns>A tuple of start and end IP addresses, or null if no valid interface found.</returns>
    public static (IPAddress Start, IPAddress End)? GetLocalSubnetRange()
    {
        try
        {
            var interfaces = NetworkInterface.GetAllNetworkInterfaces();

            foreach (var networkInterface in interfaces)
            {
                // Skip interfaces that are not up or are loopback
                if (networkInterface.OperationalStatus != OperationalStatus.Up ||
                    networkInterface.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                {
                    continue;
                }

                var ipProperties = networkInterface.GetIPProperties();
                foreach (var unicastAddress in ipProperties.UnicastAddresses)
                {
                    // We only want IPv4 addresses
                    if (unicastAddress.Address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
                    {
                        continue;
                    }

                    var localIp = unicastAddress.Address;

                    // Generate the /24 subnet range
                    var ipBytes = localIp.GetAddressBytes();

                    // Create start address: x.x.x.1
                    ipBytes[3] = 1;
                    var startIp = new IPAddress(ipBytes);

                    // Create end address: x.x.x.254
                    ipBytes[3] = 254;
                    var endIp = new IPAddress(ipBytes);

                    return (startIp, endIp);
                }
            }

            return null;
        }
        catch
        {
            return null;
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
