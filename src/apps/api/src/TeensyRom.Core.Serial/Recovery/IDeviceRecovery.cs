using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// Reacquires a device after any transport drop: reacquires the remembered endpoint in place, polls
    /// the version command until it answers or the reason's ceiling passes, and updates the device's
    /// connection record and storage presence. See <see cref="DeviceRecovery"/> for the algorithm.
    /// </summary>
    public interface IDeviceRecovery
    {
        Task<RecoveryOutcome> RecoverAsync(TeensyRomDevice device, RecoveryReason reason, CancellationToken ct);
    }
}
