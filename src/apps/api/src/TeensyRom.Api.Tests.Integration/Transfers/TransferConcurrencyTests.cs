using System.Net.Http.Headers;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// The one property a passing unit-test suite would never reveal: the device pump keeps writing
    /// while the browser is still uploading. Everything else about the transfer feature can be correct
    /// in isolation and still deadlock or serialize accidentally at the seams this test exercises.
    /// </summary>
    [Collection("Transfer")]
    public class TransferConcurrencyTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

        [Fact]
        public async Task PumpWritesToDevice_WhileUploadsAreStillArriving()
        {
            const int fileCount = 20;
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            port.PerFileDelay = TimeSpan.FromMilliseconds(50);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new()
            {
                DeviceId = device.DeviceId,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = "/music/concurrency" }
            });
            createResponse.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            var jobId = createResponse.Content.JobId;

            var observedOverlap = false;

            try
            {
                for (var i = 0; i < fileCount - 1; i++)
                {
                    // Each upload takes tens of milliseconds to stream - a loopback in-memory TestServer
                    // would otherwise race through all of these uploads well inside a single
                    // PerFileDelay, leaving FilesSent pinned at 0 for the whole loop and no overlap to
                    // observe. This keeps the loop's total duration comparable to the device's own pace,
                    // the way a real multi-file browser upload would. TransferPump's supervisor only
                    // notices a newly-active device on its ~200ms poll tick (TransferPump.cs), and that
                    // gap can stretch further under a CI runner's constrained thread pool - the per-chunk
                    // delay below is sized so the loop's ~1.5s total comfortably outlasts that startup
                    // gap with room left over to observe overlap, not just clears it by a few ms.
                    var response = await f.RawClient.PostAsync(
                        $"/api/transfers/{jobId}/files?path=file-{i}.prg", SlowBody(32 * 1024, TimeSpan.FromMilliseconds(20)));
                    response.StatusCode.Should().Be(HttpStatusCode.OK);

                    // Polled during the upload loop, in the API's own terms: the device is behind the
                    // browser (FilesSent < FilesReceived) while still actively sending (FilesSent > 0)
                    // and the job is still open for more uploads (Receiving).
                    var snapshot = await GetJobAsync(jobId);
                    if (snapshot.State == TransferJobState.Receiving &&
                        snapshot.FilesSent > 0 &&
                        snapshot.FilesSent < snapshot.FilesReceived)
                    {
                        observedOverlap = true;
                    }
                }

                // The final upload's body streams slowly enough to guarantee the request below is
                // still in flight when we check the fake's recorded state - so the assertion that
                // follows observes a point in time strictly before this response returns, not after it.
                var lastUploadTask = f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=file-{fileCount - 1}.prg",
                    SlowBody(256 * 1024, TimeSpan.FromMilliseconds(10)));

                await WaitUntilAsync(() => port.Received.Count > 0);

                var lastResponse = await lastUploadTask;
                lastResponse.StatusCode.Should().Be(HttpStatusCode.OK);

                observedOverlap.Should().BeTrue(
                    "polling GetJob during the upload loop should have observed FilesSent > 0 while " +
                    "still Receiving and behind FilesReceived");

                await WaitUntilAsync(async () => (await GetJobAsync(jobId)).FilesReceived == fileCount);
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
                await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });
            }
        }

        public Task InitializeAsync() => Task.CompletedTask;

        /// <summary>
        /// Cancel returns before the pump's background drain finishes releasing the gate/lease - wait
        /// for that drain here so the next test in this shared collection starts from a clean fixture.
        /// </summary>
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        private async Task<TransferJobSnapshotView> GetJobAsync(string jobId)
        {
            var response = await f.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            var job = response.Content.Job;
            return new TransferJobSnapshotView(job.State, job.FilesSent, job.FilesReceived);
        }

        private readonly record struct TransferJobSnapshotView(TransferJobState State, int FilesSent, int FilesReceived);

        private static HttpContent SlowBody(long totalBytes, TimeSpan perChunkDelay)
        {
            var content = new StreamContent(new SlowStream(totalBytes, perChunkDelay));
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
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
        /// Streams zeroed bytes a small chunk at a time on a fixed delay, so a request built on this
        /// content is guaranteed to still be in flight for a predictable window - long enough to observe
        /// state on the server side without racing a body that sends instantly over loopback.
        /// </summary>
        private sealed class SlowStream(long totalBytes, TimeSpan perChunkDelay) : Stream
        {
            private const int MaxChunkSize = 8 * 1024;
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

                var chunk = (int)Math.Min(Math.Min(count, MaxChunkSize), totalBytes - _bytesRead);
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
