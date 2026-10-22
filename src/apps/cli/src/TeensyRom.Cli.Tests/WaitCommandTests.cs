using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Text.Json;
using TeensyRom.Cli.Commands.Wait;
using TeensyRom.Cli.Engine;

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

    private TestHost NewHost() => new(configure: services => services.AddSingleton(_clock));
}
