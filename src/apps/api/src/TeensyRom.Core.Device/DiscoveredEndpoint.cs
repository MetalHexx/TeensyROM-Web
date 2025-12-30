using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device;

/// <summary>
/// Represents a device endpoint discovered during scanning.
/// This is a lightweight record used for discovery - not yet validated as a TeensyROM device.
/// </summary>
/// <param name="ConnectionType">The transport type (Serial or TCP).</param>
/// <param name="Address">The address - COM port name for Serial, IP address for TCP.</param>
/// <param name="Port">The port number - null for Serial, port number (e.g., 80) for TCP.</param>
public record DiscoveredEndpoint(
    ConnectionType ConnectionType,
    string Address,
    int? Port
)
{
    /// <summary>
    /// Gets a human-readable display string for this endpoint.
    /// Examples: "COM3" or "192.168.1.42:80"
    /// </summary>
    public string Display => Port.HasValue ? $"{Address}:{Port.Value}" : Address;
}
