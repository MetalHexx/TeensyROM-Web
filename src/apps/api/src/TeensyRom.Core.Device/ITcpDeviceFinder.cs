using System.Net;

namespace TeensyRom.Core.Device;

/// <summary>
/// Defines a contract for discovering TeensyROM devices on the network via TCP scanning.
/// </summary>
public interface ITcpDeviceFinder
{
    /// <summary>
    /// Scans the specified IP range for TeensyROM devices listening on TCP port 80.
    /// </summary>
    /// <param name="startIp">The starting IP address of the range (inclusive).</param>
    /// <param name="endIp">The ending IP address of the range (inclusive).</param>
    /// <param name="ct">A cancellation token to abort the scan.</param>
    /// <returns>A list of discovered TCP devices with their IP addresses and response information.</returns>
    Task<List<TcpDiscoveredDevice>> ScanNetwork(IPAddress startIp, IPAddress endIp, CancellationToken ct);

    /// <summary>
    /// Scans the local subnet for TeensyROM devices listening on TCP port 80.
    /// Automatically detects the local subnet range and performs a parallel scan.
    /// </summary>
    /// <param name="ct">A cancellation token to abort the scan.</param>
    /// <returns>A list of discovered TCP devices on the local subnet.</returns>
    Task<List<TcpDiscoveredDevice>> ScanLocalSubnet(CancellationToken ct);
}
