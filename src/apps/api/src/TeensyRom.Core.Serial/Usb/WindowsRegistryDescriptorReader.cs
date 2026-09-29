using System.Runtime.Versioning;
using Microsoft.Win32;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// Reads registry subkeys and values, abstracted so <see cref="WindowsRegistryDescriptorReader"/> is
    /// unit-testable against a captured key/value set instead of the live registry. Paths are relative to
    /// HKEY_LOCAL_MACHINE.
    /// </summary>
    public interface IRegistryView
    {
        string[] SubKeys(string path);
        string? Value(string path, string name);
    }

    /// <inheritdoc cref="IRegistryView"/>
    [SupportedOSPlatform("windows")]
    public sealed class Win32RegistryView : IRegistryView
    {
        public string[] SubKeys(string path)
        {
            using var key = Registry.LocalMachine.OpenSubKey(path);
            return key?.GetSubKeyNames() ?? [];
        }

        public string? Value(string path, string name)
        {
            using var key = Registry.LocalMachine.OpenSubKey(path);
            return key?.GetValue(name) as string;
        }
    }

    /// <summary>
    /// Walks the two-hop Windows USB enumeration tree under HKLM\SYSTEM\CurrentControlSet\Enum\USB. Both
    /// TeensyROM images enumerate as composite devices, so PortName is not on the serial-named key: (1) the
    /// instance key under VID_16C0&amp;PID_0489 or VID_16C0&amp;PID_0483 is named for the serial-number string
    /// and holds ParentIdPrefix; (2) the sibling MI_00 (CDC) interface child
    /// "VID_16C0&amp;PID_&lt;pid&gt;&amp;MI_00\&lt;ParentIdPrefix&gt;&amp;0000\Device Parameters\PortName" holds the COM
    /// name. The registry keeps keys for devices that are unplugged and for identities the units no longer
    /// present, so a row is emitted only when its resolved PortName is in the present-port set the caller
    /// passes; a serial-named key with no ParentIdPrefix or no matching MI_00 child is skipped.
    /// </summary>
    [SupportedOSPlatform("windows")]
    public sealed class WindowsRegistryDescriptorReader : IUsbSerialDescriptorReader
    {
        private const string UsbEnumRoot = @"SYSTEM\CurrentControlSet\Enum\USB";

        private readonly IRegistryView _registry;
        private readonly ILoggingService _log;

        public WindowsRegistryDescriptorReader(ILoggingService log) : this(new Win32RegistryView(), log)
        {
        }

        public WindowsRegistryDescriptorReader(IRegistryView registry, ILoggingService log)
        {
            _registry = registry;
            _log = log;
        }

        public bool IsSupported => OperatingSystem.IsWindows();

        public IReadOnlyList<UsbSerialDescriptor> Read(IReadOnlyCollection<string> presentPortNames)
        {
            var present = new HashSet<string>(presentPortNames, StringComparer.OrdinalIgnoreCase);
            var results = new List<UsbSerialDescriptor>();

            foreach (var pid in new[] { TeensyUsbIds.ProductFull, TeensyUsbIds.ProductMinimal })
            {
                var vidPidPath = $@"{UsbEnumRoot}\VID_{TeensyUsbIds.Vendor:X4}&PID_{pid:X4}";

                foreach (var serialKeyName in _registry.SubKeys(vidPidPath))
                {
                    var instancePath = $@"{vidPidPath}\{serialKeyName}";
                    var parentIdPrefix = _registry.Value(instancePath, "ParentIdPrefix");

                    if (string.IsNullOrEmpty(parentIdPrefix))
                    {
                        _log.Internal($"WindowsRegistryDescriptorReader: '{instancePath}' has no ParentIdPrefix, skipping.");
                        continue;
                    }

                    var deviceParamsPath = $@"{UsbEnumRoot}\VID_{TeensyUsbIds.Vendor:X4}&PID_{pid:X4}&MI_00\{parentIdPrefix}&0000\Device Parameters";
                    var portName = _registry.Value(deviceParamsPath, "PortName");

                    if (string.IsNullOrEmpty(portName))
                    {
                        _log.Internal($"WindowsRegistryDescriptorReader: '{instancePath}' has no matching MI_00 child at '{deviceParamsPath}', skipping.");
                        continue;
                    }

                    if (!present.Contains(portName))
                    {
                        continue;
                    }

                    results.Add(new UsbSerialDescriptor(portName, TeensyUsbIds.Vendor, pid, serialKeyName));
                }
            }

            return results;
        }
    }
}
