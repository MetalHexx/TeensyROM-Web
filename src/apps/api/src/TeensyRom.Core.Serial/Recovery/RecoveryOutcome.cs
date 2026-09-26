using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// The result of a recovery attempt: the mode the device ended up confirmed in (or
    /// <see cref="DeviceMode.Unreachable"/>), how long it took against how long it was allowed, and -
    /// when the device answered but never reached the expected mode, or came back full without the C64
    /// menu announcing itself - why the caller should treat this as a failure even though the device is
    /// reachable.
    /// </summary>
    public sealed record RecoveryOutcome(DeviceMode Mode, TimeSpan Elapsed, TimeSpan Ceiling, string? Failure)
    {
        public bool Reachable => Mode is not DeviceMode.Unreachable;
    }
}
