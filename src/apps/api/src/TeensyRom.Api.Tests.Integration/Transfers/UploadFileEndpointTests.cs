using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Endpoints.Transfers.UploadFile;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Drives the raw-body upload endpoint through <see cref="TransferFixture.RawClient"/> - the typed
    /// endpoint helpers cannot express a raw <c>application/octet-stream</c> body, so these tests build
    /// the request by hand.
    /// </summary>
    [Collection("Transfer")]
    public class UploadFileEndpointTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(50);
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

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

        private async Task CancelAsync(string jobId) =>
            await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new CancelJobRequest { JobId = jobId });

        public Task InitializeAsync() => Task.CompletedTask;

        /// <summary>
        /// Cancel returns before the pump's background drain finishes releasing the gate/lease - wait
        /// for that drain here so the next test in this shared collection starts from a clean fixture.
        /// </summary>
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        [Fact]
        public async Task Upload_UnknownJobId_ReturnsNotFound()
        {
            var response = await f.RawClient.PostAsync(
                $"/api/transfers/{Guid.NewGuid():N}/files?path=missing.sid", RawBody([1, 2, 3]));

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Upload_PathTraversal_RejectedBeforeAnyFileIsStaged()
        {
            var device = f.DeviceManager.Devices[0];
            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/traversal"));
            var jobId = createResponse.Content.JobId;

            try
            {
                var response = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=../escape.sid", RawBody([1, 2, 3]));

                response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

                var jobStagingDir = Path.Combine(f.Options.StagingRoot, jobId);
                Directory.Exists(jobStagingDir).Should().BeFalse();
            }
            finally
            {
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task Upload_ToSealedJobWithPendingWork_ReturnsBadRequestImmediately()
        {
            var device = f.DeviceManager.Devices[0];
            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var pump = f.Services.GetRequiredService<TransferPump>();

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/sealed"));
            var jobId = createResponse.Content.JobId;
            var job = registry.Get(jobId)!;

            // Simulates a file still in flight so sealing lands on Sealed rather than finalizing straight
            // to Completed - the same technique SealJobEndpointTests uses, since the state under test
            // (Sealed, not-yet-terminal) has no other way to be produced without a real pending upload.
            job.TryTransitionTo(TransferJobState.Receiving);
            job.OnFileReceived(1);

            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = jobId });
            job.State.Should().Be(TransferJobState.Sealed);

            try
            {
                var response = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=late.sid", RawBody([1, 2, 3]));

                response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
                var detail = await response.Content.ReadAsStringAsync();
                detail.Should().Contain("Sealed");
            }
            finally
            {
                job.OnFileDropped();
                pump.TryFinalize(job);
            }
        }

        [Fact]
        public async Task Upload_ToCancelledJob_ReturnsBadRequestImmediately()
        {
            var device = f.DeviceManager.Devices[0];
            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/cancelled"));
            var jobId = createResponse.Content.JobId;

            await CancelAsync(jobId);

            var response = await f.RawClient.PostAsync(
                $"/api/transfers/{jobId}/files?path=late.sid", RawBody([1, 2, 3]));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Upload_50MbFile_AcceptedAndLandsIntactOnDevice()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/large"));
            var jobId = createResponse.Content.JobId;

            const int sizeBytes = 50 * 1024 * 1024;
            const string targetPath = "/music/large/big.sid";

            try
            {
                var response = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=big.sid", RawBody(new byte[sizeBytes]));

                // Proves the per-route ceiling raise actually took effect - the framework default (30 MB)
                // would otherwise reject this request before it ever reached the handler.
                response.StatusCode.Should().Be(HttpStatusCode.OK);

                var body = await response.Content.ReadFromJsonAsync<UploadFileResponse>(JsonOptions);
                body!.SizeBytes.Should().Be(sizeBytes);
                body.Queued.Should().BeTrue();

                await WaitUntilAsync(() => port.Received.Any(r => r.Path == targetPath && r.DeclaredLength == sizeBytes));
            }
            finally
            {
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task Upload_GateSaturated_BlocksUntilPumpDrainsThenSucceeds()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();

            // MaxStagedBytes is the only ceiling the gate enforces, and it's read fresh from the shared
            // options singleton on every call rather than baked in at construction - so tightening it here
            // on the collection's already-started host is what saturates the gate.
            var originalMaxBytes = f.Options.MaxStagedBytes;
            f.Options.MaxStagedBytes = 5;
            port.PerFileDelay = TimeSpan.FromMilliseconds(600);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/gate"));
            var jobId = createResponse.Content.JobId;

            try
            {
                var firstResponse = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=first.sid", RawBody([1, 2, 3]));
                firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

                // The pump has dequeued the first file and is mid-write (held open by PerFileDelay), so
                // its 3-byte reservation is still counted against the 5-byte budget.
                await WaitUntilAsync(() => gate.Current.Bytes == 3);

                var stopwatch = Stopwatch.StartNew();
                var secondResponse = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=second.sid", RawBody([4, 5, 6]));
                stopwatch.Stop();

                // A rejection would come back immediately; completing only after roughly the device's
                // per-file delay proves this request actually waited for the pump to free the budget.
                secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);
                stopwatch.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(300));

                await WaitUntilAsync(() => gate.Current == (0, 0));
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
                f.Options.MaxStagedBytes = originalMaxBytes;
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task Upload_ClientAbortsMidBody_ReleasesGateAndLeavesNoPartialFile()
        {
            var device = f.DeviceManager.Devices[0];
            var gate = f.Services.GetRequiredService<ITransferCapacityGate>();

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/abort"));
            var jobId = createResponse.Content.JobId;

            var priorGate = gate.Current;

            try
            {
                // Throttled so the client's cancellation below lands mid-transfer rather than racing a
                // body that already finished sending.
                var content = new StreamContent(new ThrottledStream(10 * 1024 * 1024, TimeSpan.FromMilliseconds(50)));
                content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

                using var cts = new CancellationTokenSource();
                cts.CancelAfter(TimeSpan.FromMilliseconds(250));

                Func<Task> upload = async () =>
                    await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=abort.sid", content, cts.Token);

                await upload.Should().ThrowAsync<OperationCanceledException>();

                await WaitUntilAsync(() => gate.Current == priorGate);

                var jobStagingDir = Path.Combine(f.Options.StagingRoot, jobId);
                var leftoverFiles = Directory.Exists(jobStagingDir)
                    ? Directory.EnumerateFileSystemEntries(jobStagingDir).ToArray()
                    : [];
                leftoverFiles.Should().BeEmpty();
            }
            finally
            {
                await CancelAsync(jobId);
            }
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

        /// <summary>
        /// A request-body stand-in that yields bytes on a delay, giving a test a wide, reliable window in
        /// which to cancel mid-transfer instead of racing a body that sends instantly over loopback.
        /// </summary>
        private sealed class ThrottledStream(long totalBytes, TimeSpan perChunkDelay) : Stream
        {
            private long _bytesRead;

            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => totalBytes;
            public override long Position { get => _bytesRead; set => throw new NotSupportedException(); }

            public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            {
                if (_bytesRead >= totalBytes) return 0;

                await Task.Delay(perChunkDelay, cancellationToken);

                var chunk = (int)Math.Min(count, totalBytes - _bytesRead);
                Array.Clear(buffer, offset, chunk);
                _bytesRead += chunk;
                return chunk;
            }

            public override int Read(byte[] buffer, int offset, int count) =>
                ReadAsync(buffer, offset, count, CancellationToken.None).GetAwaiter().GetResult();

            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
