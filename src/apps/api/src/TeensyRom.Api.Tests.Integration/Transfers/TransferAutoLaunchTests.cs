using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Models;
using TeensyRom.Api.Services;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Launch-after-transfer end to end over HTTP. The fixture swaps the launch service for a recording
    /// fake, so these assert what the engine asked to launch and when, never a real device launch.
    /// </summary>
    [Collection("Transfer")]
    public class TransferAutoLaunchTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);

        public Task InitializeAsync() => Task.CompletedTask;

        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        private FileTransferSettings Settings => f.Services.GetRequiredService<ISettingsService>().GetSettings().FileTransferSettings;

        private static HttpContent RawBody() =>
            new ByteArrayContent([1, 2, 3]) { Headers = { ContentType = new MediaTypeHeaderValue("application/octet-stream") } };

        private async Task<TransferJobDto> GetJobAsync(string jobId)
        {
            var response = await f.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            return response.Content.Job;
        }

        private async Task<string> TransferAsync(string destination, bool launch, params string[] files)
        {
            var device = f.DeviceManager.Devices[0];
            var create = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new()
            {
                DeviceId = device.DeviceId,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = destination, Launch = launch }
            });
            var jobId = create.Content.JobId;

            foreach (var file in files)
            {
                var upload = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path={file}", RawBody());
                upload.StatusCode.Should().Be(HttpStatusCode.OK);
            }

            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            return jobId;
        }

        private async Task<TransferJobDto> WaitForJobAsync(string jobId, Func<TransferJobDto, bool> done)
        {
            var deadline = DateTime.UtcNow + PollTimeout;

            while (true)
            {
                var job = await GetJobAsync(jobId);
                if (done(job)) return job;
                if (DateTime.UtcNow > deadline) throw new TimeoutException($"Job {jobId} did not reach the expected state; was {job.State}/{job.LaunchState}.");
                await Task.Delay(20);
            }
        }

        private static bool Settled(TransferJobDto job) =>
            job.State == TransferJobState.Completed && job.LaunchState != TransferLaunchState.Pending;

        private IEnumerable<RecordedLaunch> LaunchesUnder(string destination) =>
            f.Launches.Calls.Where(c => c.Path.StartsWith(destination + "/", StringComparison.Ordinal));

        [Fact]
        public async Task Completed_WithAutoLaunchOn_LaunchesTheGameOnceAfterTheLeaseIsReleased()
        {
            var original = Settings.AutoLaunchOnCopyEnabled;
            Settings.AutoLaunchOnCopyEnabled = true;

            try
            {
                var jobId = await TransferAsync("/launch/auto", launch: false, "tune.sid", "game.prg");

                var job = await WaitForJobAsync(jobId, Settled);

                job.LaunchState.Should().Be(TransferLaunchState.Launched);
                job.LaunchedPath.Should().Be("/launch/auto/game.prg");

                var launch = LaunchesUnder("/launch/auto").Should().ContainSingle().Subject;
                launch.Path.Should().Be("/launch/auto/game.prg");
                launch.LeaseHolderAtCall.Should().BeNull();
            }
            finally
            {
                Settings.AutoLaunchOnCopyEnabled = original;
            }
        }

        [Fact]
        public async Task Completed_WithAutoLaunchOff_LaunchesOnlyWhenTheJobRequestedIt()
        {
            var original = Settings.AutoLaunchOnCopyEnabled;
            Settings.AutoLaunchOnCopyEnabled = false;

            try
            {
                var plainId = await TransferAsync("/launch/off-plain", launch: false, "game.prg");
                var plain = await WaitForJobAsync(plainId, Settled);
                await f.WaitForQuiescenceAsync();

                var requestedId = await TransferAsync("/launch/off-requested", launch: true, "game.prg");
                var requested = await WaitForJobAsync(requestedId, Settled);

                plain.LaunchState.Should().Be(TransferLaunchState.None);
                LaunchesUnder("/launch/off-plain").Should().BeEmpty();
                requested.LaunchState.Should().Be(TransferLaunchState.Launched);
                LaunchesUnder("/launch/off-requested").Should().ContainSingle();
            }
            finally
            {
                Settings.AutoLaunchOnCopyEnabled = original;
            }
        }

        [Fact]
        public async Task Completed_WithOnlyUnlaunchableFiles_NeverLaunches()
        {
            var original = Settings.AutoLaunchOnCopyEnabled;
            Settings.AutoLaunchOnCopyEnabled = true;

            try
            {
                var jobId = await TransferAsync("/launch/none", launch: true, "disk.d64", "cart.trh", "readme.nfo");

                var job = await WaitForJobAsync(jobId, Settled);

                job.LaunchState.Should().Be(TransferLaunchState.None);
                job.LaunchedPath.Should().BeNull();
                LaunchesUnder("/launch/none").Should().BeEmpty();
            }
            finally
            {
                Settings.AutoLaunchOnCopyEnabled = original;
            }
        }

        [Fact]
        public async Task Completed_WhenTheLaunchFails_ReportsFailedOnTheJobAndKeepsTheTransfer()
        {
            var original = Settings.AutoLaunchOnCopyEnabled;
            Settings.AutoLaunchOnCopyEnabled = true;
            f.Launches.Status = FileLaunchStatus.LaunchFailed;

            try
            {
                var jobId = await TransferAsync("/launch/fails", launch: false, "game.prg");

                var job = await WaitForJobAsync(jobId, Settled);

                job.State.Should().Be(TransferJobState.Completed);
                job.FilesSent.Should().Be(1);
                job.LaunchState.Should().Be(TransferLaunchState.Failed);
                job.LaunchError.Should().NotBeNullOrEmpty();
            }
            finally
            {
                f.Launches.Status = FileLaunchStatus.Launched;
                Settings.AutoLaunchOnCopyEnabled = original;
            }
        }
    }
}
