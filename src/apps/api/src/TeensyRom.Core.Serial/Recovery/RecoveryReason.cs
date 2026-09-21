namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// Why recovery is being asked to reacquire a device - which mode it should expect (see
    /// <see cref="DeviceRecovery"/>'s expectation map) and how long it may take.
    /// </summary>
    public enum RecoveryReason
    {
        /// <summary>A large cartridge was launched; the device reboots into minimal to receive it. Ceiling = ToMinimal.</summary>
        LargeLaunch,

        /// <summary>The device is leaving minimal back to full idle. Ceiling = ToFull.</summary>
        LeaveMinimal,

        /// <summary>
        /// A launch was sent to a device already in minimal; the chain's end depends on the file, so no
        /// single mode is expected - see <see cref="DeviceRecovery"/>'s chained rule.
        /// Ceiling = ToFull + ToMinimal + LaunchSettleMs.
        /// </summary>
        ChainedLaunch,

        /// <summary>An unexplained transport drop; either mode counts as success. Ceiling = max(ToMinimal, ToFull).</summary>
        Drop
    }
}
