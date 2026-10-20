using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The interactive menu on its private app, driven by key presses on an interactive test console.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class TuiHostTests : IDisposable
{
    private const int Credits = 5;
    private const int Devices = 3;
    private const int Leave = 6;

    private readonly TestHost _host;

    public TuiHostTests()
    {
        _host = new TestHost(terminal: true, configure: services => services.AddSingleton(Substitute.For<IPlayerService>()));
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
    }

    public void Dispose() => _host.Dispose();

    private string Screen => _host.Consoles.StdOut;

    private void Pick(int entry)
    {
        for (var i = 0; i < entry; i++) _host.Consoles.Out.Input.PushKey(ConsoleKey.DownArrow);
        _host.Consoles.Out.Input.PushKey(ConsoleKey.Enter);
    }

    private Task<int> RunMenu() => CliHost.CreateTui(_host.Composition).RunAsync();

    [Fact]
    public async Task TheMenu_OffersTheEntriesInOrder_AndNoStopEngine()
    {
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        var screen = Screen;
        new[] { "Launch", "Settings", "Index Files", "Devices", "Generate ASID Patches", "Credits", "Leave" }
            .Aggregate(-1, (previous, label) =>
            {
                var at = screen.IndexOf(label, previous + 1, StringComparison.Ordinal);
                at.Should().BeGreaterThan(previous, $"{label} comes after the entry before it");
                return at;
            });
        screen.Should().NotContain("Stop Engine");
    }

    [Fact]
    public async Task TheMenu_RunsInTuiMode_ShowingEverythingOnItsOwnScreen()
    {
        Pick(Leave);

        await RunMenu();

        _host.Composition.Output.RunMode.Should().Be(CliRunMode.Tui);
        _host.Consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task AFlowThatNeedsNoEngine_RunsWithoutOne_AndTheMenuReturns()
    {
        Pick(Credits);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        Screen.Should().Contain("Special thanks");
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task AFlowThatNeedsTheEngine_ReadiesIt_AndSelectsTheOnlyOnlineDeviceWithoutAsking()
    {
        var alpha = new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected");
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { alpha });
        Pick(Devices);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        _host.Devices.Received(1).Select(alpha);
        Screen.Should().Contain("Alpha");
    }

    [Fact]
    public async Task WhenNoDeviceIsOnline_TheMenuExitsWithOne_AfterSayingWhy()
    {
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<DeviceSummary>());
        Pick(Devices);

        var exitCode = await RunMenu();

        exitCode.Should().Be(1);
        Screen.Should().Contain("No TeensyROM is online. Connect one, then run `trom device discover`.");
    }

    [Fact]
    public async Task AnErrorInsideAFlow_IsShown_AndTheMenuReturns()
    {
        var alpha = new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected");
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(
            Task.FromResult<IReadOnlyList<DeviceSummary>>([alpha]),
            Task.FromException<IReadOnlyList<DeviceSummary>>(new TeensyApiException("tr-web stopped answering.")));
        Pick(Devices);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        Screen.Should().Contain("tr-web stopped answering.");
    }
}
