using System.Collections.Concurrent;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Implements <see cref="ITransferAdmission"/>. The body is the sequence the upload endpoint used to
    /// run inline, lifted out so an extracted archive entry can walk the exact same reservation, staging,
    /// and enqueue arithmetic an uploaded file does.
    /// </summary>
    public sealed class TransferAdmission(
        ITransferCapacityGate gate,
        ITransferStagingStore staging,
        ITransferQueue queue,
        ITransferProgressNotifier notifier,
        ITransferJobRegistry registry) : ITransferAdmission
    {
        // Keyed by job id. A file parked here still holds its capacity-gate reservation - draining it
        // promptly in ReleaseHeldAsync is what keeps a large drop from starving every other upload.
        private readonly ConcurrentDictionary<string, ConcurrentQueue<StagedFile>> _held = new();

        public async Task<AdmissionResult> AdmitAsync(
            TransferJob job,
            Stream content,
            string relativePath,
            long sizeHintBytes,
            bool countAsReceived,
            CancellationToken ct)
        {
            if (!TransferPathResolver.TryResolve(job.Destination, relativePath, out FilePath target, out var error))
            {
                return new AdmissionResult(null, error);
            }

            await gate.WaitForSlotAsync(sizeHintBytes, ct);

            string? stagingPath = null;
            var effective = sizeHintBytes;

            try
            {
                stagingPath = await staging.StageAsync(job.JobId, content, ct);
                var actualBytes = new FileInfo(stagingPath).Length;
                effective = gate.Adjust(sizeHintBytes, actualBytes);

                if (countAsReceived)
                {
                    job.OnFileReceived(actualBytes);
                }
                else
                {
                    job.OnEntryExpanded();
                }

                var staged = new StagedFile(job.JobId, stagingPath, relativePath, target, job.StorageType, actualBytes, effective);

                // Consulted once, under the same decision that enqueues - see ReleaseHeldAsync for the
                // race this leaves between "expansion just finished" and "a file is being admitted".
                if (job.HasExpansionOutstanding)
                {
                    _held.GetOrAdd(job.JobId, _ => new ConcurrentQueue<StagedFile>()).Enqueue(staged);
                }
                else
                {
                    await queue.EnqueueAsync(job.DeviceId, staged, ct);
                }

                notifier.JobChanged(job);

                if (job.State == TransferJobState.Created)
                {
                    job.TryTransitionTo(TransferJobState.Receiving);
                }

                return new AdmissionResult(staged, null);
            }
            catch
            {
                // A slot leaked here is permanent and eventually deadlocks every upload for the process
                // lifetime - releasing exactly `effective` (never the raw reservation once Adjust ran)
                // keeps the byte counter from drifting.
                gate.ReleaseSlot(effective);

                if (stagingPath is not null)
                {
                    staging.DeleteStagedFile(stagingPath);
                }

                throw;
            }
        }

        public async Task ReleaseHeldAsync(string jobId, CancellationToken ct)
        {
            if (!_held.TryGetValue(jobId, out var heldQueue))
            {
                return;
            }

            var deviceId = registry.Get(jobId)?.DeviceId;

            if (deviceId is null)
            {
                _held.TryRemove(jobId, out _);
                return;
            }

            await DrainAsync(heldQueue, deviceId, ct);

            _held.TryRemove(jobId, out _);

            // Re-drain the same queue instance after the key is gone: a file parked by a concurrent
            // AdmitAsync between the drain above and this removal targeted this exact object, and would
            // otherwise be stranded - the job would simply never complete.
            await DrainAsync(heldQueue, deviceId, ct);
        }

        public void DiscardHeld(string jobId)
        {
            if (!_held.TryRemove(jobId, out var heldQueue))
            {
                return;
            }

            var job = registry.Get(jobId);

            while (heldQueue.TryDequeue(out var staged))
            {
                staging.DeleteStagedFile(staged.StagingPath);
                gate.ReleaseSlot(staged.ReservedBytes);
                job?.OnFileDropped();
            }
        }

        private async Task DrainAsync(ConcurrentQueue<StagedFile> heldQueue, string deviceId, CancellationToken ct)
        {
            while (heldQueue.TryDequeue(out var staged))
            {
                await queue.EnqueueAsync(deviceId, staged, ct);
            }
        }
    }
}
