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
    /// Three failures that are silent by nature and never show up in a suite built from small, fast
    /// archives: a wedged pipeline that hangs every upload for the process lifetime, a job that
    /// completes while expansion is still producing entries, and a scratch leak invisible until the
    /// feature stops working. Every test here either holds a real archive's extraction open with
    /// <see cref="GatedArchiveReader"/> (substituted per <see cref="TransferFixture"/>'s
    /// service-collection hook) or tightens a ceiling low enough that the failure shape is reachable
    /// without generating gigabytes of fixture data.
    /// </summary>
    [Collection("Transfer")]
    public class ArchiveExpansionLifecycleTests : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

        public Task InitializeAsync() => Task.CompletedTask;

        // Every test in this class builds and disposes its own TransferFixture - none touch the
        // collection's shared host - so there is nothing here for a shared teardown to quiesce.
        public Task DisposeAsync() => Task.CompletedTask;

        // ------------------------------------------------------------------------------------------
        // No wedging - two shapes, both of which must pass.
        // ------------------------------------------------------------------------------------------

        [Fact]
        public async Task NoWedging_ArchiveContentsExceedStagingCeiling_ExpandsToCompletionWhileDeviceDrainsSlowly()
        {
            var entries = Enumerable.Range(0, 6)
                .Select(i => new EntrySpec($"song-{i}.sid", new byte[512]))
                .ToArray();
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, entries);

            // The ceiling only ever fits two entries at once - the rest must wait for the device to
            // drain a slot before they can be admitted at all.
            using var fixture = new LowStagingCeilingTransferFixture(maxStagedBytes: 1024);
            var device = fixture.DeviceManager.Devices[0];
            var port = fixture.DeviceManager.PortFor(device.DeviceId);
            port.PerFileDelay = TimeSpan.FromMilliseconds(30);

            try
            {
                var (snapshot, _) = await ExpandArchiveToCompletionAsync(
                    fixture, device.DeviceId, "wedge-staging-ceiling", archive, TimeSpan.FromSeconds(30));

                snapshot.FilesFailed.Should().Be(0);
                snapshot.FilesSent.Should().Be(entries.Length);
                port.Received.Count.Should().Be(entries.Length);
            }
            finally
            {
                port.PerFileDelay = TimeSpan.Zero;
            }
        }

        /// <summary>
        /// The one the design nearly got wrong: ordinary uploads for a job with an archive still
        /// expanding are held exactly like an extracted entry (see <c>TransferAdmission.AdmitAsync</c>'s
        /// <c>job.HasExpansionOutstanding</c> check) - so if extraction were ever admitted straight from
        /// the walk instead of after <c>ReleaseHeldAsync</c> runs, an archive whose own entries need gate
        /// capacity that a full-but-undraining ceiling can never free would hang for the process
        /// lifetime. Held files reserving the whole ceiling with nothing draining is exactly that
        /// precondition.
        /// </summary>
        [Fact]
        public async Task NoWedging_OrdinaryUploadsSaturateStagingCeilingDuringExpansion_ExpansionFinishesHoldReleasesEveryUploadReturns()
        {
            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate, o => o.MaxStagedBytes = 2048);
            var device = fixture.DeviceManager.Devices[0];
            var capacityGate = fixture.Services.GetRequiredService<ITransferCapacityGate>();

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/hold-vs-gate", expectedArchiveCount: 1);

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", Bytes("EXPANDED")));
            var archiveUpload = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            archiveUpload.StatusCode.Should().Be(HttpStatusCode.OK);

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");

            var ordinaryBody = new byte[512];
            var ordinaryCount = 0;

            while (capacityGate.Current.Bytes + ordinaryBody.Length <= 2048)
            {
                var response = await fixture.RawClient.PostAsync(
                    $"/api/transfers/{jobId}/files?path=held-{ordinaryCount}.prg", RawBody(ordinaryBody));
                response.StatusCode.Should().Be(HttpStatusCode.OK);
                ordinaryCount++;
            }

            // The ceiling is now entirely occupied by files this same job is holding, not draining - the
            // exact state the archive's own extracted entry must not deadlock against.
            capacityGate.Current.Should().Be((ordinaryCount, 2048));

            gate.Release();

            var sealResponse = await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

            var sweeper = GetSweeper(fixture);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                return (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed;
            }, TimeSpan.FromSeconds(20));

            var finalSnapshot = await GetJobAsync(fixture, jobId);
            finalSnapshot.FilesFailed.Should().Be(0);
            finalSnapshot.FilesSent.Should().Be(ordinaryCount + 1);
        }

        // ------------------------------------------------------------------------------------------
        // No silent loss.
        // ------------------------------------------------------------------------------------------

        [Fact]
        public async Task NoSilentLoss_SealedJobWithExpansionOutstanding_DoesNotCompleteOrPurgeUntilEveryEntryIsAccountedFor()
        {
            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate);
            var device = fixture.DeviceManager.Devices[0];
            var registry = fixture.Services.GetRequiredService<ITransferJobRegistry>();
            var scratch = fixture.Services.GetRequiredService<ITransferScratchStore>();

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/no-silent-loss", expectedArchiveCount: 1);

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("only.sid", Bytes("CONTENT")));
            var uploadResponse = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            var sealResponse = await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");

            for (var i = 0; i < 5; i++)
            {
                var job = registry.Get(jobId)!;
                job.State.Should().NotBe(TransferJobState.Completed);
                job.PendingCount.Should().BeGreaterThan(0);
                scratch.BytesInUse.Should().BeGreaterThan(0);

                await Task.Delay(TimeSpan.FromMilliseconds(50));
            }

            gate.Release();

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed);

            var finalSnapshot = await GetJobAsync(fixture, jobId);
            finalSnapshot.FilesSent.Should().Be(1);
            finalSnapshot.ExpandedFileCount.Should().Be(1);
        }

        // ------------------------------------------------------------------------------------------
        // A vanished client does not strand a live expansion.
        // ------------------------------------------------------------------------------------------

        [Fact]
        public async Task Abandonment_VanishedClientWithLiveExpansion_JobSurvivesIdleSweepWithNoSubscribers()
        {
            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate, o => o.IdleAbandonmentThreshold = TimeSpan.FromMilliseconds(75));
            var device = fixture.DeviceManager.Devices[0];
            var registry = fixture.Services.GetRequiredService<ITransferJobRegistry>();
            var sweeper = GetSweeper(fixture);

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/vanished-client", expectedArchiveCount: 1);

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("only.sid", Bytes("CONTENT")));
            var uploadResponse = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            await WaitUntilAsync(() => registry.Get(jobId)!.PendingCount > 0);

            // No subscriber ever joins this job, and this sits well past the idle threshold - the only
            // thing standing between here and an abandoned job is PendingCount still reflecting the
            // archive's own outstanding slot.
            await Task.Delay(TimeSpan.FromMilliseconds(200));
            sweeper.Sweep();

            registry.Get(jobId)!.State.Should().NotBe(TransferJobState.Abandoned);

            gate.Release();

            await WaitUntilAsync(() => registry.Get(jobId)!.PendingCount == 0);

            var cancelResponse = await fixture.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });
            cancelResponse.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);

            await WaitUntilAsync(() => TransferJob.IsTerminal(registry.Get(jobId)!.State));
        }

        // ------------------------------------------------------------------------------------------
        // Scratch released on every exit - completion, cancellation, abandonment, and a startup sweep
        // over an orphaned root. Each proves the budget, not just the bytes, by expanding a
        // same-size archive twice under the same tight ceiling.
        // ------------------------------------------------------------------------------------------

        [Fact]
        public async Task ScratchReleased_OnCompletion_BudgetReturnsForASubsequentExpansion()
        {
            var content = Bytes("COMPLETION-CONTENT");
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", content));
            var ceiling = archive.Length + content.Length + 16;

            using var fixture = new LowScratchCeilingTransferFixture(ceiling);
            var device = fixture.DeviceManager.Devices[0];

            var (first, _) = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-completion-1", archive);
            first.FilesFailed.Should().Be(0);
            first.FilesSent.Should().Be(1);

            var (second, _) = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-completion-2", archive);
            second.FilesFailed.Should().Be(0);
            second.FilesSent.Should().Be(1);
        }

        [Fact]
        public async Task ScratchReleased_OnCancellationMidExpansion_BudgetReturnsForASubsequentExpansion()
        {
            var content = Bytes("CANCEL-CONTENT");
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", content));
            var ceiling = archive.Length + content.Length + 16;

            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate, o => o.MaxScratchBytes = ceiling);
            var device = fixture.DeviceManager.Devices[0];
            var scratch = fixture.Services.GetRequiredService<ITransferScratchStore>();

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/scratch-cancel", expectedArchiveCount: 1);

            var uploadResponse = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");

            var cancelResponse = await fixture.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new() { JobId = jobId });
            cancelResponse.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);

            gate.Release();

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).State == TransferJobState.Cancelled);
            await WaitUntilAsync(() => scratch.BytesInUse == 0);

            var (second, _) = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-cancel-2", archive);
            second.FilesFailed.Should().Be(0);
            second.FilesSent.Should().Be(1);
        }

        [Fact]
        public async Task ScratchReleased_OnAbandonment_BudgetReturnsForASubsequentExpansion()
        {
            var content = Bytes("ABANDON-CONTENT");
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", content));
            var ceiling = archive.Length + content.Length + 16;

            using var fixture = new LowScratchCeilingTransferFixture(
                ceiling, o => o.IdleAbandonmentThreshold = TimeSpan.FromMilliseconds(75));
            var device = fixture.DeviceManager.Devices[0];
            var sweeper = GetSweeper(fixture);
            var scratch = fixture.Services.GetRequiredService<ITransferScratchStore>();
            var registry = fixture.Services.GetRequiredService<ITransferJobRegistry>();

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/scratch-abandon", expectedArchiveCount: 1);

            var uploadResponse = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            // Left unsealed and un-subscribed: expansion runs to completion on its own, the device
            // drains its single entry, and the job goes idle without ever reaching a terminal state on
            // its own.
            await WaitUntilAsync(() => registry.Get(jobId)!.PendingCount == 0);

            await Task.Delay(TimeSpan.FromMilliseconds(200));
            sweeper.Sweep();

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).State == TransferJobState.Abandoned);
            await WaitUntilAsync(() => scratch.BytesInUse == 0);

            var (second, _) = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-abandon-2", archive);
            second.FilesFailed.Should().Be(0);
            second.FilesSent.Should().Be(1);
        }

        [Fact]
        public async Task ScratchReleased_OnStartupSweepOverAnOrphanedRoot_BudgetIsCleanForANewExpansion()
        {
            var content = Bytes("ORPHAN-CONTENT");
            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", content));
            var ceiling = archive.Length + content.Length + 16;

            string? orphanDir = null;

            using var fixture = new LowScratchCeilingTransferFixture(ceiling, o =>
            {
                // Simulates a prior process's crash: bytes left on disk under the job's own scratch root
                // with nothing in memory (a fresh process) ever having reserved them.
                orphanDir = Path.Combine(o.ScratchRoot, "orphaned-from-a-crashed-process");
                Directory.CreateDirectory(orphanDir);
                File.WriteAllBytes(Path.Combine(orphanDir, "leftover.bin"), new byte[ceiling]);
            });

            // Building the fixture builds and starts the host, and ApplicationBootstrapService's startup
            // sweep runs to completion before the host is ready to serve - by the time a service can be
            // resolved here, the sweep has already run.
            var scratch = fixture.Services.GetRequiredService<ITransferScratchStore>();

            Directory.Exists(orphanDir).Should().BeFalse("the startup sweep must reclaim a root orphaned by a prior crash");
            scratch.BytesInUse.Should().Be(0);

            var device = fixture.DeviceManager.Devices[0];
            var (snapshot, _) = await ExpandArchiveToCompletionAsync(fixture, device.DeviceId, "scratch-orphan", archive);
            snapshot.FilesFailed.Should().Be(0);
            snapshot.FilesSent.Should().Be(1);
        }

        // ------------------------------------------------------------------------------------------
        // Honest counts across the overlap.
        // ------------------------------------------------------------------------------------------

        [Fact]
        public async Task HonestCounts_ExpansionFinishesWhileOrdinaryUploadsContinue_ExpandedTotalAndDevicePercentStayHonest()
        {
            const int ordinaryFileCount = 6;
            const int archiveEntryCount = 3;
            const int archivesSent = 1;
            const int scanTotal = ordinaryFileCount + archivesSent;

            var gate = new ArchiveExtractionGate();
            using var fixture = new GatedArchiveTransferFixture(gate);
            var device = fixture.DeviceManager.Devices[0];

            var jobId = await CreateJobAsync(fixture, device.DeviceId, "/music/honest-counts", expectedArchiveCount: 1);

            var readings = new List<(int FilesSent, int? ExpandedFileCount)>();

            async Task CaptureAsync()
            {
                var snapshot = await GetJobAsync(fixture, jobId);
                readings.Add((snapshot.FilesSent, snapshot.ExpandedFileCount));
            }

            for (var i = 0; i < ordinaryFileCount / 2; i++)
            {
                var response = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pre-{i}.prg", RawBody(Bytes("PRE")));
                response.StatusCode.Should().Be(HttpStatusCode.OK);
                await CaptureAsync();
            }

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip,
                new EntrySpec("a.sid", Bytes("A")), new EntrySpec("b.sid", Bytes("B")), new EntrySpec("c.sid", Bytes("C")));
            var archiveUpload = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archive));
            archiveUpload.StatusCode.Should().Be(HttpStatusCode.OK);
            await CaptureAsync();

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandingArchive == "pack.zip");

            for (var i = ordinaryFileCount / 2; i < ordinaryFileCount; i++)
            {
                var response = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=mid-{i}.prg", RawBody(Bytes("MID")));
                response.StatusCode.Should().Be(HttpStatusCode.OK);
                await CaptureAsync();
            }

            // Still gated closed - every reading captured so far must show the expanded total absent,
            // whether it was taken before the archive even arrived or while expansion is outstanding.
            readings.Should().OnlyContain(r => r.ExpandedFileCount == null);

            gate.Release();

            await WaitUntilAsync(async () => (await GetJobAsync(fixture, jobId)).ExpandedFileCount != null);
            await CaptureAsync();

            var sealResponse = await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });
            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

            var sweeper = GetSweeper(fixture);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                await CaptureAsync();
                return (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed;
            }, TimeSpan.FromSeconds(20));

            await CaptureAsync();

            // Composition honesty: absent until expansion is done, then present and exactly correct -
            // never a partial or stale value in between.
            readings.Should().OnlyContain(r => r.ExpandedFileCount == null || r.ExpandedFileCount == archiveEntryCount);

            // Read the same figure the browser composes from these fields (see
            // libs/application/src/lib/transfer/transfer-helpers.ts's computeTransferMetrics) and assert
            // it never moves backwards across the sequence.
            var devicePercents = readings
                .Select(r => DevicePercent(r.FilesSent, r.ExpandedFileCount, scanTotal, archivesSent))
                .ToList();

            devicePercents
                .Zip(devicePercents.Skip(1), (earlier, later) => later >= earlier)
                .Should().OnlyContain(nonDecreasing => nonDecreasing);

            var finalSnapshot = await GetJobAsync(fixture, jobId);
            finalSnapshot.FilesFailed.Should().Be(0);
            finalSnapshot.FilesSent.Should().Be(ordinaryFileCount + archiveEntryCount);
        }

        // ------------------------------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------------------------------

        private static byte[] Bytes(string s) => System.Text.Encoding.UTF8.GetBytes(s);

        private static HttpContent RawBody(byte[] bytes)
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
        }

        /// Mirrors computeTransferMetrics's devicePct arithmetic (transfer-helpers.ts): the composed
        /// total is absent until expandedFileCount is known, and the ratio is floored and capped below
        /// 100 rather than rounded up early.
        private static int DevicePercent(int filesSent, int? expandedFileCount, int scanTotal, int archivesSent)
        {
            var expandedTotal = expandedFileCount is null ? (int?)null : scanTotal - archivesSent + expandedFileCount.Value;
            var denominator = expandedTotal ?? scanTotal;
            return denominator <= 0 ? 0 : Math.Min(99, (int)(filesSent * 100L / denominator));
        }

        private static async Task<string> CreateJobAsync(
            TransferFixture fixture, string deviceId, string destination, int expectedArchiveCount = 0)
        {
            var response = await fixture.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new()
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = destination, ExpectedArchiveCount = expectedArchiveCount }
            });
            response.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            return response.Content.JobId;
        }

        private static async Task<TransferJobDto> GetJobAsync(TransferFixture fixture, string jobId)
        {
            var response = await fixture.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            return response.Content.Job;
        }

        /// TransferJobSweeper is only registered via AddHostedService<TransferJobSweeper>() - it must be
        /// located among the host's hosted services rather than resolved directly.
        private static TransferJobSweeper GetSweeper(TransferFixture fixture) =>
            fixture.Services.GetServices<IHostedService>().OfType<TransferJobSweeper>().Single();

        /// <summary>
        /// Creates a job, uploads <paramref name="archiveBytes"/> as its sole archive under the fixed
        /// name <c>pack.zip</c>, seals it, and waits for it to complete - driving the sweeper directly so
        /// completion does not depend on the real 30-second timer.
        /// </summary>
        private static async Task<(TransferJobDto Snapshot, string Destination)> ExpandArchiveToCompletionAsync(
            TransferFixture fixture, string deviceId, string destinationSuffix, byte[] archiveBytes, TimeSpan? timeout = null)
        {
            var destination = $"/music/archive-lifecycle-{destinationSuffix}";
            var jobId = await CreateJobAsync(fixture, deviceId, destination, expectedArchiveCount: 1);

            var uploadResponse = await fixture.RawClient.PostAsync($"/api/transfers/{jobId}/files?path=pack.zip", RawBody(archiveBytes));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });

            var sweeper = GetSweeper(fixture);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                return (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed;
            }, timeout ?? PollTimeout);

            return (await GetJobAsync(fixture, jobId), destination);
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

        // ------------------------------------------------------------------------------------------
        // Derived fixtures - one per tuning shape this suite needs, following the same idiom as
        // ArchiveExpansionSafetyTests's LowExpansionCeilingTransferFixture / LowDepthTransferFixture.
        // ------------------------------------------------------------------------------------------

        private sealed class LowStagingCeilingTransferFixture(long maxStagedBytes)
            : TransferFixture(o => o.MaxStagedBytes = maxStagedBytes)
        {
        }

        private sealed class LowScratchCeilingTransferFixture(long maxScratchBytes, Action<TransferOptions>? configureOptions = null)
            : TransferFixture(o =>
            {
                o.MaxScratchBytes = maxScratchBytes;
                configureOptions?.Invoke(o);
            })
        {
        }

        /// <summary>
        /// Substitutes <see cref="IArchiveReader"/> with <see cref="GatedArchiveReader"/> wrapping the
        /// real <see cref="SharpCompressArchiveReader"/> - the slow-extraction seam every gated test in
        /// this suite drives through <paramref name="gate"/>.
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
