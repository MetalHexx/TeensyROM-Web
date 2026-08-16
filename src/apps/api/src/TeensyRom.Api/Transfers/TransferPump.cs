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
        ITransferScratchStore scratch,
        ITransferAdmission admission,
        IDeviceConnectionManager deviceManager,
        IServiceScopeFactory scopeFactory,
        ITransferProgressNotifier notifier,
        TransferOptions options,
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
                        _ = _workers.GetOrAdd(deviceId, id => StartDrainWorker(id, stoppingToken));
                    }

                    await Task.Delay(SupervisorPollInterval, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        /// <summary>
        /// Runs <see cref="DrainDeviceAsync"/> to completion on one dedicated OS thread for this
        /// device's entire lifetime - not just its synchronous prologue. A bare
        /// <c>Task.Factory.StartNew(..., TaskCreationOptions.LongRunning, TaskScheduler.Default)</c>
        /// only pins the delegate up to its first genuine <c>await</c>; every continuation after that
        /// resolves <see cref="TaskScheduler.Current"/> back to <see cref="TaskScheduler.Default"/> -
        /// the ordinary ThreadPool - because that is what the task itself was scheduled on, so an
        /// inherently async loop like this one would spend almost all of its real work back on the
        /// pool it exists to stay off of. Installing a single-threaded <see cref="SynchronizationContext"/>
        /// on a raw <see cref="Thread"/> before starting the loop, and pumping that context's queued
        /// continuations on the same thread until the loop finishes, keeps every iteration - including
        /// the async ack path's own network awaits - on the dedicated thread for good.
        /// </summary>
        private Task StartDrainWorker(string deviceId, CancellationToken ct)
        {
            var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var thread = new Thread(() =>
            {
                var syncContext = new SingleThreadSynchronizationContext();
                SynchronizationContext.SetSynchronizationContext(syncContext);

                try
                {
                    var drainTask = DrainDeviceAsync(deviceId, ct);
                    drainTask.ContinueWith(_ => syncContext.Complete(), TaskScheduler.Default);

                    syncContext.RunOnCurrentThread();

                    drainTask.GetAwaiter().GetResult();
                    completion.SetResult();
                }
                catch (Exception ex)
                {
                    completion.SetException(ex);
                }
            })
            {
                IsBackground = true,
                Name = $"TransferPump-{deviceId}"
            };

            thread.Start();

            return completion.Task;
        }

        private async Task DrainDeviceAsync(string deviceId, CancellationToken ct)
        {
            var resetJobIds = new HashSet<string>();

            try
            {
                await foreach (var first in queue.ReadAllAsync(deviceId, ct))
                {
                    var batch = new List<StagedFile> { first };

                    // The first item already paid a blocking wait above; take whatever else is
                    // immediately available, up to the ceiling, without waiting for more of it.
                    while (batch.Count < options.BatchSize && queue.TryRead(deviceId, out var more))
                    {
                        batch.Add(more);
                    }

                    try
                    {
                        await ProcessBatchAsync(batch, resetJobIds, ct);
                    }
                    catch (Exception ex)
                    {
                        log.InternalError($"TransferPump: unhandled error processing staged file for job '{first.JobId}': {ex.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        /// <summary>
        /// Admits each staged file in order - dropping or aborting exactly as the pump did per file
        /// before batching existed - then sends every admitted file through one
        /// <see cref="TransferFilesCommand"/> whose per-file callback still does the four things that
        /// must stay per file: gate release, staging delete, cache upsert, and job counters.
        /// <paramref name="resetJobIds"/> is shared across every batch this worker ever processes, so a
        /// job's device reset still fires once, before its first file, never per batch.
        /// </summary>
        private async Task ProcessBatchAsync(List<StagedFile> batch, HashSet<string> resetJobIds, CancellationToken ct)
        {
            var admitted = new List<(StagedFile Staged, TransferJob Job, TeensyRomDevice Device)>();
            var touchedJobs = new HashSet<TransferJob>();

            foreach (var staged in batch)
            {
                var job = registry.Get(staged.JobId);

                if (job is null || job.State is TransferJobState.Cancelling || TransferJob.IsTerminal(job.State))
                {
                    staging.DeleteStagedFile(staged.StagingPath);
                    gate.ReleaseSlot(staged.ReservedBytes);
                    job?.OnFileDropped();

                    if (job is not null)
                    {
                        touchedJobs.Add(job);
                    }

                    continue;
                }

                var device = deviceManager.GetAvailableDevice(job.DeviceId);

                if (device is null)
                {
                    AbortPendingFile(job, staged, "Device is no longer available");
                    touchedJobs.Add(job);
                    continue;
                }

                if (resetJobIds.Add(job.JobId))
                {
                    await ResetDeviceAsync(job, device, ct);
                }

                touchedJobs.Add(job);
                admitted.Add((staged, job, device));
            }

            try
            {
                if (admitted.Count > 0)
                {
                    await SendBatchAsync(admitted, ct);
                }
            }
            finally
            {
                // Runs even if SendBatchAsync let a composition exception propagate for the caller's
                // log-only catch - a job must still reach its terminal state once every one of its
                // files in this batch has been accounted for, exception or not.
                foreach (var job in touchedJobs)
                {
                    TryFinalize(job);
                }
            }
        }

        /// <summary>
        /// Composes and sends every admitted file as one command. The invariant that replaces the old
        /// per-file <c>finally</c>: whatever the per-file callback below has not already released and
        /// deleted by the time this returns - a batch that threw while composing, or a result the
        /// pipeline rejected before the handler ever ran - is swept here exactly once, driven by the
        /// admitted set rather than by what the result happens to report.
        /// </summary>
        private async Task SendBatchAsync(List<(StagedFile Staged, TransferJob Job, TeensyRomDevice Device)> admitted, CancellationToken ct)
        {
            // Seeded with every admitted file before composing even starts, so a file whose
            // StreamedFileTransfer.FromFile throws - never reaching the callback at all - is still
            // covered by the finally sweep below, exactly like every other file that never gets a
            // result.
            var pending = admitted.ToDictionary(entry => entry.Staged, entry => entry);

            try
            {
                var transfers = new List<StreamedFileTransfer>(admitted.Count);
                var stagedByTransfer = new Dictionary<StreamedFileTransfer, StagedFile>();

                foreach (var entry in admitted)
                {
                    var transfer = StreamedFileTransfer.FromFile(entry.Staged.StagingPath, entry.Staged.TargetPath, entry.Staged.TargetStorage);
                    transfers.Add(transfer);
                    stagedByTransfer[transfer] = entry.Staged;
                }

                using var scope = scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                var firstEntry = admitted[0];

                try
                {
                    var result = await mediator.Send(new TransferFilesCommand
                    {
                        Files = transfers,
                        DeviceId = firstEntry.Job.DeviceId,
                        CommunicationPort = firstEntry.Device.CommunicationPort,
                        OnFileCompleted = (outcome, _) => HandleOutcome(outcome, stagedByTransfer, pending),
                        ShouldSkip = transfer => IsJobInactive(stagedByTransfer, pending, transfer)
                    }, ct);

                    // A pipeline behavior (e.g. CommunicationPortBehavior refusing a busy/minimal-FW
                    // device) can produce IsSuccess=false without ever invoking the handler, so no
                    // OnFileCompleted callback ran for any file. Anything still pending at this point
                    // failed for the reason the pipeline reported, not because it was dropped.
                    if (!result.IsSuccess)
                    {
                        foreach (var entry in pending.Values.ToArray())
                        {
                            pending.Remove(entry.Staged);
                            AbortPendingFile(entry.Job, entry.Staged, $"Device write failed: {result.Error}");
                        }
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    foreach (var entry in pending.Values.ToArray())
                    {
                        pending.Remove(entry.Staged);
                        AbortPendingFile(entry.Job, entry.Staged, $"Device write failed: {ex.Message}");
                    }
                }
            }
            finally
            {
                foreach (var entry in pending.Values)
                {
                    DropPendingFile(entry.Job, entry.Staged);
                }
            }
        }

        /// <summary>
        /// Rechecked by the handler before every file's handshake, including files whose job was still
        /// active when this batch was composed - the seam that lets a cancel or abort landing mid-batch
        /// stop a job's remaining files within one file rather than waiting for the whole batch to drain.
        /// </summary>
        private static bool IsJobInactive(
            Dictionary<StreamedFileTransfer, StagedFile> stagedByTransfer,
            Dictionary<StagedFile, (StagedFile Staged, TransferJob Job, TeensyRomDevice Device)> pending,
            StreamedFileTransfer transfer)
        {
            var job = pending[stagedByTransfer[transfer]].Job;
            return job.State is TransferJobState.Cancelling || TransferJob.IsTerminal(job.State);
        }

        /// <summary>
        /// The per-file callback <see cref="TransferFilesCommand.OnFileCompleted"/> invokes once per
        /// file, in send order - the seam that keeps backpressure, staging cleanup, cache freshness, and
        /// progress at per-file granularity while the MediatR handshake covers the whole batch.
        /// </summary>
        private Task HandleOutcome(
            TransferFileOutcome outcome,
            Dictionary<StreamedFileTransfer, StagedFile> stagedByTransfer,
            Dictionary<StagedFile, (StagedFile Staged, TransferJob Job, TeensyRomDevice Device)> pending)
        {
            var staged = stagedByTransfer[outcome.File];
            var (_, job, device) = pending[staged];
            pending.Remove(staged);

            if (!outcome.Attempted)
            {
                if (outcome.DeviceLost)
                {
                    // The handler skips every file after the one that discovered the device was gone -
                    // never attempted, so it is dropped rather than counted as a failure.
                    AbortPendingFile(job, staged, "Device is no longer available");
                }
                else
                {
                    // IsJobInactive said skip this one - the job itself, not the device, so only this
                    // file is dropped; the batch still carries on for any other job's files.
                    DropPendingFile(job, staged);
                }

                return Task.CompletedTask;
            }

            job.SetCurrentFile(staged.RelativePath);

            if (outcome.Saved)
            {
                var completed = new TransferFileCompleted(job.JobId, staged.RelativePath, staged.TargetPath.Value, true, null, staged.SizeBytes);
                job.OnFileSent(completed);
                device.GetStorage(job.StorageType)?.UpsertTransferredFile(staged.TargetPath, staged.SizeBytes);
            }
            else
            {
                var completed = new TransferFileCompleted(job.JobId, staged.RelativePath, staged.TargetPath.Value, false, outcome.Error, staged.SizeBytes);
                job.OnFileFailed(completed);
            }

            job.SetCurrentFile(null);
            staging.DeleteStagedFile(staged.StagingPath);
            gate.ReleaseSlot(staged.ReservedBytes);

            notifier.JobChanged(job);
            return Task.CompletedTask;
        }

        /// <summary>
        /// Aborts <paramref name="job"/> the first time it is seen and always releases and deletes this
        /// one file. Every later call for the same job (another file of a batch that lost the same
        /// device) takes the already-aborted branch instead, since <see cref="AbortJob"/> only accounts
        /// for the one file that triggers it and must not run its lease/notify side effects twice.
        /// </summary>
        private void AbortPendingFile(TransferJob job, StagedFile staged, string reason)
        {
            if (job.State is not TransferJobState.Aborted)
            {
                AbortJob(job, reason);
            }
            else
            {
                job.OnFileDropped();
            }

            staging.DeleteStagedFile(staged.StagingPath);
            gate.ReleaseSlot(staged.ReservedBytes);
        }

        /// <summary>
        /// A file that never reached the per-file callback and does not need the job aborted - just
        /// released, deleted, and counted as dropped rather than sent or failed.
        /// </summary>
        private void DropPendingFile(TransferJob job, StagedFile staged)
        {
            staging.DeleteStagedFile(staged.StagingPath);
            gate.ReleaseSlot(staged.ReservedBytes);
            job.OnFileDropped();
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
            scratch.PurgeJob(job.JobId);
            deviceManager.GetAvailableDevice(job.DeviceId)?.GetStorage(job.StorageType)?.PersistCache();
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
            scratch.PurgeJob(job.JobId);

            if (nextState == TransferJobState.Cancelled)
            {
                // A held file still occupies its capacity-gate reservation until admission enqueues or
                // discards it - draining it here, not just relying on expansion to release it later,
                // keeps a cancelled job's reservation from outliving the job itself.
                admission.DiscardHeld(job.JobId);
            }

            deviceManager.GetAvailableDevice(job.DeviceId)?.GetStorage(job.StorageType)?.PersistCache();
            notifier.JobChanged(job);
        }

        /// <summary>
        /// Posts every async continuation back onto the single dedicated thread that installed it, via
        /// a blocking queue that thread's own message loop drains - the mechanism
        /// <see cref="StartDrainWorker"/> relies on to keep a drain loop's continuations pinned to one
        /// OS thread instead of resuming on <see cref="TaskScheduler.Default"/> after the loop's first
        /// await.
        /// </summary>
        private sealed class SingleThreadSynchronizationContext : SynchronizationContext
        {
            private readonly BlockingCollection<(SendOrPostCallback Callback, object? State)> _queue = new();

            public override void Post(SendOrPostCallback d, object? state) => _queue.Add((d, state));

            public override void Send(SendOrPostCallback d, object? state) =>
                throw new NotSupportedException($"{nameof(SingleThreadSynchronizationContext)} does not support synchronous Send.");

            public void RunOnCurrentThread()
            {
                foreach (var (callback, state) in _queue.GetConsumingEnumerable())
                {
                    callback(state);
                }
            }

            public void Complete() => _queue.CompleteAdding();
        }
    }
}
