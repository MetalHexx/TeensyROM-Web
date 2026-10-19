using TeensyRom.Api.Endpoints.Serial.GetLogs;
using TeensyRom.Api.Services;

namespace TeensyRom.Api.Tests.LogHub;

public class LogSubscriptionsTests
{
    private readonly IQueuedChannelLogger _logger = Substitute.For<IQueuedChannelLogger>();
    private readonly LogSubscriptions _subscriptions;

    public LogSubscriptionsTests()
    {
        _subscriptions = new LogSubscriptions(_logger);
    }

    [Fact]
    public void Add_FirstListener_StartsTheStreamOnce()
    {
        _subscriptions.Add("a");

        _logger.Received(1).StartLogStream();
        _subscriptions.Count.Should().Be(1);
    }

    [Fact]
    public void Add_SecondListener_DoesNotRestartTheStream()
    {
        _subscriptions.Add("a");
        _subscriptions.Add("b");

        _logger.Received(1).StartLogStream();
        _subscriptions.Count.Should().Be(2);
    }

    [Fact]
    public void Remove_OneOfTwoListeners_KeepsTheStreamRunning()
    {
        _subscriptions.Add("a");
        _subscriptions.Add("b");

        _subscriptions.Remove("a");

        _logger.DidNotReceive().StopLogStream();
        _subscriptions.Count.Should().Be(1);
    }

    [Fact]
    public void Remove_LastListener_StopsTheStream()
    {
        _subscriptions.Add("a");
        _subscriptions.Add("b");
        _subscriptions.Remove("a");

        _subscriptions.Remove("b");

        _logger.Received(1).StopLogStream();
        _subscriptions.Count.Should().Be(0);
    }

    [Fact]
    public void Add_DuplicateConnection_MakesNoTransition()
    {
        _subscriptions.Add("a");
        _subscriptions.Add("a");

        _logger.Received(1).StartLogStream();
        _subscriptions.Count.Should().Be(1);

        _subscriptions.Remove("a");

        _logger.Received(1).StopLogStream();
    }

    [Fact]
    public void Remove_UnknownConnection_MakesNoTransition()
    {
        _subscriptions.Remove("ghost");

        _logger.DidNotReceive().StopLogStream();

        _subscriptions.Add("a");
        _subscriptions.Remove("ghost");

        _logger.DidNotReceive().StopLogStream();
        _subscriptions.Count.Should().Be(1);
    }

    [Fact]
    public void Add_AfterTheLastListenerLeft_StartsTheStreamAgain()
    {
        _subscriptions.Add("a");
        _subscriptions.Remove("a");

        _subscriptions.Add("b");

        _logger.Received(2).StartLogStream();
    }
}
