using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>How long recovery waits for a device to answer on one transport, at each firmware image.</summary>
    public sealed class TransportCeilings
    {
        public int ToMinimalMs { get; set; }

        /// <summary>The Teensy's restart into the full image. Over TCP, leaving minimal also gets <see cref="ConnectionOptions.MenuBootTimeoutMs"/> on top, since the full image answers there only once the C64 menu has booted.</summary>
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

        public const int DefaultMenuBootTimeoutMs = 30_000;

        /// <summary>
        /// How long a reset may take to bring the C64 menu back: its boot-time SID token, then its
        /// "Boot: complete". A ceiling, not a delay - every wait ends the moment the menu reports in
        /// (~1 s normally). The TR's own settings can hold the menu up for many seconds and they add up:
        /// the NFC reader's setup runs before the menu starts (up to 20 retries); the network time sync
        /// blocks for 5 s of DNS plus 2.5 s of NTP with no internet (bench: 8.5 s of silence); DHCP with
        /// the cable out blocks 15 s + 4 s by default and is user-configurable. Tunable
        /// ("Connection:MenuBootTimeoutMs") for setups slower than that. Over TCP it is also part of the wait
        /// to leave minimal firmware (added to <see cref="TransportCeilings.ToFullMs"/>), where the menu boots
        /// before the device answers at all.
        /// </summary>
        public int MenuBootTimeoutMs { get; set; } = DefaultMenuBootTimeoutMs;

        /// <summary>
        /// The transport a device is driven over when discovery confirms it on both USB serial and TCP.
        /// TCP by default; the other endpoint stays on the device's record either way. A cached start
        /// reconfirms the transport it cached, so a change takes effect at the next full discovery.
        /// </summary>
        public ConnectionType PreferredTransport { get; set; } = ConnectionType.Tcp;
    }
}
