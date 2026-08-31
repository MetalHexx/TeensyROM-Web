using Microsoft.Extensions.Hosting;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Runs every <see cref="TransferOptions.SweepInterval"/> and closes the gaps the pump cannot: a
    /// job whose client vanished before sealing (Abandoned), a job sealed with an already-empty queue
    /// that no worker will ever wake for (the <see cref="TransferPump.TryFinalize"/> backstop), and
    /// terminal jobs old enough to evict.
    /// </summary>
    public sealed class TransferJobSweeper(
        ITransferJobRegistry registry,
        IDeviceLeaseCoordinator leaseCoordinator,
        ITransferStagingStore staging,
        ITransferScratchStore scratch,
        ITransferAdmission admission,
        ITransferSubscriptionTracker tracker,
        IDeviceConnectionManager deviceManager,
        ITransferProgressNotifier notifier,
        TransferOptions options,
        TransferPump pump,
        ILoggingService log) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(options.SweepInterval);

            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    Sweep();
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        /// <summary>A single sweep pass over every registered job. Public so it can be driven directly by tests without waiting on the timer.</summary>
        public void Sweep()
        {
            foreach (var job in registry.All())
            {
                try
                {
                    SweepJob(job);
                }
                catch (Exception ex)
                {
                    log.InternalError($"TransferJobSweeper: failed to sweep job '{job.JobId}': {ex.Message}");
                }
            }
        }

        /// <summary>
        /// A job mid-expansion is never abandoned below, but not because this method checks for it - the
        /// <c>PendingCount == 0</c> guard on the Created/Receiving branch already excludes it, because an
        /// accepted archive's own pending slot (taken by <see cref="TransferJob.OnFileReceived"/> when it
        /// was uploaded) is not released until <see cref="TransferJob.ReleaseFinishedArchiveSlots"/> runs,
        /// which the walk only calls after every entry every finished archive produced has been admitted.
        /// That is a consequence of the upload/expansion handoff, not something designed into this sweep -
        /// so if that release ordering ever changes, a mid-expansion job would start being abandoned out
        /// from under its own expansion, silently, the next time this runs.
        /// </summary>
        private void SweepJob(TransferJob job)
        {
            switch (job.State)
            {
                case TransferJobState.Created or TransferJobState.Receiving:
                    if (job.PendingCount == 0 &&
                        DateTime.UtcNow - job.LastActivityUtc > options.IdleAbandonmentThreshold &&
                        !tracker.HasSubscribers(job.JobId))
                    {
                        AbandonJob(job);
                    }
                    break;

                case TransferJobState.Sealed:
                    pump.TryFinalize(job);
                    break;

                default:
                    if (TransferJob.IsTerminal(job.State) &&
                        DateTime.UtcNow - job.LastActivityUtc > options.TerminalJobRetention)
                    {
                        registry.Remove(job.JobId);
                    }
                    break;
            }
        }

        private void AbandonJob(TransferJob job)
        {
            if (!job.TryTransitionTo(TransferJobState.Abandoned))
            {
                return;
            }

            leaseCoordinator.Release(job.DeviceId, job.JobId);
            staging.PurgeJob(job.JobId);
            scratch.PurgeJob(job.JobId);
            admission.DiscardHeld(job.JobId);
            deviceManager.GetAvailableDevice(job.DeviceId)?.GetStorage(job.StorageType)?.PersistCache();
            notifier.JobChanged(job);
        }
    }
}
