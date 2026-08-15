using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferAdmissionTests : IDisposable
{
    private readonly ITransferCapacityGate _gate = Substitute.For<ITransferCapacityGate>();
    private readonly ITransferStagingStore _staging = Substitute.For<ITransferStagingStore>();
    private readonly ITransferQueue _queue = Substitute.For<ITransferQueue>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly List<string> _tempFiles = [];

    private TransferAdmission NewAdmission() => new(_gate, _staging, _queue, _notifier, _registry);

    private static TransferJob NewJob(int expectedArchiveCount = 0) =>
        new("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions(),
            expectedArchiveCount: expectedArchiveCount);

    // AdmitAsync reads the true size back off disk, so every staged path used in these tests must be a
    // real file - a mock can hand back a path, but not the FileInfo.Length behind it.
    private string NewStagedFile(int sizeBytes)
    {
        var path = Path.GetTempFileName();
        File.WriteAllBytes(path, new byte[sizeBytes]);
        _tempFiles.Add(path);
        return path;
    }

    /// Passes actualBytes straight through as the effective reservation - the clamping arithmetic itself
    /// is TransferCapacityGate's own suite; here it only needs to be a believable pass-through.
    private void StubGateAdjustsToActual() =>
        _gate.Adjust(Arg.Any<long>(), Arg.Any<long>()).Returns(callInfo => (long)callInfo[1]);

    public void Dispose()
    {
        foreach (var path in _tempFiles.Where(File.Exists))
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task AdmitAsync_UnusableRelativePath_ReturnsRejectedWithResolverMessageAndStagesNothing()
    {
        var admission = NewAdmission();
        var job = NewJob();

        var result = await admission.AdmitAsync(job, Stream.Null, "../escape.prg", 10, countAsReceived: true, CancellationToken.None);

        result.Accepted.Should().BeFalse();
        result.Error.Should().Be("Relative path must not contain '.' or '..' segments.");
        await _staging.DidNotReceiveWithAnyArgs().StageAsync(default!, default!, default);
        await _gate.DidNotReceiveWithAnyArgs().WaitForSlotAsync(default, default);
    }

    [Fact]
    public async Task AdmitAsync_ArchiveFreeJob_StagesAdjustsEnqueuesNotifiesAndTransitionsToReceiving()
    {
        var admission = NewAdmission();
        var job = NewJob();
        var stagingPath = NewStagedFile(sizeBytes: 42);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(stagingPath);
        _gate.Adjust(100, 42).Returns(42L);

        var result = await admission.AdmitAsync(job, Stream.Null, "game.prg", 100, countAsReceived: true, CancellationToken.None);

        result.Accepted.Should().BeTrue();
        result.File!.SizeBytes.Should().Be(42);
        result.File.ReservedBytes.Should().Be(42);
        result.File.RelativePath.Should().Be("game.prg");

        await _gate.Received(1).WaitForSlotAsync(100, Arg.Any<CancellationToken>());
        await _queue.Received(1).EnqueueAsync(job.DeviceId, result.File, Arg.Any<CancellationToken>());
        _notifier.Received(1).JobChanged(job);
        job.State.Should().Be(TransferJobState.Receiving);
        job.PendingCount.Should().Be(1);
        job.ToSnapshot().FilesReceived.Should().Be(1);
    }

    [Fact]
    public async Task AdmitAsync_CountAsReceivedFalse_RaisesExpandedCountAndPendingButNotFilesReceived()
    {
        var admission = NewAdmission();
        var job = NewJob();
        var stagingPath = NewStagedFile(sizeBytes: 7);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(stagingPath);
        _gate.Adjust(50, 7).Returns(7L);

        await admission.AdmitAsync(job, Stream.Null, "extracted.prg", 50, countAsReceived: false, CancellationToken.None);

        job.PendingCount.Should().Be(1);
        var snapshot = job.ToSnapshot();
        snapshot.FilesReceived.Should().Be(0);
        snapshot.ExpandedFileCount.Should().Be(1);
    }

    [Fact]
    public async Task AdmitAsync_ExpansionOutstanding_HoldsFileInsteadOfEnqueuingButStillAccepts()
    {
        var admission = NewAdmission();
        var job = NewJob(expectedArchiveCount: 1);
        job.OnArchiveAccepted();
        var stagingPath = NewStagedFile(sizeBytes: 5);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(stagingPath);
        StubGateAdjustsToActual();

        var result = await admission.AdmitAsync(job, Stream.Null, "entry.prg", 20, countAsReceived: false, CancellationToken.None);

        result.Accepted.Should().BeTrue();
        await _queue.DidNotReceiveWithAnyArgs().EnqueueAsync(default!, default!, default);
        job.PendingCount.Should().Be(1);
    }

    [Fact]
    public async Task ReleaseHeldAsync_DrainsHeldFilesInAdmissionOrder_ThenLaterAdmissionsGoStraightToQueue()
    {
        var admission = NewAdmission();
        var job = NewJob(expectedArchiveCount: 1);
        job.OnArchiveAccepted();
        _registry.Get(job.JobId).Returns(job);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns(NewStagedFile(3), NewStagedFile(4), NewStagedFile(5));
        StubGateAdjustsToActual();

        var first = await admission.AdmitAsync(job, Stream.Null, "one.prg", 10, countAsReceived: false, CancellationToken.None);
        var second = await admission.AdmitAsync(job, Stream.Null, "two.prg", 10, countAsReceived: false, CancellationToken.None);

        await _queue.DidNotReceiveWithAnyArgs().EnqueueAsync(default!, default!, default);

        job.OnArchiveExpansionFinished();
        job.HasExpansionOutstanding.Should().BeFalse();

        await admission.ReleaseHeldAsync(job.JobId, CancellationToken.None);
        var third = await admission.AdmitAsync(job, Stream.Null, "three.prg", 10, countAsReceived: false, CancellationToken.None);

        Received.InOrder(() =>
        {
            _queue.EnqueueAsync(job.DeviceId, first.File!, Arg.Any<CancellationToken>());
            _queue.EnqueueAsync(job.DeviceId, second.File!, Arg.Any<CancellationToken>());
            _queue.EnqueueAsync(job.DeviceId, third.File!, Arg.Any<CancellationToken>());
        });
    }

    /// <summary>
    /// The seam the handoff calls out: an admission that lands while ReleaseHeldAsync is mid-drain -
    /// after the held item it is currently awaiting the enqueue of has already been dequeued, but before
    /// the job's key is removed from the hold - must still be enqueued rather than stranded.
    /// </summary>
    [Fact]
    public async Task ReleaseHeldAsync_AdmissionRacingTheDrain_IsNotStranded()
    {
        var admission = NewAdmission();
        var job = NewJob(expectedArchiveCount: 1);
        job.OnArchiveAccepted();
        _registry.Get(job.JobId).Returns(job);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns(NewStagedFile(3), NewStagedFile(4));
        StubGateAdjustsToActual();

        var firstAdmit = await admission.AdmitAsync(job, Stream.Null, "one.prg", 10, countAsReceived: false, CancellationToken.None);

        var releaseStarted = new TaskCompletionSource();
        var letReleaseFinish = new TaskCompletionSource();

        _queue.EnqueueAsync(job.DeviceId, firstAdmit.File!, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                releaseStarted.TrySetResult();
                return new ValueTask(letReleaseFinish.Task);
            });

        var releaseTask = admission.ReleaseHeldAsync(job.JobId, CancellationToken.None);
        await releaseStarted.Task;

        // Still holds job.HasExpansionOutstanding == true here - this is the concurrent admission the
        // rule in P02-T01 says must never happen once P02-T02 lands, but it is exactly what exercises the
        // re-drain safety net this task is responsible for.
        var secondAdmitTask = admission.AdmitAsync(job, Stream.Null, "two.prg", 10, countAsReceived: false, CancellationToken.None);

        letReleaseFinish.SetResult();
        await releaseTask;
        var secondAdmit = await secondAdmitTask;

        await _queue.Received(1).EnqueueAsync(job.DeviceId, firstAdmit.File!, Arg.Any<CancellationToken>());
        await _queue.Received(1).EnqueueAsync(job.DeviceId, secondAdmit.File!, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DiscardHeld_HeldFiles_ReleasesCapacityDeletesStagedFilesAndDropsPendingCount()
    {
        var admission = NewAdmission();
        var job = NewJob(expectedArchiveCount: 1);
        job.OnArchiveAccepted();
        _registry.Get(job.JobId).Returns(job);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns(NewStagedFile(3), NewStagedFile(4));
        StubGateAdjustsToActual();

        var first = await admission.AdmitAsync(job, Stream.Null, "one.prg", 10, countAsReceived: false, CancellationToken.None);
        var second = await admission.AdmitAsync(job, Stream.Null, "two.prg", 10, countAsReceived: false, CancellationToken.None);
        job.PendingCount.Should().Be(2);

        admission.DiscardHeld(job.JobId);

        _staging.Received(1).DeleteStagedFile(first.File!.StagingPath);
        _staging.Received(1).DeleteStagedFile(second.File!.StagingPath);
        _gate.Received(1).ReleaseSlot(first.File.ReservedBytes);
        _gate.Received(1).ReleaseSlot(second.File.ReservedBytes);
        job.PendingCount.Should().Be(0);

        await admission.ReleaseHeldAsync(job.JobId, CancellationToken.None);
        await _queue.DidNotReceiveWithAnyArgs().EnqueueAsync(default!, default!, default);
    }

    [Fact]
    public async Task AdmitAsync_StagingThrows_ReleasesRawReservationAndAttemptsNoDelete()
    {
        var admission = NewAdmission();
        var job = NewJob();
        _staging.When(x => x.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>()))
            .Do(_ => throw new IOException("stream throws mid-copy"));

        Func<Task> act = () => admission.AdmitAsync(job, Stream.Null, "game.prg", 123, countAsReceived: true, CancellationToken.None);

        await act.Should().ThrowAsync<IOException>();
        _gate.Received(1).ReleaseSlot(123);
        _staging.DidNotReceiveWithAnyArgs().DeleteStagedFile(default!);
        job.ToSnapshot().FilesReceived.Should().Be(0);
    }

    [Fact]
    public async Task AdmitAsync_FailureAfterAdjust_ReleasesEffectiveReservationNotRawAndDeletesStagedFile()
    {
        var admission = NewAdmission();
        var job = NewJob();
        var stagingPath = NewStagedFile(sizeBytes: 30);
        _staging.StageAsync(job.JobId, Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(stagingPath);
        _gate.Adjust(500, 30).Returns(30L);
        _queue.When(x => x.EnqueueAsync(job.DeviceId, Arg.Any<StagedFile>(), Arg.Any<CancellationToken>()))
            .Do(_ => throw new InvalidOperationException("device queue exploded"));

        Func<Task> act = () => admission.AdmitAsync(job, Stream.Null, "game.prg", 500, countAsReceived: true, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _gate.Received(1).ReleaseSlot(30);
        _gate.DidNotReceive().ReleaseSlot(500);
        _staging.Received(1).DeleteStagedFile(stagingPath);
    }
}
