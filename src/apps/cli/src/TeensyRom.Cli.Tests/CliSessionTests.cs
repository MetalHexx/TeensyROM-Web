using NSubstitute;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Testing;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

[Collection(ConsoleCollection.Name)]
public sealed class CliSessionTests : IDisposable
{
    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;
    private readonly TestConsole _console = new TestConsole().Interactive();
    private readonly IEngineControl _engine = Substitute.For<IEngineControl>();
    private readonly IDeviceService _devices = Substitute.For<IDeviceService>();
    private readonly CliSession _sut;

    public CliSessionTests()
    {
        _console.Profile.Width = 200;
        AnsiConsole.Console = _console;
        RecordedCommand.Runs.Clear();
        _devices.GetDevicesAsync(Arg.Any<CancellationToken>())
            .Returns(new[] { new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected") });

        var app = new CommandApp();
        app.Configure(config =>
        {
            config.PropagateExceptions();
            config.AddCommand<RecordedCommand>("ports");
            config.AddCommand<RecordedCommand>("credits");
            config.AddCommand<RecordedCommand>("stop");
        });
        _sut = new CliSession(app, new StartupGate(_engine, _devices));
    }

    public void Dispose() => AnsiConsole.Console = _originalConsole;

    private void EngineStarts() => _engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);

    [Fact]
    public async Task RunCommand_ForACommandThatNeedsTheEngine_ReadiesItFirstThenRunsTheCommand()
    {
        EngineStarts();
        _console.Input.PushKey(ConsoleKey.Enter);

        var exitCode = await _sut.RunCommandAsync(["ports"]);

        exitCode.Should().Be(RecordedCommand.ExitCode);
        RecordedCommand.Runs.Should().Equal("ports");
        await _engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunCommand_WhenTheEngineCannotBeReadied_FailsWithoutRunningTheCommand()
    {
        _engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The TeensyROM engine didn't start."));

        var exitCode = await _sut.RunCommandAsync(["ports"]);

        exitCode.Should().Be(1);
        RecordedCommand.Runs.Should().BeEmpty();
    }

    [Theory]
    [InlineData("credits")]
    [InlineData("ports", "-h")]
    public async Task RunCommand_ForACommandThatNeedsNoEngine_NeverStartsOne(params string[] args)
    {
        var exitCode = await _sut.RunCommandAsync(args);

        exitCode.Should().Be(args.Contains("-h") ? 0 : RecordedCommand.ExitCode);
        await _engine.DidNotReceive().EnsureRunningAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunCommand_AfterStop_ChecksTheEngineAgainForTheNextEngineCommand()
    {
        EngineStarts();
        _console.Input.PushKey(ConsoleKey.Enter);
        await _sut.RunCommandAsync(["ports"]);
        await _sut.RunCommandAsync(["ports"]);
        await _engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());

        await _sut.RunCommandAsync(["stop"]);
        _console.Input.PushKey(ConsoleKey.Enter);
        await _sut.RunCommandAsync(["ports"]);

        await _engine.Received(2).EnsureRunningAsync(Arg.Any<CancellationToken>());
    }

    private sealed class RecordedCommand : Command<RecordedCommand.NoSettings>
    {
        public const int ExitCode = 7;

        public static List<string> Runs { get; } = [];

        public sealed class NoSettings : CommandSettings;

        public override int Execute(CommandContext context, NoSettings settings)
        {
            Runs.Add(context.Name);
            return ExitCode;
        }
    }
}
