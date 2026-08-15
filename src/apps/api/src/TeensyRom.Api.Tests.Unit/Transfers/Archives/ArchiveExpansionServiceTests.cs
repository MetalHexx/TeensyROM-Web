using System.Text;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers.Archives;

/// <summary>
/// Exercises the walk in isolation against <see cref="FakeArchiveReader"/> - a hand-built double rather
/// than a mock, since the walk drives <see cref="IArchiveReader.ExtractAsync"/>'s callback recursively
/// through nested archives. Real fixture archives belong to P05-T01; this suite covers the walk's own
/// logic only. <see cref="ITransferScratchStore"/> is the real implementation against a temp root, since
/// faking its reservation arithmetic would just re-implement it; <see cref="ITransferAdmission"/> and
/// <see cref="ITransferJobRegistry"/> are mocked to assert the calls and ordering the walk owes them.
/// </summary>
public sealed class ArchiveExpansionServiceTests : IDisposable
{
    private readonly FakeArchiveReader _reader = new();
    private readonly ITransferAdmission _admission = Substitute.For<ITransferAdmission>();
    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly TransferOptions _options;
    private readonly ITransferScratchStore _scratch;

    public ArchiveExpansionServiceTests()
    {
        _options = new TransferOptions
        {
            ScratchRoot = Path.Combine(Path.GetTempPath(), "archive-expansion-tests-" + Guid.NewGuid())
        };
        _scratch = new TransferScratchStore(_options, _log);

        _admission.AdmitAsync(Arg.Any<TransferJob>(), Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => Task.FromResult(new AdmissionResult(
                new StagedFile("job", "staged", (string)callInfo[2], new FilePath("/x"), TeensyStorageType.SD, (long)callInfo[3], (long)callInfo[3]),
                null)));
    }

    public void Dispose()
    {
        if (Directory.Exists(_options.ScratchRoot))
        {
            Directory.Delete(_options.ScratchRoot, recursive: true);
        }
    }

    private ArchiveExpansionService NewService() => new(_reader, _scratch, _admission, _registry, _options, _log);

    private TransferJob NewJob(int expectedArchiveCount = 1)
    {
        var job = new TransferJob("device-1", TeensyStorageType.SD, new DirectoryPath("/music"), _options, expectedArchiveCount: expectedArchiveCount);
        _registry.Get(job.JobId).Returns(job);
        return job;
    }

    /// One archive uploaded and handed to expansion - the slot ExpandAsync must release exactly once.
    private static void AcceptArchive(TransferJob job)
    {
        job.OnFileReceived(1);
        job.OnArchiveAccepted();
    }

    private string WriteTopLevelArchive(string jobId, string marker)
    {
        var jobDir = _scratch.EnsureJobDirectory(jobId);
        var path = Path.Combine(jobDir, Guid.NewGuid() + ".zip");
        File.WriteAllText(path, marker);
        return path;
    }

