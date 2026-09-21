using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Device;

/// <summary>
/// Connects to one TCP address and hands back an open, ready-to-probe port. Isolated behind an
/// interface so discovery's per-address flow can be unit tested with a fake connection - including
/// the bytes the version probe writes - without a real socket.
/// </summary>
public interface ITcpProbe
{
    /// <summary>
    /// Connects to <paramref name="ip"/>:<paramref name="port"/>. Throws <see cref="TimeoutException"/>
    /// when the connect attempt does not complete in time, or the underlying <see cref="SocketException"/>
    /// (e.g. connection refused) on any other connect failure.
    /// </summary>
    Task<ICommunicationPort> Connect(IPAddress ip, int port);
}

/// <summary>
/// Discovers TeensyROM devices on the local network by connecting to every address in the local
/// subnet in parallel; only the handful of addresses that accept a connection are probed with the
/// version command. Uses true async I/O without thread pool blocking for efficient parallel scanning.
/// </summary>
public class TcpDiscoveryStrategy : IDiscoveryStrategy
{
    private const int _maxDegreeOfParallelism = 256; // High parallelism safe with true async I/O (no thread blocking)

    private readonly ILoggingService _log;
    private readonly IDeviceInterrogator _interrogator;
    private readonly ITcpProbe _probe;

    public TcpDiscoveryStrategy(ILoggingService log, IDeviceInterrogator interrogator)
        : this(log, interrogator, new TcpProbe(log))
    {
    }

    /// <summary>Test seam: substitutes <see cref="ITcpProbe"/> so a unit test drives the per-address probe without a socket.</summary>
    public TcpDiscoveryStrategy(ILoggingService log, IDeviceInterrogator interrogator, ITcpProbe probe)
    {
        _log = log;
        _interrogator = interrogator;
        _probe = probe;
    }

    /// <summary>
    /// Sweeps the local /24 subnet in parallel, probing only the addresses that accept a TCP connection.
    /// </summary>
    public async Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct)
    {
        var subnetRange = NetworkHelper.GetLocalSubnetRange();

        if (!subnetRange.HasValue)
        {
            _log.InternalError("TcpDiscoveryStrategy: Unable to detect local subnet range");
            return [];
        }

        var (startIp, endIp) = subnetRange.Value;
        var ipRange = NetworkHelper.GenerateIpRange(startIp, endIp);

        var discovered = new ConcurrentBag<DiscoveredEndpoint>();
        var answered = 0;
        var refused = 0;
        var timedOut = 0;

        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = _maxDegreeOfParallelism,
            CancellationToken = ct
        };

        var stopwatch = Stopwatch.StartNew();

        await Parallel.ForEachAsync(ipRange, parallelOptions, async (ip, token) =>
        {
            token.ThrowIfCancellationRequested();

            try
            {
                var endpoint = await ProbeAddress(ip, TcpConstants.TeensyRomPort);
                Interlocked.Increment(ref answered);

                if (endpoint is not null)
                {
                    discovered.Add(endpoint);
                }
            }
            catch (TimeoutException)
            {
                Interlocked.Increment(ref timedOut);
            }
            catch (Exception)
            {
                Interlocked.Increment(ref refused);
            }
        });

        stopwatch.Stop();
        _log.Internal($"TCP sweep {startIp}–{endIp}: {ipRange.Count} addresses, {answered} answered, {refused} refused, {timedOut} timed out, in {stopwatch.ElapsedMilliseconds} ms");

        return discovered.ToList();
    }

    /// <summary>
    /// Connects to one address via <see cref="ITcpProbe"/> and, once connected, probes it with the
    /// version command. Returns null when the connected device never answers as a TeensyROM; lets a
    /// connect failure propagate so the sweep can classify it as refused or timed out. Isolated from
    /// the sweep loop so a unit test can drive a single address directly.
    /// </summary>
    public async Task<DiscoveredEndpoint?> ProbeAddress(IPAddress ip, int port)
    {
        var communicationPort = await _probe.Connect(ip, port);

        var version = _interrogator.ReadVersion(communicationPort);

        if (!version.IsTeensyRom)
        {
            _log.Internal($"{ip}: connected but no version reply ({(string.IsNullOrEmpty(version.RawText) ? "empty" : version.RawText)})");
            communicationPort.Dispose();
            return null;
        }

        return new DiscoveredEndpoint(ConnectionType.Tcp, ip.ToString(), port, version, communicationPort);
    }

    /// <inheritdoc cref="ITcpProbe"/>
    private sealed class TcpProbe(ILoggingService log) : ITcpProbe
    {
        private const int _connectTimeoutMs = 100;

        public async Task<ICommunicationPort> Connect(IPAddress ip, int port)
        {
            var tcpClient = new TcpClient();

            try
            {
                using var connectCts = new CancellationTokenSource(_connectTimeoutMs);
                await tcpClient.ConnectAsync(ip, port, connectCts.Token);
                return new TcpCommunicationPort(log, tcpClient);
            }
            catch (OperationCanceledException)
            {
                tcpClient.Dispose();
                throw new TimeoutException($"Connect to {ip}:{port} timed out after {_connectTimeoutMs}ms");
            }
            catch
            {
                tcpClient.Dispose();
                throw;
            }
        }
    }
}
