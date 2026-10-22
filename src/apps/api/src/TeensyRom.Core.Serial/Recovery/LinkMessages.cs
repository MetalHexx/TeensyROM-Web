using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>The user-facing messages for a failed link, named for the transport actually in use.</summary>
    public static class LinkMessages
    {
        /// <summary>The link dropped mid-command and came back, but the command may have run.</summary>
        public static string OutcomeUnknown(ConnectionType transport) =>
            $"The {Describe(transport)} to the TeensyROM dropped while this command was being sent. The connection is back, but the command may or may not have run.";

        /// <summary>The link dropped and could not be recovered.</summary>
        public static string LinkLost(ConnectionType transport) =>
            $"Lost the {Describe(transport)} to the TeensyROM and could not get it back. Check that it is powered on and connected.";

        /// <summary>The unit's TCP session is stuck and there is no other way to reach it; deliberately says nothing of serial or USB.</summary>
        public const string StuckSession =
            "The TeensyROM's network session is stuck: it accepts a connection but does not answer. Restart the TeensyROM to clear it.";

        /// <summary>The unit's TCP session was stuck and the device was rebuilt on its USB port.</summary>
        public const string FellBackToSerial =
            "The TeensyROM's network session was stuck, so it is now connected over USB instead. Try the command again.";

        private static string Describe(ConnectionType transport) =>
            transport == ConnectionType.Tcp ? "network connection" : "USB connection";
    }
}
