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

        /// <summary>
        /// Bench (TR+): once the menu has asked for its SID the Teensy answers nothing while the menu brings
        /// the network up - ~2 s with a static IP, ~4.2 s when the time sync stalls. The first version
        /// request after the token waits that out rather than timing out into a close and reopen.
        /// </summary>
        private const int _versionAfterMenuTokenAckTimeoutMs = 8000;

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
            DeviceMode? lastSeenMode = null;
            VersionReply? lastCorrectReply = null;
            var fallbackLogged = false;
            var menuTokenSeen = false;

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
                        reply = ReacquireSerial(chipId, port, expected, ref fallbackLogged, ref menuTokenSeen);
                    }
                }

                reply ??= port.IsOpen ? interrogator.ReadVersion(port) : VersionReply.Empty;

                if (reply.IsTeensyRom && reply.ChipId == chipId)
                {
                    lastProbeAnswered = true;
                    lastCorrectReply = reply;
                    var mode = reply.IsMinimalFirmware ? DeviceMode.Minimal : DeviceMode.FullIdle;
                    lastSeenMode = mode;

                    if (expected is null || expected == mode)
                    {
                        // Argument evaluation order matters here: the boot wait inside MenuBootFailure has
                        // to run before sw.Elapsed is read, or the logged recovery time excludes it.
                        var menuBootFailure = MenuBootFailure(reason, port, reply);
                        return Succeed(device, port, transport, reply, mode, reason, ceiling, sw.Elapsed, menuBootFailure);
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
                    Close(port);
                    lastProbeAnswered = false;
                }
                else
                {
                    lastProbeAnswered = false;
                }

                await Task.Delay(options.PollIntervalMs, ct);
            }

            if (lastSeenMode is { } unexpectedMode && lastCorrectReply is not null && port.IsOpen && lastProbeAnswered)
            {
                // The device is reachable, just not in the mode this reason expected - the caller (e.g. a
                // launch) decides what that means.
                var failure = $"expected {DescribeExpectation(expected)}, device is in {unexpectedMode}";
                return Succeed(device, port, transport, lastCorrectReply, unexpectedMode, reason, ceiling, sw.Elapsed, failure);
            }

            device.MarkUnreachable();
            Close(port);
            log.InternalError($"{_logClass} Recovery {reason} on {transport} for {chipId} failed after {sw.Elapsed.TotalMilliseconds} ms (ceiling {ceiling.TotalMilliseconds} ms)");
            return new RecoveryOutcome(DeviceMode.Unreachable, sw.Elapsed, ceiling, $"no correct-chip reply from {chipId} within {ceiling.TotalMilliseconds} ms");
        }

        /// <summary>
        /// Leaving minimal is the one reset <c>TRStreamExtensions.ResetFromMinimal</c> cannot finish for
        /// itself: the Teensy reboots and drops the transport, so the reply that ended the poll can come
        /// before the C64 menu is done, and the firmware says so in that very reply. "complete" (TCP only
        /// comes back at the end of the boot, so this is the usual case there) needs no wait; anything else
        /// is polled until complete - on serial only ever after the menu's SID token, which the reacquire
        /// listened for. A miss is not swallowed: it comes back as the outcome's
        /// <see cref="RecoveryOutcome.Failure"/> and a warning, since the next command may still meet the
        /// booting menu.
        /// </summary>
        private string? MenuBootFailure(RecoveryReason reason, ICommunicationPort port, VersionReply reply)
        {
            if (reason != RecoveryReason.LeaveMinimal || reply.BootComplete == true)
            {
                return null;
            }

            try
            {
                return port.WaitForBootComplete(log)
                    ? null
                    : "the C64 menu did not report its boot complete after the reset";
            }
            catch (Exception ex) when (TransportDrop.IsDrop(ex, port))
            {
                return $"the transport dropped waiting for the C64 menu: {ex.Message}";
            }
        }

        /// <summary>TCP: close if open, then a single bounded connect attempt. A failed or timed-out connect is a miss, not an error - swallowed so the caller reads it from the port staying closed.</summary>
        private void ReacquireTcp(TeensyRomDevice device, ICommunicationPort port)
        {
            Close(port);

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
        /// Serial: tries every port the descriptor filter currently claims for this chip id, in listing
        /// order, reopening and version-confirming each before accepting it. A descriptor match alone does
        /// not prove which port is live: full and minimal are different USB identities (0489 / 0483),
        /// Windows keeps a just-detached image's port entry alive, and chip 19277260 was observed claiming
        /// COM4 and COM7 at once on the bench - so the version reply is what actually decides, and this
        /// otherwise-redundant-looking reopen-and-confirm is why. When the filter cannot be trusted this
        /// call, falls back to scanning every present COM port (except the one already set) and
        /// version-probing each in turn, returning the matching reply directly since the scan already
        /// obtained it.
        /// </summary>
        private VersionReply? ReacquireSerial(string chipId, ICommunicationPort port, DeviceMode? expected, ref bool fallbackLogged, ref bool menuTokenSeen)
        {
            var lookup = locator.FindByChipId(chipId);

            if (lookup.FilterAvailable && lookup.Candidates.Count > 0)
            {
                return ReacquireCandidates(chipId, port, InProbeOrder(lookup.Candidates, expected), expected, ref menuTokenSeen);
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

        /// <summary>
        /// Opens each candidate in turn and accepts the first whose version reply proves it is this chip;
        /// a candidate that opens but answers wrong or not at all is closed and the loop moves on.
        /// Exhausting the list is a miss - the outer poll retries within the unchanged ceiling.
        /// <para>
        /// Waiting for full, a port that may be the full image is only listened to until the C64 menu asks
        /// for its SID, and asked for its version after that. The full port appears just before the
        /// firmware resets the C64 and the menu copies itself into C64 RAM; a request answered in that
        /// window can make the Teensy miss a C64 bus cycle and corrupt the copy (bench: every failed boot -
        /// menu never started, hung, or dropping remote launches - came from a round that polled then;
        /// none from 26 silent rounds). The menu's SID request is its first act once running, so after it
        /// the version request is safe. No token within the listen bound (port opened late, or a menu that
        /// never started) falls through to the version request.
        /// </para>
        /// </summary>
        private VersionReply? ReacquireCandidates(string chipId, ICommunicationPort port, IEnumerable<TeensyRomPort> candidates, DeviceMode? expected, ref bool menuTokenSeen)
        {
            foreach (var candidate in candidates)
            {
                Close(port);

                try
                {
                    port.SetPort(candidate.PortName);
                    port.OpenPort(useRetryLoop: false);
                }
                catch (Exception)
                {
                    continue;
                }

                var ackTimeoutMs = TRDiscoveryRoutines.VersionAckTimeoutMs;

                if (expected == DeviceMode.FullIdle && candidate.Image != TeensyRomImage.Minimal && !menuTokenSeen)
                {
                    try
                    {
                        menuTokenSeen = port.WaitForMenuBootToken(log);
                    }
                    catch (Exception ex) when (ex is IOException or InvalidOperationException or UnauthorizedAccessException)
                    {
                        // The port went away while listening - the transient minimal image jumping to full
                        // (macOS cannot tell it from full by descriptor), or a stale entry. A miss.
                        log.Internal($"{_logClass} {candidate.PortName} went away while listening for the C64 menu: {ex.Message}");
                        continue;
                    }

                    if (menuTokenSeen) ackTimeoutMs = _versionAfterMenuTokenAckTimeoutMs;
                }

                var reply = interrogator.ReadVersion(port, ackTimeoutMs);
                if (reply.IsTeensyRom && reply.ChipId == chipId)
                {
                    return reply;
                }
            }

            Close(port);
            return null;
        }

        /// <summary>
        /// Every Teensy boot passes through the minimal image before it jumps to full, so a device leaving
        /// minimal shows its minimal port again, and that port never answers: the image is only waiting in
        /// <c>Serial.begin()</c> for DTR before it jumps. Opening it (DTR on) releases that wait, so it is
        /// still worth opening (bench, serial: minimal port back ~800 ms after the reset, gone ~1390 ms, full
        /// port up ~1600 ms; ~2 s later when nobody opens it). Ports of the image the reason expects are
        /// probed first, the other image last - still probed, so a device that really stayed in the other
        /// image is reported in that mode, not as unreachable.
        /// </summary>
        private static IEnumerable<TeensyRomPort> InProbeOrder(IReadOnlyList<TeensyRomPort> candidates, DeviceMode? expected)
        {
            if (expected is null)
            {
                return candidates;
            }

            var wanted = expected == DeviceMode.Minimal ? TeensyRomImage.Minimal : TeensyRomImage.Full;
            return candidates.OrderBy(c => c.Image == wanted ? 0 : c.Image == TeensyRomImage.Unknown ? 1 : 2);
        }

        /// <summary>
        /// Closes the port if it is open. Closing a serial port whose USB device has just gone away throws
        /// ("A device attached to the system is not functioning") after .NET has already released the
        /// handle, so the port reads closed and can be reopened: during recovery that is a miss for the
        /// poll to retry, not a failure to escape with.
        /// </summary>
        private void Close(ICommunicationPort port)
        {
            if (!port.IsOpen) return;

            try
            {
                port.ClosePort();
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                log.Internal($"{_logClass} {port.GetEndpoint()} went away before it closed: {ex.Message}");
            }
        }

        private VersionReply ScanSerialPortsForChip(string chipId, ICommunicationPort port)
        {
            var currentPortName = port.GetEndpoint();

            foreach (var candidate in SerialHelper.GetComPorts().Where(name => name != currentPortName))
            {
                Close(port);

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

            Close(port);
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
                    // Unknown leaves the last known value in place rather than writing either answer - the
                    // probe's own log line (TRDiscoveryRoutines.ProbeStorageRoot) says why it couldn't tell.
                    // Treating Unknown as Absent previously produced a 404 "does not have an SD card" for a
                    // device whose SD had been indexed minutes earlier.
                    if (sd is StoragePresence.Present or StoragePresence.Absent) device.Cart.SdStorage.Available = sd == StoragePresence.Present;
                    if (usb is StoragePresence.Present or StoragePresence.Absent) device.Cart.UsbStorage.Available = usb == StoragePresence.Present;
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
                _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, null)
            };
        }

        private static DeviceMode? Expectation(RecoveryReason reason) => reason switch
        {
            RecoveryReason.LargeLaunch => DeviceMode.Minimal,
            RecoveryReason.LeaveMinimal => DeviceMode.FullIdle,
            _ => null
        };

        private static string DescribeExpectation(DeviceMode? expected) => expected?.ToString() ?? "either mode";
    }
}
