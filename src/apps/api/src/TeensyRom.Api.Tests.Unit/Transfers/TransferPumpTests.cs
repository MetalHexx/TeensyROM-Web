using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

/// <summary>
/// TryFinalize is the single place a job reaches a terminal state, shared by the pump and the sweeper -
/// exercised directly here rather than through the queue-draining loop.
/// </summary>
public class TransferPumpTests
{
    private readonly ITransferQueue _queue = Substitute.For<ITransferQueue>();
    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly IDeviceLeaseCoordinator _leaseCoordinator = Substitute.For<IDeviceLeaseCoordinator>();
    private readonly ITransferCapacityGate _gate = Substitute.For<ITransferCapacityGate>();
    private readonly ITransferStagingStore _staging = Substitute.For<ITransferStagingStore>();
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IServiceScopeFactory _scopeFactory = Substitute.For<IServiceScopeFactory>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private TransferPump NewPump() => new(
        _queue, _registry, _leaseCoordinator, _gate, _staging, _deviceManager, _scopeFactory, _notifier, _log);

    private static TransferJob NewJob() =>
        new("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));

    private static TransferJob JobIn(TransferJobState state, int pendingCount)
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

        for (var i = 0; i < pendingCount; i++)
        {
            job.OnFileReceived(1);
        }

        return job;
    }

    public static IEnumerable<object[]> AllStatesAtZeroPending()
    {
        foreach (var state in Enum.GetValues<TransferJobState>())
        {
            var expectedNext = state switch
            {
                TransferJobState.Sealed => TransferJobState.Completed,
                TransferJobState.Cancelling => TransferJobState.Cancelled,
                _ => state
            };

            yield return [state, expectedNext];
        }
    }

    [Theory]
    [MemberData(nameof(AllStatesAtZeroPending))]
    public void TryFinalize_EveryStateWithNoPendingFiles_MatchesTruthTable(TransferJobState state, TransferJobState expectedState)
    {
        var job = JobIn(state, pendingCount: 0);
        var pump = NewPump();

        pump.TryFinalize(job);

        job.State.Should().Be(expectedState);
    }

    [Theory]
    [InlineData(TransferJobState.Sealed)]
    [InlineData(TransferJobState.Cancelling)]
    public void TryFinalize_SealedOrCancellingWithPendingFiles_DoesNotTransition(TransferJobState state)
    {
        var job = JobIn(state, pendingCount: 1);
        var pump = NewPump();

        pump.TryFinalize(job);

        job.State.Should().Be(state);
        _leaseCoordinator.DidNotReceiveWithAnyArgs().Release(default!, default!);
    }

    [Fact]
    public void TryFinalize_SealedToCompleted_ReleasesLeasePurgesStagingAndNotifies()
    {
        var job = JobIn(TransferJobState.Sealed, pendingCount: 0);
        var pump = NewPump();

        pump.TryFinalize(job);

        _leaseCoordinator.Received(1).Release("device-1", job.JobId);
        _staging.Received(1).PurgeJob(job.JobId);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public void TryFinalize_CancellingToCancelled_ReleasesLeasePurgesStagingAndNotifies()
    {
        var job = JobIn(TransferJobState.Cancelling, pendingCount: 0);
        var pump = NewPump();

        pump.TryFinalize(job);

        _leaseCoordinator.Received(1).Release("device-1", job.JobId);
        _staging.Received(1).PurgeJob(job.JobId);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public void TryFinalize_CalledTwiceAfterTransition_IsIdempotent()
    {
        var job = JobIn(TransferJobState.Sealed, pendingCount: 0);
        var pump = NewPump();

        pump.TryFinalize(job);
        pump.TryFinalize(job);

        job.State.Should().Be(TransferJobState.Completed);
        _leaseCoordinator.Received(1).Release("device-1", job.JobId);
        _staging.Received(1).PurgeJob(job.JobId);
    }
}
