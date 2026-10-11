using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Usb
{
    /// <inheritdoc cref="ITeensyPortLocator"/>
    public sealed class TeensyPortLocator : ITeensyPortLocator
    {
        private readonly IReadOnlyList<IUsbSerialDescriptorReader> _readers;
        private readonly ILoggingService _log;
        private readonly Func<IReadOnlyList<string>> _getPresentPorts;

        /// <summary>
        /// Chip ids this process has classified at least once. The locator is a singleton, so this
        /// outlives any single call: it is what lets <see cref="FindByChipId"/> answer "not present right
        /// now" for a chip a working reader has already named, instead of "cannot tell" - see the read
        /// path in <see cref="ReadPorts"/>.
        /// </summary>
        private readonly HashSet<string> _classifiedChipIds = new(StringComparer.OrdinalIgnoreCase);

        public TeensyPortLocator(IEnumerable<IUsbSerialDescriptorReader> readers, ILoggingService log)
            : this(readers, log, SerialHelper.GetComPorts)
        {
        }

        /// <summary>Test seam for the "present ports" source, otherwise <see cref="SerialHelper.GetComPorts"/>.</summary>
        public TeensyPortLocator(IEnumerable<IUsbSerialDescriptorReader> readers, ILoggingService log, Func<IReadOnlyList<string>> getPresentPorts)
        {
            _readers = readers.ToList();
            _log = log;
            _getPresentPorts = getPresentPorts;
        }

        public PortLocatorResult ListPorts()
        {
            var outcome = ReadPorts();

            if (!outcome.ReaderFunctional || outcome.UnavailableReason is not null)
            {
                return new PortLocatorResult([], false, outcome.UnavailableReason);
            }

            return new PortLocatorResult(outcome.Ports, true, null);
        }

        public PortLookup FindByChipId(string chipId)
        {
            var outcome = ReadPorts();

            if (!outcome.ReaderFunctional)
            {
                return new PortLookup([], false, outcome.UnavailableReason);
            }

            var matches = outcome.Ports
                .Where(p => string.Equals(p.ChipId, chipId, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matches.Count > 0)
            {
                return new PortLookup(matches, true, null);
            }

            if (_classifiedChipIds.Contains(chipId))
            {
                // The reader worked and simply found no port for this chip this round. Since this chip
                // has been classified before, that is "not present right now", not "cannot tell".
                return new PortLookup([], true, null);
            }

            // The reader worked and classified other chips this round (or none at all), but this chip has
            // never been classified in this process - that is "cannot tell", not "not present right now".
            return new PortLookup([], false, outcome.UnavailableReason ?? "this chip has not been seen yet");
        }

        /// <summary>
        /// The one read of the descriptor source, shared by <see cref="ListPorts"/> and
        /// <see cref="FindByChipId"/>. <see cref="ReadOutcome.ReaderFunctional"/> is true whenever a
        /// supported reader read without throwing - even when it classified nothing among present ports -
        /// so callers can tell that case apart from "no reader" or "reader threw", which
        /// <see cref="ListPorts"/> collapses into a single "cannot tell" but <see cref="FindByChipId"/>
        /// does not.
        /// </summary>
        private ReadOutcome ReadPorts()
        {
            var reader = _readers.FirstOrDefault(r => r.IsSupported);

            if (reader is null)
            {
                return new ReadOutcome([], false, "No USB descriptor reader supports this platform.");
            }

            var presentPorts = _getPresentPorts();

            IReadOnlyList<UsbSerialDescriptor> descriptors;
            try
            {
                descriptors = reader.Read(presentPorts);
            }
            catch (Exception ex)
            {
                _log.InternalError($"TeensyPortLocator: descriptor reader threw: {ex.Message}");
                return new ReadOutcome([], false, ex.Message);
            }

            var ports = descriptors
                .Select(Classify)
                .Where(p => p is not null)
                .Select(p => p!)
                .ToList();

            foreach (var port in ports)
            {
                _classifiedChipIds.Add(port.ChipId);
            }

            if (ports.Count == 0 && presentPorts.Count > 0)
            {
                return new ReadOutcome([], true, $"descriptor filter found no TeensyROM among {presentPorts.Count} present ports");
            }

            return new ReadOutcome(ports, true, null);
        }

        private sealed record ReadOutcome(IReadOnlyList<TeensyRomPort> Ports, bool ReaderFunctional, string? UnavailableReason);

        private static TeensyRomPort? Classify(UsbSerialDescriptor descriptor)
        {
            if (descriptor.Vid == TeensyUsbIds.Vendor && descriptor.Pid == TeensyUsbIds.ProductFull)
            {
                return new TeensyRomPort(descriptor.PortName, StripFullPrefix(descriptor.SerialNumber), TeensyRomImage.Full);
            }

            if (descriptor.Vid == TeensyUsbIds.Vendor && descriptor.Pid == TeensyUsbIds.ProductMinimal)
            {
                return new TeensyRomPort(descriptor.PortName, descriptor.SerialNumber, TeensyRomImage.Minimal);
            }

            if (descriptor.Vid is null)
            {
                return new TeensyRomPort(descriptor.PortName, descriptor.SerialNumber, TeensyRomImage.Unknown);
            }

            return null;
        }

        private static string StripFullPrefix(string serial) =>
            serial.StartsWith(TeensyUsbIds.FullSerialPrefix, StringComparison.OrdinalIgnoreCase)
                ? serial[TeensyUsbIds.FullSerialPrefix.Length..]
                : serial;
    }
}
