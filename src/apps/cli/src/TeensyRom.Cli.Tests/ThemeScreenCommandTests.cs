using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The Theme screen over a substituted theme service, driven by keys and answers queued on an interactive console.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class ThemeScreenCommandTests : IDisposable
{
    private const int Change = 0;
    private const int Switch = 1;
    private const int Apply = 2;
    private const int Save = 3;
    private const int LeaveShipped = 4;
    private const int Overwrite = 4;
    private const int Delete = 5;
    private const int LeaveCustom = 6;

    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected");
    private static readonly DeviceSummary Beta = new("b-2", "Beta", true, "USB COM4", "Connected");
    private static readonly DeviceSummary Gamma = new("g-3", "Gamma", false, "USB COM5", "ConnectionLost");

    private static readonly ThemeColors Blues = new(6, 14, 14, 1, 3, 1, 15);
    private static readonly ThemeColors Mono = new(0, 0, 1, 1, 12, 12, 1);
    private static readonly ThemeColors Warm = new(9, 8, 7, 1, 2, 10, 15);

    private static readonly ThemeDto Default = Theme("tr-default", "Default", ThemeKind.Shipped, Blues);
    private static readonly ThemeDto MonoTheme = Theme("tr-mono", "Mono", ThemeKind.Shipped, Mono);
    private static readonly ThemeDto Mine = Theme("mine-id", "Mine", ThemeKind.Custom, Warm);

    private readonly IThemeService _themes = Substitute.For<IThemeService>();
    private readonly TestHost _host;
    private readonly Keys _keys;
    private IReadOnlyList<ThemeApplyOutcome>? _outcomes;
    private Exception? _applyFailure;

    public ThemeScreenCommandTests()
    {
        _host = new TestHost(terminal: true, configure: services => services.AddSingleton(_themes));
        _keys = new Keys(_host.Consoles.Out.Input);
        AnsiConsole.Console = _host.Consoles.Out;
        HasThemes(Default, MonoTheme, Mine);
        HasDevices(Alpha);
        HasRecord("a-1", Blues, "tr-default");
        _themes.CreateAsync(default!, default!, default).ReturnsForAnyArgs(call =>
            Theme("new-id", call.ArgAt<string>(0), ThemeKind.Custom, call.ArgAt<ThemeColors>(1)));
        _themes.ApplyAsync(default!, default!, default).ReturnsForAnyArgs(call =>
        {
            if (_applyFailure is not null) throw _applyFailure;
            return _outcomes ?? call.ArgAt<IReadOnlyList<DeviceSummary>>(0)
                .Select(device => new ThemeApplyOutcome(device, ThemeApplyStatus.Applied, Blues, true, null)).ToList();
        });
    }

    public void Dispose() => _host.Dispose();

    private string Screen => _host.Consoles.StdOut;

    /// <summary>Queues what the user would press and type, in order.</summary>
    private sealed class Keys(TestConsoleInput input)
    {
        public Keys Pick(int index)
        {
            for (var i = 0; i < index; i++) input.PushKey(ConsoleKey.DownArrow);
            input.PushKey(ConsoleKey.Enter);
            return this;
        }

        public Keys Text(string text)
        {
            input.PushTextWithEnter(text);
            return this;
        }

        /// <summary>Change a color: the row to edit, then how many Downs the color menu needs from where it starts.</summary>
        public Keys ChangeRow(int row, int downs) => Pick(Change).Pick(row).Pick(downs);
    }

    private Task<int> Run() => CliHost.CreateTuiApp(_host.Composition.Registrar).RunAsync(["theme"]);

    private static ThemeDto Theme(string id, string name, ThemeKind kind, ThemeColors colors) => new()
    {
        Id = id,
        Name = name,
        Kind = kind,
        Parts = new ThemePartsDto { Device = colors.ToDto() }
    };

    private void HasThemes(params ThemeDto[] themes) =>
        _themes.ListAsync(Arg.Any<CancellationToken>()).Returns(themes);

    private void HasDevices(params DeviceSummary[] devices) =>
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(devices);

    private void HasRecord(string deviceId, ThemeColors colors, string? themeId) =>
        _themes.GetDeviceRecordAsync(deviceId, Arg.Any<CancellationToken>())
            .Returns(new DeviceThemeRecordDto { DeviceId = deviceId, Colors = colors.ToDto(), ThemeId = themeId, IsRecorded = true });

    private void ReturnsOutcomes(params ThemeApplyOutcome[] outcomes) => _outcomes = outcomes;

    private async Task NothingWasSent()
    {
        await _themes.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default);
        await _themes.DidNotReceiveWithAnyArgs().CreateAsync(default!, default!, default);
        await _themes.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default!, default!, default);
        await _themes.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    // ---- opening -----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Opening_ShowsTheDevicesRecordedColors_WithTheMatchingThemeAsTheSource()
    {
        _keys.Pick(LeaveShipped);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("Theme: Default  (shipped)").And.Contain("Screen background").And.Contain("Blue").And.Contain("Light Grey");
        Screen.Should().NotContain("changed").And.NotContain("Overwrite").And.NotContain("Delete");
        await NothingWasSent();
    }

    [Fact]
    public async Task Opening_WithRecordedColorsThatNoLongerMatchTheTheme_HasNoSource()
    {
        HasRecord("a-1", Mono, "tr-default");
        _keys.Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Theme: Unsaved colors");
    }

    [Fact]
    public async Task Opening_WithNoOnlineDevice_UsesTheFactoryTheme()
    {
        HasDevices(Gamma);
        HasThemes(MonoTheme, Default);
        _keys.Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Theme: Default  (shipped)");
        await _themes.DidNotReceiveWithAnyArgs().GetDeviceRecordAsync(default!, default);
    }

    // ---- editing -----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ChangingARow_MarksItChanged_AndSendsNothing()
    {
        _keys.ChangeRow(row: 0, downs: 1).Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Screen background: Yellow").And.Contain("changed").And.Contain("Default  (shipped, edited)");
        await NothingWasSent();
    }

    [Fact]
    public async Task KeepCurrent_LeavesTheRowUnchanged()
    {
        _keys.ChangeRow(row: 0, downs: 10).Pick(LeaveShipped);

        await Run();

        Screen.Should().NotContain("changed").And.NotContain("edited");
    }

    [Fact]
    public async Task SwitchingTheme_LoadsItsColors_AndSendsNothing()
    {
        _keys.Pick(Switch).Pick(1).Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Theme: Mono  (shipped)");
        Screen.Should().NotContain("changed");
        await NothingWasSent();
    }

    // ---- apply -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_WithOneOnlineDevice_AppliesWithoutAsking()
    {
        _keys.Pick(Apply).Pick(LeaveShipped);

        await Run();

        await _themes.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<DeviceSummary>>(targets => targets.Count == 1 && targets[0] == Alpha),
            Arg.Is<ThemeApplyRequest>(request => request.Colors == Blues && request.ThemeId == "tr-default" && request.Overrides.Count == 0),
            Arg.Any<CancellationToken>());
        Screen.Should().NotContain("Apply to").And.Contain("Alpha: applied, and the C64 was reset.");
    }

    [Fact]
    public async Task Apply_WithTwoOnlineDevices_OffersAllFirst_AndAppliesToBoth()
    {
        HasDevices(Alpha, Beta, Gamma);
        _keys.Pick(Apply).Pick(0).Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("All online devices (2)");
        await _themes.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<DeviceSummary>>(targets => targets.SequenceEqual(new[] { Alpha, Beta })),
            Arg.Is<ThemeApplyRequest>(request => request.Colors == Blues && request.ThemeId == "tr-default"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_WithTwoOnlineDevices_CanTargetOne()
    {
        HasDevices(Alpha, Beta);
        _keys.Pick(Apply).Pick(2).Pick(LeaveShipped);

        await Run();

        await _themes.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<DeviceSummary>>(targets => targets.Count == 1 && targets[0] == Beta),
            Arg.Any<ThemeApplyRequest>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_WithNoOnlineDevice_SaysSo_AndSendsNothing()
    {
        _keys.Pick(Apply).Pick(LeaveShipped);
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(
            new[] { Alpha },
            new[] { Alpha with { IsOnline = false } },
            new[] { Alpha with { IsOnline = false } });

        await Run();

        Screen.Should().Contain("No TeensyROM is online.");
        await NothingWasSent();
    }

    [Fact]
    public async Task Apply_NamesEachDevicesOutcome()
    {
        HasDevices(Alpha, Beta);
        ReturnsOutcomes(
            new ThemeApplyOutcome(Alpha, ThemeApplyStatus.Busy, Blues, false, "The device is receiving a transfer."),
            new ThemeApplyOutcome(Beta, ThemeApplyStatus.Failed, null, false, "The device went away."));
        _keys.Pick(Apply).Pick(0).Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Alpha: busy with a transfer").And.Contain("Beta: failed. The device went away.");
    }

    [Fact]
    public async Task Apply_SaysWhenAnAppliedDeviceWasNotRecorded()
    {
        ReturnsOutcomes(new ThemeApplyOutcome(Alpha, ThemeApplyStatus.Applied, Blues, false, null));
        _keys.Pick(Apply).Pick(LeaveShipped);

        await Run();

        Screen.Should().Contain("Alpha: applied").And.Contain("Alpha: these colors were not recorded");
    }

    [Fact]
    public async Task AnEngineError_IsShown_AndTheScreenReturns()
    {
        _applyFailure = new TeensyApiException("tr-web could not reach the device.", 502);
        _keys.Pick(Apply).Pick(LeaveShipped);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("tr-web could not reach the device.");
    }

    // ---- save, overwrite, delete -------------------------------------------------------------------------------------

    [Fact]
    public async Task Save_CreatesTheTrimmedName_AndBecomesTheCustomSource()
    {
        _keys.ChangeRow(row: 0, downs: 1).Pick(Save).Text("  My Theme  ").Pick(LeaveCustom);

        await Run();

        var edited = Blues with { Background = 7 };

        await _themes.Received(1).CreateAsync("My Theme", edited, Arg.Any<CancellationToken>());
        Screen.Should().Contain("Theme: My Theme  (custom)").And.Contain("Overwrite \"My Theme\"");
    }

    [Fact]
    public async Task Overwrite_UpdatesTheSourceWithTheRows_AndClearsTheChangedMarks()
    {
        HasRecord("a-1", Warm, "mine-id");
        _keys.ChangeRow(row: 0, downs: 1).Pick(Overwrite).Pick(LeaveCustom);

        await Run();

        await _themes.Received(1).UpdateAsync("mine-id", "Mine", Warm with { Background = 10 }, Arg.Any<CancellationToken>());
        Screen.Should().Contain("Mine  (custom, edited)");
        var lastHeader = Screen[Screen.LastIndexOf("Theme: Mine", StringComparison.Ordinal)..].ReplaceLineEndings("\n").Split('\n')[0];

        lastHeader.Should().Contain("(custom)").And.NotContain("edited");
    }

    [Fact]
    public async Task Delete_WhenConfirmed_RemovesTheTheme_AndKeepsTheRows()
    {
        HasRecord("a-1", Warm, "mine-id");
        _keys.Pick(Delete).Pick(1).Pick(LeaveShipped);

        await Run();

        await _themes.Received(1).DeleteAsync("mine-id", Arg.Any<CancellationToken>());
        Screen.Should().Contain("Delete Mine?").And.Contain("Theme: Unsaved colors");
    }

    [Fact]
    public async Task Delete_WhenDeclined_KeepsTheTheme()
    {
        HasRecord("a-1", Warm, "mine-id");
        _keys.Pick(Delete).Pick(0).Pick(LeaveCustom);

        await Run();

        await _themes.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
        Screen.Should().Contain("Delete Mine?").And.NotContain("Unsaved colors");
    }

    // ---- user text ---------------------------------------------------------------------------------------------------

    [Fact]
    public async Task NamesWithBrackets_AreShownLiterally()
    {
        var odd = Theme("odd-id", "[red]x", ThemeKind.Custom, Blues);
        var device = Alpha with { Name = "[blue]d" };

        HasThemes(Default, odd);
        HasDevices(device);
        HasRecord("a-1", Blues, "odd-id");
        ReturnsOutcomes(new ThemeApplyOutcome(device, ThemeApplyStatus.Applied, Blues, true, null));
        _keys.Pick(Apply).Pick(LeaveCustom);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("Theme: [red]x  (custom)")
            .And.Contain("Overwrite \"[red]x\"")
            .And.Contain("Delete \"[red]x\"")
            .And.Contain("[blue]d: applied");
    }
}
