using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

/// <summary>
/// Covers the abandonment predicate (state x pendingCount x idleFor x hasSubscribers) and the
/// Sealed/Cancelling finalize backstop - the logic most likely to be got subtly wrong. Idle time is
/// simulated with a short real sleep against a small threshold rather than reaching into the job's
/// private clock state.
/// </summary>
public class TransferJobSweeperTests
{
    private static readonly TimeSpan Threshold = TimeSpan.FromMilliseconds(150);
    private static readonly TimeSpan PastThreshold = TimeSpan.FromMilliseconds(300);

    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly IDeviceLeaseCoordinator _leaseCoordinator = Substitute.For<IDeviceLeaseCoordinator>();
    private readonly ITransferStagingStore _staging = Substitute.For<ITransferStagingStore>();
    private readonly ITransferSubscriptionTracker _tracker = Substitute.For<ITransferSubscriptionTracker>();
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private readonly TransferOptions _options = new()
    {
        IdleAbandonmentThreshold = Threshold,
        TerminalJobRetention = Threshold
    };

    private TransferPump NewPump() => new(
        Substitute.For<ITransferQueue>(), _registry, _leaseCoordinator, Substitute.For<ITransferCapacityGate>(),
        _staging, _deviceManager, Substitute.For<IServiceScopeFactory>(), _notifier, _options, _log);

    private TransferJobSweeper NewSweeper() => new(
        _registry, _leaseCoordinator, _staging, _tracker, _deviceManager, _notifier, _options, NewPump(), _log);

    private static TransferJob NewJob(TransferJobState state, int pendingCount, bool idle)
    {
        var job = new TransferJob("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions());

        if (state is TransferJobState.Receiving or TransferJobState.Sealed)
        {
            job.TryTransitionTo(TransferJobState.Receiving);
        }
        if (state is TransferJobState.Sealed)
        {
            job.TryTransitionTo(TransferJobState.Sealed);
        }
        if (state is TransferJobState.Aborted)
        {
            job.TryTransitionTo(TransferJobState.Aborted);
        }

        for (var i = 0; i < pendingCount; i++)
        {
            job.OnFileReceived(1);
        }

        if (idle)
        {
            Thread.Sleep(PastThreshold);
        }

        return job;
    }

    public static IEnumerable<object[]> AbandonmentPredicateCases()
    {
        // state, pendingCount, idle, hasSubscribers, expectAbandoned
        yield return [TransferJobState.Created, 0, true, false, true];
        yield return [TransferJobState.Receiving, 0, true, false, true];
        yield return [TransferJobState.Created, 1, true, false, false];
        yield return [TransferJobState.Created, 0, false, false, false];
        yield return [TransferJobState.Created, 0, true, true, false];
    }

    [Theory]
    [MemberData(nameof(AbandonmentPredicateCases))]
    public void Sweep_AbandonmentPredicate_MatchesTable(
        TransferJobState state, int pendingCount, bool idle, bool hasSubscribers, bool expectAbandoned)
    {
        var job = NewJob(state, pendingCount, idle);
        _registry.All().Returns([job]);
        _tracker.HasSubscribers(job.JobId).Returns(hasSubscribers);

        NewSweeper().Sweep();

        job.State.Should().Be(expectAbandoned ? TransferJobState.Abandoned : state);
    }

    [Fact]
    public void Sweep_AbandonedJob_ReleasesLeaseAndPurgesStaging()
    {
        var job = NewJob(TransferJobState.Created, 0, idle: true);
        _registry.All().Returns([job]);
        _tracker.HasSubscribers(job.JobId).Returns(false);

        NewSweeper().Sweep();

        _leaseCoordinator.Received(1).Release("device-1", job.JobId);
        _staging.Received(1).PurgeJob(job.JobId);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public void Sweep_SealedJobWithEmptyQueue_FinalizesToCompleted()
    {
        var job = NewJob(TransferJobState.Sealed, 0, idle: false);
        _registry.All().Returns([job]);

        NewSweeper().Sweep();

        job.State.Should().Be(TransferJobState.Completed);
    }

    [Fact]
    public void Sweep_SealedJobIsNeverAbandonedRegardlessOfIdleTimeOrSubscribers()
    {
        var job = NewJob(TransferJobState.Sealed, 1, idle: true);
        _registry.All().Returns([job]);
        _tracker.HasSubscribers(job.JobId).Returns(false);

        NewSweeper().Sweep();

        job.State.Should().Be(TransferJobState.Sealed);
    }

    [Fact]
    public void Sweep_CancellingJobWithEmptyQueue_FinalizesToCancelled()
    {
        var job = new TransferJob("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions());
        job.TryTransitionTo(TransferJobState.Cancelling);
        _registry.All().Returns([job]);

        NewSweeper().Sweep();

        job.State.Should().Be(TransferJobState.Cancelled);
    }

    [Fact]
    public void Sweep_TerminalJobOlderThanRetention_IsEvicted()
    {
        var job = NewJob(TransferJobState.Aborted, 0, idle: true);
        _registry.All().Returns([job]);

        NewSweeper().Sweep();

        _registry.Received(1).Remove(job.JobId);
    }

    [Fact]
    public void Sweep_TerminalJobWithinRetention_IsNotEvicted()
    {
        var job = NewJob(TransferJobState.Aborted, 0, idle: false);
        _registry.All().Returns([job]);

        NewSweeper().Sweep();

        _registry.DidNotReceive().Remove(job.JobId);
    }
}
