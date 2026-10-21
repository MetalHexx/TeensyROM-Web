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

        private static string Describe(ConnectionType transport) =>
            transport == ConnectionType.Tcp ? "network connection" : "USB connection";
    }
}
