using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Tests;

/// <summary><c>trom api start</c> (<c>trom engine start</c>): readies the engine, then reports what <c>status</c> would.</summary>
[Collection(ConsoleCollection.Name)]
public sealed class EngineStartCommandTests : IDisposable
{
    private static readonly EngineStatus Running =
        new(true, "1.0.0", "1.0.0", true, "localhost:10213", null, "/home/logs", "/home/logs/Logs-1.txt");

    private readonly TestHost _host = new();

    public void Dispose() => _host.Dispose();

    [Fact]
    public async Task Start_ReadiesTheEngine_AndPrintsTheStatusDocument()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        var exitCode = await _host.RunAsync("api", "start", "--json");

        exitCode.Should().Be(0);
        await _host.Engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        var status = JsonDocument.Parse(_host.Consoles.StdOut).RootElement;
        status.GetProperty("running").GetBoolean().Should().BeTrue();
        status.GetProperty("version").GetString().Should().Be("1.0.0");
        status.GetProperty("logFolder").GetString().Should().Be("/home/logs");
    }

    [Fact]
    public async Task Start_PrintsTheSameDocumentAsStatus()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        await _host.RunAsync("api", "start", "--json");
        var started = _host.Consoles.StdOut;
        using var other = new TestHost();
        other.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);
        await other.RunAsync("api", "status", "--json");

        started.Should().Be(other.Consoles.StdOut);
    }

    [Fact]
    public async Task Start_WithoutJson_ShowsTheStatusRows()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        var exitCode = await _host.RunAsync("engine", "start");

        exitCode.Should().Be(0);
        _host.Consoles.StdOut.Should().Contain("Status: running").And.Contain("Trom API version: 1.0.0");
    }

    [Fact]
    public async Task Start_WhenTheEngineCannotStart_ExitsThree_WithNothingOnStdout()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The port is in use."));

        var exitCode = await _host.RunAsync("api", "start", "--json");

        exitCode.Should().Be((int)CliExitCode.EngineUnavailable);
        _host.Consoles.StdOut.Should().BeEmpty();
        _host.Consoles.StdErr.Should().Contain("The port is in use.");
        await _host.Engine.DidNotReceiveWithAnyArgs().GetStatusAsync(default);
    }
}
