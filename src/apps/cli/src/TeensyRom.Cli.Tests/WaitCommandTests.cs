using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Text.Json;
using TeensyRom.Cli.Commands.Wait;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

[Collection(ConsoleCollection.Name)]
public sealed class WaitCommandTests
{
    private readonly IEngineClock _clock = Substitute.For<IEngineClock>();

    [Theory]
    [InlineData("45s", "00:00:45")]
    [InlineData("3m", "00:03:00")]
    [InlineData("3m20s", "00:03:20")]
    [InlineData("1h", "01:00:00")]
    [InlineData("1h2m3s", "01:02:03")]
    [InlineData("3M20S", "00:03:20")]
    [InlineData("1s", "00:00:01")]
    [InlineData("6h", "06:00:00")]
    [InlineData("3:20", "00:03:20")]
    [InlineData("00:03:20", "00:03:20")]
    [InlineData("1:02:03", "01:02:03")]
    [InlineData("00:03:20.5000000", "00:03:20.5000000")]
    [InlineData("0:01.5", "00:00:01.5000000")]
    [InlineData("06:00:00", "06:00:00")]
    public void TryParse_OfAnAcceptedForm_GivesTheExactDuration(string text, string expected)
    {
        WaitDuration.TryParse(text, out var duration).Should().BeTrue();

        duration.Should().Be(TimeSpan.Parse(expected));
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("0s")]
    [InlineData("0:00")]
    [InlineData("00:00:00.5")]
    [InlineData("7h")]
    [InlineData("6h1s")]
    [InlineData("06:00:00.0000001")]
    [InlineData("3m20")]
    [InlineData("20s3m")]
    [InlineData("-5s")]
    [InlineData("3:75")]
    [InlineData("1:75:00")]
    [InlineData("1:2:3:4")]
    public void TryParse_OfAnythingElse_Fails(string text)
    {
        WaitDuration.TryParse(text, out _).Should().BeFalse();
    }

    [Theory]
    [InlineData("0s")]
    [InlineData("7h")]
    [InlineData("abc")]
    public async Task Wait_WithAnInvalidDuration_IsAUsageErrorBeforeAnythingRuns(string duration)
    {
        using var host = NewHost();

        var exitCode = await host.RunAsync("wait", duration);

        exitCode.Should().Be(2);
        host.Consoles.StdErr.Should().Contain("3m20s");
        host.Consoles.StdOut.Should().BeEmpty();
        await _clock.DidNotReceiveWithAnyArgs().DelayAsync(default, default);
    }

    [Fact]
    public async Task Wait_WaitsTheDurationOnTheClock_WritesNothingToStdout_AndNeverStartsTheEngine()
    {
        using var host = NewHost();

        var exitCode = await host.RunAsync("wait", "3:20");

        exitCode.Should().Be(0);
        await _clock.Received(1).DelayAsync(TimeSpan.FromSeconds(200), Arg.Any<CancellationToken>());
        host.Consoles.StdOut.Should().BeEmpty();
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await host.Devices.DidNotReceiveWithAnyArgs().GetDevicesAsync(default);
    }

    [Fact]
    public async Task Wait_UnderJson_WritesTheWaitedDuration()
    {
        using var host = NewHost();

        var exitCode = await host.RunAsync("wait", "3m20s", "--json");

        exitCode.Should().Be(0);
        using var document = JsonDocument.Parse(host.Consoles.StdOut);
        document.RootElement.GetProperty("waited").GetString().Should().Be("00:03:20");
    }

    [Fact]
    public async Task Wait_WhenCancelled_ExitsOneWithAMessage()
    {
        _clock.DelayAsync(default, default).ThrowsAsyncForAnyArgs(new OperationCanceledException());
        using var host = NewHost();

        var exitCode = await host.RunAsync("wait", "1m");

        exitCode.Should().Be(1);
        host.Consoles.StdOut.Should().BeEmpty();
        host.Consoles.StdErr.Should().Contain("The wait was cancelled.");
    }

    [Fact]
    public async Task Wait_WhenCancelledUnderJson_WritesTheJsonError()
    {
        _clock.DelayAsync(default, default).ThrowsAsyncForAnyArgs(new OperationCanceledException());
        using var host = NewHost();

        var exitCode = await host.RunAsync("wait", "1m", "--json");

        exitCode.Should().Be(1);
        host.Consoles.StdErr.Should().Contain("The wait was cancelled.").And.Contain("\"error\"");
    }

    private static readonly TimeSpan Tick = TimeSpan.FromMilliseconds(250);

