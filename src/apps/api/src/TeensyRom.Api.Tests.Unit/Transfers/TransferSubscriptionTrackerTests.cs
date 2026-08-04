using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferSubscriptionTrackerTests
{
    private static ITransferSubscriptionTracker NewTracker() => new TransferSubscriptionTracker();

    [Fact]
    public void Add_SingleConnectionToJob_HasSubscribersIsTrue()
    {
        var tracker = NewTracker();

        tracker.Add("conn-1", "job-1");

        tracker.HasSubscribers("job-1").Should().BeTrue();
    }

    [Fact]
    public void HasSubscribers_UnknownJob_ReturnsFalse() =>
        NewTracker().HasSubscribers("no-such-job").Should().BeFalse();

    [Fact]
    public void Remove_LastSubscriber_HasSubscribersBecomesFalse()
    {
        var tracker = NewTracker();
        tracker.Add("conn-1", "job-1");

        tracker.Remove("conn-1", "job-1");

        tracker.HasSubscribers("job-1").Should().BeFalse();
    }

    [Fact]
    public void Remove_OneOfTwoSubscribers_JobStaysSubscribed()
    {
        var tracker = NewTracker();
        tracker.Add("conn-1", "job-1");
        tracker.Add("conn-2", "job-1");

        tracker.Remove("conn-1", "job-1");

        tracker.HasSubscribers("job-1").Should().BeTrue();
    }

    [Fact]
    public void RemoveConnection_SubscribedToTwoJobs_DropsFromBoth()
    {
        var tracker = NewTracker();
        tracker.Add("conn-1", "job-1");
        tracker.Add("conn-1", "job-2");

        tracker.RemoveConnection("conn-1");

        tracker.HasSubscribers("job-1").Should().BeFalse();
        tracker.HasSubscribers("job-2").Should().BeFalse();
    }

    [Fact]
    public void RemoveConnection_OneOfSeveralSubscribers_LeavesOtherJobsSubscribersIntact()
    {
        var tracker = NewTracker();
        tracker.Add("conn-1", "job-1");
        tracker.Add("conn-2", "job-1");

        tracker.RemoveConnection("conn-1");

        tracker.HasSubscribers("job-1").Should().BeTrue();
    }

    [Fact]
    public void RemoveConnection_UnknownConnection_DoesNotThrow()
    {
        var tracker = NewTracker();

        var act = () => tracker.RemoveConnection("never-added");

        act.Should().NotThrow();
    }

    [Fact]
    public void Remove_UnknownPair_DoesNotThrow()
    {
        var tracker = NewTracker();

        var act = () => tracker.Remove("conn-1", "job-1");

        act.Should().NotThrow();
    }
}
