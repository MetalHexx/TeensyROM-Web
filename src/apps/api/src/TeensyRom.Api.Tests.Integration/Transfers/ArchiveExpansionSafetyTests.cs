using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
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

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Path traversal via entry names is the classic exploitation of archive expansion, and containment
    /// is the single most important control in that feature - this suite is what makes the claim testable
    /// rather than asserted. Every technique below is driven through a real `.zip`, `.7z`, or `.rar` built
    /// byte-for-byte by the small format builders beside this file, uploaded through the same HTTP surface
    /// a browser uses, and checked against where bytes actually landed - never against what error text
    /// came back.
    ///
    /// Coverage is not perfectly even across formats, and each gap below is a tooling limit, not an
    /// oversight:
    /// - `.rar` has no writer anywhere in this sandbox (SharpCompress is read-only for RAR, and no
    ///   rar/WinRAR binary is installed), so <see cref="RarFixtureBuilder"/> writes the format by hand and
    ///   gets full control - including both bomb shapes and a real symlink entry.
    /// - `.zip` is also hand-built (<see cref="ZipFixtureBuilder"/>), for the same reason `.rar` is: a
    ///   declared-size lie and a synthetic external-attributes symlink both need direct control over the
    ///   central directory record that no managed writer exposes.
    /// - `.7z` is built through SharpCompress's own <see cref="SharpCompress.Writers.SevenZip.SevenZipWriter"/>,
    ///   which is real but narrow: no external-attributes control (no symlink fixture), no declared-size
    ///   control (no bomb fixtures - the writer always writes the true size), no password support (no
    ///   encrypted fixture), and it silently strips a leading `/` or a drive prefix off an entry name
    ///   before it ever reaches the archive (no absolute/drive-rooted fixture - the hostile name never
    ///   survives being written). Relative traversal is unaffected and is covered for all three formats.
    /// - RAR's own STORE-method reader bounds a real extraction read at the header's declared UNP_SIZE
    ///   rather than the physical byte count that follows it, so a `.rar` cannot be made to produce more
    ///   bytes than it declares - the "understating bomb" fixture is `.zip`-only. The "declared-size bomb"
    ///   (refused before extraction ever reads a byte) does not depend on that behavior and is covered for
    ///   both `.zip` and `.rar`.
    /// - "self-containing archive" is approximated as a long, finite chain of same-named nested archives
    ///   (well past the test's own tightened depth ceiling) rather than a literal byte-identical
    ///   self-reference, which cannot exist for a finite archive (it would have to be larger than itself).
    ///   <see cref="ArchiveExpansionService"/> walks a chain and a true cycle through the exact same
    ///   per-item depth check, so the finite chain exercises the real guard.
    /// </summary>
    [Collection("Transfer")]
    public class ArchiveExpansionSafetyTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

        public Task InitializeAsync() => Task.CompletedTask;

        /// Cancel/Seal return before the pump's background drain finishes releasing the gate/lease - wait
        /// for that drain here so the next test in this shared collection starts from a clean fixture.
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        // ------------------------------------------------------------------------------------------
        // Escape techniques - refused for every entry name that tries to leave the destination.
        // ------------------------------------------------------------------------------------------

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Escape_RelativeTraversal_RefusedAndNothingLandsOnTheDevice(ArchiveFormat format) =>
            await AssertSoleEntryRefusedAsync(format, "relative-traversal", "../escape.sid", Bytes("ESCAPE"));

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Escape_DeeperRelativeTraversal_RefusedAndNothingLandsOnTheDevice(ArchiveFormat format) =>
            await AssertSoleEntryRefusedAsync(format, "deep-traversal", "a/../../escape.sid", Bytes("ESCAPE"));

        // Absolute and drive-rooted names do not survive being written into a `.7z` at all (see the
        // class doc) - both are covered for zip and rar only.
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Escape_AbsolutePathEntry_RefusedAndNothingLandsOnTheDevice(ArchiveFormat format) =>
            await AssertSoleEntryRefusedAsync(format, "absolute", "/rooted.sid", Bytes("ROOTED"));

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Escape_WindowsDriveRootedEntry_RefusedAndNothingLandsOnTheDevice(ArchiveFormat format) =>
            await AssertSoleEntryRefusedAsync(format, "drive-root", "C:\\rooted.sid", Bytes("ROOTED"));

        /// A symlink is refused outright by <see cref="TeensyRom.Api.Transfers.Archives.ArchiveExpansionService"/>
        /// regardless of where it points - resolve-then-check is impossible for a link that was never
        /// written to disk. The target here names an escape anyway, to document the technique the entry
        /// stands in for; it is never read.
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Escape_SymlinkEntryPointingOutsideItsRoot_RefusedAndNothingLandsOnTheDevice(ArchiveFormat format)
        {
            var archive = HostileArchiveFactory.Build(format, new EntrySpec("escape-link", Bytes("../../outside"), IsSymlink: true));
            await AssertArchiveCostsExactlyOneFailureAsync(format, "symlink", archive);
        }

        // ------------------------------------------------------------------------------------------
        // Size bombs - a lie about declared vs. actual uncompressed size, caught at two different points.
        // ------------------------------------------------------------------------------------------

        /// The declared size (50,000) alone exceeds the tightened ceiling (1,000) while the real bytes are
        /// four - if the guard fired only against real content, this archive would sail through harmlessly.
        /// It does not, which is only explainable by the pre-extraction declared-size check.
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Bomb_DeclaredSizeExceedsCeiling_RefusedBeforeExtractionEverStarts(ArchiveFormat format)
        {
            using var fixture = new LowExpansionCeilingTransferFixture();
            var device = fixture.DeviceManager.Devices[0];
            var port = fixture.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var archive = HostileArchiveFactory.Build(format, new EntrySpec("bomb.sid", Bytes("tiny"), DeclaredSizeOverride: 50_000));

            var (snapshot, _) = await RunArchiveJobToCompletionAsync(fixture, device.DeviceId, "bomb-declared", format, archive);

            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(0);
            port.Received.Count.Should().Be(priorCount, "the declared lie must be caught before any byte is streamed");
        }

        /// The declared size (5) is far under any ceiling - a front-door check alone would let this
        /// archive through. The real content (200,000 bytes) only gets caught because the walk keeps
        /// comparing bytes actually copied against the declaration while streaming, not just once up
        /// front. `.rar` cannot demonstrate this: its own store-method reader bounds a real extraction
        /// read at the declared UNP_SIZE, so it can never be made to produce more than it declares - the
        /// production guard this proves is unreachable for that format's reader, not absent. `.7z`'s
        /// writer cannot lie about a declared size at all (see the class doc).
        [Fact]
        public async Task Bomb_UnderstatingDeclaredSize_StoppedDuringExtractionNotJustRefusedUpFront()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var realContent = new byte[200_000];
            Array.Fill(realContent, (byte)'A');

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("bomb.sid", realContent, DeclaredSizeOverride: 5));

            var (snapshot, _) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, "bomb-understating", ArchiveFormat.Zip, archive);

            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(0);
            port.Received.Count.Should().Be(priorCount, "the oversized real content must never reach the device");
        }

        // ------------------------------------------------------------------------------------------
        // Unreadable archives - each costs exactly one failed file, never the job.
        // ------------------------------------------------------------------------------------------

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Corrupt_Archive_CostsOneFileAndTheJobStillCompletes(ArchiveFormat format) =>
            await AssertArchiveCostsExactlyOneFailureAsync(format, "corrupt", HostileArchiveFactory.BuildCorrupt(format));

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Truncated_Archive_CostsOneFileAndTheJobStillCompletes(ArchiveFormat format) =>
            await AssertArchiveCostsExactlyOneFailureAsync(format, "truncated", HostileArchiveFactory.BuildTruncated(format));

        /// `.7z` has no encrypted fixture - the writer exposes no password option at all (see the class doc).
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Encrypted_Archive_CostsOneFileAndTheJobStillCompletes(ArchiveFormat format)
        {
            var archive = HostileArchiveFactory.Build(format, new EntrySpec("secret.sid", Bytes("shh"), Encrypted: true));
            await AssertArchiveCostsExactlyOneFailureAsync(format, "encrypted", archive);
        }

        // ------------------------------------------------------------------------------------------
        // Structure - nesting, self-reference, and archives whose contents are entirely ignorable.
        // ------------------------------------------------------------------------------------------

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Nested_ThreeArchiveLayersDeep_ProducesTheFullyComposedRelativePath(ArchiveFormat format)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;
            var ext = HostileArchiveFactory.Extension(format);

            var level3 = HostileArchiveFactory.Build(format, new EntrySpec("deep.sid", Bytes("DEEP")));
            var level2 = HostileArchiveFactory.Build(format, new EntrySpec($"level3{ext}", level3));
            var top = HostileArchiveFactory.Build(format, new EntrySpec($"level2{ext}", level2));

            var (snapshot, destination) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, $"nested-{format}", format, top);

            snapshot.FilesFailed.Should().Be(0);
            snapshot.FilesSent.Should().Be(1);
            port.Received.Should().ContainSingle(r => r.Path == $"{destination}/pack/level2/level3/deep.sid");
            port.Received.Count.Should().Be(priorCount + 1);
        }

        /// A true byte-identical self-containing archive cannot exist (see the class doc) - a long,
        /// finite chain of same-named nested archives stands in for it, run against a fixture whose depth
        /// ceiling is tightened so the chain need not be deep enough to matter in practice.
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task SelfContaining_DeepRecursiveChain_TerminatesViaTheDepthGuardWithoutHangingTheJob(ArchiveFormat format)
        {
            using var fixture = new LowDepthTransferFixture();
            var device = fixture.DeviceManager.Devices[0];
            var port = fixture.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;
            var ext = HostileArchiveFactory.Extension(format);

            var chain = HostileArchiveFactory.Build(format, new EntrySpec("bottom.sid", Bytes("BOTTOM")));

            for (var i = 0; i < 6; i++)
            {
                chain = HostileArchiveFactory.Build(format, new EntrySpec($"self{ext}", chain));
            }

            var (snapshot, _) = await RunArchiveJobToCompletionAsync(fixture, device.DeviceId, "self-containing", format, chain);

            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(0);
            port.Received.Count.Should().Be(priorCount, "the chain must never reach its innermost content");
        }

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Mixed_SupportedUnsupportedAndEmptyDirectory_OnlyTheSupportedFileIsAdmitted(ArchiveFormat format)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var archive = HostileArchiveFactory.Build(format,
                new EntrySpec("song.sid", Bytes("TUNE")),
                new EntrySpec("readme.doc", Bytes("ignore me")),
                new EntrySpec("empty", [], IsDirectory: true));

            var (snapshot, destination) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, $"mixed-{format}", format, archive);

            snapshot.FilesFailed.Should().Be(0);
            snapshot.FilesSent.Should().Be(1);
            port.Received.Should().ContainSingle(r => r.Path == $"{destination}/pack/song.sid");
            port.Received.Count.Should().Be(priorCount + 1);
        }

        /// The unsupported file is ignored without comment everywhere else in this suite; here it is the
        /// archive's *only* entry, so nothing at all is left to admit - the archive itself costs one
        /// failed file rather than vanishing silently.
        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task EmptyUsableContent_ArchiveWithOnlyUnsupportedFiles_IsOneFailedFile(ArchiveFormat format)
        {
            var archive = HostileArchiveFactory.Build(format, new EntrySpec("readme.doc", Bytes("not usable")));
            await AssertArchiveCostsExactlyOneFailureAsync(format, "empty-usable", archive);
        }

        // ------------------------------------------------------------------------------------------
        // Cross-platform outcomes - the cases most likely to pass on the developer's machine and fail
        // on a user's.
        // ------------------------------------------------------------------------------------------

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task CaseCollision_EntriesDifferingOnlyInCase_ProducesExactlyOneWinnerAndOneFailure(ArchiveFormat format)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var archive = HostileArchiveFactory.Build(format,
                new EntrySpec("keep.sid", Bytes("A")),
                new EntrySpec("KEEP.sid", Bytes("B")));

            var (snapshot, destination) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, $"case-{format}", format, archive);

            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(1);
            port.Received.Count.Should().Be(priorCount + 1);
            port.Received.Should().Contain(r =>
                r.Path == $"{destination}/pack/keep.sid" || r.Path == $"{destination}/pack/KEEP.sid");
        }

        /// The archive's own uploaded name (not any entry inside it) is padded long enough that its
        /// derived content prefix, once concatenated with even a short entry name, exceeds
        /// <c>TransferPathResolver</c>'s 4096-character device-path ceiling - a limit no single archive
        /// entry name gets anywhere near on its own. This is reported through the ordinary per-entry
        /// failure path, not a crash or a hang.
        [Fact]
        public async Task DevicePathComposedFromNestingExceedsResolverLimit_IsReportedNotAnObscureFailure()
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var archive = HostileArchiveFactory.Build(ArchiveFormat.Zip, new EntrySpec("song.sid", Bytes("TUNE")));
            var longArchiveName = new string('a', 4090) + ".zip";

            var destination = "/music/archive-safety-long-device-path";
            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, destination));
            var jobId = createResponse.Content.JobId;

            var uploadResponse = await f.RawClient.PostAsync($"/api/transfers/{jobId}/files?path={longArchiveName}", RawBody(archive));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });

            var sweeper = GetSweeper(f);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                return (await GetJobAsync(f, jobId)).State == TransferJobState.Completed;
            });

            var snapshot = await GetJobAsync(f, jobId);
            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(0);
            port.Received.Count.Should().Be(priorCount);
        }

        // ------------------------------------------------------------------------------------------
        // Parity - the same content, packed three ways, produces the same successful outcome.
        // ------------------------------------------------------------------------------------------

        [Theory]
        [InlineData(ArchiveFormat.Zip)]
        [InlineData(ArchiveFormat.SevenZip)]
        [InlineData(ArchiveFormat.Rar)]
        public async Task Parity_SameEntryPackedPerFormat_ProducesTheSameSuccessfulOutcome(ArchiveFormat format)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var archive = HostileArchiveFactory.Build(format, new EntrySpec("song.sid", Bytes("TUNE-BYTES")));

            var (snapshot, destination) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, $"parity-{format}", format, archive);

            snapshot.FilesFailed.Should().Be(0);
            snapshot.FilesSent.Should().Be(1);
            port.Received.Count.Should().Be(priorCount + 1);

            var received = port.Received.Should().ContainSingle(r => r.Path == $"{destination}/pack/song.sid").Which;
            Encoding.UTF8.GetString(received.Body).Should().Be("TUNE-BYTES");
        }

        // ------------------------------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------------------------------

        private static byte[] Bytes(string s) => Encoding.UTF8.GetBytes(s);

        private static CreateJobRequest NewCreateRequest(string deviceId, string destination) => new()
        {
            DeviceId = deviceId,
            StorageType = TeensyStorageType.SD,
            Body = new CreateJobBody { DestinationDirectory = destination, ExpectedArchiveCount = 1 }
        };

        private static HttpContent RawBody(byte[] bytes)
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            return content;
        }

        private static async Task<TransferJobDto> GetJobAsync(TransferFixture fixture, string jobId)
        {
            var response = await fixture.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new() { JobId = jobId });
            return response.Content.Job;
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

        /// TransferPump.TryFinalize only ever runs again for a sealed job once something wakes it - the
        /// next item the pump itself drains, or this sweep. An archive whose every entry is refused
        /// enqueues nothing for the pump to drain, so sealing this suite's jobs immediately after upload
        /// (before expansion has even started) always lands in that gap; without driving the sweep
        /// directly here, completion would depend on the real 30-second timer instead of this suite's own
        /// poll interval.
        private static TransferJobSweeper GetSweeper(TransferFixture fixture) =>
            fixture.Services.GetServices<IHostedService>().OfType<TransferJobSweeper>().Single();

        /// <summary>
        /// Creates a job, uploads <paramref name="archiveBytes"/> as the job's sole archive under the
        /// fixed name <c>pack&lt;ext&gt;</c>, seals it, and waits for it to reach a terminal state.
        /// Every technique in this suite is a one-archive job, so this is the entire happy-path harness
        /// every test needs.
        /// </summary>
        private static async Task<(TransferJobDto Snapshot, string Destination)> RunArchiveJobToCompletionAsync(
            TransferFixture fixture, string deviceId, string destinationSuffix, ArchiveFormat format, byte[] archiveBytes)
        {
            var destination = $"/music/archive-safety-{destinationSuffix}";

            var createResponse = await fixture.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(deviceId, destination));
            var jobId = createResponse.Content.JobId;

            var uploadResponse = await fixture.RawClient.PostAsync(
                $"/api/transfers/{jobId}/files?path=pack{HostileArchiveFactory.Extension(format)}", RawBody(archiveBytes));
            uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            await fixture.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new() { JobId = jobId });

            var sweeper = GetSweeper(fixture);

            await WaitUntilAsync(async () =>
            {
                sweeper.Sweep();
                return (await GetJobAsync(fixture, jobId)).State == TransferJobState.Completed;
            });

            return (await GetJobAsync(fixture, jobId), destination);
        }

        /// A single hostile entry, alone in its own archive: refused, nothing admitted, nothing reaches
        /// the device.
        private async Task AssertSoleEntryRefusedAsync(ArchiveFormat format, string suffix, string entryName, byte[] content)
        {
            var archive = HostileArchiveFactory.Build(format, new EntrySpec(entryName, content));
            await AssertArchiveCostsExactlyOneFailureAsync(format, suffix, archive);
        }

        /// Shared assertion for every archive in this suite that should complete with exactly one failed
        /// file, nothing sent, and nothing new on the device.
        private async Task AssertArchiveCostsExactlyOneFailureAsync(ArchiveFormat format, string suffix, byte[] archiveBytes)
        {
            var device = f.DeviceManager.Devices[0];
            var port = f.DeviceManager.PortFor(device.DeviceId);
            var priorCount = port.Received.Count;

            var (snapshot, _) = await RunArchiveJobToCompletionAsync(f, device.DeviceId, suffix, format, archiveBytes);

            snapshot.FilesFailed.Should().Be(1);
            snapshot.FilesSent.Should().Be(0);
            port.Received.Count.Should().Be(priorCount, "nothing from a refused archive may ever reach the device");
        }

        private sealed class LowExpansionCeilingTransferFixture() : TransferFixture(o => o.MaxExpandedBytesPerArchive = 1_000)
        {
        }

        private sealed class LowDepthTransferFixture() : TransferFixture(o => o.MaxExpansionDepth = 3)
        {
        }
    }
}
