namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>How long recovery waits for a device to answer on one transport, at each firmware image.</summary>
    public sealed class TransportCeilings
    {
        public int ToMinimalMs { get; set; }
        public int ToFullMs { get; set; }
    }

    /// <summary>
    /// Tunables for reacquiring a device after a transport drop: the poll interval between probes,
    /// per-transport ceilings, and the bounds a launch/start confirm use around a single connect and
    /// version exchange. Bound by the API's <c>ConnectionOptionsBinder</c> from the "Connection"
    /// configuration section.
    /// </summary>
    public sealed class ConnectionOptions
    {
        public int PollIntervalMs { get; set; } = 250;
        public TransportCeilings Tcp { get; set; } = new() { ToMinimalMs = 8_000, ToFullMs = 15_000 };     // bench: 3.6 s / 7.1 s with a static IP
        public TransportCeilings Serial { get; set; } = new() { ToMinimalMs = 15_000, ToFullMs = 15_000 }; // seeded from the 13.7 s serial round trip; tuned in P04-T02
        public int LaunchSettleMs { get; set; } = 2_000;        // how long the launch handler watches for a recognizable reply before confirming with the version command (P02-T03)
        public int ConnectTimeoutMs { get; set; } = 2_000;      // one TCP connect attempt inside recovery / start confirm; the poll loop repeats it until the ceiling
    }
}
