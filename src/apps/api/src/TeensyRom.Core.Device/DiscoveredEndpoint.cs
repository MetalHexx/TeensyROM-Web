using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device;

/// <summary>
/// Represents a device endpoint discovered during scanning.
/// This record can include an open ICommunicationPort for validated devices.
/// </summary>
/// <param name="ConnectionType">The transport type (Serial or TCP).</param>
/// <param name="Address">The address - COM port name for Serial, IP address for TCP.</param>
/// <param name="Port">The port number - null for Serial, port number (e.g., 80) for TCP.</param>
/// <param name="PingResponse">Ping response from the device</param>
/// <param name="CommunicationPort">Optional open communication port for validated devices.</param>
public record DiscoveredEndpoint(
    ConnectionType ConnectionType,
    string Address,
    int? Port,
    string? PingResponse,
    ICommunicationPort? CommunicationPort = null
)
{
    /// <summary>
    /// Gets a human-readable display string for this endpoint.
    /// Examples: "COM3" or "192.168.1.42:80"
    /// </summary>
    public string Display => Port.HasValue ? $"{Address}:{Port.Value}" : Address;

    /// <summary>
    /// Gets whether this endpoint has a validated, open communication port.
    /// </summary>
    public bool HasOpenPort => CommunicationPort is not null && CommunicationPort.IsOpen;
}
