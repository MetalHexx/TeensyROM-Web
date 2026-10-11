namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// Reads USB serial descriptors from one platform's native source. Pure over an injected source so
    /// every implementation is unit-testable without touching the OS.
    /// </summary>
    public interface IUsbSerialDescriptorReader
    {
        /// <summary>True when this reader's platform is the one currently running.</summary>
        bool IsSupported { get; }

        /// <summary>
        /// Reads descriptors for ports that are PRESENT right now. <paramref name="presentPortNames"/> is
        /// the cross-check a reader needs only when its native source can retain entries for devices that
        /// are no longer attached (e.g. the Windows registry); a reader whose enumeration is itself
        /// present-only by construction (sysfs tty nodes, macOS device nodes) may ignore it. May throw;
        /// <see cref="ITeensyPortLocator"/> catches.
        /// </summary>
        IReadOnlyList<UsbSerialDescriptor> Read(IReadOnlyCollection<string> presentPortNames);
    }
}
