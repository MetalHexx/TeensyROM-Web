using System.Collections.Concurrent;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Drains every device's staged-file queue as fast as the device allows, one worker per device so a
    /// slow device never stalls another. Also the only place a job's per-file counters, storage cache,
    /// and terminal-state transition are applied - see <see cref="TryFinalize"/>.
    /// </summary>
    public sealed class TransferPump(
        ITransferQueue queue,
        ITransferJobRegistry registry,
        IDeviceLeaseCoordinator leaseCoordinator,
        ITransferCapacityGate gate,
        ITransferStagingStore staging,
        IDeviceConnectionManager deviceManager,
        IServiceScopeFactory scopeFactory,
        ITransferProgressNotifier notifier,
        ILoggingService log) : BackgroundService
    {
        private static readonly TimeSpan SupervisorPollInterval = TimeSpan.FromMilliseconds(200);

        private readonly ConcurrentDictionary<string, Task> _workers = new();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    foreach (var deviceId in queue.ActiveDeviceIds)
                    {
                        _ = _workers.GetOrAdd(deviceId, id => Task.Run(() => DrainDeviceAsync(id, stoppingToken), stoppingToken));
                    }

                    await Task.Delay(SupervisorPollInterval, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task DrainDeviceAsync(string deviceId, CancellationToken ct)
        {
            var resetJobIds = new HashSet<string>();

            try
            {
                await foreach (var staged in queue.ReadAllAsync(deviceId, ct))
                {
                    try
                    {
                        await ProcessStagedFileAsync(staged, resetJobIds, ct);
                    }
                    catch (Exception ex)
                    {
                        log.InternalError($"TransferPump: unhandled error processing staged file for job '{staged.JobId}': {ex.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task ProcessStagedFileAsync(StagedFile staged, HashSet<string> resetJobIds, CancellationToken ct)
        {
            var job = registry.Get(staged.JobId);

            if (job is null || job.State is TransferJobState.Cancelling || TransferJob.IsTerminal(job.State))
            {
                staging.DeleteStagedFile(staged.StagingPath);
                gate.ReleaseSlot(staged.ReservedBytes);
                job?.OnFileDropped();

                if (job is not null)
                {
                    TryFinalize(job);
                }

                return;
            }

            var device = deviceManager.GetAvailableDevice(job.DeviceId);

            if (device is null)
            {
                AbortJob(job, "Device is no longer available");
                staging.DeleteStagedFile(staged.StagingPath);
                gate.ReleaseSlot(staged.ReservedBytes);
                return;
            }

            if (resetJobIds.Add(job.JobId))
            {
                await ResetDeviceAsync(job, device, ct);
            }

            job.SetCurrentFile(staged.RelativePath);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                var transfer = StreamedFileTransfer.FromFile(staged.StagingPath, staged.TargetPath, staged.TargetStorage);

                SaveFileResult result;

                try
                {
                    result = await mediator.Send(new SaveFileCommand
                    {
                        File = transfer,
                        DeviceId = job.DeviceId,
                        CommunicationPort = device.CommunicationPort
                    }, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    AbortJob(job, $"Device write failed: {ex.Message}");
                    return;
                }

                TransferFileCompleted completed;

                if (result.IsSuccess)
                {
                    job.OnFileSent(staged.SizeBytes);
                    device.GetStorage(job.StorageType)?.UpsertTransferredFile(staged.TargetPath, staged.SizeBytes);
                    completed = new TransferFileCompleted(job.JobId, staged.RelativePath, staged.TargetPath.Value, true, null, staged.SizeBytes);
                }
                else
                {
                    completed = new TransferFileCompleted(job.JobId, staged.RelativePath, staged.TargetPath.Value, false, result.Error, staged.SizeBytes);
                    job.OnFileFailed(completed);
                }

                notifier.JobChanged(job);
                await notifier.FileCompletedAsync(completed);
            }
            finally
            {
                job.SetCurrentFile(null);
                staging.DeleteStagedFile(staged.StagingPath);
                gate.ReleaseSlot(staged.ReservedBytes);
            }

            TryFinalize(job);
        }

        private async Task ResetDeviceAsync(TransferJob job, TeensyRomDevice device, CancellationToken ct)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

                await mediator.Send(new ResetCommand
                {
                    DeviceId = job.DeviceId,
                    CommunicationPort = device.CommunicationPort
                }, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.InternalWarning($"TransferPump: reset command failed for device '{job.DeviceId}': {ex.Message}");
            }
        }

        /// <summary>
        /// A device that vanished mid-write or mid-resolution. Terminal immediately - no pending-count
        /// gating, unlike the Sealed/Cancelling transitions <see cref="TryFinalize"/> owns.
        /// </summary>
        private void AbortJob(TransferJob job, string reason)
        {
            job.Abort(reason);
            leaseCoordinator.Release(job.DeviceId, job.JobId);
            staging.PurgeJob(job.JobId);
            job.OnFileDropped();
            notifier.JobChanged(job);
        }

        /// <summary>
        /// The single place a job reaches a terminal state from the pump or the sweeper: Sealed
        /// transitions to Completed and Cancelling transitions to Cancelled, both only once
        /// <see cref="TransferJob.PendingCount"/> reaches zero. Idempotent and safe to call
        /// concurrently - <see cref="TransferJob.TryTransitionTo"/> guards the actual transition, and the
        /// release/purge/persist/notify side effects only run for the caller that wins it.
        /// </summary>
        public void TryFinalize(TransferJob job)
        {
            TransferJobState? nextState = job.State switch
            {
                TransferJobState.Sealed when job.PendingCount == 0 => TransferJobState.Completed,
                TransferJobState.Cancelling when job.PendingCount == 0 => TransferJobState.Cancelled,
                _ => null
            };

            if (nextState is null || !job.TryTransitionTo(nextState.Value))
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
