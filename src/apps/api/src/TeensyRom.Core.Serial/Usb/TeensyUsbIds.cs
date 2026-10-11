namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// USB vendor/product ids and serial-number conventions the two TeensyROM firmware images enumerate under.
    /// </summary>
    public static class TeensyUsbIds
    {
        public const ushort Vendor = 0x16C0;

        /// <summary>usb=serialmidi image; serial string is "TeensyROM-Serial-&lt;chipId&gt;".</summary>
        public const ushort ProductFull = 0x0489;

        /// <summary>usb=serial image; serial string is the bare chip digits.</summary>
        public const ushort ProductMinimal = 0x0483;

        /// <summary>Compare case-insensitively: Windows stores it upper-cased.</summary>
        public const string FullSerialPrefix = "TeensyROM-Serial-";
    }

    /// <summary>Which TeensyROM firmware image a discovered port is running.</summary>
    public enum TeensyRomImage
    {
        Full,
        Minimal,
        Unknown
    }
}
