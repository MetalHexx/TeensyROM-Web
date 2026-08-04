namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Enforces one active transfer job per device. Deliberately independent of
    /// <c>CommunicationPortBehavior</c>'s per-command port lock — see <see cref="DeviceLeaseCoordinator"/>.
    /// </summary>
    public interface IDeviceLeaseCoordinator
    {
        bool TryAcquire(string deviceId, string jobId);
        void Release(string deviceId, string jobId);
        string? GetHolder(string deviceId);
    }
}