    private static LastLaunchRecord Record(PlayState state = PlayState.Playing) => new(
        "dev-1", "Bench", TeensyStorageType.USB, new LaunchedFile("/music/Commando.sid", 4096), PlayMode.CurrentDirectory,
        null, TeensyFilterType.Music, StorageScope.DirShallow, "/music", state, [], 0);

    private DateTimeOffset _now = DateTimeOffset.UnixEpoch;

    private List<TimeSpan> RunClockForward()
    {
        var delays = new List<TimeSpan>();

        _clock.UtcNow.Returns(_ => _now);
        _clock.DelayAsync(default, default).ReturnsForAnyArgs(call =>
        {
            var delay = call.ArgAt<TimeSpan>(0);

            delays.Add(delay);
            _now += delay;
            return Task.CompletedTask;
        });

        return delays;
    }

    private TestHost NewHost(ILastLaunchStore? store = null) => new(configure: services =>
    {
        services.AddSingleton(_clock);
        if (store is not null) services.Replace(ServiceDescriptor.Singleton(store));
    });

    [Fact]
    public async Task Wait_WithADevice_HoldsTheCountdownWhileTheRecordSaysPaused()
    {
        var delays = RunClockForward();
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns(Record());
        store.Load("dev-1").Returns(Record(), Record(PlayState.Paused), Record(PlayState.Paused), Record(PlayState.Paused), Record());
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "1s", "--device", "Bench");

        exitCode.Should().Be(0);
        delays.Should().OnlyContain(delay => delay == Tick);
        delays.Count.Should().Be(4 + 3);
        (_now - DateTimeOffset.UnixEpoch).Should().Be(TimeSpan.FromSeconds(1) + 3 * Tick);
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        store.DidNotReceiveWithAnyArgs().Save(default!);
    }

    [Fact]
    public async Task Wait_WithADevice_ForADurationThatIsNotWholeTicks_WaitsExactlyThatLong()
    {
        var delays = RunClockForward();
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns(Record());
        store.Load("dev-1").Returns(Record());
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "0:01.1", "--device", "Bench");

        exitCode.Should().Be(0);
        delays.Should().Equal(Tick, Tick, Tick, Tick, TimeSpan.FromMilliseconds(100));
        (_now - DateTimeOffset.UnixEpoch).Should().Be(TimeSpan.FromSeconds(1.1));
    }

    [Fact]
    public async Task Wait_WithADevice_TreatsAnUnreadableRecordAsNotPaused()
    {
        RunClockForward();
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns(Record());
        store.Load("dev-1").Returns((LastLaunchRecord?)null);
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "1s", "--device", "Bench");

        exitCode.Should().Be(0);
        (_now - DateTimeOffset.UnixEpoch).Should().Be(TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Wait_WithADeviceThatHasNoRecord_CountsDownPlainly()
    {
        var delays = RunClockForward();
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns((LastLaunchRecord?)null);
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "10s", "--device", "Bench");

        exitCode.Should().Be(0);
        delays.Should().Equal(TimeSpan.FromSeconds(10));
        store.DidNotReceiveWithAnyArgs().Load(default!);
        host.Consoles.StdErr.Should().Contain("no last launch recorded for Bench; counting down without holding");
        host.Consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task Wait_WithAnAmbiguousDeviceName_IsAUsageError()
    {
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns(_ => throw new CliException(CliExitCode.Usage, "More than one device is named 'Bench'."));
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "10s", "--device", "Bench");

        exitCode.Should().Be(2);
        await _clock.DidNotReceiveWithAnyArgs().DelayAsync(default, default);
    }

    [Fact]
    public async Task Wait_WithoutADevice_NeverReadsTheStore_AndSaysNothing()
    {
        var store = Substitute.For<ILastLaunchStore>();
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "10s");

        exitCode.Should().Be(0);
        host.Consoles.StdErr.Should().BeEmpty();
        await _clock.Received(1).DelayAsync(TimeSpan.FromSeconds(10), Arg.Any<CancellationToken>());
        store.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task Wait_WithADeviceUnderJson_WritesTheDurationCountedDown()
    {
        RunClockForward();
        var store = Substitute.For<ILastLaunchStore>();
        store.Find("Bench").Returns(Record());
        store.Load("dev-1").Returns(Record(PlayState.Paused), Record());
        using var host = NewHost(store);

        var exitCode = await host.RunAsync("wait", "1s", "--device", "Bench", "--json");

        exitCode.Should().Be(0);
        using var document = JsonDocument.Parse(host.Consoles.StdOut);
        document.RootElement.GetProperty("waited").GetString().Should().Be("00:00:01");
    }
}
