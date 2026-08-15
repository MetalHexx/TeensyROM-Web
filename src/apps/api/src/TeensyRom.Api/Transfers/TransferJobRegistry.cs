using System.Collections.Concurrent;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    public sealed class TransferJobRegistry(TransferOptions options) : ITransferJobRegistry
    {
        private readonly ConcurrentDictionary<string, TransferJob> _jobs = new();

        public TransferJob Create(string deviceId, TeensyStorageType storageType, DirectoryPath destination, int expectedArchiveCount = 0)
        {
            var job = new TransferJob(deviceId, storageType, destination, options, expectedArchiveCount: expectedArchiveCount);
            _jobs[job.JobId] = job;
            return job;
        }

        public TransferJob? Get(string jobId) => _jobs.GetValueOrDefault(jobId);

        public TransferJob? GetActive(string deviceId) =>
            _jobs.Values.FirstOrDefault(job => job.DeviceId == deviceId && !TransferJob.IsTerminal(job.State));

        public IReadOnlyCollection<TransferJob> All() => _jobs.Values.ToArray();

        public void Remove(string jobId) => _jobs.TryRemove(jobId, out _);
    }
}
