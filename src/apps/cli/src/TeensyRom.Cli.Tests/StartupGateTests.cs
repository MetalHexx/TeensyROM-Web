using NSubstitute;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ConsoleCollection
{
    public const string Name = "Static AnsiConsole";
}

[Collection(ConsoleCollection.Name)]
public sealed class StartupGateTests : IDisposable
{
    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;
    private readonly TestConsole _console = new TestConsole().Interactive();
    private readonly IEngineControl _engine = Substitute.For<IEngineControl>();
    private readonly IDeviceService _devices = Substitute.For<IDeviceService>();
    private readonly StartupGate _sut;

    public StartupGateTests()
    {
        _console.Profile.Width = 200;
        AnsiConsole.Console = _console;
        _engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _sut = new StartupGate(_engine, _devices);
    }

    public void Dispose() => AnsiConsole.Console = _originalConsole;

    private static DeviceSummary Online(string id, string name, string connection = "USB COM3") =>
        new(id, name, true, connection, "Connected");

    private static DeviceSummary Offline(string id, string name) =>
        new(id, name, false, "USB COM9", "ConnectionLost");

    private void TrWebKnows(params DeviceSummary[] known) =>
        _devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(known);

    [Fact]
    public async Task EnsureReady_OffersOnlyOnlineDevices_AndSelectsThePick()
    {
        var alpha = Online("a", "Alpha");
        var bravo = Online("b", "Bravo", "Ethernet 10.0.0.7");
        TrWebKnows(alpha, Offline("c", "Charlie"), bravo);
        _console.Input.PushKey(ConsoleKey.DownArrow);
        _console.Input.PushKey(ConsoleKey.Enter);

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeTrue();
        _devices.Received(1).Select(bravo);
        _console.Output.Should().Contain("Alpha (USB COM3)").And.Contain("Bravo (Ethernet 10.0.0.7)").And.NotContain("Charlie");
    }

    [Fact]
    public async Task EnsureReady_WithOneOnlineDevice_StillPrompts()
    {
        var alpha = Online("a", "Alpha");
        TrWebKnows(alpha);
        _console.Input.PushKey(ConsoleKey.Enter);

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeTrue();
        _devices.Received(1).Select(alpha);
        _console.Input.IsKeyAvailable().Should().BeFalse("the prompt consumed the key press");
    }

    [Fact]
    public async Task EnsureReady_WithADeviceNameThatLooksLikeMarkup_ShowsItAsTyped()
    {
        var odd = Online("a", "[red]Rig[/] #1");
        TrWebKnows(odd);
        _console.Input.PushKey(ConsoleKey.Enter);

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeTrue();
        _devices.Received(1).Select(odd);
        _console.Output.Should().Contain("[red]Rig[/] #1");
    }

    [Fact]
    public async Task EnsureReady_WithNoOnlineDevice_SaysSoAndFails()
    {
        TrWebKnows(Offline("c", "Charlie"));

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeFalse();
        _console.Output.Should().Contain("No TeensyROM is online in tr-web — connect one in tr-web and try again.");
        _devices.DidNotReceive().Select(Arg.Any<DeviceSummary>());
    }

    [Fact]
    public async Task EnsureReady_WhenListingDevicesFails_ShowsItsMessageAndFails()
    {
        _devices.GetDevicesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IReadOnlyList<DeviceSummary>>(new TeensyApiException("tr-web is busy listing devices — try again in a few seconds.", 503)));

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeFalse();
        _console.Output.Should().Contain("tr-web is busy listing devices — try again in a few seconds.");
    }

    [Fact]
    public async Task EnsureReady_WhenTheEngineIsNotReady_ShowsWhyAndNeverAsksForDevices()
    {
        _engine.EnsureRunningAsync(Arg.Any<CancellationToken>())
            .Returns(EngineReady.Failed("The TeensyROM engine didn't start (it didn't answer within 180 seconds)."));

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeFalse();
        _console.Output.Should().Contain("The TeensyROM engine didn't start");
        await _devices.DidNotReceive().GetDevicesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EnsureReady_OnceReady_DoesNotCheckAgain()
    {
        TrWebKnows(Online("a", "Alpha"));
        _console.Input.PushKey(ConsoleKey.Enter);
        await _sut.EnsureReadyAsync();

        var again = await _sut.EnsureReadyAsync();

        again.Should().BeTrue();
        await _engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        await _devices.Received(1).GetDevicesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EnsureReady_WhenAFailedAttemptIsRetried_ChecksAgain()
    {
        TrWebKnows(Offline("c", "Charlie"));
        await _sut.EnsureReadyAsync();

        await _sut.EnsureReadyAsync();

        await _engine.Received(2).EnsureRunningAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EnsureReady_WithoutAnInteractiveTerminal_SaysSoInsteadOfPrompting()
    {
        var plain = new TestConsole();
        plain.Profile.Width = 200;
        AnsiConsole.Console = plain;
        TrWebKnows(Online("a", "Alpha"));

        var ready = await _sut.EnsureReadyAsync();

        ready.Should().BeFalse();
        plain.Output.Should().Contain("Choosing a TeensyROM needs an interactive terminal.");
        _devices.DidNotReceive().Select(Arg.Any<DeviceSummary>());
    }
}
