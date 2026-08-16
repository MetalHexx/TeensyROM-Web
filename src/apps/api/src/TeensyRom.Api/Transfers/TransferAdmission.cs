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

        // Keyed by job id. Guards the read-HasExpansionOutstanding-then-hold decision in AdmitAsync against
        // the read-then-drain-then-remove sequence in ReleaseHeldAsync/DiscardHeld, so the two can never
        // interleave into a state where a file is enqueued into _held after the one drain that would have
        // caught it has already run - see ReleaseHeldAsync for the shape of the race this closes.
        private readonly ConcurrentDictionary<string, object> _locks = new();

        private object LockFor(string jobId) => _locks.GetOrAdd(jobId, _ => new object());

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

                // Reading HasExpansionOutstanding and (if true) enqueuing into _held must be one atomic
                // step under the same per-job lock ReleaseHeldAsync/DiscardHeld use for their own
                // check-then-drain: split across the lock boundary, a drain that runs between the read and
                // the enqueue would observe an empty or already-removed queue, and this file would never be
                // picked up again.
                bool held;

                lock (LockFor(job.JobId))
                {
                    held = job.HasExpansionOutstanding;

                    if (held)
                    {
                        _held.GetOrAdd(job.JobId, _ => new ConcurrentQueue<StagedFile>()).Enqueue(staged);
                    }
                }

                if (!held)
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
            var deviceId = registry.Get(jobId)?.DeviceId;

            // Loops rather than draining once: the queue is never removed from _held until a check made
            // under the lock observes it empty, so a file AdmitAsync enqueues into the very same queue
            // instance while a drain is already in flight (see AdmitAsync) is still the live target and
            // gets picked up by the drain already running, or by the next iteration's drain otherwise -
            // never stranded in a queue nobody will ever look at again.
            while (true)
            {
                ConcurrentQueue<StagedFile>? heldQueue;

                lock (LockFor(jobId))
                {
                    if (!_held.TryGetValue(jobId, out heldQueue) || heldQueue.IsEmpty)
                    {
                        _held.TryRemove(jobId, out _);
                        return;
                    }
                }

                if (deviceId is null)
                {
                    lock (LockFor(jobId))
                    {
                        _held.TryRemove(jobId, out _);
                    }

                    return;
                }

                await DrainAsync(heldQueue, deviceId, ct);
            }
        }

        public void DiscardHeld(string jobId)
        {
            ConcurrentQueue<StagedFile>? heldQueue;

            lock (LockFor(jobId))
            {
                _held.TryRemove(jobId, out heldQueue);
            }

            if (heldQueue is null)
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
