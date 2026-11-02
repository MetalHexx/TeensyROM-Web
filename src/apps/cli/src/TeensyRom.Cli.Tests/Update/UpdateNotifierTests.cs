using TeensyRom.Cli.Output;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

[Collection(ConsoleCollection.Name)]
public sealed class UpdateNotifierTests
{
    private static readonly UpdateStatus Available = new("1.0.0-beta.1", "1.0.0-beta.2", true, InstallKind.Release, null);

    private readonly FakeReleaseCheck _check = new() { CachedStatus = Available };
    private readonly FakeTimeProvider _time = new();

    private sealed record Subject(UpdateNotifier Notifier, TestConsoles Consoles);

    private Subject Create(bool terminal = true)
    {
        var consoles = new TestConsoles(terminal);

        return new Subject(new UpdateNotifier(_check, new CliOutput(consoles.Consoles), _time), consoles);
    }

    // ---- which runs look -----------------------------------------------------------------------------------

    [Theory]
    [InlineData(new string[0], true, true)]
    [InlineData(new[] { "device", "list" }, true, true)]
    [InlineData(new[] { "theme", "apply", "update" }, true, true)]
    [InlineData(new[] { "device", "list" }, false, false)]
    [InlineData(new[] { "device", "list", "--json" }, true, false)]
    [InlineData(new[] { "--json", "init" }, true, false)]
    [InlineData(new[] { "--help" }, true, false)]
    [InlineData(new[] { "device", "-h" }, true, false)]
    [InlineData(new[] { "--version" }, true, false)]
    [InlineData(new[] { "-v" }, true, false)]
    [InlineData(new[] { "update" }, true, false)]
    [InlineData(new[] { "update", "--check" }, true, false)]
    [InlineData(new[] { "init" }, true, false)]
    [InlineData(new[] { "--no-color", "init" }, true, false)]
    public void ShouldCheck_IsTrueOnlyForARunAPersonWatches(string[] args, bool canPrompt, bool expected)
    {
        Create().Notifier.ShouldCheck(args, canPrompt).Should().Be(expected);
    }

    [Fact]
    public async Task WhenTheRunShouldNotCheck_NothingIsLookedUpOrSaid()
    {
        var subject = Create();

        subject.Notifier.Begin(["device", "list", "--json"], menu: false);
        await subject.Notifier.EndAsync();

        _check.Refreshes.Should().Be(0);
        subject.Consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task WithoutATerminal_NothingIsLookedUpOrSaid()
    {
        var subject = Create(terminal: false);

        subject.Notifier.Begin(["device", "list"], menu: false);
        await subject.Notifier.EndAsync();

        _check.Refreshes.Should().Be(0);
        subject.Consoles.StdErr.Should().BeEmpty();
    }

    // ---- the notice ----------------------------------------------------------------------------------------

    [Fact]
    public async Task AtTheEndOfARun_SaysOnStderrThatANewerReleaseIsOut_AndRemembersIt()
    {
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        await subject.Notifier.EndAsync();

        _check.Refreshes.Should().Be(1);
        subject.Consoles.StdErr.Should().Contain("TeensyROM Suite 1.0.0-beta.2 is out (you have 1.0.0-beta.1). Run").And.Contain("trom update");
        subject.Consoles.StdOut.Should().BeEmpty();
        _check.MarkedNotified.Should().Be(1);
    }

    [Fact]
    public void Sentence_IsTheOneTheMenuShowsToo()
    {
        UpdateNotifier.Sentence("1.2.0", "1.1.0").Should().Be("TeensyROM Suite 1.2.0 is out (you have 1.1.0). Run `trom update`.");
    }

    [Fact]
    public async Task WithinADayOfTheLastNotice_SaysNothing()
    {
        _check.Notified = _time.GetUtcNow() - TimeSpan.FromHours(23);
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        await subject.Notifier.EndAsync();

        subject.Consoles.StdErr.Should().BeEmpty();
        _check.MarkedNotified.Should().Be(0);
    }

    [Theory]
    [InlineData(24)]
    [InlineData(-5)]
    public async Task ADayAfterTheLastNoticeOrWithAClockSetBack_SaysItAgain(int hoursAgo)
    {
        _check.Notified = _time.GetUtcNow() - TimeSpan.FromHours(hoursAgo);
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        await subject.Notifier.EndAsync();

        subject.Consoles.StdErr.Should().Contain("is out");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task WhenNothingNewerIsKnown_SaysNothing(bool knownButCurrent)
    {
        _check.CachedStatus = knownButCurrent ? Available with { Available = false, Latest = "1.0.0-beta.1" } : null;
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        await subject.Notifier.EndAsync();

        subject.Consoles.StdErr.Should().BeEmpty();
        _check.MarkedNotified.Should().Be(0);
    }

    [Fact]
    public async Task InTheMenu_StillLooksUpButLeavesTheSayingToTheMenu()
    {
        var subject = Create();

        subject.Notifier.Begin([], menu: true);
        await subject.Notifier.EndAsync();

        _check.Refreshes.Should().Be(1);
        subject.Consoles.StdErr.Should().BeEmpty();
        _check.MarkedNotified.Should().Be(0);
    }

    // ---- the budgets ---------------------------------------------------------------------------------------

    [Fact]
    public async Task TheLookupGetsFiveSeconds()
    {
        var timeouts = new List<TimeSpan>();
        var subject = new UpdateNotifier(new TimeoutRecordingCheck(timeouts), new CliOutput(new TestConsoles(true).Consoles), _time);

        subject.Begin(["device", "list"], menu: false);
        await subject.EndAsync();

        timeouts.Should().Equal(TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task TheEndOfARunWaitsOnlyASecondForALookupThatIsStillGoing()
    {
        var neverEnds = new TaskCompletionSource();
        _check.OnRefresh = () => neverEnds.Task;
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        var ending = subject.Notifier.EndAsync();

        await Task.Delay(50);
        ending.IsCompleted.Should().BeFalse("it is still inside its one second");

        _time.Advance(TimeSpan.FromSeconds(1));
        await ending.WaitAsync(TimeSpan.FromSeconds(10));

        subject.Consoles.StdErr.Should().Contain("is out", "what an earlier run recorded is still worth saying");
    }

    [Fact]
    public async Task TheEndOfARun_DoesNotWaitForALookupThatHasFinished()
    {
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);

        var ending = subject.Notifier.EndAsync();

        (await Task.WhenAny(ending, Task.Delay(TimeSpan.FromSeconds(10)))).Should().BeSameAs(ending);
    }

    [Fact]
    public async Task AFailingLookup_NeverFailsTheRun()
    {
        _check.OnRefresh = () => throw new InvalidOperationException("boom");
        var subject = Create();

        subject.Notifier.Begin(["device", "list"], menu: false);
        var ending = () => subject.Notifier.EndAsync();

        await ending.Should().NotThrowAsync();
    }

    private sealed class TimeoutRecordingCheck(List<TimeSpan> timeouts) : IReleaseCheck
    {
        public UpdateStatus? Cached() => null;

        public DateTimeOffset? NotifiedAt() => null;

        public Task RefreshAsync(TimeSpan timeout, CancellationToken ct = default)
        {
            timeouts.Add(timeout);
            return Task.CompletedTask;
        }

        public Task<UpdateStatus> CurrentAsync(TimeSpan timeout, CancellationToken ct = default) => throw new NotSupportedException();

        public void Record(IReadOnlyList<ReleaseInfo> releases) => throw new NotSupportedException();

        public void MarkNotified() => throw new NotSupportedException();
    }
}
