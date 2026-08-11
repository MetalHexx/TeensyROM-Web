using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferJobTests
{
    private static TransferJob NewJob(TransferOptions? options = null, Func<DateTime>? clock = null) =>
        new("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), options ?? new TransferOptions(), clock);

    private static TransferFileCompleted Success(TransferJob job, string path, long sizeBytes) =>
        new(job.JobId, path, $"/transfers/{path}", true, null, sizeBytes);

    private static TransferFileCompleted Failure(TransferJob job, string path, string error, long sizeBytes) =>
        new(job.JobId, path, $"/transfers/{path}", false, error, sizeBytes);

    /// <summary>
    /// Drives a fresh job to the requested state via a legal path, so the transition table test can
    /// exercise every (from, to) pair using only the public API.
    /// </summary>
    private static TransferJob JobIn(TransferJobState state)
    {
        var job = NewJob();

        switch (state)
        {
            case TransferJobState.Created:
                break;
            case TransferJobState.Receiving:
                job.TryTransitionTo(TransferJobState.Receiving);
                break;
            case TransferJobState.Sealed:
                job.TryTransitionTo(TransferJobState.Receiving);
                job.TryTransitionTo(TransferJobState.Sealed);
                break;
            case TransferJobState.Completed:
                job.TryTransitionTo(TransferJobState.Receiving);
                job.TryTransitionTo(TransferJobState.Sealed);
                job.TryTransitionTo(TransferJobState.Completed);
                break;
            case TransferJobState.Cancelling:
                job.TryTransitionTo(TransferJobState.Cancelling);
                break;
            case TransferJobState.Cancelled:
                job.TryTransitionTo(TransferJobState.Cancelling);
                job.TryTransitionTo(TransferJobState.Cancelled);
                break;
            case TransferJobState.Abandoned:
                job.TryTransitionTo(TransferJobState.Abandoned);
                break;
            case TransferJobState.Aborted:
                job.TryTransitionTo(TransferJobState.Aborted);
                break;
        }

        return job;
    }

    private static readonly HashSet<(TransferJobState From, TransferJobState To)> LegalEdges =
    [
        (TransferJobState.Created, TransferJobState.Receiving),
        (TransferJobState.Created, TransferJobState.Cancelling),
        (TransferJobState.Created, TransferJobState.Abandoned),
        (TransferJobState.Created, TransferJobState.Aborted),
        (TransferJobState.Receiving, TransferJobState.Sealed),
        (TransferJobState.Receiving, TransferJobState.Cancelling),
        (TransferJobState.Receiving, TransferJobState.Abandoned),
        (TransferJobState.Receiving, TransferJobState.Aborted),
        (TransferJobState.Sealed, TransferJobState.Completed),
        (TransferJobState.Sealed, TransferJobState.Cancelling),
        (TransferJobState.Sealed, TransferJobState.Aborted),
        (TransferJobState.Cancelling, TransferJobState.Cancelled)
    ];

    public static IEnumerable<object[]> AllTransitionPairs()
    {
        foreach (var from in Enum.GetValues<TransferJobState>())
        {
            foreach (var to in Enum.GetValues<TransferJobState>())
            {
                yield return [from, to, LegalEdges.Contains((from, to))];
            }
        }
    }

    [Theory]
    [MemberData(nameof(AllTransitionPairs))]
    public void TryTransitionTo_EveryStatePair_MatchesLegalEdgeTable(TransferJobState from, TransferJobState to, bool expectedLegal)
    {
        var job = JobIn(from);

        var result = job.TryTransitionTo(to);

        result.Should().Be(expectedLegal);
        job.State.Should().Be(expectedLegal ? to : from);
    }

    [Theory]
    [InlineData(TransferJobState.Completed)]
    [InlineData(TransferJobState.Cancelled)]
    [InlineData(TransferJobState.Abandoned)]
    [InlineData(TransferJobState.Aborted)]
    public void IsTerminal_TerminalStates_ReturnsTrue(TransferJobState state) =>
        TransferJob.IsTerminal(state).Should().BeTrue();

    [Theory]
    [InlineData(TransferJobState.Created)]
    [InlineData(TransferJobState.Receiving)]
    [InlineData(TransferJobState.Sealed)]
    [InlineData(TransferJobState.Cancelling)]
    public void IsTerminal_NonTerminalStates_ReturnsFalse(TransferJobState state) =>
        TransferJob.IsTerminal(state).Should().BeFalse();

    [Fact]
    public void OnFileReceived_IncrementsReceivedAndPending()
    {
        var job = NewJob();

        job.OnFileReceived(100);
        job.OnFileReceived(200);

        job.PendingCount.Should().Be(2);
        job.ToSnapshot().FilesReceived.Should().Be(2);
    }

    [Fact]
    public void OnFileSent_IncrementsSentAndBytesAndDecrementsPending()
    {
        var job = NewJob();
        job.OnFileReceived(100);
        job.OnFileReceived(200);

        job.OnFileSent(Success(job, "a.prg", 100));

        job.PendingCount.Should().Be(1);
        var snapshot = job.ToSnapshot();
        snapshot.FilesSent.Should().Be(1);
        snapshot.BytesSent.Should().Be(100);
    }

    [Fact]
    public void OnFileFailed_IncrementsFailedAndRecordsFailure_AndDecrementsPending()
    {
        var job = NewJob();
        job.OnFileReceived(50);
        var failure = Failure(job, "a.prg", "disk full", 50);

        job.OnFileFailed(failure);

        job.PendingCount.Should().Be(0);
        var snapshot = job.ToSnapshot();
        snapshot.FilesFailed.Should().Be(1);
        snapshot.Failures.Should().ContainSingle().Which.Should().Be(failure);
    }

    [Fact]
    public void OnFileDropped_DecrementsPendingOnly_WithoutTouchingActivity()
    {
        var job = NewJob();
        job.OnFileReceived(10);
        var beforeDrop = job.LastActivityUtc;

        job.OnFileDropped();

        job.PendingCount.Should().Be(0);
        job.LastActivityUtc.Should().Be(beforeDrop);
        var snapshot = job.ToSnapshot();
        snapshot.FilesSent.Should().Be(0);
        snapshot.FilesFailed.Should().Be(0);
    }

    [Fact]
    public void PendingCount_ReachesZero_AfterEqualReceivedAndSent()
    {
        var job = NewJob();
        job.OnFileReceived(10);
        job.OnFileReceived(20);

        job.OnFileSent(Success(job, "a.prg", 10));
        job.OnFileSent(Success(job, "b.prg", 20));

        job.PendingCount.Should().Be(0);
    }

    [Fact]
    public void Touch_AdvancesLastActivityUtc()
    {
        var job = NewJob();
        var before = job.LastActivityUtc;

        Thread.Sleep(5);
        job.Touch();

        job.LastActivityUtc.Should().BeAfter(before);
    }

    [Fact]
    public void ToSnapshot_TotalFiles_IsNullBeforeSealing()
    {
        var job = NewJob();
        job.OnFileReceived(10);

        job.ToSnapshot().TotalFiles.Should().BeNull();
    }

    [Fact]
    public void ToSnapshot_TotalFiles_IsFilesReceivedAfterSealing()
    {
        var job = NewJob();
        job.OnFileReceived(10);
        job.OnFileReceived(20);
        job.TryTransitionTo(TransferJobState.Receiving);
        job.TryTransitionTo(TransferJobState.Sealed);

        job.ToSnapshot().TotalFiles.Should().Be(2);
    }

    [Fact]
    public void Abort_LegalFromState_SetsAbortedAndError()
    {
        var job = NewJob();

        job.Abort("device disconnected");

        job.State.Should().Be(TransferJobState.Aborted);
        job.ToSnapshot().Error.Should().Be("device disconnected");
    }

    [Fact]
    public void Abort_FromTerminalState_IsNoOp()
    {
        var job = JobIn(TransferJobState.Cancelled);

        job.Abort("too late");

        job.State.Should().Be(TransferJobState.Cancelled);
        job.ToSnapshot().Error.Should().BeNull();
    }

    [Fact]
    public void SetCurrentFile_ReflectedInSnapshot()
    {
        var job = NewJob();

        job.SetCurrentFile("games/foo.prg");

        job.ToSnapshot().CurrentFile.Should().Be("games/foo.prg");
    }

    [Fact]
    public void ToSnapshot_RecentCompletions_BoundedToNewestAcrossSuccessesAndFailures()
    {
        var job = NewJob(new TransferOptions { RecentCompletionsBound = 5 });
        for (var i = 0; i < 8; i++) job.OnFileReceived(1);

        var completions = new List<TransferFileCompleted>();
        for (var i = 0; i < 8; i++)
        {
            // Every third one fails - the bound must be exercised across both outcomes, not just successes.
            var isFailure = i % 3 == 0;
            var completed = isFailure ? Failure(job, $"file{i}.prg", "disk full", 1) : Success(job, $"file{i}.prg", 1);
            completions.Add(completed);

            if (isFailure) job.OnFileFailed(completed);
            else job.OnFileSent(completed);
        }

        var recent = job.ToSnapshot().RecentCompletions;

        recent.Should().HaveCount(5);
        recent.Should().Equal(completions.Skip(3).Reverse());
    }

    [Fact]
    public void ToSnapshot_Failures_BoundedToEarliest_WhileFilesFailedCountsAll()
    {
        var job = NewJob(new TransferOptions { RetainedFailuresBound = 50 });
        for (var i = 0; i < 70; i++) job.OnFileReceived(1);

        var failures = new List<TransferFileCompleted>();
        for (var i = 0; i < 70; i++)
        {
            var failure = Failure(job, $"file{i}.prg", "disk full", 1);
            failures.Add(failure);
            job.OnFileFailed(failure);
        }

        var snapshot = job.ToSnapshot();

        // Independence is the requirement: the retained list caps at 50 while the count keeps every one.
        snapshot.FilesFailed.Should().Be(70);
        snapshot.Failures.Should().HaveCount(50);
        snapshot.Failures.Should().Equal(failures.Take(50));
    }

    [Fact]
    public void ToSnapshot_HandsOutCopies_NotLiveLists()
    {
        var job = NewJob();
        job.OnFileReceived(10);
        var failure = Failure(job, "a.prg", "disk full", 10);
        job.OnFileFailed(failure);

        var snapshot = job.ToSnapshot();

        job.OnFileReceived(20);
        job.OnFileFailed(Failure(job, "b.prg", "disk full", 20));

        snapshot.Failures.Should().ContainSingle().Which.Should().Be(failure);
        snapshot.RecentCompletions.Should().ContainSingle().Which.Should().Be(failure);
    }

    [Fact]
    public void ToSnapshot_RateWindow_ReportsZero_AfterQuietPeriodLongerThanWindow()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var options = new TransferOptions { RateWindow = TimeSpan.FromSeconds(10) };
        var job = NewJob(options, () => now);
        job.OnFileReceived(100);
        job.OnFileReceived(100);

        job.OnFileSent(Success(job, "a.prg", 100));
        now = now.AddSeconds(1);
        job.OnFileSent(Success(job, "b.prg", 100));

        job.ToSnapshot().FilesPerSecond.Should().BeGreaterThan(0);

        now = now.AddSeconds(20);
        var snapshot = job.ToSnapshot();

        snapshot.BytesPerSecond.Should().Be(0);
        snapshot.FilesPerSecond.Should().Be(0);
    }

    [Fact]
    public void ToSnapshot_RateWindow_ReflectsThroughputChangeWithinOneWindow()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var options = new TransferOptions { RateWindow = TimeSpan.FromSeconds(10) };
        var job = NewJob(options, () => now);
        for (var i = 0; i < 5; i++) job.OnFileReceived(100);

        now = now.AddSeconds(5);
        job.OnFileSent(Success(job, "a.prg", 100));
        var lightRate = job.ToSnapshot().FilesPerSecond;

        now = now.AddSeconds(1);
        job.OnFileSent(Success(job, "b.prg", 100));
        job.OnFileSent(Success(job, "c.prg", 100));
        job.OnFileSent(Success(job, "d.prg", 100));
        job.OnFileSent(Success(job, "e.prg", 100));
        var heavyRate = job.ToSnapshot().FilesPerSecond;

        heavyRate.Should().BeGreaterThan(lightRate);
    }

    [Fact]
    public void ToSnapshot_RateWindow_ReportsLifetimeAverage_OnceTerminal()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var job = NewJob(clock: () => now);
        job.OnFileReceived(100);
        job.OnFileReceived(100);
        job.TryTransitionTo(TransferJobState.Receiving);

        job.OnFileSent(Success(job, "a.prg", 100));
        now = now.AddSeconds(2);
        job.OnFileSent(Success(job, "b.prg", 100));

        job.TryTransitionTo(TransferJobState.Sealed);
        job.TryTransitionTo(TransferJobState.Completed);

        var snapshot = job.ToSnapshot();

        snapshot.FilesPerSecond.Should().Be(1);
        snapshot.BytesPerSecond.Should().Be(100);
    }

    [Fact]
    public void ToSnapshot_RateWindow_TwoFilesInSameInstant_DoesNotDivideByZero()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var job = NewJob(clock: () => now);
        job.OnFileReceived(100);
        job.OnFileReceived(100);

        job.OnFileSent(Success(job, "a.prg", 100));
        job.OnFileSent(Success(job, "b.prg", 100));

        var snapshot = job.ToSnapshot();

        double.IsFinite(snapshot.BytesPerSecond).Should().BeTrue();
        double.IsFinite(snapshot.FilesPerSecond).Should().BeTrue();
        snapshot.BytesPerSecond.Should().BeGreaterThan(0);
        snapshot.FilesPerSecond.Should().BeGreaterThan(0);
    }
}
