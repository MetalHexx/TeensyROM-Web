using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Entities.Device
{
    /// <summary>
    /// The device's last-known reachability state, as established by the connection record.
    /// </summary>
    public enum DeviceMode
    {
        FullIdle,
        FullBusy,
        Minimal,
        Unreachable
    }

    /// <summary>
    /// How the API reaches a device: the endpoint known for each transport, the transport currently
    /// in use, the last-known mode, and when it was last confirmed. Survives across any single port,
    /// so this outlives an individual COM port or TCP socket.
    /// </summary>
    public sealed class DeviceConnectionRecord
    {
        /// <summary>
        /// Keys the record. Stand-in ids (e.g. "Unknown", "Unknown-2") are allowed here but are never
        /// written to the connection record cache.
        /// </summary>
        public string ChipId { get; }

        /// <summary>e.g. "COM12"; null when never seen on serial.</summary>
        public string? SerialPortName { get; private set; }

        /// <summary>e.g. "192.168.1.37:2112"; null when never seen on TCP.</summary>
        public string? TcpEndpoint { get; private set; }

        /// <summary>Null when unreachable or never connected.</summary>
        public ConnectionType? TransportInUse { get; private set; }

        public DeviceMode Mode { get; private set; } = DeviceMode.Unreachable;

        public DateTime? LastConfirmedUtc { get; private set; }

        public DeviceConnectionRecord(string chipId)
        {
            ChipId = chipId;
        }

        /// <summary>
        /// A version reply with the expected chip ID arrived on this transport at this endpoint.
        /// </summary>
        public void Confirm(ConnectionType transport, string endpoint, DeviceMode mode)
        {
            if (mode is DeviceMode.Unreachable or DeviceMode.FullBusy)
            {
                throw new ArgumentException($"Cannot confirm a device as {mode}; busy and unreachable are marked, never confirmed.", nameof(mode));
            }

            if (transport == ConnectionType.Serial)
            {
                SerialPortName = endpoint;
            }
            else
            {
                TcpEndpoint = endpoint;
            }

            TransportInUse = transport;
            Mode = mode;
            LastConfirmedUtc = DateTime.UtcNow;
        }

        public void MarkBusy() => Mode = DeviceMode.FullBusy;

        /// <summary>After a busy device is reset or a command succeeds.</summary>
        public void MarkIdle() => Mode = DeviceMode.FullIdle;

        /// <summary>
        /// Endpoints and <see cref="LastConfirmedUtc"/> are kept so a later retry has something to try
        /// first; only reachability and the in-use transport are cleared.
        /// </summary>
        public void MarkUnreachable()
        {
            Mode = DeviceMode.Unreachable;
            TransportInUse = null;
        }

        public string? EndpointFor(ConnectionType transport) => transport == ConnectionType.Serial ? SerialPortName : TcpEndpoint;
    }
}
