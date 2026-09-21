using System.Diagnostics;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device
{
    /// <summary>
    /// Owns the three discovery occasions - cache-first API start confirmed by chip id, full discovery
    /// with resets on request, and records-only listing for a page load - and sequences them onto
    /// <see cref="ICartFinder"/>, which alone knows how to turn an endpoint into a listed device.
    /// <see cref="_byChip"/> keeps every device for the process lifetime, reachable or not: an
    /// unreachable record's endpoints and last facts stay in place so the next discovery occasion can
    /// find it again, but only <see cref="GetAvailableDevices"/> and <see cref="GetAvailableDevice"/>
    /// ever surface it to a caller outside this class.
    /// </summary>
    public class DeviceConnectionManager : IDeviceConnectionManager
    {
        private enum DiscoveryOccasion { Start, FullScan }

        private readonly ICartFinder _finder;
        private readonly IConnectionRecordCache _cache;
        private readonly IDeviceTransportFactory _transports;
        private readonly IDeviceInterrogator _interrogator;
        private readonly ITeensyPortLocator _locator;
        private readonly ConnectionOptions _options;
        private readonly ILoggingService _log;

        private readonly Dictionary<string, TeensyRomDevice> _byChip = [];
        private readonly SemaphoreSlim _occasionGate = new(1, 1);
        private Task<List<TeensyRomDevice>>? _inFlight;

        public DeviceConnectionManager(
            ICartFinder finder,
            IConnectionRecordCache cache,
            IDeviceTransportFactory transports,
            IDeviceInterrogator interrogator,
            ITeensyPortLocator locator,
            ConnectionOptions options,
            ILoggingService log)
        {
            _finder = finder;
            _cache = cache;
            _transports = transports;
            _interrogator = interrogator;
            _locator = locator;
            _options = options;
            _log = log;
        }

        public List<TeensyRomDevice> GetAvailableDevices() =>
            _byChip.Values.Where(d => d.Connection.Mode != DeviceMode.Unreachable).ToList();

        public TeensyRomDevice? GetAvailableDevice(string deviceId) =>
            GetAvailableDevices().FirstOrDefault(d => d.DeviceId == deviceId);

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
        {
            if (!fullScan)
            {
                var running = _inFlight;
                if (running is not null && !running.IsCompleted)
                {
                    try
                    {
                        // A page load during another occasion waits for the answer instead of getting an
                        // empty list - it still contacts nothing itself. That occasion's own caller owns
                        // reporting its failure, not this listing.
                        await running;
                    }
                    catch
                    {
                    }
                }

                var stopwatch = Stopwatch.StartNew();
                var available = GetAvailableDevices();
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Listing (page-load): {available.Count} device(s) in {stopwatch.ElapsedMilliseconds} ms");
                return available;
            }

            return await RunOrJoin(token => RunFullDiscovery(DiscoveryOccasion.FullScan, token), ct);
        }

        public Task<List<TeensyRomDevice>> ConnectAtStartAsync(CancellationToken ct) =>
            RunOrJoin(RunConnectAtStart, ct);

        /// <summary>Joins the already-running occasion instead of queuing a second sweep; otherwise starts one under the gate.</summary>
        private async Task<List<TeensyRomDevice>> RunOrJoin(Func<CancellationToken, Task<List<TeensyRomDevice>>> runOccasion, CancellationToken ct)
        {
            await _occasionGate.WaitAsync(ct);
            Task<List<TeensyRomDevice>> task;
            try
            {
                var running = _inFlight;
                task = running is not null && !running.IsCompleted ? running : runOccasion(ct);
                _inFlight = task;
            }
            finally
            {
                _occasionGate.Release();
            }

            return await task;
        }

        private async Task<List<TeensyRomDevice>> RunFullDiscovery(DiscoveryOccasion occasion, CancellationToken ct)
        {
            var stopwatch = Stopwatch.StartNew();

            foreach (var device in _byChip.Values)
            {
                device.CommunicationPort.Dispose();
            }

            var discovered = await _finder.FindDevices(ct);
            var discoveredChips = new HashSet<string>(discovered.Select(d => d.DeviceId));

            foreach (var device in discovered)
            {
                _byChip[device.DeviceId] = device;
            }

            foreach (var (chipId, device) in _byChip)
            {
                if (!discoveredChips.Contains(chipId))
                {
                    device.MarkUnreachable();
                }
            }

            _cache.Save(BuildCacheRows());

            stopwatch.Stop();
            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Discovery ({occasion}): {discovered.Count} device(s) ready in {stopwatch.ElapsedMilliseconds} ms");

            return GetAvailableDevices();
        }

        private async Task<List<TeensyRomDevice>> RunConnectAtStart(CancellationToken ct)
        {
            var cached = _cache.Load();

            if (cached is null || cached.Count == 0)
            {
                return await RunFullDiscovery(DiscoveryOccasion.Start, ct);
            }

            var stopwatch = Stopwatch.StartNew();
            var results = await Task.WhenAll(cached.Select(row => TryConfirmCachedRow(row, ct)));

            if (results.Any(device => device is null))
            {
                foreach (var device in results)
                {
                    device?.CommunicationPort.Dispose();
                }
                return await RunFullDiscovery(DiscoveryOccasion.Start, ct);
            }

            foreach (var device in results)
            {
                _byChip[device!.DeviceId] = device;
            }

            _cache.Save(BuildCacheRows());

            stopwatch.Stop();
            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Discovery (start, cached): {results.Length} device(s) confirmed in {stopwatch.ElapsedMilliseconds} ms");

            return GetAvailableDevices();
        }

        /// <summary>
        /// Reacquires one cached row by chip id: opens the remembered endpoint bounded by
        /// <see cref="ConnectionOptions.ConnectTimeoutMs"/> and confirms it answers as the expected chip,
        /// then hands the confirmed endpoint to <see cref="ICartFinder.BuildDevice"/> - the same builder
        /// full discovery uses. Returns null - the opened port disposed - on any miss.
        /// </summary>
        private async Task<TeensyRomDevice?> TryConfirmCachedRow(CachedConnectionRecord row, CancellationToken ct)
        {
            ICommunicationPort? port = null;

            try
            {
                string address;
                int? tcpPort = null;

                if (row.TransportInUse == ConnectionType.Serial)
                {
                    if (string.IsNullOrEmpty(row.SerialPortName))
                    {
                        _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: no cached port name");
                        return null;
                    }

                    var lookup = _locator.FindByChipId(row.ChipId);
                    if (lookup.FilterAvailable &&
                        (lookup.Port is null || !string.Equals(lookup.Port.PortName, row.SerialPortName, StringComparison.OrdinalIgnoreCase)))
                    {
                        // A different port is still a miss: the cache said otherwise, so full discovery decides.
                        _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: descriptor no longer names this chip");
                        return null;
                    }

                    address = row.SerialPortName;
                    port = _transports.CreateSerial(row.SerialPortName);
                }
                else
                {
                    if (string.IsNullOrEmpty(row.TcpEndpoint) || !NetworkHelper.TryParseEndpoint(row.TcpEndpoint, out var host, out var parsedPort))
                    {
                        _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: no cached endpoint");
                        return null;
                    }

                    address = host;
                    tcpPort = parsedPort;
                    port = _transports.CreateTcp(row.TcpEndpoint);
                }

                try
                {
                    port.OpenPort(_options.ConnectTimeoutMs);
                }
                catch (Exception ex)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: open failed: {ex.Message}");
                    return null;
                }

                var reply = _interrogator.ReadVersion(port);

                if (!reply.IsTeensyRom)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: no answer");
                    return null;
                }

                if (reply.ChipId != row.ChipId)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: wrong chip ({reply.ChipId})");
                    return null;
                }

                var endpoint = new DiscoveredEndpoint(row.TransportInUse, address, tcpPort, reply, port);
                var device = await _finder.BuildDevice(endpoint, ct);

                if (device is null)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: builder rejected the endpoint");
                    return null;
                }

                port = null; // ownership passed to the device
                return device;
            }
            finally
            {
                port?.Dispose();
            }
        }

        /// <summary>
        /// Narrows any row that held both a serial name and a TCP address to the transport that was just
        /// confirmed, since a freshly built device's record only carries the endpoint it was confirmed on.
        /// </summary>
        private List<CachedConnectionRecord> BuildCacheRows() =>
            GetAvailableDevices()
                .Select(d => new CachedConnectionRecord(
                    d.DeviceId,
                    d.Connection.SerialPortName,
                    d.Connection.TcpEndpoint,
                    d.Connection.TransportInUse ?? d.ConnectionType))
                .ToList();
    }
}
