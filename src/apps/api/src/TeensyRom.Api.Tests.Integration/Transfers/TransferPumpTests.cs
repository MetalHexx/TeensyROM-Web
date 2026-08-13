using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Tests.Integration.Common;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Drives <see cref="TransferPump"/> and <see cref="TransferJobSweeper"/> as they actually run - as
    /// hosted services inside the test host - by enqueuing staged files the same way the eventual upload
    /// endpoint will, since that endpoint does not exist yet (P03). No hardware attached; the fake
    /// devices from <see cref="TransferFixture"/> stand in for it.
    /// </summary>
    [Collection("Transfer")]
    public class TransferPumpTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(50);

        public Task InitializeAsync() => Task.CompletedTask;

        /// <summary>
        /// Cancel/Seal return before the pump's background drain finishes releasing the gate/lease -
        /// wait for that drain here so the next test in this shared collection starts from a clean
        /// fixture.
        /// </summary>
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        [Fact]
        public async Task Pump_EnqueuedFile_IsWrittenToDeviceBeforeJobIsSealed()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            var targetPath = new FilePath("/games/pump-single.prg");
            await EnqueueFileAsync(job, device.DeviceId, "pump-single.prg", targetPath, [1, 2, 3, 4, 5]);

            await WaitUntilAsync(() => port.Received.Any(r => r.Path == targetPath.Value));

            // The file already landed on the device even though the job has not been sealed yet.
            job.State.Should().Be(TransferJobState.Receiving);

            job.TryTransitionTo(TransferJobState.Sealed);

            // Mirrors the not-yet-built upload-completion endpoint (P03), which - like the cancel
            // endpoint - calls TryFinalize immediately after sealing rather than leaving an
            // already-drained queue for a worker that will never wake again.
            pump.TryFinalize(job);

            // TransferJob's state flips to Completed a couple of statements before TransferPump releases
            // the lease/gate - waiting on the state alone would let this poll return in that gap, so the
            // condition covers every side effect the assertions below re-check.
            await WaitUntilAsync(() =>
                job.State == TransferJobState.Completed &&
                leaseCoordinator.GetHolder(device.DeviceId) is null &&
                gate.Current == (0, 0));

            job.ToSnapshot().FilesSent.Should().Be(1);
            leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            gate.Current.Should().Be((0, 0));
        }

        [Fact]
        public async Task Pump_FailingFile_RecordsFailureAndLeavesJobRunning()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            var failingTarget = new FilePath("/games/fail.prg");
            var okTarget = new FilePath("/games/ok.prg");

            // "File already exists" short-circuits SaveFileCommandHandler's retry loop without the
            // exponential backoff sleep a generic IOException would trigger, keeping this test fast.
            port.FailFor = path => path == failingTarget.Value ? new IOException("File already exists") : null;

            try
            {
                await EnqueueFileAsync(job, device.DeviceId, "fail.prg", failingTarget, [1, 2, 3]);
                await EnqueueFileAsync(job, device.DeviceId, "ok.prg", okTarget, [4, 5, 6, 7]);

                job.TryTransitionTo(TransferJobState.Sealed);
                pump.TryFinalize(job);

                // See Pump_EnqueuedFile_IsWrittenToDeviceBeforeJobIsSealed - the state transition is
                // visible before the lease/gate release that follows it, so the wait covers both.
                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Completed &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0));

                var snapshot = job.ToSnapshot();
                snapshot.FilesFailed.Should().Be(1);
                snapshot.FilesSent.Should().Be(1);
                snapshot.Failures.Should().ContainSingle(fx => fx.RelativePath == "fail.prg");

                port.Received.Should().ContainSingle(r => r.Path == okTarget.Value);
                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
            }
            finally
            {
                port.FailFor = null;
            }
        }

        [Fact]
        public async Task Pump_CancelWithBacklog_JobReachesCancelledAndReleasesDevice()
        {
            var device = f.DeviceManager.Devices[1];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            // Slows the device write just enough that both files are still pending when Cancelling is
            // set below, proving the job actually has a backlog to drain rather than an empty queue.
            port.PerFileDelay = TimeSpan.FromMilliseconds(300);

            try
            {
                await EnqueueFileAsync(job, device.DeviceId, "cancel-1.prg", new FilePath("/games/cancel-1.prg"), [1, 2, 3]);
                await EnqueueFileAsync(job, device.DeviceId, "cancel-2.prg", new FilePath("/games/cancel-2.prg"), [4, 5, 6]);

                job.PendingCount.Should().Be(2);

                job.TryTransitionTo(TransferJobState.Cancelling).Should().BeTrue();

                // Mirrors the cancel endpoint (P03-T01): finalize immediately in case the queue is
                // already empty by the time cancellation is requested.
                pump.TryFinalize(job);

                // See Pump_EnqueuedFile_IsWrittenToDeviceBeforeJobIsSealed - the state transition is
                // visible before the lease/gate release that follows it, so the wait covers both.
                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Cancelled &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0),
                    TimeSpan.FromSeconds(15));

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        [Fact]
        public async Task Pump_LostDevice_JobIsAbortedAndReleasesLease()
        {
            var device = f.DeviceManager.Devices[0];
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            // Simulates the device vanishing between the upload endpoint admitting the file and the
            // pump's worker picking it up: GetAvailableDevice(device.DeviceId) starts returning null, the
            // same as if the device disconnected. This is the only route into AbortJob a test can drive -
            // ExceptionBehavior in the MediatR pipeline converts every communication failure into an
            // ordinary failed SaveFileResult before it can reach the pump as an exception.
            f.DeviceManager.SimulateDeviceLoss(device.DeviceId);

            try
            {
                await EnqueueFileAsync(job, device.DeviceId, "lost.prg", new FilePath("/games/lost.prg"), [1, 2, 3]);

                // AbortJob flips the job to Aborted before the lease/gate release that follows it in
                // ProcessStagedFileAsync, so the wait covers both instead of racing that gap.
                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Aborted &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0));

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
            }
            finally
            {
                f.DeviceManager.RestoreDevice(device.DeviceId);
            }
        }

        [Fact]
        public async Task Pump_TwoDevices_SlowDeviceDoesNotBlockFastDevice()
        {
            var slowDevice = f.DeviceManager.Devices[0];
            var fastDevice = f.DeviceManager.Devices[1];
            var slowPort = f.DeviceManager.PortFor(slowDevice.DeviceId);
            var fastPort = f.DeviceManager.PortFor(fastDevice.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var slowJob = registry.Create(slowDevice.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(slowDevice.DeviceId, slowJob.JobId).Should().BeTrue();
            slowJob.TryTransitionTo(TransferJobState.Receiving);

            var fastJob = registry.Create(fastDevice.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(fastDevice.DeviceId, fastJob.JobId).Should().BeTrue();
            fastJob.TryTransitionTo(TransferJobState.Receiving);

            var slowTarget = new FilePath("/games/slow.prg");
            var fastTarget = new FilePath("/games/fast.prg");

            // Slows only the first device's writes. If the pump serialized both devices through one
            // worker, the fast device's file would sit behind this delay too.
            slowPort.PerFileDelay = TimeSpan.FromSeconds(1);

            try
            {
                await EnqueueFileAsync(slowJob, slowDevice.DeviceId, "slow.prg", slowTarget, [1, 2, 3]);
                await EnqueueFileAsync(fastJob, fastDevice.DeviceId, "fast.prg", fastTarget, [4, 5, 6]);

                await WaitUntilAsync(() => fastPort.Received.Any(r => r.Path == fastTarget.Value));

                // The fast device's file landed while the slow device's write was still in flight -
                // proof the two per-device workers ran concurrently rather than one blocking the other.
                // (Not asserting slowPort.Received is empty: the port is shared with other tests in this
                // collection and may already carry unrelated entries from earlier in the run.)
                slowPort.Received.Should().NotContain(r => r.Path == slowTarget.Value);

                fastJob.TryTransitionTo(TransferJobState.Sealed);
                pump.TryFinalize(fastJob);
                await WaitUntilAsync(() => fastJob.State == TransferJobState.Completed);

                await WaitUntilAsync(() => slowPort.Received.Any(r => r.Path == slowTarget.Value));
                slowJob.TryTransitionTo(TransferJobState.Sealed);
                pump.TryFinalize(slowJob);
                await WaitUntilAsync(() => slowJob.State == TransferJobState.Completed);
            }
            finally
            {
                slowPort.PerFileDelay = TimeSpan.Zero;
            }
        }

        [Fact]
        public async Task Pump_BacklogLargerThanOne_GateAndStagingReleasePerFileNotPerBatch()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var queue = f.Services.GetRequiredService<ITransferQueue>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            const int fileCount = 4;

            // Slows only the write phase, so the batch below takes long enough for the poll loop to
            // observe the gate fall between files instead of jumping straight from fileCount to 0 - the
            // regression this whole batching design exists to prevent.
            port.PerFileDelay = TimeSpan.FromMilliseconds(150);

            try
            {
                // Stage everything up front, then enqueue in a tight loop with no other awaits in
                // between, so every file is already sitting in the channel by the time the pump's
                // worker wakes up and drains them as one batch rather than trickling in across several.
                var stagedFiles = new List<StagedFile>();

                for (var i = 0; i < fileCount; i++)
                {
                    stagedFiles.Add(await StageFileAsync(job, $"batch-{i}.prg", new FilePath($"/games/batch-{i}.prg"), [1, 2, 3]));
                }

                foreach (var staged in stagedFiles)
                {
                    await queue.EnqueueAsync(device.DeviceId, staged, CancellationToken.None);
                }

                var observedFileCounts = new HashSet<int>();
                var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(10);

                while (job.ToSnapshot().FilesSent < fileCount)
                {
                    observedFileCounts.Add(gate.Current.Files);

                    if (DateTime.UtcNow > deadline)
                    {
                        throw new TimeoutException("Batch did not fully drain within the poll timeout.");
                    }

                    await Task.Delay(TimeSpan.FromMilliseconds(15));
                }

                // The gate fell in steps, not from fileCount straight to 0 - proof the per-file release
                // inside the batch callback still fires per file rather than once for the whole batch.
                observedFileCounts.Should().Contain(count => count > 0 && count < fileCount);

                await WaitUntilAsync(() => gate.Current == (0, 0));

                // The device received every file, in the same order the batch composed them.
                var receivedInOrder = port.Received
                    .Select(r => r.Path)
                    .Where(path => path.StartsWith("/games/batch-", StringComparison.Ordinal))
                    .ToList();

                receivedInOrder.Should().Equal(Enumerable.Range(0, fileCount).Select(i => $"/games/batch-{i}.prg"));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;

                job.TryTransitionTo(TransferJobState.Sealed);
                pump.TryFinalize(job);
                await WaitUntilAsync(() => job.State == TransferJobState.Completed);
            }
        }

        [Fact]
        public async Task Pump_JobCancelledBeforeDrain_BatchedFilesAreDroppedNotSent()
        {
            var device = f.DeviceManager.Devices[1];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var queue = f.Services.GetRequiredService<ITransferQueue>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            var firstTarget = new FilePath("/games/cancelled-before-drain-1.prg");
            var secondTarget = new FilePath("/games/cancelled-before-drain-2.prg");

            // Stage both fully before either is enqueued or the job is cancelled: dropping the first
            // file alone would let TryFinalize purge the job's whole staging directory out from under
            // the second file while it is still mid-stage, once both are pending. Cancelling before
            // enqueueing mirrors files the upload endpoint already accepted moments before a concurrent
            // cancel request landed, so the admission check inside the batch (evaluated per file, as
            // each is taken off the queue) is guaranteed to see Cancelling for both.
            var firstStaged = await StageFileAsync(job, "cancelled-before-drain-1.prg", firstTarget, [1, 2, 3]);
            var secondStaged = await StageFileAsync(job, "cancelled-before-drain-2.prg", secondTarget, [4, 5, 6]);

            job.TryTransitionTo(TransferJobState.Cancelling).Should().BeTrue();

            await queue.EnqueueAsync(device.DeviceId, firstStaged, CancellationToken.None);
            await queue.EnqueueAsync(device.DeviceId, secondStaged, CancellationToken.None);

            pump.TryFinalize(job);

            await WaitUntilAsync(() =>
                job.State == TransferJobState.Cancelled &&
                leaseCoordinator.GetHolder(device.DeviceId) is null &&
                gate.Current == (0, 0));

            port.Received.Should().NotContain(r => r.Path == firstTarget.Value || r.Path == secondTarget.Value);
            leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            gate.Current.Should().Be((0, 0));
        }

        [Fact]
        public async Task Pump_JobCancelledMidBatch_StopsWithinOneFileInsteadOfFinishingWholeBatch()
        {
            var device = f.DeviceManager.Devices[1];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var queue = f.Services.GetRequiredService<ITransferQueue>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            const int fileCount = 5;
            const string pathPrefix = "/games/cancel-mid-batch-";

            // Slow enough that the batch's single TransferFilesCommand is still working through the
            // backlog when the cancel below lands, but short enough the test stays fast.
            port.PerFileDelay = TimeSpan.FromMilliseconds(200);

            try
            {
                // Stage everything up front, then enqueue in a tight loop with no other awaits, so every
                // file is already queued by the time the pump's worker wakes - one TransferFilesCommand
                // for the whole backlog, exactly the condition batching exists to help with.
                var stagedFiles = new List<StagedFile>();

                for (var i = 0; i < fileCount; i++)
                {
                    stagedFiles.Add(await StageFileAsync(job, $"cancel-mid-batch-{i}.prg", new FilePath($"{pathPrefix}{i}.prg"), [1, 2, 3]));
                }

                foreach (var staged in stagedFiles)
                {
                    await queue.EnqueueAsync(device.DeviceId, staged, CancellationToken.None);
                }

                // Cancel as soon as the first file of the batch has landed - the batch's single
                // TransferFilesCommand is still in flight for the remaining four.
                await WaitUntilAsync(() => port.Received.Any(r => r.Path == $"{pathPrefix}0.prg"));
                job.TryTransitionTo(TransferJobState.Cancelling).Should().BeTrue();

                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Cancelled &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0),
                    TimeSpan.FromSeconds(15));

                var landed = port.Received.Count(r => r.Path.StartsWith(pathPrefix, StringComparison.Ordinal));

                // Cancellation must interrupt the batch within one file, not let the whole in-flight
                // batch finish - if the pump only stopped composing further batches, every one of the
                // fileCount files already admitted into this one would still land.
                landed.Should().BeLessThan(fileCount);

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        [Fact]
        public async Task Pump_LostDeviceMidBatch_AbortsJobAndReleasesEveryAdmittedFile()
        {
            var device = f.DeviceManager.Devices[0];
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var queue = f.Services.GetRequiredService<ITransferQueue>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            // Same mechanism as Pump_LostDevice_JobIsAbortedAndReleasesLease, but with more than one
            // file already staged so the admission check has to drop every one of them, not just the
            // one that happens to trigger the abort.
            f.DeviceManager.SimulateDeviceLoss(device.DeviceId);

            try
            {
                // Stage both fully before either is enqueued: aborting on the first file alone would
                // purge the job's whole staging directory out from under the second file while it is
                // still mid-stage.
                var firstStaged = await StageFileAsync(job, "lost-1.prg", new FilePath("/games/lost-1.prg"), [1, 2, 3]);
                var secondStaged = await StageFileAsync(job, "lost-2.prg", new FilePath("/games/lost-2.prg"), [4, 5, 6]);

                await queue.EnqueueAsync(device.DeviceId, firstStaged, CancellationToken.None);
                await queue.EnqueueAsync(device.DeviceId, secondStaged, CancellationToken.None);

                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Aborted &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0));

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
                job.ToSnapshot().FilesSent.Should().Be(0);
            }
            finally
            {
                f.DeviceManager.RestoreDevice(device.DeviceId);
            }
        }

        [Fact]
        public async Task Pump_StagedFileMissingWhenBatchIsComposed_ReleasesGateWithoutSendingIt()
        {
            var device = f.DeviceManager.Devices[0];
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var staging = f.Services.GetRequiredService<ITransferStagingStore>();
            var queue = f.Services.GetRequiredService<ITransferQueue>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            byte[] missingBytes = [1, 2, 3];
            await gate.WaitForSlotAsync(missingBytes.Length, CancellationToken.None);

            string stagingPath;
            using (var stream = new MemoryStream(missingBytes))
            {
                stagingPath = await staging.StageAsync(job.JobId, stream, CancellationToken.None);
            }

            job.OnFileReceived(missingBytes.Length);

            // Deleted before the pump ever gets a chance to drain it - deterministically reproduces
            // StreamedFileTransfer.FromFile throwing FileNotFoundException while composing the batch,
            // before mediator.Send is ever reached, rather than racing the pump's worker for it.
            File.Delete(stagingPath);

            var missingStaged = new StagedFile(
                job.JobId, stagingPath, "missing.prg", new FilePath("/games/missing.prg"), job.StorageType,
                missingBytes.Length, missingBytes.Length);

            await queue.EnqueueAsync(device.DeviceId, missingStaged, CancellationToken.None);

            job.TryTransitionTo(TransferJobState.Sealed);
            pump.TryFinalize(job);

            await WaitUntilAsync(() =>
                job.State == TransferJobState.Completed &&
                leaseCoordinator.GetHolder(device.DeviceId) is null &&
                gate.Current == (0, 0));

            leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            gate.Current.Should().Be((0, 0));
        }

        [Fact]
        public async Task Pump_PipelineRejectsBatchBeforeHandlerRuns_AbortsJobWithReportedErrorInsteadOfSilentlyDropping()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var job = registry.Create(device.DeviceId, TeensyStorageType.SD, new DirectoryPath("/games"));
            leaseCoordinator.TryAcquire(device.DeviceId, job.JobId).Should().BeTrue();
            job.TryTransitionTo(TransferJobState.Receiving);

            var firstTarget = new FilePath("/games/rejected-1.prg");
            var secondTarget = new FilePath("/games/rejected-2.prg");

            // CommunicationPortBehavior's firmware pre-check throws as soon as it touches the port;
            // MediatR's ExceptionBehavior converts that into a normal TransferFilesResult with
            // IsSuccess = false and an empty Outcomes list rather than letting the exception escape
            // mediator.Send - the second escape path the exactly-once cleanup invariant has to cover,
            // since no file is ever reported through the per-file callback at all. SendBatchAsync must
            // notice IsSuccess = false and abort every still-pending file with the reported error,
            // the same way the sibling catch-block does for a composition exception - otherwise these
            // two files would vanish with the job reporting Completed and no failure at all.
            port.SimulateDeviceLoss = true;

            try
            {
                await EnqueueFileAsync(job, device.DeviceId, "rejected-1.prg", firstTarget, [1, 2, 3]);
                await EnqueueFileAsync(job, device.DeviceId, "rejected-2.prg", secondTarget, [4, 5, 6]);

                job.TryTransitionTo(TransferJobState.Sealed);
                pump.TryFinalize(job);

                await WaitUntilAsync(() =>
                    job.State == TransferJobState.Aborted &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    gate.Current == (0, 0));

                port.Received.Should().NotContain(r => r.Path == firstTarget.Value || r.Path == secondTarget.Value);
                gate.Current.Should().Be((0, 0));
                job.ToSnapshot().Error.Should().NotBeNullOrEmpty();
            }
            finally
            {
                port.SimulateDeviceLoss = false;
            }
        }

        private async Task EnqueueFileAsync(TransferJob job, string deviceId, string relativePath, FilePath targetPath, byte[] bytes)
        {
            var queue = f.Services.GetRequiredService<ITransferQueue>();
            var staged = await StageFileAsync(job, relativePath, targetPath, bytes);

            await queue.EnqueueAsync(deviceId, staged, CancellationToken.None);
        }

        /// <summary>
        /// Reserves gate capacity and writes a file to the staging store without enqueueing it - the
        /// half of <see cref="EnqueueFileAsync"/> a caller needs when multiple files for the same job
        /// must all finish staging before any of them is enqueued, so a batch that drops or aborts on
        /// the first one cannot purge the job's staging directory out from under one still being
        /// written.
        /// </summary>
        private async Task<StagedFile> StageFileAsync(TransferJob job, string relativePath, FilePath targetPath, byte[] bytes)
        {
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var staging = f.Services.GetRequiredService<ITransferStagingStore>();

            await gate.WaitForSlotAsync(bytes.Length, CancellationToken.None);

            string stagingPath;
            using (var stream = new MemoryStream(bytes))
            {
                stagingPath = await staging.StageAsync(job.JobId, stream, CancellationToken.None);
            }

            job.OnFileReceived(bytes.Length);

            return new StagedFile(job.JobId, stagingPath, relativePath, targetPath, job.StorageType, bytes.Length, bytes.Length);
        }

        private static async Task WaitUntilAsync(Func<bool> condition, TimeSpan? timeout = null)
        {
            var deadline = DateTime.UtcNow + (timeout ?? PollTimeout);

            while (!condition())
            {
                if (DateTime.UtcNow > deadline)
                {
                    throw new TimeoutException("Condition was not met within the poll timeout.");
                }

                await Task.Delay(PollInterval);
            }
        }
    }
}