    [Fact]
    public async Task ExpandAsync_NestedArchive_PreservesLayoutAndAdmitsOnlyAfterReleasingHeldUploads()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "TOP");
        var sidContent = new byte[] { 1, 2, 3, 4, 5 };
        var nestedMarkerBytes = Encoding.UTF8.GetBytes("NESTED");

        _reader.Define("TOP", new FakeArchive
        {
            Entries =
            [
                new FakeEntry("a/b.sid", sidContent.Length, sidContent),
                new FakeEntry("demos/pack.rar", nestedMarkerBytes.Length, nestedMarkerBytes)
            ],
            DeclaredUncompressedBytes = sidContent.Length + nestedMarkerBytes.Length
        });

        var innerContent = new byte[] { 9, 9 };
        _reader.Define("NESTED", new FakeArchive
        {
            Entries = [new FakeEntry("song.sid", innerContent.Length, innerContent)],
            DeclaredUncompressedBytes = innerContent.Length
        });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "folder/pack.zip"), CancellationToken.None);

        await _admission.Received(1).AdmitAsync(
            job, Arg.Any<Stream>(), "folder/pack/a/b.sid", sidContent.Length, false, Arg.Any<CancellationToken>());
        await _admission.Received(1).AdmitAsync(
            job, Arg.Any<Stream>(), "folder/pack/demos/pack/song.sid", innerContent.Length, false, Arg.Any<CancellationToken>());

        Received.InOrder(() =>
        {
            _admission.ReleaseHeldAsync(job.JobId, Arg.Any<CancellationToken>());
            _admission.AdmitAsync(job, Arg.Any<Stream>(), "folder/pack/a/b.sid", Arg.Any<long>(), false, Arg.Any<CancellationToken>());
            _admission.AdmitAsync(job, Arg.Any<Stream>(), "folder/pack/demos/pack/song.sid", Arg.Any<long>(), false, Arg.Any<CancellationToken>());
        });

        job.PendingCount.Should().Be(0);
        job.HasExpansionOutstanding.Should().BeFalse();
        _scratch.BytesInUse.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_MultipleArchivesForSameJob_DefersEverythingUntilTheLastOneFinishes()
    {
        var job = NewJob(expectedArchiveCount: 2);
        AcceptArchive(job);
        AcceptArchive(job);

        var path1 = WriteTopLevelArchive(job.JobId, "ONE");
        var path2 = WriteTopLevelArchive(job.JobId, "TWO");
        var content1 = new byte[] { 1 };
        var content2 = new byte[] { 2 };

        _reader.Define("ONE", new FakeArchive { Entries = [new FakeEntry("one.sid", content1.Length, content1)], DeclaredUncompressedBytes = content1.Length });
        _reader.Define("TWO", new FakeArchive { Entries = [new FakeEntry("two.sid", content2.Length, content2)], DeclaredUncompressedBytes = content2.Length });

        var service = NewService();

        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, path1, "one.zip"), CancellationToken.None);

        await _admission.DidNotReceiveWithAnyArgs().AdmitAsync(default!, default!, default!, default, default, default);
        await _admission.DidNotReceiveWithAnyArgs().ReleaseHeldAsync(default!, default);
        job.HasExpansionOutstanding.Should().BeTrue();

        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, path2, "two.zip"), CancellationToken.None);

        job.HasExpansionOutstanding.Should().BeFalse();
        await _admission.Received(1).ReleaseHeldAsync(job.JobId, Arg.Any<CancellationToken>());
        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "one/one.sid", content1.Length, false, Arg.Any<CancellationToken>());
        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "two/two.sid", content2.Length, false, Arg.Any<CancellationToken>());
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_DepthExceeded_FailsOnlyTheOverDeepArchive()
    {
        var job = NewJob();
        AcceptArchive(job);
        _options.MaxExpansionDepth = 1;

        var topPath = WriteTopLevelArchive(job.JobId, "TOP");
        var n1Bytes = Encoding.UTF8.GetBytes("N1");
        var n2Bytes = Encoding.UTF8.GetBytes("N2");

        _reader.Define("TOP", new FakeArchive { Entries = [new FakeEntry("a.rar", n1Bytes.Length, n1Bytes)], DeclaredUncompressedBytes = n1Bytes.Length });
        _reader.Define("N1", new FakeArchive { Entries = [new FakeEntry("b.rar", n2Bytes.Length, n2Bytes)], DeclaredUncompressedBytes = n2Bytes.Length });
        _reader.Define("N2", new FakeArchive { Entries = [], DeclaredUncompressedBytes = 0 });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "top.zip"), CancellationToken.None);

        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "top/a/b.rar" && !f.Success);
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_SelfContainingArchive_TerminatesWithoutRecursion()
    {
        var job = NewJob();
        AcceptArchive(job);
        _options.MaxExpansionDepth = 5;

        var topPath = WriteTopLevelArchive(job.JobId, "SELF");
        var selfBytes = Encoding.UTF8.GetBytes("SELF");

        _reader.Define("SELF", new FakeArchive { Entries = [new FakeEntry("self.zip", selfBytes.Length, selfBytes)], DeclaredUncompressedBytes = selfBytes.Length });

        var service = NewService();
        var act = async () => await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "self.zip"), CancellationToken.None);

        await act.Should().NotThrowAsync();
        job.PendingCount.Should().Be(0);
        job.ToSnapshot().Failures.Should().ContainSingle();
    }

    [Fact]
    public async Task ExpandAsync_ActualBytesExceedDeclaredTotal_StopsArchiveMidExtractionButKeepsEarlierEntries()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "LIAR");
        var first = new byte[] { 1, 2, 3 };
        var second = new byte[] { 4, 5, 6, 7, 8 };

        _reader.Define("LIAR", new FakeArchive
        {
            Entries =
            [
                new FakeEntry("a.sid", first.Length, first),
                new FakeEntry("b.sid", 1, second) // declares 1 byte, actually delivers 5
            ],
            DeclaredUncompressedBytes = 4 // understated relative to what extraction actually produces
        });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "liar.zip"), CancellationToken.None);

        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "liar/a.sid", first.Length, false, Arg.Any<CancellationToken>());
        await _admission.DidNotReceive().AdmitAsync(job, Arg.Any<Stream>(), "liar/b.sid", Arg.Any<long>(), false, Arg.Any<CancellationToken>());
        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "liar.zip");
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_PerEntryRefusals_RecordFailuresWithoutAbortingWalkAndPendingCountStaysNonNegative()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "MIXED");
        var okContent = new byte[] { 9, 9 };

        _reader.Define("MIXED", new FakeArchive
        {
            Entries =
            [
                new FakeEntry("link.sid", 1, [0], IsSymlink: true),
                new FakeEntry("../escape.sid", 1, [0]),
                new FakeEntry("keep.sid", okContent.Length, okContent),
                new FakeEntry("KEEP.sid", okContent.Length, okContent) // case-collides with keep.sid
            ],
            DeclaredUncompressedBytes = 1 + 1 + okContent.Length + okContent.Length
        });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "mixed.zip"), CancellationToken.None);

        job.ToSnapshot().Failures.Should().HaveCount(3);
        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "mixed/keep.sid", okContent.Length, false, Arg.Any<CancellationToken>());
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_UnexpectedExceptionInOneNestedArchive_WalkContinuesAndReleasesSlotExactlyOnce()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "TOP");
        var goodBytes = Encoding.UTF8.GetBytes("GOOD");
        var boomBytes = Encoding.UTF8.GetBytes("BOOM");

        _reader.Define("TOP", new FakeArchive
        {
            Entries =
            [
                new FakeEntry("good.rar", goodBytes.Length, goodBytes),
                new FakeEntry("boom.rar", boomBytes.Length, boomBytes)
            ],
            DeclaredUncompressedBytes = goodBytes.Length + boomBytes.Length
        });

        var innerContent = new byte[] { 7 };
        _reader.Define("GOOD", new FakeArchive { Entries = [new FakeEntry("inner.sid", innerContent.Length, innerContent)], DeclaredUncompressedBytes = innerContent.Length });
        _reader.Define("BOOM", new FakeArchive { Entries = [], DeclaredUncompressedBytes = 0, ThrowFromExtract = new InvalidOperationException("kaboom") });

        var service = NewService();
        var act = async () => await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "top.zip"), CancellationToken.None);

        await act.Should().NotThrowAsync();
        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "top/good/inner.sid", innerContent.Length, false, Arg.Any<CancellationToken>());
        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "top/boom.rar" && f.Error == "kaboom");
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_CumulativeVolumeExceedsCeiling_FailsArchiveAndReservesNothing()
    {
        var job = NewJob();
        AcceptArchive(job);
        _options.MaxExpandedBytesPerArchive = 10;

        var topPath = WriteTopLevelArchive(job.JobId, "BIG");
        _reader.Define("BIG", new FakeArchive { Entries = [], DeclaredUncompressedBytes = 1000 });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "big.zip"), CancellationToken.None);

        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "big.zip");
        _scratch.BytesInUse.Should().Be(0);
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_CorruptArchive_FailsJustThatArchive()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "CORRUPT");
        _reader.Define("CORRUPT", new FakeArchive { Entries = [], DeclaredUncompressedBytes = 0, ThrowOnReadIndex = true });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "corrupt.zip"), CancellationToken.None);

        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "corrupt.zip");
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_ScratchRefused_FailsArchiveAndPendingCountStaysNonNegative()
    {
        var job = NewJob();
        AcceptArchive(job);
        _options.MaxScratchBytes = 1;

        var topPath = WriteTopLevelArchive(job.JobId, "TOOBIG");
        _reader.Define("TOOBIG", new FakeArchive { Entries = [], DeclaredUncompressedBytes = 1000 });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "toobig.zip"), CancellationToken.None);

        job.ToSnapshot().Failures.Should().ContainSingle(f => f.RelativePath == "toobig.zip");
        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task ExpandAsync_ReportsAbsoluteRunningByteTotalForCurrentArchive()
    {
        var job = NewJob();
        AcceptArchive(job);

        var topPath = WriteTopLevelArchive(job.JobId, "PROGRESS");
        var first = new byte[] { 1, 2, 3 };
        var second = new byte[] { 4, 5, 6, 7 };

        _reader.Define("PROGRESS", new FakeArchive
        {
            Entries = [new FakeEntry("a.sid", first.Length, first), new FakeEntry("b.sid", second.Length, second)],
            DeclaredUncompressedBytes = first.Length + second.Length
        });

        var service = NewService();
        await service.ExpandAsync(new ArchiveExpansionRequest(job.JobId, topPath, "progress.zip"), CancellationToken.None);

        var snapshot = job.ToSnapshot();
        snapshot.ExpansionBytesDeclared.Should().Be(first.Length + second.Length);
        snapshot.ExpansionBytesWritten.Should().Be(first.Length + second.Length);
    }

    [Fact]
    public async Task ExpandAsync_JobPurged_DeletesScratchArchiveAndReturnsQuietlyWithoutAdmitting()
    {
        const string jobId = "dead-job";
        _registry.Get(jobId).Returns((TransferJob?)null);
        var topPath = WriteTopLevelArchive(jobId, "WHATEVER");

        var service = NewService();
        var act = async () => await service.ExpandAsync(new ArchiveExpansionRequest(jobId, topPath, "whatever.zip"), CancellationToken.None);

        await act.Should().NotThrowAsync();
        File.Exists(topPath).Should().BeFalse();
        await _admission.DidNotReceiveWithAnyArgs().AdmitAsync(default!, default!, default!, default, default, default);
        await _admission.DidNotReceiveWithAnyArgs().ReleaseHeldAsync(default!, default);
    }

    private sealed record FakeEntry(string Path, long DeclaredSize, byte[] Content, bool IsSymlink = false);

    private sealed class FakeArchive
    {
        public required IReadOnlyList<FakeEntry> Entries { get; init; }
        public required long DeclaredUncompressedBytes { get; init; }
        public bool ThrowOnReadIndex { get; init; }
        public Exception? ThrowFromExtract { get; init; }
    }

    /// <summary>
    /// Keys fixture archives by a marker string embedded as the scratch file's own bytes rather than by
    /// path, since a nested archive's scratch path is only assigned at runtime by
    /// <see cref="ITransferScratchStore.NewScratchFilePath"/> and is never known in advance.
    /// </summary>
    private sealed class FakeArchiveReader : IArchiveReader
    {
        private readonly Dictionary<string, FakeArchive> _byMarker = new();

        public void Define(string marker, FakeArchive archive) => _byMarker[marker] = archive;

        public bool IsArchiveExtension(string relativePath) =>
            relativePath.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) ||
            relativePath.EndsWith(".rar", StringComparison.OrdinalIgnoreCase) ||
            relativePath.EndsWith(".7z", StringComparison.OrdinalIgnoreCase);

        public ArchiveIndex ReadIndex(string archivePath)
        {
            var archive = Resolve(archivePath);

            if (archive.ThrowOnReadIndex)
            {
                throw new ArchiveReadException($"corrupt fixture at '{archivePath}'");
            }

            return new ArchiveIndex(
                archive.Entries.Select(e => new ArchiveEntryInfo(e.Path, e.DeclaredSize, false, e.IsSymlink)).ToList(),
                archive.DeclaredUncompressedBytes);
        }

        public async Task ExtractAsync(string archivePath, Func<ArchiveEntryInfo, Stream, CancellationToken, Task> onEntry, CancellationToken ct)
        {
            var archive = Resolve(archivePath);

            if (archive.ThrowFromExtract is not null)
            {
                throw archive.ThrowFromExtract;
            }

            foreach (var entry in archive.Entries)
            {
                using var stream = new MemoryStream(entry.Content);
                await onEntry(new ArchiveEntryInfo(entry.Path, entry.DeclaredSize, false, entry.IsSymlink), stream, ct);
            }
        }

        private FakeArchive Resolve(string archivePath)
        {
            var marker = File.ReadAllText(archivePath);

            return _byMarker.TryGetValue(marker, out var archive)
                ? archive
                : throw new ArchiveReadException($"no fixture registered for marker '{marker}' at '{archivePath}'");
        }
    }
}
