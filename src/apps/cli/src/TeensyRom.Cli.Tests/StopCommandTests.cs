using NSubstitute;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Testing;
using TeensyRom.Cli.Commands.Main;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

[Collection(ConsoleCollection.Name)]
public sealed class StopCommandTests : IDisposable
{
    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;
    private readonly TestConsole _console = new TestConsole().Interactive();
    private readonly IEngineControl _engine = Substitute.For<IEngineControl>();
    private readonly IPlayerService _player = Substitute.For<IPlayerService>();

    public StopCommandTests()
    {
        _console.Profile.Width = 300;
        AnsiConsole.Console = _console;
    }

    public void Dispose() => AnsiConsole.Console = _originalConsole;

    private async Task<int> Stop(EngineStopOutcome outcome)
    {
        _engine.StopAsync(Arg.Any<CancellationToken>()).Returns(outcome);

        return await new StopCommand(_engine, _player)
            .ExecuteAsync(new CommandContext([], Substitute.For<IRemainingArguments>(), "stop", null), new StopSettings());
    }

    [Fact]
    public async Task Stop_OfARunningEngine_ReportsItStoppedAndSucceeds()
    {
        var exitCode = await Stop(EngineStopOutcome.Stopped);

        exitCode.Should().Be(0);
        _console.Output.Should().Contain("TeensyROM engine stopped. The web app it served has stopped too.");
    }

    [Fact]
    public async Task Stop_WithNoEngineRunning_SaysSoAndSucceeds()
    {
        var exitCode = await Stop(EngineStopOutcome.NotRunning);

        exitCode.Should().Be(0);
        _console.Output.Should().Contain("No TeensyROM engine is running.");
    }

    [Fact]
    public async Task Stop_OfAnEngineThatCannotBeStopped_ExplainsAndFails()
    {
        var exitCode = await Stop(EngineStopOutcome.NotSupported);

        exitCode.Should().Be(1);
        _console.Output.Should().Contain("can't be stopped from the CLI");
    }

    [Fact]
    public async Task Stop_WhenSomethingElseUsesThePort_SaysSoAndFails()
    {
        var exitCode = await Stop(EngineStopOutcome.Foreign);

        exitCode.Should().Be(1);
        _console.Output.Should().Contain("Something other than a TeensyROM engine is using port 10213.");
    }

    [Fact]
    public async Task Stop_OfAnEngineThatDoesNotLetGo_NamesTheLogsAndFails()
    {
        var exitCode = await Stop(EngineStopOutcome.Failed);

        exitCode.Should().Be(1);
        _console.Output.Should().Contain("didn't stop within 45 seconds").And.Contain(TeensyRomHome.EngineLogsPath);
    }

    [Fact]
    public async Task Stop_EndsTheDeviceLogFollowBeforeTheEngineGoes()
    {
        await Stop(EngineStopOutcome.Stopped);

        Received.InOrder(() =>
        {
            _player.StopStream();
            _engine.StopAsync(Arg.Any<CancellationToken>());
        });
    }
}
