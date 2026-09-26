using System.Globalization;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// Reads USB serial descriptors from Linux sysfs. For each "/sys/class/tty/ttyACM*" (and "ttyUSB*")
    /// entry, resolves its "device" entry - a symlink to the USB interface on a real Linux host - and walks
    /// up the ancestor directories for the first one holding idVendor/idProduct/serial. The sysfs root is a
    /// constructor argument so tests point it at a captured directory tree instead of the live "/sys".
    /// </summary>
    public sealed class LinuxSysfsDescriptorReader : IUsbSerialDescriptorReader
    {
        private const string DefaultSysfsRoot = "/sys";
        private static readonly string[] TtyPrefixes = ["ttyACM", "ttyUSB"];

        private readonly string _sysfsRoot;
        private readonly ILoggingService _log;

        public LinuxSysfsDescriptorReader(ILoggingService log) : this(DefaultSysfsRoot, log)
        {
        }

        public LinuxSysfsDescriptorReader(string sysfsRoot, ILoggingService log)
        {
            _sysfsRoot = sysfsRoot;
            _log = log;
        }

        public bool IsSupported => OperatingSystem.IsLinux();

        public IReadOnlyList<UsbSerialDescriptor> Read(IReadOnlyCollection<string> presentPortNames)
        {
            var ttyClassDir = Path.Combine(_sysfsRoot, "class", "tty");

            if (!Directory.Exists(ttyClassDir))
            {
                return [];
            }

            var rootFullPath = Path.GetFullPath(_sysfsRoot);
            var results = new List<UsbSerialDescriptor>();

            foreach (var ttyPath in Directory.EnumerateFileSystemEntries(ttyClassDir))
            {
                var ttyName = Path.GetFileName(ttyPath);

                if (!TtyPrefixes.Any(prefix => ttyName.StartsWith(prefix, StringComparison.Ordinal)))
                {
                    continue;
                }

                var deviceDir = ResolveDeviceDirectory(ttyPath);

                if (deviceDir is null)
                {
                    _log.Internal($"LinuxSysfsDescriptorReader: '{ttyName}' has no 'device' entry, skipping.");
                    continue;
                }

                var usbDeviceDir = FindUsbDeviceDirectory(deviceDir, rootFullPath);

                if (usbDeviceDir is null)
                {
                    _log.Internal($"LinuxSysfsDescriptorReader: '{ttyName}' has no ancestor under '{rootFullPath}' with idVendor/idProduct/serial, skipping.");
                    continue;
                }

                var vid = ReadHex(Path.Combine(usbDeviceDir, "idVendor"));
                var pid = ReadHex(Path.Combine(usbDeviceDir, "idProduct"));
                var serial = ReadText(Path.Combine(usbDeviceDir, "serial"));

                if (vid is null || pid is null || serial is null)
                {
                    continue;
                }

                results.Add(new UsbSerialDescriptor($"/dev/{ttyName}", vid, pid, serial));
            }

            return results;
        }

        private static string? ResolveDeviceDirectory(string ttyPath)
        {
            var deviceEntry = Path.Combine(ttyPath, "device");

            if (!Directory.Exists(deviceEntry))
            {
                return null;
            }

            var linkTarget = Directory.ResolveLinkTarget(deviceEntry, returnFinalTarget: true);
            return linkTarget?.FullName ?? deviceEntry;
        }

        /// <summary>Walks up from <paramref name="startDir"/>, bounded by <paramref name="rootFullPath"/>, for the first directory holding all three descriptor files.</summary>
        private static string? FindUsbDeviceDirectory(string startDir, string rootFullPath)
        {
            var current = new DirectoryInfo(startDir);

            while (current is not null && current.FullName.StartsWith(rootFullPath, StringComparison.Ordinal))
            {
                if (File.Exists(Path.Combine(current.FullName, "idVendor")) &&
                    File.Exists(Path.Combine(current.FullName, "idProduct")) &&
                    File.Exists(Path.Combine(current.FullName, "serial")))
                {
                    return current.FullName;
                }

                current = current.Parent;
            }

            return null;
        }

        private static ushort? ReadHex(string path)
        {
            if (!File.Exists(path))
            {
                return null;
            }

            var text = File.ReadAllText(path).Trim();
            return ushort.TryParse(text, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value) ? value : null;
        }

        private static string? ReadText(string path) =>
            File.Exists(path) ? File.ReadAllText(path).Trim() : null;
    }
}
