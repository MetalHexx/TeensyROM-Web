using Microsoft.AspNetCore.SignalR;
using NSubstitute;
using TeensyRom.Api.Endpoints.Transfers.Hub;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferProgressNotifierTests
{
    private static TransferJob NewJob() =>
        new("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions());

    private static (TransferProgressNotifier Notifier, IClientProxy GroupProxy, ITransferJobRegistry Registry) NewNotifier(TimeSpan throttle)
    {
        var groupProxy = Substitute.For<IClientProxy>();
        var clients = Substitute.For<IHubClients>();
        clients.Group(Arg.Any<string>()).Returns(groupProxy);

        var hubContext = Substitute.For<IHubContext<TransferHub>>();
        hubContext.Clients.Returns(clients);

        var registry = Substitute.For<ITransferJobRegistry>();
        var options = new TransferOptions { SnapshotThrottle = throttle };
        var notifier = new TransferProgressNotifier(hubContext, registry, options, Substitute.For<ILoggingService>());

        return (notifier, groupProxy, registry);
    }

    private static bool IsSnapshotFor(object?[] args, string jobId) =>
        args.Length == 1 && args[0] is TransferJobDto dto && dto.JobId == jobId;

    [Fact]
    public async Task JobChanged_MarkedRepeatedlyWithinOneThrottleWindow_BroadcastsExactlyOnce()
    {
        var job = NewJob();
        var (notifier, groupProxy, registry) = NewNotifier(TimeSpan.FromMilliseconds(20));
        registry.Get(job.JobId).Returns(job);

        await notifier.StartAsync(CancellationToken.None);
        try
        {
            notifier.JobChanged(job);
            notifier.JobChanged(job);
            notifier.JobChanged(job);

            await Task.Delay(TimeSpan.FromMilliseconds(150));
        }
        finally
        {
            await notifier.StopAsync(CancellationToken.None);
        }

        await groupProxy.Received(1).SendCoreAsync(
            "JobSnapshot", Arg.Is<object?[]>(a => IsSnapshotFor(a, job.JobId)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoDirtyJobs_ProducesNoTraffic()
    {
        var (notifier, groupProxy, _) = NewNotifier(TimeSpan.FromMilliseconds(20));

        await notifier.StartAsync(CancellationToken.None);
        await Task.Delay(TimeSpan.FromMilliseconds(100));
        await notifier.StopAsync(CancellationToken.None);

        await groupProxy.DidNotReceive().SendCoreAsync(
            Arg.Any<string>(), Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JobChanged_TerminalState_FlushesImmediatelyWithoutWaitingForTick()
    {
        var job = NewJob();
        job.TryTransitionTo(TransferJobState.Cancelled);

        // A throttle long enough that the assertion below could only pass via the immediate flush path.
        var (notifier, groupProxy, registry) = NewNotifier(TimeSpan.FromMinutes(5));
        registry.Get(job.JobId).Returns(job);

        notifier.JobChanged(job);

        await groupProxy.Received(1).SendCoreAsync(
            "JobSnapshot", Arg.Is<object?[]>(a => IsSnapshotFor(a, job.JobId)), Arg.Any<CancellationToken>());
    }
}
