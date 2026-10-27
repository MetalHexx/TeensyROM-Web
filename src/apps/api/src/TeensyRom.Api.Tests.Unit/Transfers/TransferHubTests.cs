using Microsoft.AspNetCore.SignalR;
using TeensyRom.Api.Endpoints.Transfers.Hub;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferHubTests
{
    private const string ConnectionId = "conn-1";

    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly ITransferSubscriptionTracker _tracker = Substitute.For<ITransferSubscriptionTracker>();
    private readonly IGroupManager _groups = Substitute.For<IGroupManager>();

    private TransferHub NewHub()
    {
        var context = Substitute.For<HubCallerContext>();
        context.ConnectionId.Returns(ConnectionId);
        return new TransferHub(_registry, _tracker) { Context = context, Groups = _groups };
    }

    [Fact]
    public async Task SubscribeAll_JoinsAllGroupAndReturnsEveryJobNewestFirst_WithoutTrackingOrTouching()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var clock = now;
        var older = new TransferJob("d1", TeensyStorageType.SD, new DirectoryPath("/a"), new TransferOptions(), () => clock);
        clock = now.AddMinutes(5);
        var newer = new TransferJob("d2", TeensyStorageType.SD, new DirectoryPath("/b"), new TransferOptions(), () => clock);
        clock = now.AddHours(1);
        _registry.All().Returns([older, newer]);

        var jobs = await NewHub().SubscribeAll();

        jobs.Select(j => j.JobId).Should().Equal(newer.JobId, older.JobId);
        await _groups.Received(1).AddToGroupAsync(ConnectionId, TransferHubGroups.All, Arg.Any<CancellationToken>());
        _tracker.ReceivedCalls().Should().BeEmpty();
        older.LastActivityUtc.Should().Be(now);
        newer.LastActivityUtc.Should().Be(now.AddMinutes(5));
    }

    [Fact]
    public async Task UnsubscribeAll_LeavesAllGroup()
    {
        await NewHub().UnsubscribeAll();

        await _groups.Received(1).RemoveFromGroupAsync(ConnectionId, TransferHubGroups.All, Arg.Any<CancellationToken>());
    }
}
