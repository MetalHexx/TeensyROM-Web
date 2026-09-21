using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Usb
{
    /// <inheritdoc cref="ITeensyPortLocator"/>
    public sealed class TeensyPortLocator : ITeensyPortLocator
    {
        private readonly IReadOnlyList<IUsbSerialDescriptorReader> _readers;
        private readonly ILoggingService _log;
        private readonly Func<IReadOnlyList<string>> _getPresentPorts;

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
            var reader = _readers.FirstOrDefault(r => r.IsSupported);

            if (reader is null)
            {
                return new PortLocatorResult([], false, "No USB descriptor reader supports this platform.");
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
                return new PortLocatorResult([], false, ex.Message);
            }

            var ports = descriptors
                .Select(Classify)
                .Where(p => p is not null)
                .Select(p => p!)
                .ToList();

            if (ports.Count == 0 && presentPorts.Count > 0)
            {
                return new PortLocatorResult([], false, $"descriptor filter found no TeensyROM among {presentPorts.Count} present ports");
            }

            return new PortLocatorResult(ports, true, null);
        }

        public PortLookup FindByChipId(string chipId)
        {
            var result = ListPorts();

            if (!result.FilterAvailable)
            {
                return new PortLookup(null, false, result.UnavailableReason);
            }

            var matches = result.Ports.Where(p => string.Equals(p.ChipId, chipId, StringComparison.OrdinalIgnoreCase)).ToList();

            if (matches.Count == 0)
            {
                return new PortLookup(null, true, null);
            }

            if (matches.Count > 1)
            {
                _log.InternalWarning($"TeensyPortLocator: chip id '{chipId}' matched {matches.Count} ports ({string.Join(", ", matches.Select(m => m.PortName))}); using '{matches[0].PortName}'.");
            }

            return new PortLookup(matches[0], true, null);
        }

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
