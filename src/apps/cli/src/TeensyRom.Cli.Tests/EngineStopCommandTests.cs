using NSubstitute;
using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Engine;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Tests;

public sealed class EngineStopCommandTests
{
    private readonly TestConsoles _consoles = new();
    private readonly IEngineControl _engine = Substitute.For<IEngineControl>();

    private EngineStopCommand Command() => new(new CliOutput(_consoles.Consoles), _engine);

    private Task<int> Stop(EngineStopOutcome outcome)
    {
        _engine.StopAsync(Arg.Any<CancellationToken>()).Returns(outcome);

        return Command().ExecuteAsync(new CommandContext([], Substitute.For<IRemainingArguments>(), "stop", null), new EngineStopSettings());
    }

    private async Task<CliException> StopFailing(EngineStopOutcome outcome)
    {
        var act = () => Stop(outcome);

        return (await act.Should().ThrowAsync<CliException>()).Which;
    }

    [Fact]
    public async Task Stop_OfARunningEngine_ReportsItStoppedAndSucceeds()
    {
        var exitCode = await Stop(EngineStopOutcome.Stopped);

        exitCode.Should().Be(0);
        _consoles.StdErr.Should().Contain("TeensyROM engine stopped. The web app it served has stopped too.");
    }

    [Fact]
    public async Task Stop_WithNoEngineRunning_SaysSoAndSucceeds()
    {
        var exitCode = await Stop(EngineStopOutcome.NotRunning);

        exitCode.Should().Be(0);
        _consoles.StdErr.Should().Contain("No TeensyROM engine is running.");
    }

    [Fact]
    public async Task Stop_OfAnEngineThatCannotBeStopped_ExplainsAndFails()
    {
        var error = await StopFailing(EngineStopOutcome.NotSupported);

        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Contain("can't be stopped from the CLI");
    }

    [Fact]
    public async Task Stop_WhenSomethingElseUsesThePort_SaysSoAndFails()
    {
        var error = await StopFailing(EngineStopOutcome.Foreign);

        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Contain("Something other than a TeensyROM engine is using port 10213");
    }

    [Fact]
    public async Task Stop_OfAnEngineThatDoesNotLetGo_NamesTheLogsAndFails()
    {
        var error = await StopFailing(EngineStopOutcome.Failed);

        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Contain("didn't stop within 45 seconds").And.Contain(TeensyRomHome.EngineLogsPath);
    }

    [Fact]
    public async Task Stop_NeverStartsAnEngine()
    {
        await Stop(EngineStopOutcome.NotRunning);

        await _engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }
}
