using TeensyRom.Core.Commands;

namespace TeensyRom.Core.Serial.Commands.LaunchAsidPlayer
{
    public class LaunchAsidPlayerResult : TeensyCommandResult
    {
        /// <summary>The device moved from the network onto its USB serial port for this launch.</summary>
        public bool MovedToSerial { get; set; }

        /// <summary>Set only when a network device could not be confirmed over serial.</summary>
        public bool UsbUnreachable { get; set; }
    }
}
