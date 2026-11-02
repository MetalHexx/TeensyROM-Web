using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console;
using NSubstitute.ExceptionExtensions;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Tests.Update;
using TeensyRom.Cli.Themes;
using TeensyRom.Cli.Update;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The interactive menu on its private app, driven by key presses on an interactive test console.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class TuiHostTests : IDisposable
{
    private const int OpenWebUi = 1;
    private const int Credits = 7;
    private const int Devices = 4;
    private const int Theme = 5;
    private const int Leave = 9;
    private const int UpdateEntry = 9;
    private const int LeaveAfterUpdateEntry = 10;

    private readonly IThemeService _themes = Substitute.For<IThemeService>();
    private readonly IWebUiProbe _webUi = Substitute.For<IWebUiProbe>();
    private readonly IEngineLocator _locator = Substitute.For<IEngineLocator>();
    private readonly TestHost _host;

    public TuiHostTests()
    {
        _host = new TestHost(terminal: true, configure: services =>
        {
            services.AddSingleton(Substitute.For<IPlayerService>());
            services.AddSingleton(_themes);
            services.AddSingleton(_webUi);
            services.AddSingleton(_locator);
        });
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
        new[] { "Launch", "Open Trom UI", "Watch Folders", "Index Files", "Devices", "Theme", "Generate ASID Patches", "Credits", "Settings", "Leave" }
            .Aggregate(-1, (previous, label) =>
            {
                var at = screen.IndexOf(label, previous + 1, StringComparison.Ordinal);
                at.Should().BeGreaterThan(previous, $"{label} comes after the entry before it");
                return at;
            });
        screen.Should().NotContain("Stop Engine").And.NotContain("Update to").And.NotContain("`trom update`");
    }

    // ---- the update entry -----------------------------------------------------------------------------------

    private static readonly UpdateStatus NewerRelease = new("1.0.0-beta.1", "1.0.0-beta.2", true, InstallKind.Release, null);

    private void ANewerReleaseWasFound()
    {
        _host.ReleaseCheck.CachedStatus = NewerRelease;
        _host.Updates.CheckAsync(Arg.Any<CancellationToken>()).Returns(new UpdateCheckResult(
            NewerRelease,
            ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64"),
            new ReleaseAsset("TeensyROM-Suite-1.0.0-beta.2-win-x64.zip", "https://example.test/a.zip", 1000, "sha256:" + new string('a', 64))));
    }

    private void TheUpdateAnswers(UpdateApplied applied) =>
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .Returns(applied);

    [Fact]
    public async Task WhenANewerReleaseIsKnown_TheLogoLineAndTheEntryJustBeforeLeaveAppear_WithoutLookingAnythingUp()
    {
        ANewerReleaseWasFound();
        Pick(LeaveAfterUpdateEntry);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        var screen = Screen;
        var sentence = screen.IndexOf("TeensyROM Suite 1.0.0-beta.2 is out (you have 1.0.0-beta.1). Run `trom update`.", StringComparison.Ordinal);
        sentence.Should().BeGreaterThan(-1);
        sentence.Should().BeLessThan(screen.IndexOf("Choose wisely", StringComparison.Ordinal), "the line sits under the logo, above the first prompt");
        screen.IndexOf("Update to 1.0.0-beta.2", StringComparison.Ordinal).Should().BeInRange(screen.IndexOf("Settings", StringComparison.Ordinal), screen.IndexOf("Leave", StringComparison.Ordinal));
        _host.ReleaseCheck.Refreshes.Should().Be(0, "the menu draws from what is cached and never waits for the network");
    }

    [Fact]
    public async Task TheUpdateEntry_AsksFirst_Installs_AndClosesTheMenuWithoutAnEngine()
    {
        ANewerReleaseWasFound();
        TheUpdateAnswers(new UpdateApplied("1.0.0-beta.1", "1.0.0-beta.2", false, false, null));
        Pick(UpdateEntry);
        Pick(0);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0, _host.Consoles.StdErr);
        await _host.Updates.Received(1).ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>());
        Screen.Should().Contain("Update TeensyROM Suite from 1.0.0-beta.1 to 1.0.0-beta.2?").And.Contain("Updated TeensyROM Suite from 1.0.0-beta.1 to 1.0.0-beta.2.")
            .And.Contain("run `trom` again to use TeensyROM Suite 1.0.0-beta.2");
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        _host.TransferLines.Disposals.Should().Be(1);
    }

    [Fact]
    public async Task TheUpdateEntry_WhenDeclined_InstallsNothing_AndTheMenuStaysOpen()
    {
        ANewerReleaseWasFound();
        Pick(UpdateEntry);
        Pick(1);
        Pick(LeaveAfterUpdateEntry);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        await _host.Updates.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default, default);
        Screen.Should().Contain("Cancelled; nothing was changed.");
    }

    [Fact]
    public async Task TheUpdateEntry_WhenTheUpdateFails_ShowsWhy_AndTheMenuStaysOpen()
    {
        ANewerReleaseWasFound();
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.Failed, "Another trom update is already running."));
        Pick(UpdateEntry);
        Pick(0);
        Pick(LeaveAfterUpdateEntry);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        Screen.Should().Contain("Another trom update is already running.");
    }

    [Fact]
    public async Task TheUpdateEntry_WhenTheLookupNowFindsNothing_SaysSo_AndTheMenuStaysOpen()
    {
        ANewerReleaseWasFound();
        _host.Updates.CheckAsync(Arg.Any<CancellationToken>()).Returns(new UpdateCheckResult(NewerRelease with { Latest = "1.0.0-beta.1", Available = false }, null, null));
        Pick(UpdateEntry);
        Pick(LeaveAfterUpdateEntry);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        Screen.Should().Contain("TeensyROM Suite 1.0.0-beta.1 is the newest release.");
        await _host.Updates.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default, default);
    }

    private static ThemeDto FactoryTheme() => new()
    {
        Id = ThemeColors.FactoryThemeId,
        Name = "TR Default",
        Kind = ThemeKind.Shipped,
        Parts = new ThemePartsDto { Device = new ThemeColors(6, 14, 14, 1, 3, 1, 15).ToDto() }
    };

    [Fact]
    public async Task ThemeEntry_WithNoOnlineDevice_StillOpensTheScreen_WithoutSelectingADevice()
    {
        _themes.ListAsync(Arg.Any<CancellationToken>()).Returns(new[] { FactoryTheme() });
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<DeviceSummary>());
        Pick(Theme);
        Pick(4);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0, _host.Consoles.StdErr);
        Screen.Should().Contain("Theme: TR Default  (shipped)");
        _host.Devices.DidNotReceive().Select(Arg.Any<DeviceSummary>());
    }

    [Fact]
    public async Task ThemeEntry_StartsTheThemeScreen_ThenReturnsToTheMenu()
    {
        var factory = FactoryTheme();

        _themes.ListAsync(Arg.Any<CancellationToken>()).Returns(new[] { factory });
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected") });
        _themes.GetDeviceRecordAsync("a", Arg.Any<CancellationToken>()).Returns(
            new DeviceThemeRecordDto { DeviceId = "a", Colors = factory.Parts.Device, ThemeId = factory.Id, IsRecorded = false });
        Pick(Theme);
        Pick(4);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0, _host.Consoles.StdErr);
        Screen.Should().Contain("Theme: TR Default  (shipped)");
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
    public async Task TheMenu_StartsFollowingTransfers_WithoutWaitingForTheStartToFinish()
    {
        _host.TransferLines.StartResult = new TaskCompletionSource().Task;
        Pick(Leave);

        var exitCode = await RunMenu().WaitAsync(TimeSpan.FromSeconds(10));

        exitCode.Should().Be(0);
        _host.TransferLines.Starts.Should().Be(1);
        Screen.Should().Contain("Leave");
    }

    [Fact]
    public async Task TheMenu_DisposesTheTransferLines_WhenTheUserLeaves()
    {
        Pick(Leave);

        await RunMenu();

        _host.TransferLines.Disposals.Should().Be(1);
    }

    [Fact]
    public async Task TheMenu_DisposesTheTransferLines_WhenTheGateFails()
    {
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<DeviceSummary>());
        Pick(Devices);

        var exitCode = await RunMenu();

        exitCode.Should().Be(1);
        _host.TransferLines.Disposals.Should().Be(1);
    }

    [Fact]
    public async Task AfterTheEngineIsReady_TheMenuAsksTheTransferLinesToStartAgain()
    {
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected") });
        Pick(Devices);
        Pick(Leave);

        await RunMenu();

        _host.TransferLines.Starts.Should().Be(2);
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
    public async Task OpenTromUi_ReadiesTheEngine_OpensTheBrowser_AndTheMenuReturns()
    {
        _webUi.IsServingAsync(Arg.Any<CancellationToken>()).Returns(true);
        Pick(OpenWebUi);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        await _host.Engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        _host.BrowserOpener.Opened.Should().Equal("http://localhost:10213");
        Screen.Should().Contain("Opened in your browser").And.Contain("http://192.168.1.20:10213");
        _host.Devices.DidNotReceive().Select(Arg.Any<DeviceSummary>());
    }

    [Fact]
    public async Task OpenTromUi_WhenTheWebUiIsNotServed_ShowsTheProblem_AndOpensNothing()
    {
        _webUi.IsServingAsync(Arg.Any<CancellationToken>()).Returns(false);
        _locator.Locate().Returns(new EngineLookup(new EngineLocation(EngineMode.Packaged, "/install/api"), "/install/api"));
        Pick(OpenWebUi);
        Pick(Leave);

        var exitCode = await RunMenu();

        exitCode.Should().Be(0);
        Screen.Should().Contain("isn't serving Trom UI");
        _host.BrowserOpener.Opened.Should().BeEmpty();
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
