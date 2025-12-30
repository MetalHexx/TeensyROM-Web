using System.Buffers;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device;

/// <summary>
/// Discovers TeensyROM devices on the local network via TCP scanning.
/// Uses true async I/O without thread pool blocking for efficient parallel scanning.
/// Implements IDiscoveryStrategy to provide a unified discovery interface.
/// </summary>
public class TcpDiscoveryStrategy(ILoggingService log) : IDiscoveryStrategy
{
    private const int _maxDegreeOfParallelism = 256;
    private const int _connectionTimeoutMs = 150;
    private const int _readTimeoutMs = 100;
    private const int _bufferSize = 4096;

    #region IDiscoveryStrategy Implementation

    /// <summary>
    /// Finds all available TCP endpoints on the local network.
    /// Implements IDiscoveryStrategy to provide unified discovery across transport types.
    /// </summary>
    /// <param name="ct">Cancellation token to abort the network scan.</param>
    /// <returns>List of TCP endpoints (IP:port) where TeensyROM devices were found.</returns>
    public async Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct)
    {
        var discoveredDevices = await ScanLocalSubnet(ct);

        var endpoints = discoveredDevices
            .Select(device => new DiscoveredEndpoint(
                ConnectionType.Tcp,
                device.IpAddress,
                device.Port
            ))
            .ToList();

        return endpoints;
    }

    #endregion

    #region Private Methods

    /// <summary>
    /// Scans the local subnet for TeensyROM devices.
    /// Automatically detects the local subnet range and performs a parallel scan.
    /// </summary>
    private async Task<List<TcpDiscoveredDevice>> ScanLocalSubnet(CancellationToken ct)
    {
        log.Internal("TcpDiscoveryStrategy: Scanning local subnet for TeensyROM devices");

        var subnetRange = NetworkHelper.GetLocalSubnetRange();
        if (!subnetRange.HasValue)
        {
            log.InternalError("TcpDiscoveryStrategy: Unable to detect local subnet range");
            return [];
        }

        var (startIp, endIp) = subnetRange.Value;
        log.Internal($"TcpDiscoveryStrategy: Scanning range {startIp} to {endIp}");

        return await ScanNetwork(startIp, endIp, ct);
    }

    /// <summary>
    /// Scans the specified IP range for TeensyROM devices using parallel TCP connections.
    /// Each IP is probed with a TeensyROM ping token (0x6455) to validate the device.
    /// </summary>
    private async Task<List<TcpDiscoveredDevice>> ScanNetwork(IPAddress startIp, IPAddress endIp, CancellationToken ct)
    {
        var ipRange = NetworkHelper.GenerateIpRange(startIp, endIp);
        var discoveredDevices = new ConcurrentBag<TcpDiscoveredDevice>();

        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = _maxDegreeOfParallelism,
            CancellationToken = ct
        };

        log.Internal($"TcpDiscoveryStrategy: Scanning {ipRange.Count} IP addresses with MaxDegreeOfParallelism = {_maxDegreeOfParallelism}");

        await Parallel.ForEachAsync(ipRange, parallelOptions, async (ip, ct) =>
        {
            ct.ThrowIfCancellationRequested();

            var device = await TryDiscoverDeviceAsync(ip, 80, ct);
            if (device != null)
            {
                discoveredDevices.Add(device);
                log.InternalSuccess($"TcpDiscoveryStrategy: Discovered TeensyROM device at {device.IpAddress}:{device.Port}");
            }
        });

        var result = discoveredDevices.ToList();
        log.InternalSuccess($"TcpDiscoveryStrategy: Scan complete. Found {result.Count} device(s)");

        return result;
    }

    /// <summary>
    /// Attempts to discover a TeensyROM device at the specified IP address and port.
    /// Creates a TCP connection, sends the TeensyROM ping token, and validates the response.
    /// </summary>
    private async Task<TcpDiscoveredDevice?> TryDiscoverDeviceAsync(IPAddress ip, int port, CancellationToken ct)
    {
        using var tcpClient = new TcpClient();

        try
        {
            // Connect with timeout
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(_connectionTimeoutMs);

            await tcpClient.ConnectAsync(ip, port, cts.Token).ConfigureAwait(false);

            var stream = tcpClient.GetStream();

            // Send TeensyROM ping token (0x6455) as big-endian ushort
            var pingBytes = BitConverter.GetBytes((ushort)0x6455);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(pingBytes);
            }

            await stream.WriteAsync(pingBytes, 0, pingBytes.Length, ct).ConfigureAwait(false);

            // Read response with timeout using ArrayPool to reduce allocations
            var buffer = ArrayPool<byte>.Shared.Rent(_bufferSize);
            try
            {
                using var readCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                readCts.CancelAfter(_readTimeoutMs);

                int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, readCts.Token).ConfigureAwait(false);

                if (bytesRead > 0)
                {
                    var response = Encoding.UTF8.GetString(buffer, 0, bytesRead);

                    if (IsTeensyRomResponse(response))
                    {
                        return new TcpDiscoveredDevice
                        {
                            IpAddress = ip.ToString(),
                            Port = port,
                            Response = response,
                            DiscoveredAt = DateTime.UtcNow
                        };
                    }
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }
        catch (OperationCanceledException)
        {
            // Timeout or cancellation - not a TeensyROM device
        }
        catch (SocketException)
        {
            // Connection refused - no device at this IP
        }
        catch (IOException)
        {
            // Connection error - not a TeensyROM device
        }
        finally
        {
          tcpClient.Close();
          tcpClient.Dispose();
        }
        return null;
    }

    /// <summary>
    /// Validates whether the response string indicates a TeensyROM device.
    /// TeensyROM devices respond with "teensyrom" or "busy" (case-insensitive).
    /// </summary>
    private static bool IsTeensyRomResponse(string? response)
    {
        if (string.IsNullOrWhiteSpace(response))
        {
            return false;
        }

        var responseLower = response.ToLowerInvariant();
        return responseLower.Contains("teensyrom") || responseLower.Contains("busy");
    }

    #endregion
}
