using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Models;
using TeensyRom.Api.Tests.Integration.Common;
using TeensyRom.Api.Tests.Integration.Fixtures.Archives;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Cancellation as a single terminal step: whatever a job is doing when the request lands, it comes
    /// back already cancelled and has handed back its device, its staged files, and its expansion
    /// workspace. The two properties worth the most here are the ones a drain could never offer - a
    /// device usable again the instant cancel returns even with an archive mid-expansion, and a scratch
    /// budget that balances no matter whether the reclaim or the walk got there first.
    /// </summary>
    [Collection("Transfer")]
    public class TransferCancellationTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

        public Task InitializeAsync() => Task.CompletedTask;

        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        [Fact]
        public async Task Cancel_JobWithNothingInFlight_IsTerminalOnReturnAndFreesTheDevice()
        {
            var device = f.DeviceManager.Devices[0];
            var jobId = await CreateJobAsync(f, device.DeviceId, "/music/cancel-idle");

            var cancel = await CancelAsync(f, jobId);

            cancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);

            var reCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/cancel-idle-2"));
            reCreate.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);

            await CancelAsync(f, reCreate.Content.JobId);
        }

        /// <summary>
        /// A backlog the device is still working through is exactly what the old draining state waited
        /// on. The response itself has to be terminal, and the lease has to be gone before the queued
        /// files have been dealt with at all - they are dropped afterwards, which is what returns their
        /// capacity-gate slots.
        /// </summary>
        [Fact]
        public async Task Cancel_WithFilesStillQueuedForTheDevice_ReturnsCancelledWithoutWaitingForTheBacklog()
        {
            var device = f.DeviceManager.Devices[1];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var leaseCoordinator = f.Services.GetRequiredService<IDeviceLeaseCoordinator>();
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();

            port.PerFileDelay = TimeSpan.FromMilliseconds(300);

            try
            {
                var jobId = await CreateJobAsync(f, device.DeviceId, "/music/cancel-backlog");

                for (var i = 0; i < 4; i++)
                {
                    var upload = await f.RawClient.PostAsync(
                        $"/api/transfers/{jobId}/files?path=backlog-{i}.prg", RawBody(Bytes("BACKLOG")));
                    upload.StatusCode.Should().Be(HttpStatusCode.OK);
                }

                // Guarantees a genuine in-flight device write for the cancel to land against, rather
                // than an already-idle queue.
                await WaitUntilAsync(() => port.Received.Any(r => r.Path == "/music/cancel-backlog/backlog-0.prg"));

                var cancel = await CancelAsync(f, jobId);

                cancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);
                leaseCoordinator.GetHolder(device.DeviceId).Should().BeNull();
                cancel.Content.Job.FilesSent.Should().BeLessThan(4);

                await WaitUntilAsync(() => gate.Current == (0, 0));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        /// <summary>
        /// The upload endpoint stages a body that a concurrent cancel is simultaneously purging. Whoever
        /// wins, the request has to come back rather than block on a job that no longer exists, and the
        /// slot it reserved has to be released either way - a leak here is permanent and eventually
        /// starves every later upload.
        /// </summary>
        [Fact]
        public async Task Cancel_WhileAnUploadIsInFlight_LeavesNoReservedCapacityBehind()
        {
            var device = f.DeviceManager.Devices[0];
            var jobId = await CreateJobAsync(f, device.DeviceId, "/music/cancel-mid-upload");

            var upload = f.RawClient.PostAsync(
                $"/api/transfers/{jobId}/files?path=big.prg", RawBody(new byte[8 * 1024 * 1024]));

            var cancel = await CancelAsync(f, jobId);
            cancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);

            var uploadResponse = await upload;
            uploadResponse.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadRequest);

            await f.WaitForQuiescenceAsync();
        }

        [Fact]
        public async Task Cancel_CompletedJob_ReturnsSuccessAndLeavesItCompleted()
        {
            var device = f.DeviceManager.Devices[0];
            var jobId = await CreateJobAsync(f, device.DeviceId, "/music/cancel-after-complete");

            var seal = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            seal.Content.Job.State.Should().Be(TransferJobState.Completed);

            var cancel = await CancelAsync(f, jobId);

            cancel.Content.Job.State.Should().Be(TransferJobState.Completed);
        }

        /// <summary>
        /// The failure this whole change exists for: an archive mid-expansion used to hold the job's
        /// pending count above zero for as long as extraction ran, so the job never left the draining
        /// state and never gave the device back. The extraction gate is deliberately never released
        /// here - cancel has to return, and the device has to be re-usable, with the walk still blocked.
        /// </summary>
        [Fact]
        public async Task Cancel_MidExpansion_FreesTheDeviceWithoutWaitingForTheExpansionToFinish()
        {
            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate);
            var device = fixture.DeviceManager.Devices[0];

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/cancel-mid-expansion", expectedArchiveCount: 1);

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip,
                new EntrySpec("a.sid", Bytes("A")), new EntrySpec("b.sid", Bytes("B")));
            var upload = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            upload.StatusCode.Should().Be(HttpStatusCode.OK);

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");

            var cancel = await CancelAsync(fixture, jobId);
            cancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);

            var second = await fixture.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/cancel-mid-expansion-2"));
            second.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);

            await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = second.Content.JobId });

            // Nothing non-terminal left and the capacity gate back at (0, 0), with the gate above still
            // holding the cancelled job's extraction where it stood.
            await fixture.WaitForQuiescenceAsync();
        }

        /// <summary>
        /// Cancel purges the job's scratch tree while the walk may still be writing into it, so the
        /// budget has to come back exactly once whichever side ran first: released twice it would go
        /// negative and hand later jobs space that does not exist, released never it would never come
        /// back at all. The ceiling here fits exactly one expansion, so the second one only succeeds if
        /// the first returned every byte.
        /// </summary>
        [Fact]
        public async Task Cancel_MidExpansion_ReturnsTheScratchBudgetExactlyOnceForTheNextExpansion()
        {
            var content = Bytes("CANCELLED-EXPANSION-CONTENT");
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", content));
            var ceiling = archive.Length + content.Length + 16;

            var extraction = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(extraction, o => o.MaxScratchBytes = ceiling);
            var device = fixture.DeviceManager.Devices[0];
            var scratch = fixture.Services.GetRequiredService<ITransferScratchStore>();

            scratch.BytesInUse.Should().Be(0);

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/scratch-balance", expectedArchiveCount: 1);

            var upload = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            upload.StatusCode.Should().Be(HttpStatusCode.OK);

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");
            scratch.BytesInUse.Should().BeGreaterThan(0);

            var cancel = await CancelAsync(fixture, jobId);
            cancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);

            // Back to its pre-expansion value with the extraction gate still closed - the reclaim does
            // not depend on the walk noticing first.
            await WaitUntilAsync(() => scratch.BytesInUse == 0);

            extraction.Release();

            // The walk unwinding after the reclaim must not take the budget below zero on its way out.
            await Task.Delay(TimeSpan.FromMilliseconds(200));
            scratch.BytesInUse.Should().Be(0);

            var second = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-balance-2", archive);
            second.FilesFailed.Should().Be(0);
            second.FilesSent.Should().Be(1);
            await WaitUntilAsync(() => scratch.BytesInUse == 0);
        }

        // ------------------------------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------------------------------

        private static CreateJobRequest NewCreateRequest(string deviceId, string destination, int expectedArchiveCount = 0) => new()
        {
            DeviceId = deviceId,
            StorageType = TeensyStorageType.SD,
            Body = new CreateJobBody { DestinationDirectory = destination, ExpectedArchiveCount = expectedArchiveCount }
        };

        private static byte[] Bytes(string s) => System.Text.Encoding.UTF8.GetBytes(s);

        private static HttpContent RawBody(byte[] bytes)
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
        }

        private static async Task<string> CreateJobAsync(
            TransferFixture fixture, string deviceId, string destination, int expectedArchiveCount = 0)
        {
            var response = await fixture.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(deviceId, destination, expectedArchiveCount));
            response.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            return response.Content.JobId;
        }

        private static async Task<RadTestResult<CancelJobResponse>> CancelAsync(TransferFixture fixture, string jobId)
        {
            var response = await fixture.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });
            response.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);
            return response;
        }

        private static async Task<TransferJobDto> GetJobAsync(TransferFixture fixture, string jobId)
        {
            var response = await fixture.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            return response.Content.Job;
        }

        private static TransferJobSweeper GetSweeper(TransferFixture fixture) =>
            fixture.Services.GetServices<IHostedService>().OfType<TransferJobSweeper>().Single();

        /// <summary>
        /// Uploads <paramref name="archiveBytes"/> as a fresh job's sole archive, seals it, and drives
        /// the sweeper directly until it completes rather than waiting on the real sweep timer.
        /// </summary>
        private static async Task<TransferJobDto> ExpandArchiveToCompletionAsync(
            TransferFixture fixture, string deviceId, string destinationSuffix, byte[] archiveBytes)
        {
            var jobId = await CreateJobAsync(fixture, deviceId, $"/music/{destinationSuffix}", expectedArchiveCount: 1);

            var upload = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archiveBytes));
            upload.StatusCode.Should().Be(HttpStatusCode.OK);

            await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });

            var sweeper = GetSweeper(fixture);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                return (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed;
            });

            return await GetJobAsync(fixture, jobId);
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

        /// <summary>
        /// Substitutes <see cref="IArchiveReader"/> with <see cref="GatedArchiveReader"/> wrapping the
        /// real reader, so a test can hold an expansion open for as long as it needs.
        /// </summary>
        private sealed class GatedArchiveTransferFixture(ArchiveExtractionGate gate, Action<TransferOptions>? configureOptions = null)
            : TransferFixture(configureOptions, services =>
            {
                var existing = services.FirstOrDefault(d => d.ServiceType == typeof(IArchiveReader));
                if (existing is not null)
                {
                    services.Remove(existing);
                }

                services.AddSingleton<IArchiveReader>(sp =>
                    new GatedArchiveReader(new SharpCompressArchiveReader(sp.GetRequiredService<ILoggingService>()), gate));
            })
        {
        }
    }
}
