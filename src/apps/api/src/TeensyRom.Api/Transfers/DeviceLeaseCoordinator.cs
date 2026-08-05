using System.Collections.Concurrent;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// A plain deviceId-to-jobId map with no timer. <c>CommunicationPortBehavior</c>'s static
    /// per-command port lock disposes any entry idle for 5 minutes, refreshed only on command release —
    /// a job holding that lock across its whole lifetime would have it disposed out from under it by an
    /// unrelated command's cleanup pass. The lease is independent of it on purpose.
    /// </summary>
    public sealed class DeviceLeaseCoordinator : IDeviceLeaseCoordinator
    {
        private readonly ConcurrentDictionary<string, string> _leases = new();

        public bool TryAcquire(string deviceId, string jobId) =>
            _leases.GetOrAdd(deviceId, jobId) == jobId;

        public void Release(string deviceId, string jobId) =>
            _leases.TryRemove(new KeyValuePair<string, string>(deviceId, jobId));

        public string? GetHolder(string deviceId) =>
            _leases.TryGetValue(deviceId, out var jobId) ? jobId : null;
    }
}
