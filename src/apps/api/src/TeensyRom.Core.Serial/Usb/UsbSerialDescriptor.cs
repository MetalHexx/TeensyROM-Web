namespace TeensyRom.Core.Serial.Usb
{
    /// <summary>
    /// A serial port's raw USB descriptor fields as read from a platform's native source. <see cref="Vid"/>
    /// and <see cref="Pid"/> are null when the platform cannot supply them (macOS).
    /// </summary>
    public sealed record UsbSerialDescriptor(string PortName, ushort? Vid, ushort? Pid, string SerialNumber);
}
