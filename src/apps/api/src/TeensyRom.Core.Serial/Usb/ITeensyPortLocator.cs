namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>A discovered TeensyROM serial port, classified by firmware image and keyed by chip id.</summary>
    public sealed record TeensyRomPort(string PortName, string ChipId, TeensyRomImage Image);

    /// <summary>The full port listing plus whether the descriptor filter itself could be trusted this call.</summary>
    public sealed record PortLocatorResult(IReadOnlyList<TeensyRomPort> Ports, bool FilterAvailable, string? UnavailableReason);

    /// <summary>
    /// A single chip-id lookup result. <see cref="Port"/> null with <see cref="FilterAvailable"/> true means
    /// "not present right now"; <see cref="FilterAvailable"/> false means "cannot tell" - callers branch on
    /// the flag, so it is never collapsed into a bare null.
    /// </summary>
    public sealed record PortLookup(TeensyRomPort? Port, bool FilterAvailable, string? UnavailableReason);

    /// <summary>
    /// Lists the serial ports that belong to a TeensyROM - by USB vendor/product - so discovery can skip
    /// foreign ports and recovery can find a device's new port by chip id instead of opening every port.
    /// </summary>
    public interface ITeensyPortLocator
    {
        /// <summary>Never throws.</summary>
        PortLocatorResult ListPorts();

        /// <summary>
        /// Convenience over <see cref="ListPorts"/>: the first port whose chip id matches, plus the same
        /// availability flag - callers branch on the flag, so it is never collapsed into a bare null.
        /// </summary>
        PortLookup FindByChipId(string chipId);
    }
}
