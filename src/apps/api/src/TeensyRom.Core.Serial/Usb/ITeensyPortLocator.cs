namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>A discovered TeensyROM serial port, classified by firmware image and keyed by chip id.</summary>
    public sealed record TeensyRomPort(string PortName, string ChipId, TeensyRomImage Image);

    /// <summary>The full port listing plus whether the descriptor filter itself could be trusted this call.</summary>
    public sealed record PortLocatorResult(IReadOnlyList<TeensyRomPort> Ports, bool FilterAvailable, string? UnavailableReason);

    /// <summary>
    /// A chip-id lookup result. <see cref="Candidates"/> empty with <see cref="FilterAvailable"/> true means
    /// "not present right now"; <see cref="FilterAvailable"/> false means "cannot tell" - callers branch on
    /// the flag, so it is never collapsed into a bare empty list. The locator does not rank candidates -
    /// they are in the listing's own order - because which image is wanted depends on why the caller is
    /// asking, and the locator has no way to know that; the caller decides by probing.
    /// </summary>
    public sealed record PortLookup(IReadOnlyList<TeensyRomPort> Candidates, bool FilterAvailable, string? UnavailableReason);

    /// <summary>
    /// Lists the serial ports that belong to a TeensyROM - by USB vendor/product - so discovery can skip
    /// foreign ports and recovery can find a device's new port by chip id instead of opening every port.
    /// </summary>
    public interface ITeensyPortLocator
    {
        /// <summary>Never throws.</summary>
        PortLocatorResult ListPorts();

        /// <summary>
        /// Convenience over <see cref="ListPorts"/>: every port whose chip id matches, in the listing's own
        /// order, plus the same availability flag - callers branch on the flag, so it is never collapsed
        /// into a bare empty list.
        /// </summary>
        PortLookup FindByChipId(string chipId);
    }
}
