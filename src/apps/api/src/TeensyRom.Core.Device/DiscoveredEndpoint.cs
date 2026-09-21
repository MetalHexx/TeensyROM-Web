using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Device;

/// <summary>
/// A device endpoint discovered during scanning: the version probe that validated it as a TeensyROM,
/// plus the open communication port - positioned after the reply - ready for the finder to use.
/// A discovery strategy returns an endpoint only when <see cref="VersionReply.IsTeensyRom"/> is true.
/// </summary>
/// <param name="ConnectionType">The transport type (Serial or TCP).</param>
/// <param name="Address">The address - COM port name for Serial, IP address for TCP.</param>
/// <param name="Port">The port number - null for Serial, port number (e.g., 2112) for TCP.</param>
/// <param name="Version">The parsed version reply that validated this endpoint.</param>
/// <param name="CommunicationPort">The open communication port, positioned after the version reply.</param>
public record DiscoveredEndpoint(
    ConnectionType ConnectionType,
    string Address,
    int? Port,
    VersionReply Version,
    ICommunicationPort CommunicationPort
)
{
    /// <summary>
    /// Gets a human-readable display string for this endpoint.
    /// Examples: "COM3" or "192.168.1.42:2112"
    /// </summary>
    public string Display => Port.HasValue ? $"{Address}:{Port.Value}" : Address;
}
