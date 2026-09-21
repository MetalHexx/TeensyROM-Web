using System.Diagnostics;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// Reacquires a device after any transport drop, on the device's own <see cref="ICommunicationPort"/>
    /// instance - never a new one, so the <c>StorageService</c>s already holding that port keep talking
    /// to a live connection rather than one nobody else can see. Polls the version command until it
    /// answers with the reason's expected mode or the transport's ceiling passes, then updates the
    /// connection record and (for a full reply) storage presence in place.
    /// </summary>
    public sealed class DeviceRecovery(
        IDeviceInterrogator interrogator,
        ITeensyPortLocator locator,
        ConnectionOptions options,
        ILoggingService log) : IDeviceRecovery
    {
        private const string _logClass = $"{nameof(DeviceRecovery)}:";

        public async Task<RecoveryOutcome> RecoverAsync(TeensyRomDevice device, RecoveryReason reason, CancellationToken ct)
        {
            var port = device.CommunicationPort;
            var chipId = device.DeviceId;
            var transport = device.Connection.TransportInUse ?? port.GetConnectionType();
            var ceiling = GetCeiling(reason, transport);
            var expected = Expectation(reason);

            log.Internal($"{_logClass} Recovery {reason} on {transport} for {chipId}: ceiling {ceiling.TotalMilliseconds} ms");

            var sw = Stopwatch.StartNew();
            var lastProbeAnswered = false;
            var missSeen = false;
            var fullSeen = false;
            Stopwatch? settleStopwatch = null;
            DeviceMode? lastSeenMode = null;
            VersionReply? lastCorrectReply = null;
            var fallbackLogged = false;

            while (sw.Elapsed < ceiling)
            {
                var needsReacquire = !port.IsOpen || !lastProbeAnswered;
                VersionReply? reply = null;

                if (needsReacquire)
                {
                    if (transport == ConnectionType.Tcp)
                    {
                        ReacquireTcp(device, port);
                    }
                    else
                    {
                        reply = ReacquireSerial(chipId, port, ref fallbackLogged);
                    }
                }

                reply ??= port.IsOpen ? interrogator.ReadVersion(port) : VersionReply.Empty;

                if (reply.IsTeensyRom && reply.ChipId == chipId)
                {
                    lastProbeAnswered = true;
                    lastCorrectReply = reply;
                    var mode = reply.IsMinimalFirmware ? DeviceMode.Minimal : DeviceMode.FullIdle;
                    lastSeenMode = mode;

                    if (reason == RecoveryReason.ChainedLaunch)
                    {
                        if (mode == DeviceMode.Minimal)
                        {
                            if (missSeen)
                            {
                                // Rule (b) tail / (c): a Minimal answer after a miss is the chain completing
                                // in Minimal, whether or not a Full answer was ever observed in between.
                                return Succeed(device, port, transport, reply, mode, reason, ceiling, sw.Elapsed);
                            }
                            log.Internal($"{_logClass} {chipId} answered in Minimal; still the pre-launch state, waiting for it to leave.");
                        }
                        else if (!fullSeen)
                        {
                            fullSeen = true;
                            settleStopwatch = Stopwatch.StartNew();
                            log.Internal($"{_logClass} {chipId} answered in Full; settling for {options.LaunchSettleMs} ms to confirm.");
                        }
                        else if (settleStopwatch!.Elapsed >= TimeSpan.FromMilliseconds(options.LaunchSettleMs))
                        {
                            // Rule (b): every probe through the settle hold stayed Full - the small file launched.
                            return Succeed(device, port, transport, reply, mode, reason, ceiling, sw.Elapsed);
                        }
                    }
                    else if (expected is null || expected == mode)
                    {
                        return Succeed(device, port, transport, reply, mode, reason, ceiling, sw.Elapsed);
                    }
                    else
                    {
                        log.Internal($"{_logClass} {chipId} answered in {mode}; waiting for {expected}.");
                    }
                }
                else if (reply.IsTeensyRom)
                {
                    // A collision on TCP or a sibling's port on serial is not this device.
                    log.Internal($"{_logClass} wrong chip {reply.ChipId} at {port.GetEndpoint()}");
                    if (port.IsOpen) port.ClosePort();
                    lastProbeAnswered = false;
                }
                else
                {
                    missSeen = true;
                    lastProbeAnswered = false;
                }

                await Task.Delay(options.PollIntervalMs, ct);
            }

            if (lastSeenMode is { } unexpectedMode && lastCorrectReply is not null && port.IsOpen && lastProbeAnswered)
            {
                // The device is reachable, just not in the mode this reason expected - the caller (e.g. a
                // launch) decides what that means.
                var failure = $"expected {DescribeExpectation(reason, expected)}, device is in {unexpectedMode}";
                return Succeed(device, port, transport, lastCorrectReply, unexpectedMode, reason, ceiling, sw.Elapsed, failure);
            }

            device.MarkUnreachable();
            if (port.IsOpen) port.ClosePort();
            log.InternalError($"{_logClass} Recovery {reason} on {transport} for {chipId} failed after {sw.Elapsed.TotalMilliseconds} ms (ceiling {ceiling.TotalMilliseconds} ms)");
            return new RecoveryOutcome(DeviceMode.Unreachable, sw.Elapsed, ceiling, $"no correct-chip reply from {chipId} within {ceiling.TotalMilliseconds} ms");
        }

        /// <summary>TCP: close if open, then a single bounded connect attempt. A failed or timed-out connect is a miss, not an error - swallowed so the caller reads it from the port staying closed.</summary>
        private void ReacquireTcp(TeensyRomDevice device, ICommunicationPort port)
        {
            if (port.IsOpen) port.ClosePort();

            var endpoint = device.Connection.TcpEndpoint;
            if (string.IsNullOrEmpty(endpoint)) return;

            try
            {
                port.SetPort(endpoint);
                port.OpenPort(options.ConnectTimeoutMs);
            }
            catch (Exception)
            {
            }
        }

        /// <summary>
        /// Serial: finds the device's current port by chip id and reopens on it. When the filter cannot
        /// be trusted this call, falls back to scanning every present COM port (except the one already
        /// set) and version-probing each in turn, returning the matching reply directly since the scan
        /// already obtained it.
        /// </summary>
        private VersionReply? ReacquireSerial(string chipId, ICommunicationPort port, ref bool fallbackLogged)
        {
            var lookup = locator.FindByChipId(chipId);

            if (lookup.FilterAvailable && lookup.Port is not null)
            {
                if (port.IsOpen) port.ClosePort();
                try
                {
                    port.SetPort(lookup.Port.PortName);
                    port.OpenPort(useRetryLoop: false);
                }
                catch (Exception)
                {
                    // A just-enumerated port can still fail to open - a miss, not an error.
                }
                return null;
            }

            if (lookup.FilterAvailable)
            {
                // The device has not re-enumerated yet - a miss, keep polling.
                return null;
            }

            if (!fallbackLogged)
            {
                log.InternalWarning($"{_logClass} USB descriptor filter unavailable ({lookup.UnavailableReason}); scanning every COM port for {chipId}.");
                fallbackLogged = true;
            }

            return ScanSerialPortsForChip(chipId, port);
        }

        private VersionReply ScanSerialPortsForChip(string chipId, ICommunicationPort port)
        {
            var currentPortName = port.GetEndpoint();

            foreach (var candidate in SerialHelper.GetComPorts().Where(name => name != currentPortName))
            {
                if (port.IsOpen) port.ClosePort();

                try
                {
                    port.SetPort(candidate);
                    port.OpenPort(useRetryLoop: false);
                }
                catch (Exception)
                {
                    continue;
                }

                var reply = interrogator.ReadVersion(port);
                if (reply.IsTeensyRom && reply.ChipId == chipId)
                {
                    return reply;
                }
            }

            if (port.IsOpen) port.ClosePort();
            return VersionReply.Empty;
        }

        private RecoveryOutcome Succeed(
            TeensyRomDevice device,
            ICommunicationPort port,
            ConnectionType transport,
            VersionReply reply,
            DeviceMode mode,
            RecoveryReason reason,
            TimeSpan ceiling,
            TimeSpan elapsed,
            string? failure = null)
        {
            device.Confirm(transport, port.GetEndpoint(), mode);
            VersionReplyMapper.Apply(reply, device.Cart);

            if (mode == DeviceMode.FullIdle)
            {
                var sd = interrogator.ProbeStorage(port, TeensyStorageType.SD);
                var usb = interrogator.ProbeStorage(port, TeensyStorageType.USB);

                if (sd == StoragePresence.Busy || usb == StoragePresence.Busy)
                {
                    device.MarkBusy();
                }
                else
                {
                    device.Cart.SdStorage.Available = sd == StoragePresence.Present;
                    device.Cart.UsbStorage.Available = usb == StoragePresence.Present;
                }
            }

            if (failure is null)
            {
                log.InternalSuccess($"{_logClass} Recovery {reason} -> {device.Connection.Mode} in {elapsed.TotalMilliseconds} ms (ceiling {ceiling.TotalMilliseconds} ms)");
            }
            else
            {
                log.InternalWarning($"{_logClass} Recovery {reason} -> {device.Connection.Mode} in {elapsed.TotalMilliseconds} ms (ceiling {ceiling.TotalMilliseconds} ms): {failure}");
            }

            return new RecoveryOutcome(device.Connection.Mode, elapsed, ceiling, failure);
        }

        private TimeSpan GetCeiling(RecoveryReason reason, ConnectionType transport)
        {
            var ceilings = transport == ConnectionType.Tcp ? options.Tcp : options.Serial;

            return reason switch
            {
                RecoveryReason.LargeLaunch => TimeSpan.FromMilliseconds(ceilings.ToMinimalMs),
                RecoveryReason.LeaveMinimal => TimeSpan.FromMilliseconds(ceilings.ToFullMs),
                RecoveryReason.Drop => TimeSpan.FromMilliseconds(Math.Max(ceilings.ToMinimalMs, ceilings.ToFullMs)),
                RecoveryReason.ChainedLaunch => TimeSpan.FromMilliseconds(ceilings.ToFullMs + ceilings.ToMinimalMs + options.LaunchSettleMs),
                _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, null)
            };
        }

        private static DeviceMode? Expectation(RecoveryReason reason) => reason switch
        {
            RecoveryReason.LargeLaunch => DeviceMode.Minimal,
            RecoveryReason.LeaveMinimal => DeviceMode.FullIdle,
            _ => null
        };

        private static string DescribeExpectation(RecoveryReason reason, DeviceMode? expected) =>
            expected?.ToString() ?? (reason == RecoveryReason.ChainedLaunch ? "the chain to complete" : "either mode");
    }
}
