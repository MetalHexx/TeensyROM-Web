using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Tests.Integration.Common;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// The boundaries the staged-upload design exists to hold: a client cannot escape the destination
    /// directory, cannot force the host to buffer an unbounded body in memory, cannot outrun the
    /// capacity gate, and cannot recover debris left in the staging root by a prior crash.
    /// </summary>
    [Collection("Transfer")]
    public class TransferSafetyTests(TransferFixture f)
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(10);

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

        private static HttpContent SyntheticBody(long totalBytes)
        {
            var content = new StreamContent(new SyntheticStream(totalBytes));
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
        }

        private async Task CancelAsync(string jobId) =>
            await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });

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

        [Theory]
        [InlineData("../../escape.sid")]
        [InlineData("/rooted.sid")]
        [InlineData("a/../../b.sid")]
        public async Task Upload_PathTraversalAttempt_RejectedBeforeAnyFileIsStagedOrWritten(string maliciousPath)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/traversal-safety"));
            var jobId = createResponse.Content.JobId;

            try
            {
                var priorReceivedCount = port.Received.Count;

                var response = await f.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path={Uri.EscapeDataString(maliciousPath)}", RawBody([1, 2, 3]));

                response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

                Directory.Exists(Path.Combine(f.Options.StagingRoot, jobId)).Should().BeFalse();
                port.Received.Count.Should().Be(priorReceivedCount);
            }
            finally
            {
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task Upload_LargeSyntheticDrop_DoesNotBufferTheWholeBodyInMemory()
        {
            var device = f.DeviceManager.Devices[0];

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/memory-safety"));
            var jobId = createResponse.Content.JobId;

            const long sizeBytes = 200L * 1024 * 1024;

            try
            {
                // GetTotalMemory(forceFullCollection: true) forces the collection itself; a synthetic,
                // non-preallocating body stream (below) keeps this test process's own heap from
                // absorbing the payload, so any growth measured here can only be attributed to the
                // server's own handling of the request body.
                var before = GC.GetTotalMemory(forceFullCollection: true);

                var response = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=huge.bin", SyntheticBody(sizeBytes));
                response.StatusCode.Should().Be(HttpStatusCode.OK);

                var after = GC.GetTotalMemory(forceFullCollection: true);

                // A generous ceiling, tuned to catch "the whole 200 MB body was buffered" rather than
                // fluctuate on ordinary allocator noise.
                (after - before).Should().BeLessThan(50L * 1024 * 1024,
                    "the endpoint should stream the body straight to disk, never buffer it whole");
            }
            finally
            {
                await CancelAsync(jobId);
            }
        }

        [Fact]
        public async Task Upload_MoreFilesThanMaxStagedFilesCeiling_GateNeverExceedsItAndEveryUploadEventuallySucceeds()
        {
            // MaxStagedFiles sizes the gate's file semaphore once, at construction - mutating it on an
            // already-started host has no effect (see UploadFileEndpointTests.Upload_GateSaturated...),
            // so this ceiling can only be tested against a fixture built with the low value from the
            // start. A fresh, unshared fixture instead of the collection's shared one.
            using var fixture = new LowFileCapacityTransferFixture();

            var device = fixture.DeviceManager.Devices[0];
            var port = fixture.DeviceManager.PortFor(device.DeviceId);
            var gate = fixture.Services.GetRequiredService<ITransferCapacityGate>();

            port.PerFileDelay = TimeSpan.FromMilliseconds(150);

            var createResponse = await fixture.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/capacity-gate"));
            var jobId = createResponse.Content.JobId;
            var jobStagingDir = Path.Combine(fixture.Options.StagingRoot, jobId);

            const int fileCount = 8;
            var maxObservedGateFiles = 0;
            var maxObservedStagedOnDisk = 0;
            using var monitorCts = new CancellationTokenSource();

            var monitorTask = Task.Run(async () =>
            {
                while (!monitorCts.IsCancellationRequested)
                {
                    maxObservedGateFiles = Math.Max(maxObservedGateFiles, gate.Current.Files);

                    var onDisk = Directory.Exists(jobStagingDir) ? Directory.EnumerateFiles(jobStagingDir).Count() : 0;
                    maxObservedStagedOnDisk = Math.Max(maxObservedStagedOnDisk, onDisk);

                    try
                    {
                        await Task.Delay(5, monitorCts.Token);
                    }
                    catch (OperationCanceledException)
                    {
                    }
                }
            });

            try
            {
                var uploadTasks = Enumerable.Range(0, fileCount)
                    .Select(i => fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=file-{i}.prg", RawBody([1, 2, 3])))
                    .ToArray();

                var responses = await Task.WhenAll(uploadTasks);
                responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
            }
            finally
            {
                monitorCts.Cancel();
                await monitorTask;
            }

            maxObservedGateFiles.Should().BeLessThanOrEqualTo(3);
            maxObservedStagedOnDisk.Should().BeLessThanOrEqualTo(3);

            await WaitUntilAsync(() => gate.Current.Files == 0 && gate.Current.Bytes == 0);
        }

        [Fact]
        public void StartupSweep_DebrisLeftInStagingRoot_IsClearedBeforeTheHostAcceptsRequests()
        {
            // WebApplicationFactory starts the host - and every IHostedService, including
            // ApplicationBootstrapService.StartAsync, which calls ITransferStagingStore.SweepAll() -
            // the first time .Services (or a client) is touched. DebrisSeededTransferFixture seeds the
            // staging root from within that same construction window, before the sweep can run, so no
            // polling is needed: the sweep has already completed by the time the fixture returns.
            using var fixture = new DebrisSeededTransferFixture();

            Directory.GetFileSystemEntries(fixture.Options.StagingRoot).Should().BeEmpty();
        }

        private sealed class LowFileCapacityTransferFixture() : TransferFixture(o => o.MaxStagedFiles = 3)
        {
        }

        private sealed class DebrisSeededTransferFixture() : TransferFixture(o =>
        {
            File.WriteAllBytes(Path.Combine(o.StagingRoot, "debris.bin"), [1, 2, 3]);

            var orphanedJobDir = Path.Combine(o.StagingRoot, "orphaned-job");
            Directory.CreateDirectory(orphanedJobDir);
            File.WriteAllBytes(Path.Combine(orphanedJobDir, "0.bin"), [4, 5, 6]);
        })
        {
        }

        private sealed class SyntheticStream(long totalBytes) : Stream
        {
            private long _bytesRead;

            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => totalBytes;
            public override long Position { get => _bytesRead; set => throw new NotSupportedException(); }

            public override int Read(byte[] buffer, int offset, int count)
            {
                if (_bytesRead >= totalBytes) return 0;

                var chunk = (int)Math.Min(count, totalBytes - _bytesRead);
                Array.Clear(buffer, offset, chunk);
                _bytesRead += chunk;
                return chunk;
            }

            public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
                Task.FromResult(Read(buffer, offset, count));

            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
