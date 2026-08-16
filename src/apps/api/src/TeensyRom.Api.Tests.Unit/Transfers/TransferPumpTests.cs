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
/// exercised directly here rather than through the queue-draining loop. <see cref="_scratch"/> is a real
/// <see cref="TransferScratchStore"/> rather than a substitute so the release tests can assert the
/// budget itself (<see cref="ITransferScratchStore.BytesInUse"/>) coming back, not just that a purge call
/// was made.
/// </summary>
public class TransferPumpTests : IDisposable
{
    private const long MaxScratchBytes = 1000;

    private readonly string _scratchRoot = Directory.CreateTempSubdirectory("teensyrom-pump-scratch-tests-").FullName;
    private readonly ITransferQueue _queue = Substitute.For<ITransferQueue>();
    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly IDeviceLeaseCoordinator _leaseCoordinator = Substitute.For<IDeviceLeaseCoordinator>();
    private readonly ITransferCapacityGate _gate = Substitute.For<ITransferCapacityGate>();
    private readonly ITransferStagingStore _staging = Substitute.For<ITransferStagingStore>();
    private readonly ITransferAdmission _admission = Substitute.For<ITransferAdmission>();
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IServiceScopeFactory _scopeFactory = Substitute.For<IServiceScopeFactory>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly TransferOptions _options = new();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly ITransferScratchStore _scratch;

    public TransferPumpTests()
    {
        _scratch = new TransferScratchStore(
            new TransferOptions { ScratchRoot = _scratchRoot, MaxScratchBytes = MaxScratchBytes }, Substitute.For<ILoggingService>());
    }

    public void Dispose()
    {
        if (Directory.Exists(_scratchRoot))
        {
            Directory.Delete(_scratchRoot, recursive: true);
        }
    }

    private TransferPump NewPump() => new(
        _queue, _registry, _leaseCoordinator, _gate, _staging, _scratch, _admission, _deviceManager, _scopeFactory, _notifier, _options, _log);

    private static TransferJob NewJob() =>
        new("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions());

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

    /// <summary>
    /// Asserts the scratch budget itself, not just that a purge call happened - a job that reserved
    /// scratch space (as an archive upload would) must get every byte of it back on completion.
    /// </summary>
    [Fact]
    public void TryFinalize_SealedToCompleted_ReturnsScratchBudgetToPreJobValue()
    {
        var job = JobIn(TransferJobState.Sealed, pendingCount: 0);
        _scratch.TryReserve(job.JobId, 400).Should().BeTrue();
        var pump = NewPump();

        pump.TryFinalize(job);

        _scratch.BytesInUse.Should().Be(0);
        _admission.DidNotReceiveWithAnyArgs().DiscardHeld(default!);
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

    /// <summary>
    /// Cancelling releases the scratch budget exactly like completion, and additionally discards
    /// anything still held for the job - a cancelled job will never drain a held file any other way.
    /// </summary>
    [Fact]
    public void TryFinalize_CancellingToCancelled_ReturnsScratchBudgetAndDiscardsHeld()
    {
        var job = JobIn(TransferJobState.Cancelling, pendingCount: 0);
        _scratch.TryReserve(job.JobId, 250).Should().BeTrue();
        var pump = NewPump();

        pump.TryFinalize(job);

        _scratch.BytesInUse.Should().Be(0);
        _admission.Received(1).DiscardHeld(job.JobId);
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
