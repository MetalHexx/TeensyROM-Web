using System.Text.RegularExpressions;

namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// macOS exposes no descriptor read for a serial port; the port node's own name carries the serial
    /// string, so this enumerates "/dev/cu.usbmodem*" and extracts the chip digits with a regex that
    /// tolerates both the bare digits and a "TeensyROM_Serial_"/"TeensyROM-Serial-" prefix, plus macOS's
    /// trailing location digit. Rows always come back with <c>Vid = Pid = null</c>.
    /// This reader narrows candidates but is NOT the safety filter <see cref="WindowsRegistryDescriptorReader"/>
    /// and <see cref="LinuxSysfsDescriptorReader"/> get: any "cu.usbmodem&lt;digits&gt;" CDC device (e.g. an
    /// Arduino's location-id name) becomes a candidate with a bogus chip id, classified
    /// <see cref="TeensyRomImage.Unknown"/>. So on macOS, <see cref="ITeensyPortLocator.FindByChipId"/> over
    /// Unknown rows is advisory - the version reply is what confirms - and discovery still writes only the
    /// version token to such a port, which every CDC device tolerates.
    /// </summary>
    public sealed class MacOsPortNameDescriptorReader : IUsbSerialDescriptorReader
    {
        private const string DevDirectory = "/dev";
        private const string NodeSearchPattern = "cu.usbmodem*";

        private static readonly Regex ChipPattern = new(
            @"^cu\.usbmodem(?:TeensyROM[_-]Serial[_-])?(?<digits>\d+)$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly Func<IReadOnlyList<string>> _enumerateDeviceNodes;

        public MacOsPortNameDescriptorReader() : this(EnumerateDevDirectory)
        {
        }

        /// <summary>Takes the device-node name list as an injectable enumerator so tests avoid the live "/dev".</summary>
        public MacOsPortNameDescriptorReader(Func<IReadOnlyList<string>> enumerateDeviceNodes)
        {
            _enumerateDeviceNodes = enumerateDeviceNodes;
        }

        public bool IsSupported => OperatingSystem.IsMacOS();

        public IReadOnlyList<UsbSerialDescriptor> Read(IReadOnlyCollection<string> presentPortNames)
        {
            var results = new List<UsbSerialDescriptor>();

            foreach (var nodeName in _enumerateDeviceNodes())
            {
                var match = ChipPattern.Match(nodeName);

                if (!match.Success)
                {
                    continue;
                }

                var digits = match.Groups["digits"].Value;
                var chipId = digits.Length > 1 ? digits[..^1] : digits;

                results.Add(new UsbSerialDescriptor($"{DevDirectory}/{nodeName}", null, null, chipId));
            }

            return results;
        }

        private static IReadOnlyList<string> EnumerateDevDirectory() =>
            Directory.Exists(DevDirectory)
                ? Directory.GetFileSystemEntries(DevDirectory, NodeSearchPattern)
                    .Select(Path.GetFileName)
                    .Where(name => name is not null)
                    .Select(name => name!)
                    .ToList()
                : [];
    }
}
