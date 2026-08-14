using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Drives every terminal path a transfer job can take end to end over HTTP, against the fake device
    /// and fake connection manager built in P01-T01 - no hardware, no real serial port.
    /// </summary>
    [Collection("Transfer")]
    public class TransferLifecycleTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

        public Task InitializeAsync() => Task.CompletedTask;

        /// <summary>
        /// Cancel/Seal return before the pump's background drain finishes releasing the gate/lease -
        /// wait for that drain here so the next test in this shared collection starts from a clean
        /// fixture.
        /// </summary>
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        private static CreateJobRequest NewCreateRequest(string deviceId, string destination) => new()
        {
            DeviceId = deviceId,
            StorageType = TeensyStorageType.SD,
            Body = new CreateJobBody { DestinationDirectory = destination }
        };

        private static HttpContent RawBody(byte[] bytes)
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
        }

        private async Task<TransferJobDto> GetJobAsync(string jobId)
        {
            var response = await f.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            return response.Content.Job;
        }

        private async Task CancelAsync(string jobId) =>
            await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });

        // TransferJobSweeper is only registered via AddHostedService<TransferJobSweeper>() - unlike
        // TransferPump, it has no separate self-registration - so it must be located among the host's
        // hosted services rather than resolved directly.
        private TransferJobSweeper GetSweeper() =>
            f.Services.GetServices<IHostedService>().OfType<TransferJobSweeper>().Single();

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

        private static async Task WaitUntilAsync(Func<Task<bool>> condition, TimeSpan? timeout = null)
        {
            var deadline = DateTime.UtcNow + (timeout ?? PollTimeout);

            while (!await condition())
            {
                if (DateTime.UtcNow > deadline)
                {
                    throw new TimeoutException("Condition was not met within the poll timeout.");
                }

                await Task.Delay(PollInterval);
            }
        }

        [Fact]
        public async Task Seal_AfterUploadingFiles_JobReachesCompletedWithEveryFileOnDeviceAndLeaseReleased()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/seal-lifecycle"));
            var jobId = createResponse.Content.JobId;

            var relativePaths = new[] { "a.prg", "b.prg", "c.prg" };

            foreach (var path in relativePaths)
            {
                var response = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path={path}", RawBody([1, 2, 3]));
                response.StatusCode.Should().Be(HttpStatusCode.OK);
            }

            var sealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

            // TransferJob's state flips to Completed a couple of statements before TransferPump releases
            // the lease and purges staging - waiting on the state alone would let this poll return in that
            // gap, so the condition covers every side effect the assertions below re-check.
            await WaitUntilAsync(async () =>
                (await GetJobAsync(jobId)).State == TransferJobState.Completed &&
                leaseCoordinator.GetHolder(device.DeviceId) is null &&
                !Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)));

            var finalSnapshot = await GetJobAsync(jobId);
            finalSnapshot.FilesSent.Should().Be(relativePaths.Length);

            foreach (var path in relativePaths)
            {
                port.Received.Should().ContainSingle(r => r.Path == $"/music/seal-lifecycle/{path}");
            }

            Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)).Should().BeFalse();
            leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();

            // The lease is released - a new job for the same device is accepted.
            var reCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/seal-lifecycle-2"));

            try
            {
                reCreate.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            }
            finally
            {
                await CancelAsync(reCreate.Content.JobId);
            }
        }

        [Fact]
        public async Task Cancel_MidJobWithSlowDevice_InFlightFileCompletesRemainderIsDiscardedStagingEmptyLeaseReleased()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();

            port.PerFileDelay = TimeSpan.FromMilliseconds(300);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/cancel-lifecycle"));
            var jobId = createResponse.Content.JobId;

            try
            {
                for (var i = 0; i < 4; i++)
                {
                    var response = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=cancel-{i}.prg", RawBody([9, 9, 9, 9, 9]));
                    response.StatusCode.Should().Be(HttpStatusCode.OK);
                }

                // The pump composes every already-queued file into one batch and only rechecks
                // cancellation once per file, right before that file's own handshake - so without this
                // wait, cancel can beat the pump to the very first file too, leaving nothing genuinely
                // in flight for this test to prove survives a cancel. Waiting for the first file to
                // actually land guarantees a real in-flight write for the cancel below to race against.
                await WaitUntilAsync(() => port.Received.Any(r => r.Path == "/music/cancel-lifecycle/cancel-0.prg"));

                var cancelResponse = await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });
                cancelResponse.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);

                // TransferJob's state flips to Cancelled a couple of statements before TransferPump
                // releases the lease and purges staging - waiting on the state alone would let this poll
                // return in that gap, so the condition covers every side effect the assertions below
                // re-check.
                await WaitUntilAsync(async () =>
                    (await GetJobAsync(jobId)).State == TransferJobState.Cancelled &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    !Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)),
                    TimeSpan.FromSeconds(15));

                var snapshot = await GetJobAsync(jobId);

                // Cancelling mid-drain always leaves some backlog undelivered - the pump drops queued
                // items for a cancelling job rather than writing them.
                snapshot.FilesSent.Should().BeLessThan(4);

                // Every file the fake actually received arrived whole - a cancel mid-write does not
                // truncate the in-flight file's body.
                port.Received
                    .Where(r => r.Path.StartsWith("/music/cancel-lifecycle/"))
                    .Should().OnlyContain(r => r.Body.Length == r.DeclaredLength);

                Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)).Should().BeFalse();
                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        [Fact]
        public async Task Abandonment_IdleJobWithNoSubscribers_DeliversBacklogThenAbandonsAndReleasesDevice()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var sweeper = GetSweeper();

            var originalThreshold = f.Options.IdleAbandonmentThreshold;
            f.Options.IdleAbandonmentThreshold = TimeSpan.FromMilliseconds(100);
            port.PerFileDelay = TimeSpan.FromMilliseconds(50);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/abandon-lifecycle"));
            var jobId = createResponse.Content.JobId;

            try
            {
                for (var i = 0; i < 3; i++)
                {
                    var response = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=idle-{i}.prg", RawBody([1, 2, 3]));
                    response.StatusCode.Should().Be(HttpStatusCode.OK);
                }

                // The backlog is fully delivered before the job is allowed to go idle - abandonment must
                // only fire once the pump has actually drained the queue, not merely once the client
                // stops calling.
                await WaitUntilAsync(async () => (await GetJobAsync(jobId)).FilesSent == 3);

                // IdleAbandonmentThreshold is wall-clock by design (TransferJobSweeper compares against
                // DateTime.UtcNow with no injectable clock), so there is no observable substitute for
                // waiting past it - only the sweep itself is driven deterministically, via Sweep()
                // rather than the 30-second background timer.
                await Task.Delay(f.Options.IdleAbandonmentThreshold + TimeSpan.FromMilliseconds(75));
                sweeper.Sweep();

                await WaitUntilAsync(async () => (await GetJobAsync(jobId)).State == TransferJobState.Abandoned);

                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
                f.Options.IdleAbandonmentThreshold = originalThreshold;
            }
        }

        [Fact]
        public async Task Abandonment_JobWithActiveHubSubscriber_IsNotAbandonedDuringSameIdleWindow()
        {
            var device = f.DeviceManager.Devices[1];
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var sweeper = GetSweeper();
            var tracker = f.Services.GetRequiredService<ITransferSubscriptionTracker>();

            var originalThreshold = f.Options.IdleAbandonmentThreshold;
            f.Options.IdleAbandonmentThreshold = TimeSpan.FromMilliseconds(100);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/abandon-subscribed"));
            var jobId = createResponse.Content.JobId;

            // Stands in for a client holding a TransferHub subscription: TransferHub.Subscribe does
            // nothing but this - join a SignalR group and call tracker.Add - so driving the tracker
            // directly exercises the exact collaborator the sweeper consults, without the added noise of
            // a real SignalR connection.
            var connectionId = Guid.NewGuid().ToString();
            tracker.Add(connectionId, jobId);

            try
            {
                await Task.Delay(f.Options.IdleAbandonmentThreshold + TimeSpan.FromMilliseconds(75));
                sweeper.Sweep();

                var snapshot = await GetJobAsync(jobId);
                snapshot.State.Should().Be(TransferJobState.Created);

                leaseCoordinator.GetHolder(device.DeviceId).Should().Be(jobId);
            }
            finally
            {
                tracker.Remove(connectionId, jobId);
                f.Options.IdleAbandonmentThreshold = originalThreshold;
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task FailureIsolation_OneFileFailsEveryAttempt_RemainingFilesArriveAndFailureIsReported()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/failure-isolation"));
            var jobId = createResponse.Content.JobId;

            const string failingRelativePath = "bad.prg";
            const string failingTarget = "/music/failure-isolation/bad.prg";

            // "File already exists" short-circuits SaveFileCommandHandler's retry loop without the
            // exponential backoff sleep a generic IOException would trigger, keeping this test fast.
            port.FailFor = path => path == failingTarget ? new IOException("File already exists") : null;

            try
            {
                await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path={failingRelativePath}", RawBody([1, 2, 3]));
                await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=good-1.prg", RawBody([4, 5, 6]));
                await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=good-2.prg", RawBody([7, 8, 9]));

                var sealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
                sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

                await WaitUntilAsync(async () => (await GetJobAsync(jobId)).State == TransferJobState.Completed);

                var snapshot = await GetJobAsync(jobId);
                snapshot.FilesFailed.Should().Be(1);
                snapshot.FilesSent.Should().Be(2);
                snapshot.Failures.Should().ContainSingle(fx => fx.RelativePath == failingRelativePath);

                port.Received.Should().Contain(r => r.Path == "/music/failure-isolation/good-1.prg");
                port.Received.Should().Contain(r => r.Path == "/music/failure-isolation/good-2.prg");
            }
            finally
            {
                port.FailFor = null;
            }
        }

        [Fact]
        public async Task DeviceLoss_DeviceVanishesPartwayThroughJob_JobAbortsStagingPurgedLeaseReleased()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/device-loss"));
            var jobId = createResponse.Content.JobId;

            try
            {
                var firstUpload = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=first.prg", RawBody([1, 2, 3]));
                firstUpload.StatusCode.Should().Be(HttpStatusCode.OK);

                await WaitUntilAsync(() => port.Received.Any(r => r.Path == "/music/device-loss/first.prg"));

                // The device vanishes between this file's admission and the pump picking up the next one
                // - the only route into the pump's Abort branch a test can drive, since ExceptionBehavior
                // converts every real communication-port exception into an ordinary failed SaveFileResult
                // before it ever reaches TransferPump.
                f.DeviceManager.SimulateDeviceLoss(device.DeviceId);

                await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=second.prg", RawBody([4, 5, 6]));

                // TransferJob's state flips to Aborted a couple of statements before TransferPump releases
                // the lease and purges staging - waiting on the state alone would let this poll return in
                // that gap, so the condition covers every side effect the assertions below re-check.
                await WaitUntilAsync(async () =>
                    (await GetJobAsync(jobId)).State == TransferJobState.Aborted &&
                    leaseCoordinator.GetHolder(device.DeviceId) is null &&
                    !Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)));

                var snapshot = await GetJobAsync(jobId);
                snapshot.Error.Should().NotBeNullOrEmpty();

                Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)).Should().BeFalse();
                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
            }
            finally
            {
                f.DeviceManager.RestoreDevice(device.DeviceId);
            }
        }

        [Fact]
        public async Task Create_SecondJobForSameDeviceIsRejected_DifferentDeviceSucceedsAndIsNotBlockedByASlowSibling()
        {
            var deviceA = f.DeviceManager.Devices[0];
            var deviceB = f.DeviceManager.Devices[1];

            var firstCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(deviceA.DeviceId, "/music/exclusive-a"));
            firstCreate.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            var jobIdA = firstCreate.Content.JobId;

            try
            {
                var secondCreateSameDevice = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, ProblemDetails>(
                    NewCreateRequest(deviceA.DeviceId, "/music/exclusive-a-2"));
                secondCreateSameDevice.Should().BeProblem().WithStatusCode(HttpStatusCode.Conflict);

                var createDifferentDevice = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                    NewCreateRequest(deviceB.DeviceId, "/music/exclusive-b"));
                createDifferentDevice.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
                var jobIdB = createDifferentDevice.Content.JobId;

                try
                {
                    var portA = f.DeviceManager.PortFor(deviceA.DeviceId);
                    var portB = f.DeviceManager.PortFor(deviceB.DeviceId);

                    // The behavior this exclusivity model actually promises, beyond the second create
                    // returning 200: device A's slow write must not head-of-line-block device B's write.
                    // A single global pump that serialized every device through one worker would still
                    // pass a bare "second create succeeds" check while failing this one.
                    portA.PerFileDelay = TimeSpan.FromSeconds(2);

                    try
                    {
                        await f.RawClient.PostAsync($"/api/transfers/{jobIdA}/files?path=slow.prg", RawBody([1, 2, 3]));
                        await f.RawClient.PostAsync($"/api/transfers/{jobIdB}/files?path=fast.prg", RawBody([4, 5, 6]));

                        await WaitUntilAsync(() => portB.Received.Any(r => r.Path == "/music/exclusive-b/fast.prg"));

                        portA.Received.Should().NotContain(r => r.Path == "/music/exclusive-a/slow.prg");
                    }
                    finally
                    {
                        portA.PerFileDelay = TimeSpan.Zero;
                        await WaitUntilAsync(() => portA.Received.Any(r => r.Path == "/music/exclusive-a/slow.prg"), TimeSpan.FromSeconds(10));
                    }
                }
                finally
                {
                    await CancelAsync(jobIdB);
                }
            }
            finally
            {
                await CancelAsync(jobIdA);
            }
        }
    }
}
