using System.Collections.Concurrent;
using TeensyRom.Api.Services;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Integration.Common
{
    public sealed record RecordedLaunch(string DeviceId, TeensyStorageType StorageType, string Path, string? LeaseHolderAtCall);

    /// <summary>
    /// Stands in for <see cref="IFileLaunchService"/> in <see cref="TransferFixture"/>: the fake
    /// communication port has no launch handshake, so a real launch would hold the device's port lock
    /// and stall later tests. Records each call, along with who held the device lease at that instant.
    /// </summary>
    public sealed class RecordingFileLaunchService(IDeviceLeaseCoordinator leases) : IFileLaunchService
    {
        private readonly ConcurrentQueue<RecordedLaunch> _calls = new();

        public IReadOnlyList<RecordedLaunch> Calls => _calls.ToArray();

        public FileLaunchStatus Status { get; set; } = FileLaunchStatus.Launched;

        public Task<FileLaunchOutcome> LaunchAsync(string deviceId, TeensyStorageType storageType, FilePath path, CancellationToken ct)
        {
            _calls.Enqueue(new RecordedLaunch(deviceId, storageType, path.Value, leases.GetHolder(deviceId)));

            return Task.FromResult(new FileLaunchOutcome(Status, null, Status.ToString()));
        }
    }
}
