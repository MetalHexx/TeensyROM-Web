using Microsoft.Extensions.Hosting;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Runs every <see cref="TransferOptions.SweepInterval"/> and closes the gaps the pump cannot: a
    /// job whose client vanished before sealing (Abandoned), a job sealed or cancelled with an already-
    /// empty queue that no worker will ever wake for (the <see cref="TransferPump.TryFinalize"/>
    /// backstop), and terminal jobs old enough to evict.
    /// </summary>
    public sealed class TransferJobSweeper(
        ITransferJobRegistry registry,
        IDeviceLeaseCoordinator leaseCoordinator,
        ITransferStagingStore staging,
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

                case TransferJobState.Sealed or TransferJobState.Cancelling:
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
            deviceManager.GetAvailableDevice(job.DeviceId)?.GetStorage(job.StorageType)?.PersistCache();
            notifier.JobChanged(job);
        }
    }
}
