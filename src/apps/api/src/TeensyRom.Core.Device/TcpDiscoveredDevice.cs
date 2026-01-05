using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Device;

/// <summary>
/// Represents a TeensyROM device discovered during TCP network scanning.
/// This is a lightweight DTO for discovered devices, optionally including the open port.
/// </summary>
public class TcpDiscoveredDevice
{
    /// <summary>
    /// Gets the IP address of the discovered device.
    /// </summary>
    public string IpAddress { get; init; } = string.Empty;

    /// <summary>
    /// Gets the TCP port of the discovered device (default: 80).
    /// </summary>
    public int Port { get; init; } = 80;

    /// <summary>
    /// Gets the response received from the device during discovery.
    /// </summary>
    public string? Response { get; init; }

    /// <summary>
    /// Gets the timestamp when this device was discovered.
    /// </summary>
    public DateTime DiscoveredAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Gets the endpoint string in "ip:port" format.
    /// </summary>
    public string Endpoint => $"{IpAddress}:{Port}";

    /// <summary>
    /// Gets the open communication port for this discovered device.
    /// This port is already connected and validated - ready for use.
    /// </summary>
    public ICommunicationPort? CommunicationPort { get; init; }
}
