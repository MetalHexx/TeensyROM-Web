using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file next|previous|pause|stop</c> through the real tree over a substituted player service.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FilePlaybackCommandTests : IDisposable
{
    private const string NothingToCarryOn = "There's nothing to carry on from on Alpha yet — start with `trom file launch <path>` or `trom file random`.";
    private const string NotPausable = "games and programs can't be paused, so it was stopped by resetting the device";

    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly IPlayerService _player = Substitute.For<IPlayerService>();
    private readonly PlayerState _state = new() { CurrentItem = Song("/music/Commando.sid"), PlayState = PlayState.Playing };
    private readonly List<TestHost> _hosts = [];

    public FilePlaybackCommandTests()
    {
        _player.GetState().Returns(_ => _state with { });
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(bool terminal = false)
    {
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.AddSingleton(_player);
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        host.Devices.SelectedDevice.Returns(Alpha);
        _hosts.Add(host);
        return host;
    }

    private static SongItem Song(string path) => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path,
        Title = "Commando",
        Size = 4096
    };

    private static GameItem Game(string path) => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path,
        Size = 8192
    };

    private static LaunchOutcome Launched(ILaunchableItem item) => new(LaunchStatus.Launched, item, "Launched");

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static string[] Names(JsonElement element) => element.EnumerateObject().Select(p => p.Name).ToArray();

    private static string Lines(TestHost host) => host.Consoles.StdOut.Replace("\r\n", "\n");

    // ---- next and previous -------------------------------------------------------------------------------------------

    private void StepReturns(string verb, LaunchOutcome? outcome)
    {
        if (verb == "next") _player.NextAsync().Returns(outcome);
        else _player.PreviousAsync().Returns(outcome);
    }

    [Theory]
    [InlineData("next")]
    [InlineData("previous")]
    public async Task Step_WithNothingToCarryOnFrom_Fails_WithOneSentenceThatPointsToHowToStart(string verb)
    {
        _state.CurrentItem = null;
        var host = NewHost();

        var exitCode = await host.RunAsync("file", verb);

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain(NothingToCarryOn);
        host.Consoles.StdOut.Should().BeEmpty();
        await _player.DidNotReceive().NextAsync();
        await _player.DidNotReceive().PreviousAsync();
    }

    [Theory]
    [InlineData("next")]
    [InlineData("previous")]
    public async Task Step_WhenThePlayerFindsNothingToPlay_FailsTheSameWay(string verb)
    {
        StepReturns(verb, null);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", verb);

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain(NothingToCarryOn);
    }

    [Theory]
    [InlineData("next")]
    [InlineData("previous")]
    public async Task Step_PrintsTheLaunchedFileAsFileLaunchDoes(string verb)
    {
        StepReturns(verb, Launched(Song("/music/Delta.sid")));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", verb);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Lines(host).Should().Be("/music/Delta.sid\n");
    }

    [Fact]
    public async Task Next_Json_IsTheLaunchDocument()
    {
        StepReturns("next", Launched(Song("/music/Delta.sid")));
        var host = NewHost();

        await host.RunAsync("file", "next", "--json");

        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("status", "file", "message");
        result.GetProperty("status").GetString().Should().Be("launched");
        result.GetProperty("file").GetProperty("path").GetString().Should().Be("/music/Delta.sid");
    }

    [Fact]
    public async Task Next_OfAnIncompatibleFile_FailsWithTheMessage_AndStillPrintsTheFile()
    {
        StepReturns("next", new LaunchOutcome(LaunchStatus.Incompatible, Song("/music/Odd.sid"), "That SID needs more RAM."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "next");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("That SID needs more RAM.");
        Lines(host).Should().Be("/music/Odd.sid\n");
    }

    [Theory]
    [InlineData("next", "The next file wasn't found.")]
    [InlineData("previous", "The previous file wasn't found.")]
    public async Task Step_WhenTheFileIsNotFound_IsNotFound(string verb, string sentence)
    {
        StepReturns(verb, new LaunchOutcome(LaunchStatus.NotFound, null, null));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", verb);

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain(sentence);
    }

    [Fact]
    public async Task Step_WhenTr_WebDoesNotAnswer_ExitsAsAnyOtherCommandDoes()
    {
        _player.NextAsync().Returns(Task.FromException<LaunchOutcome?>(new TeensyApiException("The device abc was not found.", 404)));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "next");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("The device abc was not found.");
    }

    // ---- pause -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Pause_Json_NamesTheAction_AndLeavesOutAReasonAndAFileThereIsNone()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Paused, Song("/music/Commando.sid"), null, null));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("action", "file");
        result.GetProperty("action").GetString().Should().Be("paused");
        result.GetProperty("file").GetProperty("path").GetString().Should().Be("/music/Commando.sid");
    }

    [Fact]
    public async Task Pause_Json_OfAStop_CarriesTheReason()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Stopped, Game("/games/Uridium.prg"), NotPausable, null));
        var host = NewHost();

        await host.RunAsync("file", "pause", "--json");

        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("action", "reason", "file");
        result.GetProperty("action").GetString().Should().Be("stopped");
        result.GetProperty("reason").GetString().Should().Be(NotPausable);
    }

    [Fact]
    public async Task Pause_Json_WithNothingKnownAboutTheDevice_IsTheActionAlone()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Toggled, null, null, null));
        var host = NewHost();

        await host.RunAsync("file", "pause", "--json");

        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("action");
        result.GetProperty("action").GetString().Should().Be("toggled");
    }

    [Theory]
    [InlineData("Paused", "paused")]
    [InlineData("Resumed", "resumed")]
    [InlineData("Stopped", "stopped")]
    [InlineData("Relaunched", "relaunched")]
    [InlineData("Toggled", "toggled")]
    public async Task Pause_Piped_PrintsTheActionWord(string name, string word)
    {
        var action = Enum.Parse<PlayToggleAction>(name);
        var relaunch = action == PlayToggleAction.Relaunched ? Launched(Song("/music/Commando.sid")) : null;
        _player.ToggleAsync().Returns(new PlayToggleResult(action, Song("/music/Commando.sid"), null, relaunch));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Lines(host).Should().Be($"{word}\n");
    }

    [Fact]
    public async Task Pause_OnATerminal_SaysWhatHappenedInOneSentence()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Paused, Song("/music/Commando.sid"), null, null));
        var host = NewHost(terminal: true);

        await host.RunAsync("file", "pause");

        Lines(host).Should().Be("Paused Commando.sid.\n");
    }

    [Fact]
    public async Task Pause_OnATerminal_OfAStop_GivesTheReason()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Stopped, Game("/games/Uridium.prg"), NotPausable, null));
        var host = NewHost(terminal: true);

        await host.RunAsync("file", "pause");

        Lines(host).Should().Be($"Stopped Uridium.prg — {NotPausable}.\n");
    }

    [Theory]
    [InlineData("Incompatible", (int)CliExitCode.Failed)]
    [InlineData("NotFound", (int)CliExitCode.NotFound)]
    [InlineData("Failed", (int)CliExitCode.Failed)]
    public async Task Pause_WhenTheRelaunchFails_StillPrintsTheAction_AndExitsAsALaunchReportWould(string status, int expectedExit)
    {
        var game = Game("/games/Uridium.prg");
        var outcome = new LaunchOutcome(Enum.Parse<LaunchStatus>(status), game, "The unit can't run that.");
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Relaunched, game, "The unit can't run that.", outcome));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause", "--json");

        exitCode.Should().Be(expectedExit);
        var result = Parse(host.Consoles.StdOut);
        result.GetProperty("action").GetString().Should().Be("relaunched");
        result.GetProperty("reason").GetString().Should().Be("The unit can't run that.");
        result.GetProperty("file").GetProperty("path").GetString().Should().Be("/games/Uridium.prg");
        host.Consoles.StdErr.Should().Contain("The unit can't run that.");
    }

    [Fact]
    public async Task Pause_WhenTheRelaunchFails_PipedPrintsNoActionWord()
    {
        var game = Game("/games/Uridium.prg");
        var outcome = new LaunchOutcome(LaunchStatus.Incompatible, game, "The unit can't run that.");
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Relaunched, game, "The unit can't run that.", outcome));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdOut.Should().BeEmpty("the command did not relaunch anything");
    }

    [Fact]
    public async Task Pause_WhenTheDeviceCantBeReached_ExitsAsAnyOtherCommandDoes()
    {
        _player.ToggleAsync().Returns(Task.FromException<PlayToggleResult>(new TeensyApiException("The device abc was not found.", 404)));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdOut.Should().BeEmpty();
    }

    // ---- stop --------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Stop_Json_AnswersStopped_WithTheFileAndNoReason()
    {
        _player.StopAsync().Returns(Song("/music/Commando.sid"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "stop", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("action", "file");
        result.GetProperty("action").GetString().Should().Be("stopped");
        await _player.Received(1).StopAsync();
    }

    [Fact]
    public async Task Stop_WithNothingKnownAboutTheDevice_StillResets_AndAnswersTheActionAlone()
    {
        _player.StopAsync().Returns((ILaunchableItem?)null);
        var host = NewHost();

        await host.RunAsync("file", "stop", "--json");

        Names(Parse(host.Consoles.StdOut)).Should().Equal("action");
    }

    [Fact]
    public async Task Stop_SaysWhatItStopped_OnATerminal_AndTheActionWordWhenPiped()
    {
        _player.StopAsync().Returns(Song("/music/Commando.sid"));
        var terminal = NewHost(terminal: true);
        var piped = NewHost();

        await terminal.RunAsync("file", "stop");
        await piped.RunAsync("file", "stop");

        Lines(terminal).Should().Be("Stopped Commando.sid.\n");
        Lines(piped).Should().Be("stopped\n");
    }

    // ---- options -----------------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("next")]
    [InlineData("previous")]
    [InlineData("pause")]
    [InlineData("stop")]
    public async Task NoPlaybackVerbAcceptsAStorage(string verb)
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", verb, "--storage", "usb");

        exitCode.Should().Be((int)CliExitCode.Usage);
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task EveryPlaybackVerb_WorksOnTheDeviceNamed()
    {
        _player.ToggleAsync().Returns(new PlayToggleResult(PlayToggleAction.Paused, Song("/music/Commando.sid"), null, null));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "pause", "--device", "alpha");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Devices.Received(1).Select(Alpha);
    }
}
