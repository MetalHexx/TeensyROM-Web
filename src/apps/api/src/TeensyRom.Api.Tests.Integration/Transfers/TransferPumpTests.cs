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
    public class TransferPumpTests(TransferFixture f)
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(50);

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

            await WaitUntilAsync(() => job.State == TransferJobState.Completed);

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

                await WaitUntilAsync(() => job.State == TransferJobState.Completed);

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

                await WaitUntilAsync(() => job.State == TransferJobState.Cancelled, TimeSpan.FromSeconds(15));

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                gate.Current.Should().Be((0, 0));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        private async Task EnqueueFileAsync(TransferJob job, string deviceId, string relativePath, FilePath targetPath, byte[] bytes)
        {
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();
            var staging = f.Services.GetRequiredService<ITransferStagingStore>();
            var queue = f.Services.GetRequiredService<ITransferQueue>();

            await gate.WaitForSlotAsync(bytes.Length, CancellationToken.None);

            string stagingPath;
            using (var stream = new MemoryStream(bytes))
            {
                stagingPath = await staging.StageAsync(job.JobId, stream, CancellationToken.None);
            }

            job.OnFileReceived(bytes.Length);

            var staged = new StagedFile(job.JobId, stagingPath, relativePath, targetPath, job.StorageType, bytes.Length, bytes.Length);

            await queue.EnqueueAsync(deviceId, staged, CancellationToken.None);
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
