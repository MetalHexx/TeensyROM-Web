using System.Collections.Concurrent;
using System.Diagnostics;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device
{
    /// <summary>
    /// Owns the discovery occasions - cache-first API start confirmed by chip id, full discovery with
    /// resets on request, records-only listing for a page load, and the explicit Reconnect/Forget pair -
    /// and sequences them onto one queue. <see cref="ICartFinder"/> alone knows how to turn an endpoint
    /// into a listed device.
    /// <para>
    /// Every unit the manager has ever known this session stays known, reachable or not: <see cref="_byChip"/>
    /// holds every unit it has confirmed or discovered at least once (an unreachable one kept, Mode
    /// <see cref="DeviceMode.Unreachable"/>, endpoints and facts intact), and <see cref="_offlineOnly"/>
    /// holds units known only from the saved connection file, never yet confirmed this session. Only
    /// <see cref="GetAvailableDevices"/>, <see cref="GetAvailableDevice"/> and <see cref="GetOfflineDevices"/>
    /// ever surface this knowledge to a caller outside this class.
    /// </para>
    /// <para>
    /// It also owns each known chip's saved name (<see cref="_names"/>): assigned <c>TR-n</c> on first
    /// sight, changed by <see cref="RenameAsync"/>, dropped on forget, and written onto every saved row.
    /// </para>
    /// </summary>
    public class DeviceConnectionManager : IDeviceConnectionManager
    {
        private enum DiscoveryOccasion { Start, FullScan, Reconnect, Forget }

        private static readonly IReadOnlySet<string> _noSkips = new HashSet<string>();
        private static readonly IReadOnlySet<DiscoveryOccasion> _startJoinableKinds = new HashSet<DiscoveryOccasion> { DiscoveryOccasion.Start };
        private static readonly IReadOnlySet<DiscoveryOccasion> _fullScanJoinableKinds = new HashSet<DiscoveryOccasion> { DiscoveryOccasion.Start, DiscoveryOccasion.FullScan };

        private readonly ICartFinder _finder;
        private readonly IConnectionRecordCache _cache;
        private readonly IDeviceTransportFactory _transports;
        private readonly IDeviceInterrogator _interrogator;
        private readonly ITeensyPortLocator _locator;
        private readonly ConnectionOptions _options;
        private readonly ILoggingService _log;

        private readonly ConcurrentDictionary<string, TeensyRomDevice> _byChip = new();

        /// <summary>Units known only from the saved connection file this session: never yet confirmed, so there is no <see cref="TeensyRomDevice"/> to hold them.</summary>
        private readonly ConcurrentDictionary<string, CachedConnectionRecord> _offlineOnly = new();

        /// <summary>
        /// Each known chip's saved name - the authority. <see cref="Cart.Name"/> is only a stamped copy,
        /// since the device object (and its cart) is rebuilt on every confirm. Stand-in ids never appear here.
        /// </summary>
        private readonly ConcurrentDictionary<string, string> _names = new();

        /// <summary>Makes name assignment, adoption's stamp-and-publish, rename, and forget's removal atomic against each other.</summary>
        private readonly object _namesLock = new();

        /// <summary>Serializes cache writes - Rename saves outside the occasion queue - so the file always ends at the latest rows.</summary>
        private readonly object _saveLock = new();

        private readonly SemaphoreSlim _occasionGate = new(1, 1);

        /// <summary>Whatever occasion is currently running, of any kind - the one queue every occasion waits on or joins.</summary>
        private Task? _running;
        private DiscoveryOccasion? _runningKind;

        private volatile bool _startedFromSavedRecords;

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

        public bool StartedFromSavedRecords => _startedFromSavedRecords;

        public List<TeensyRomDevice> GetAvailableDevices() =>
            _byChip.Values.Where(d => d.Connection.Mode != DeviceMode.Unreachable).ToList();

        public TeensyRomDevice? GetAvailableDevice(string deviceId) =>
            GetAvailableDevices().FirstOrDefault(d => d.DeviceId == deviceId);

        public IReadOnlyList<OfflineDevice> GetOfflineDevices()
        {
            var result = new List<OfflineDevice>();

            foreach (var device in _byChip.Values)
            {
                if (device.Connection.Mode != DeviceMode.Unreachable || StandInDeviceId.IsStandIn(device.DeviceId))
                {
                    continue;
                }

                result.Add(ToOfflineDevice(device));
            }

            foreach (var row in _offlineOnly.Values)
            {
                if (StandInDeviceId.IsStandIn(row.ChipId))
                {
                    continue;
                }

                result.Add(ToOfflineDevice(row));
            }

            return result;
        }

        private OfflineDevice ToOfflineDevice(TeensyRomDevice device) =>
            new(
                device.DeviceId,
                device.Connection.SerialPortName,
                device.Connection.TcpEndpoint,
                device.Connection.TransportInUse ?? device.ConnectionType,
                device.Cart.FwVersion,
                device.Cart.HardwareVariant,
                device.Cart.IsCompatible,
                _names.GetValueOrDefault(device.DeviceId, string.Empty));

        private OfflineDevice ToOfflineDevice(CachedConnectionRecord row) =>
            new(
                row.ChipId,
                row.SerialPortName,
                row.TcpEndpoint,
                row.TransportInUse,
                row.FwVersion ?? string.Empty,
                row.HardwareVariant,
                row.IsCompatible,
                _names.GetValueOrDefault(row.ChipId, string.Empty));

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
        {
            if (!fullScan)
            {
                var running = _running;
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

            return await RunJoinable(DiscoveryOccasion.FullScan, _fullScanJoinableKinds, token => RunFullDiscovery(DiscoveryOccasion.FullScan, token), ct);
        }

        public Task<List<TeensyRomDevice>> ConnectAtStartAsync(CancellationToken ct) =>
            RunJoinable(DiscoveryOccasion.Start, _startJoinableKinds, RunConnectAtStart, ct);

        public Task<ReconnectOutcome> ReconnectAsync(string deviceId, CancellationToken ct) =>
            RunExclusive(DiscoveryOccasion.Reconnect, token => RunReconnect(deviceId, token), ct);

        public Task<ForgetResult> ForgetAsync(string deviceId, CancellationToken ct) =>
            RunExclusive(DiscoveryOccasion.Forget, token => RunForget(deviceId), ct);

        /// <summary>
        /// Deliberately outside the occasion queue: a rename contacts no device and must not wait behind a
        /// multi-second discovery. It shares the one save path and the names lock instead.
        /// </summary>
        public Task<RenameOutcome> RenameAsync(string deviceId, string name, CancellationToken ct)
        {
            if (!DeviceNameRules.TryNormalize(name, out var normalized))
            {
                return Task.FromResult(new RenameOutcome(RenameResult.InvalidName, null, null));
            }

            TeensyRomDevice? device = null;
            CachedConnectionRecord? offlineRow = null;

            lock (_namesLock)
            {
                var known = !StandInDeviceId.IsStandIn(deviceId) &&
                    (_byChip.TryGetValue(deviceId, out device) || _offlineOnly.TryGetValue(deviceId, out offlineRow));

                if (!known)
                {
                    return Task.FromResult(new RenameOutcome(RenameResult.UnknownDevice, null, null));
                }

                // Names first: an adoption racing this rename then reads the new name either way.
                _names[deviceId] = normalized;

                if (device is not null)
                {
                    device.Cart.Name = normalized;
                }
            }

            SaveRecords();

            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Rename ({deviceId}): renamed");

            var outcome = device is not null
                ? device.Connection.Mode != DeviceMode.Unreachable
                    ? new RenameOutcome(RenameResult.Renamed, device, null)
                    : new RenameOutcome(RenameResult.Renamed, null, ToOfflineDevice(device))
                : new RenameOutcome(RenameResult.Renamed, null, ToOfflineDevice(offlineRow!));

            return Task.FromResult(outcome);
        }

        /// <summary>
        /// Joins a running occasion whose kind is in <paramref name="joinableKinds"/>; otherwise waits
        /// for whatever is running (of any kind), then runs its own and registers as <paramref name="kind"/>.
        /// Used by the two occasions whose result can be safely shared across simultaneous callers: the
        /// API start and Discover Devices (full discovery).
        /// </summary>
        private async Task<List<TeensyRomDevice>> RunJoinable(DiscoveryOccasion kind, IReadOnlySet<DiscoveryOccasion> joinableKinds, Func<CancellationToken, Task<List<TeensyRomDevice>>> run, CancellationToken ct)
        {
            while (true)
            {
                Task<List<TeensyRomDevice>>? joinTask = null;
                Task<List<TeensyRomDevice>>? ownTask = null;
                Task? previous = null;

                await _occasionGate.WaitAsync(ct);
                try
                {
                    if (_running is Task<List<TeensyRomDevice>> runningTask && !runningTask.IsCompleted &&
                        _runningKind.HasValue && joinableKinds.Contains(_runningKind.Value))
                    {
                        joinTask = runningTask;
                    }
                    else if (_running is null || _running.IsCompleted)
                    {
                        ownTask = run(ct);
                        _running = ownTask;
                        _runningKind = kind;
                    }
                    else
                    {
                        previous = _running;
                    }
                }
                finally
                {
                    _occasionGate.Release();
                }

                if (joinTask is not null)
                {
                    return await joinTask;
                }

                if (ownTask is not null)
                {
                    return await ownTask;
                }

                try
                {
                    await previous!;
                }
                catch
                {
                }
            }
        }

        /// <summary>
        /// Never joins anything: waits for whatever is running (of any kind), then runs its own and
        /// registers as <paramref name="kind"/>. Used by Reconnect and Forget, whose result belongs to
        /// one caller alone.
        /// </summary>
        private async Task<T> RunExclusive<T>(DiscoveryOccasion kind, Func<CancellationToken, Task<T>> run, CancellationToken ct)
        {
            while (true)
            {
                Task<T>? ownTask = null;
                Task? previous = null;

                await _occasionGate.WaitAsync(ct);
                try
                {
                    if (_running is null || _running.IsCompleted)
                    {
                        ownTask = run(ct);
                        _running = ownTask;
                        _runningKind = kind;
                    }
                    else
                    {
                        previous = _running;
                    }
                }
                finally
                {
                    _occasionGate.Release();
                }

                if (ownTask is not null)
                {
                    return await ownTask;
                }

                try
                {
                    await previous!;
                }
                catch
                {
                }
            }
        }

        private async Task<List<TeensyRomDevice>> RunFullDiscovery(DiscoveryOccasion occasion, CancellationToken ct)
        {
            var stopwatch = Stopwatch.StartNew();

            foreach (var device in _byChip.Values)
            {
                device.CommunicationPort.Dispose();
            }

            var discovered = await _finder.FindDevices(_noSkips, ct);
            var discoveredChips = new HashSet<string>(discovered.Select(d => d.DeviceId));

            MergeDiscovered(discovered);

            foreach (var (chipId, device) in _byChip)
            {
                if (!discoveredChips.Contains(chipId))
                {
                    device.MarkUnreachable();
                }
            }

            // Every known unit is saved, online or offline, even when this sweep found nothing: a unit
            // that's merely away right now must not be dropped from the file and force a full scan on
            // every later start.
            SaveRecords();

            stopwatch.Stop();
            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Discovery ({occasion}): {discovered.Count} device(s) ready in {stopwatch.ElapsedMilliseconds} ms");

            return GetAvailableDevices();
        }

        private async Task<List<TeensyRomDevice>> RunConnectAtStart(CancellationToken ct)
        {
            var cached = _cache.Load();

            _startedFromSavedRecords = cached is { Count: > 0 };

            if (cached is null || cached.Count == 0)
            {
                try
                {
                    return await RunFullDiscovery(DiscoveryOccasion.Start, ct);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _log.InternalError($"DeviceConnectionManager.FindDevices: Discovery (start, full) failed: {ex.Message}");
                    return GetAvailableDevices();
                }
            }

            // Known before any port is opened: if anything below throws, a following Discover Devices
            // still merges against these rows instead of a fresh sweep overwriting the file with only
            // what it finds.
            foreach (var row in cached)
            {
                _offlineOnly.TryAdd(row.ChipId, row);

                if (!StandInDeviceId.IsStandIn(row.ChipId) && !string.IsNullOrWhiteSpace(row.Name))
                {
                    _names.TryAdd(row.ChipId, row.Name);
                }
            }

            // Rows from a file written before names existed get their TR-N now, in chip-id order, so
            // the backfill is saved by this same occasion.
            foreach (var row in cached.Where(r => !StandInDeviceId.IsStandIn(r.ChipId)).OrderBy(r => r.ChipId, StringComparer.Ordinal))
            {
                EnsureName(row.ChipId);
            }

            var stopwatch = Stopwatch.StartNew();

            try
            {
                var results = await Task.WhenAll(cached.Select(row => TryConfirmCachedRowSafely(row, ct)));
                var confirmedCount = 0;
                var missedNonOfflineRow = false;

                foreach (var (row, device) in cached.Zip(results))
                {
                    if (device is not null)
                    {
                        confirmedCount++;
                        CarryForwardEndpoint(device.Connection, ConnectionType.Serial, row.SerialPortName);
                        CarryForwardEndpoint(device.Connection, ConnectionType.Tcp, row.TcpEndpoint);
                        AdoptConfirmedDevice(device);
                    }
                    else if (!row.Offline)
                    {
                        missedNonOfflineRow = true;
                    }
                }

                if (missedNonOfflineRow)
                {
                    // Exactly one search, skipping every unit just confirmed; everything still missing
                    // afterwards (including an offline-last-time row this pass never touched) is kept,
                    // flagged offline - the search itself saves.
                    await RunSearchForMissingUnits(ct);
                }
                else
                {
                    // Nothing new to look for - either every row confirmed, or only already-offline rows
                    // missed - but still saved whole so facts and flags stay current.
                    SaveRecords();
                }

                stopwatch.Stop();
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Discovery (start, cached): {confirmedCount} device(s) confirmed in {stopwatch.ElapsedMilliseconds} ms");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                // Nothing but cancellation may escape the start: the rows are already known (above), so a
                // following Discover Devices still has them even though this pass failed.
                _log.InternalError($"DeviceConnectionManager.FindDevices: Discovery (start, cached) failed: {ex.Message}");
            }

            return GetAvailableDevices();
        }

        private async Task<ReconnectOutcome> RunReconnect(string deviceId, CancellationToken ct)
        {
            var stopwatch = Stopwatch.StartNew();
            CachedConnectionRecord row;

            if (_byChip.TryGetValue(deviceId, out var existing))
            {
                if (existing.Connection.Mode != DeviceMode.Unreachable)
                {
                    _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Reconnect ({deviceId}): already available in {stopwatch.ElapsedMilliseconds} ms");
                    return new ReconnectOutcome(ReconnectResult.AlreadyAvailable, existing);
                }

                row = new CachedConnectionRecord(
                    existing.DeviceId,
                    existing.Connection.SerialPortName,
                    existing.Connection.TcpEndpoint,
                    existing.Connection.TransportInUse ?? existing.ConnectionType,
                    Offline: true,
                    existing.Cart.FwVersion,
                    existing.Cart.HardwareVariant,
                    existing.Cart.IsCompatible,
                    Name: _names.GetValueOrDefault(existing.DeviceId));
            }
            else if (_offlineOnly.TryGetValue(deviceId, out var offlineRow))
            {
                row = offlineRow;
            }
            else
            {
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Reconnect ({deviceId}): unknown device in {stopwatch.ElapsedMilliseconds} ms");
                return new ReconnectOutcome(ReconnectResult.UnknownDevice, null);
            }

            var device = await TryConfirmCachedRowSafely(row, ct);

            if (device is not null)
            {
                CarryForwardEndpoint(device.Connection, ConnectionType.Serial, row.SerialPortName);
                CarryForwardEndpoint(device.Connection, ConnectionType.Tcp, row.TcpEndpoint);
                AdoptConfirmedDevice(device);
                SaveRecords();
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Reconnect ({deviceId}): reconnected in {stopwatch.ElapsedMilliseconds} ms");
                return new ReconnectOutcome(ReconnectResult.Reconnected, device);
            }

            await RunSearchForMissingUnits(ct);

            var found = GetAvailableDevice(deviceId);
            var result = found is not null ? ReconnectResult.Reconnected : ReconnectResult.NotFound;
            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Reconnect ({deviceId}): {result} in {stopwatch.ElapsedMilliseconds} ms");
            return new ReconnectOutcome(result, found);
        }

        private Task<ForgetResult> RunForget(string deviceId)
        {
            if (_byChip.TryGetValue(deviceId, out var device))
            {
                if (device.Connection.Mode != DeviceMode.Unreachable)
                {
                    _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Forget ({deviceId}): still available");
                    return Task.FromResult(ForgetResult.StillAvailable);
                }

                // A returning unit gets a fresh TR-N, so its name goes with it - under the names lock so a
                // concurrent rename cannot leave a name behind for a unit that is no longer known.
                lock (_namesLock)
                {
                    _byChip.TryRemove(deviceId, out _);
                    _names.TryRemove(deviceId, out _);
                }

                SaveRecords();
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Forget ({deviceId}): forgotten");
                return Task.FromResult(ForgetResult.Forgotten);
            }

            bool removedOfflineRow;

            lock (_namesLock)
            {
                removedOfflineRow = _offlineOnly.TryRemove(deviceId, out _);

                if (removedOfflineRow)
                {
                    _names.TryRemove(deviceId, out _);
                }
            }

            if (removedOfflineRow)
            {
                SaveRecords();
                _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Forget ({deviceId}): forgotten");
                return Task.FromResult(ForgetResult.Forgotten);
            }

            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: Forget ({deviceId}): unknown device");
            return Task.FromResult(ForgetResult.UnknownDevice);
        }

        /// <summary>
        /// Searches only for units not already available, skipping the endpoints of every available unit
        /// so their ports are left open and undisturbed. Every found unit is merged in (step 7's rule);
        /// nothing is marked unreachable, since this search never claimed to cover the whole address
        /// space. Always saves, including when it finds nothing.
        /// </summary>
        private async Task RunSearchForMissingUnits(CancellationToken ct)
        {
            var skip = BuildAvailableEndpointSkipSet();
            var discovered = await _finder.FindDevices(skip, ct);

            MergeDiscovered(discovered);

            SaveRecords();
        }

        /// <summary>
        /// Merges each found device into the known units: carries forward whatever endpoint it wasn't
        /// found on, from a previous <see cref="_byChip"/> entry or an <see cref="_offlineOnly"/> row,
        /// then adopts it (replacing any stale entry and applying the one-address-one-chip rule).
        /// </summary>
        private void MergeDiscovered(IEnumerable<TeensyRomDevice> discovered)
        {
            foreach (var device in discovered.OrderBy(d => d.DeviceId, StringComparer.Ordinal))
            {
                if (_byChip.TryGetValue(device.DeviceId, out var previous))
                {
                    CarryForwardEndpoint(device.Connection, ConnectionType.Serial, previous.Connection.SerialPortName);
                    CarryForwardEndpoint(device.Connection, ConnectionType.Tcp, previous.Connection.TcpEndpoint);
                }
                else if (_offlineOnly.TryGetValue(device.DeviceId, out var row))
                {
                    CarryForwardEndpoint(device.Connection, ConnectionType.Serial, row.SerialPortName);
                    CarryForwardEndpoint(device.Connection, ConnectionType.Tcp, row.TcpEndpoint);
                }

                AdoptConfirmedDevice(device);
            }
        }

        /// <summary>Every available unit's COM port name and the IP part of its TCP endpoint - the addresses a search for missing units must leave alone.</summary>
        private HashSet<string> BuildAvailableEndpointSkipSet()
        {
            var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var device in GetAvailableDevices())
            {
                if (!string.IsNullOrEmpty(device.Connection.SerialPortName))
                {
                    skip.Add(device.Connection.SerialPortName);
                }

                if (!string.IsNullOrEmpty(device.Connection.TcpEndpoint))
                {
                    skip.Add(device.Connection.TcpEndpoint.GetIpAddress());
                }
            }

            return skip;
        }

        /// <summary>
        /// Registers a freshly confirmed device as the known unit for its chip: the endpoint it was just
        /// confirmed on is dropped from every other known chip first (one address, one chip, on every
        /// confirm path), then it replaces any stale <see cref="_byChip"/> or <see cref="_offlineOnly"/>
        /// entry.
        /// </summary>
        private void AdoptConfirmedDevice(TeensyRomDevice device)
        {
            var transport = device.ConnectionType;
            var endpoint = device.Connection.EndpointFor(transport);

            if (!string.IsNullOrEmpty(endpoint))
            {
                ReleaseEndpointFromOtherChips(device.DeviceId, transport, endpoint);
            }

            // The device object (and its cart) is rebuilt on every confirm, so the saved name is stamped
            // back on here. Stand-ins are display-only: they show their own id and never take a TR-N.
            // The offline row leaves in the same critical section the live row arrives in, so a rename
            // never finds the chip in neither map.
            lock (_namesLock)
            {
                _offlineOnly.TryRemove(device.DeviceId, out _);
                device.Cart.Name = StandInDeviceId.IsStandIn(device.DeviceId) ? device.DeviceId : EnsureName(device.DeviceId);
                _byChip[device.DeviceId] = device;
            }
        }

        /// <summary>
        /// The chip's saved name, or - when it has none - the lowest free <c>TR-n</c> (n a positive
        /// integer no current name already equals, ignoring case), recorded for it. Duplicates the user
        /// typed by hand are allowed to exist; this only avoids handing out a taken default.
        /// </summary>
        private string EnsureName(string chipId)
        {
            lock (_namesLock)
            {
                if (_names.TryGetValue(chipId, out var existing))
                {
                    return existing;
                }

                var taken = new HashSet<string>(_names.Values, StringComparer.OrdinalIgnoreCase);
                var n = 1;

                while (taken.Contains($"TR-{n}"))
                {
                    n++;
                }

                var assigned = $"TR-{n}";
                _names[chipId] = assigned;
                return assigned;
            }
        }

        /// <summary>Clears <paramref name="endpoint"/> from every other known chip's record on <paramref name="transport"/>, in memory and among the file-only rows.</summary>
        private void ReleaseEndpointFromOtherChips(string chipId, ConnectionType transport, string endpoint)
        {
            foreach (var (otherId, other) in _byChip)
            {
                if (otherId == chipId)
                {
                    continue;
                }

                if (string.Equals(other.Connection.EndpointFor(transport), endpoint, StringComparison.OrdinalIgnoreCase))
                {
                    other.Connection.ForgetEndpoint(transport);
                }
            }

            foreach (var otherId in _offlineOnly.Keys.ToList())
            {
                if (otherId == chipId || !_offlineOnly.TryGetValue(otherId, out var row))
                {
                    continue;
                }

                var rowEndpoint = transport == ConnectionType.Serial ? row.SerialPortName : row.TcpEndpoint;

                if (string.Equals(rowEndpoint, endpoint, StringComparison.OrdinalIgnoreCase))
                {
                    _offlineOnly[otherId] = transport == ConnectionType.Serial
                        ? row with { SerialPortName = null }
                        : row with { TcpEndpoint = null };
                }
            }
        }

        /// <summary>As <see cref="TryConfirmCachedRow"/>, except nothing but cancellation escapes: any other exception counts as this row's miss.</summary>
        private async Task<TeensyRomDevice?> TryConfirmCachedRowSafely(CachedConnectionRecord row, CancellationToken ct)
        {
            try
            {
                return await TryConfirmCachedRow(row, ct);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Tries the row's transports in preferred-first order (<see cref="ConnectionOptions.PreferredTransport"/>
        /// then the other), skipping a transport the row holds no endpoint for. <see cref="CachedConnectionRecord.TransportInUse"/>
        /// no longer decides the order - it is only threaded through so the miss-handling below logs and
        /// builds against the transport actually being tried. Every attempt is bounded by
        /// <see cref="ConnectionOptions.ConnectTimeoutMs"/>.
        /// </summary>
        private async Task<TeensyRomDevice?> TryConfirmCachedRow(CachedConnectionRecord row, CancellationToken ct)
        {
            var preferred = _options.PreferredTransport;
            var other = preferred == ConnectionType.Serial ? ConnectionType.Tcp : ConnectionType.Serial;

            var preferredEndpoint = preferred == ConnectionType.Serial ? row.SerialPortName : row.TcpEndpoint;

            if (!string.IsNullOrEmpty(preferredEndpoint))
            {
                var device = await TryConfirmCachedRowOnTransport(row with { TransportInUse = preferred }, ct);
                if (device is not null)
                {
                    return device;
                }
            }

            var otherEndpoint = other == ConnectionType.Serial ? row.SerialPortName : row.TcpEndpoint;

            if (string.IsNullOrEmpty(otherEndpoint))
            {
                return null;
            }

            return await TryConfirmCachedRowOnTransport(row with { TransportInUse = other }, ct);
        }

        private async Task<TeensyRomDevice?> TryConfirmCachedRowOnTransport(CachedConnectionRecord row, CancellationToken ct)
        {
            if (row.TransportInUse == ConnectionType.Serial)
            {
                return await TryConfirmCachedSerialRow(row, ct);
            }

            if (string.IsNullOrEmpty(row.TcpEndpoint) || !NetworkHelper.TryParseEndpoint(row.TcpEndpoint, out var host, out var parsedPort))
            {
                _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: no cached endpoint");
                return null;
            }

            return await TryOpenAndConfirm(() => _transports.CreateTcp(row.TcpEndpoint), row.ChipId, row.TransportInUse, host, parsedPort, ct);
        }

        /// <summary>
        /// Trusts the cached port name as-is whenever the descriptor filter still lists it among this
        /// chip's candidates - or the filter is unavailable, since "cannot tell" must not become "reject" -
        /// which alone survives Windows holding a stale port entry for an image that just detached. When
        /// the cached name is no longer among the candidates, the chip has genuinely moved (e.g. a mode
        /// switch swaps minimal COM7 for full COM4): every remaining candidate is opened and
        /// version-confirmed in order rather than paying for a full sweep, and the first that answers as
        /// this chip is adopted. Hands its confirmed endpoint to <see cref="ICartFinder.BuildDevice"/> -
        /// the same builder full discovery uses. Returns null - every opened port disposed - on any miss,
        /// including when the cached port name no longer exists at all (<see cref="TryOpenAndConfirm"/>
        /// builds the port inside its own miss handling, so that never throws here).
        /// </summary>
        private async Task<TeensyRomDevice?> TryConfirmCachedSerialRow(CachedConnectionRecord row, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(row.SerialPortName))
            {
                _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: no cached port name");
                return null;
            }

            var lookup = _locator.FindByChipId(row.ChipId);

            if (!lookup.FilterAvailable)
            {
                // "Cannot tell" must not become "reject" - the one case that survives Windows holding a
                // stale port entry for an image that just detached. But since the filter cannot vouch for
                // this port, it may just as well be some other device now: DTR never asserts here.
                return await TryOpenAndConfirm(() => _transports.CreateSerial(row.SerialPortName, isTeensyRomPort: false), row.ChipId, row.TransportInUse, row.SerialPortName, null, ct);
            }

            var cachedCandidate = lookup.Candidates.FirstOrDefault(c => string.Equals(c.PortName, row.SerialPortName, StringComparison.OrdinalIgnoreCase));

            if (cachedCandidate is not null)
            {
                var isTeensyRomPort = cachedCandidate.Image is TeensyRomImage.Full or TeensyRomImage.Minimal;
                return await TryOpenAndConfirm(() => _transports.CreateSerial(row.SerialPortName, isTeensyRomPort), row.ChipId, row.TransportInUse, row.SerialPortName, null, ct);
            }

            // The cached name is no longer among the candidates - a genuine move (e.g. a mode switch
            // swaps minimal COM7 for full COM4) or the chip is off USB entirely (empty candidates, a
            // miss below). Every remaining candidate is opened and version-confirmed in order.
            foreach (var candidate in lookup.Candidates)
            {
                var isTeensyRomPort = candidate.Image is TeensyRomImage.Full or TeensyRomImage.Minimal;
                var device = await TryOpenAndConfirm(() => _transports.CreateSerial(candidate.PortName, isTeensyRomPort), row.ChipId, row.TransportInUse, candidate.PortName, null, ct);
                if (device is not null)
                {
                    return device;
                }
            }

            // No candidate answered as this chip: the cache said otherwise, so the search decides.
            _log.Internal($"DeviceConnectionManager: start confirm miss for {row.ChipId}: descriptor no longer names this chip");
            return null;
        }

        /// <summary>
        /// Builds the port from <paramref name="createPort"/> and opens it, both inside the same miss
        /// handling, bounded by the connect timeout - so a cached COM name that no longer exists on the
        /// machine (<see cref="IDeviceTransportFactory.CreateSerial"/> throws) is a miss here, never a
        /// throw out of the manager. Confirms the version reply is <paramref name="chipId"/> and builds
        /// the device, disposing the port on any miss.
        /// </summary>
        private async Task<TeensyRomDevice?> TryOpenAndConfirm(Func<ICommunicationPort> createPort, string chipId, ConnectionType transport, string address, int? tcpPort, CancellationToken ct)
        {
            ICommunicationPort? owned = null;

            try
            {
                try
                {
                    owned = createPort();
                    owned.OpenPort(_options.ConnectTimeoutMs);
                }
                catch (Exception ex)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {chipId}: open failed: {ex.Message}");
                    return null;
                }

                var reply = _interrogator.ReadVersion(owned);

                if (!reply.IsTeensyRom)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {chipId}: no answer");
                    return null;
                }

                if (reply.ChipId != chipId)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {chipId}: wrong chip ({reply.ChipId})");
                    return null;
                }

                var endpoint = new DiscoveredEndpoint(transport, address, tcpPort, reply, owned);
                var device = await _finder.BuildDevice(endpoint, ct);

                if (device is null)
                {
                    _log.Internal($"DeviceConnectionManager: start confirm miss for {chipId}: builder rejected the endpoint");
                    return null;
                }

                owned = null; // ownership passed to the device
                return device;
            }
            finally
            {
                owned?.Dispose();
            }
        }

        /// <summary>Every cache write goes through here so a rename's save and an occasion's save cannot interleave.</summary>
        private void SaveRecords()
        {
            lock (_saveLock)
            {
                _cache.Save(BuildCacheRows());
            }
        }

        /// <summary>
        /// Writes every known unit as a cache row: an available unit online from its record and
        /// <see cref="TeensyRomDevice.Cart"/> (<c>FwVersion</c>, <c>HardwareVariant</c>, <c>IsCompatible</c>),
        /// an unreachable or file-only unit offline with its last-known facts. Stand-in ids are still
        /// skipped (the cache writer already drops them).
        /// </summary>
        private List<CachedConnectionRecord> BuildCacheRows()
        {
            var rows = new List<CachedConnectionRecord>();

            foreach (var device in _byChip.Values)
            {
                rows.Add(new CachedConnectionRecord(
                    device.DeviceId,
                    device.Connection.SerialPortName,
                    device.Connection.TcpEndpoint,
                    device.Connection.TransportInUse ?? device.ConnectionType,
                    Offline: device.Connection.Mode == DeviceMode.Unreachable,
                    device.Cart.FwVersion,
                    device.Cart.HardwareVariant,
                    device.Cart.IsCompatible,
                    Name: _names.GetValueOrDefault(device.DeviceId)));
            }

            foreach (var row in _offlineOnly.Values)
            {
                rows.Add(row with { Offline = true, Name = _names.GetValueOrDefault(row.ChipId) });
            }

            return rows;
        }

        /// <summary>Fills <paramref name="transport"/>'s endpoint on <paramref name="target"/> from <paramref name="candidateEndpoint"/>, but only when the target doesn't already have one.</summary>
        private static void CarryForwardEndpoint(DeviceConnectionRecord target, ConnectionType transport, string? candidateEndpoint)
        {
            if (target.EndpointFor(transport) is null)
            {
                target.RememberEndpoint(transport, candidateEndpoint);
            }
        }
    }
}
