using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom theme</c> through the real tree over a substituted theme service and device chooser.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class ThemeCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected");
    private static readonly DeviceSummary Beta = new("b-2", "Beta", true, "USB COM4", "Connected");
    private static readonly DeviceSummary Gamma = new("g-3", "Gamma", false, "USB COM5", "ConnectionLost");

    private static readonly ThemeColors Blues = new(6, 14, 14, 1, 3, 1, 15);
    private static readonly ThemeColors Mono = new(0, 0, 1, 1, 12, 12, 1);

    private readonly IThemeService _themes = Substitute.For<IThemeService>();
    private readonly IDeviceChooser _chooser = Substitute.For<IDeviceChooser>();
    private readonly List<TestHost> _hosts = [];
    private IReadOnlyList<ThemeApplyOutcome>? _outcomes;
    private Exception? _createFailure;

    public ThemeCommandTests()
    {
        _chooser.ChooseAsync(Arg.Any<string?>(), Arg.Any<DeviceScope>(), Arg.Any<CancellationToken>()).Returns(Alpha);
        _themes.CreateAsync(default!, default!, default).ReturnsForAnyArgs(call =>
            _createFailure is null ? Custom("new-id", call.ArgAt<string>(0), call.ArgAt<ThemeColors>(1)) : throw _createFailure);
        _themes.UpdateAsync(default!, default!, default!, default).ReturnsForAnyArgs(call => Custom(call.ArgAt<string>(0), call.ArgAt<string>(1), call.ArgAt<ThemeColors>(2)));
        _themes.ApplyAsync(default!, default!, default).ReturnsForAnyArgs(call =>
            _outcomes ?? call.ArgAt<IReadOnlyList<DeviceSummary>>(0).Select(Applied).ToList());
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(bool terminal = false, params DeviceSummary[] devices)
    {
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton(_chooser);
            services.AddSingleton(_themes);
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(devices);
        _hosts.Add(host);
        return host;
    }

    private static ThemeDto Theme(string id, string name, ThemeKind kind, ThemeColors colors) => new()
    {
        Id = id,
        Name = name,
        Kind = kind,
        Parts = new ThemePartsDto { Device = colors.ToDto() }
    };

    private static ThemeDto Shipped(string id, string name, ThemeColors colors) => Theme(id, name, ThemeKind.Shipped, colors);

    private static ThemeDto Custom(string id, string name, ThemeColors colors) => Theme(id, name, ThemeKind.Custom, colors);

    private static ThemeApplyOutcome Applied(DeviceSummary device) => new(device, ThemeApplyStatus.Applied, Blues, true, null);

    private static ThemeApplyOutcome Busy(DeviceSummary device) => new(device, ThemeApplyStatus.Busy, Blues, false, "busy");

    private static ThemeApplyOutcome Failed(DeviceSummary device) => new(device, ThemeApplyStatus.Failed, null, false, "The device went away.");

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private void ThemesAre(params ThemeDto[] themes)
    {
        _themes.ListAsync(Arg.Any<CancellationToken>()).Returns(themes);
        _themes.FindAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            var wanted = call.Arg<string>().Trim();
            return themes.FirstOrDefault(t => t.Id == wanted || t.Name.Equals(wanted, StringComparison.OrdinalIgnoreCase))
                ?? throw new CliException(CliExitCode.NotFound, $"No theme matches '{wanted}'.");
        });
    }

    private void RecordIs(DeviceSummary device, ThemeColors colors, string? themeId, bool recorded = true) =>
        _themes.GetDeviceRecordAsync(device.Id, Arg.Any<CancellationToken>()).Returns(new DeviceThemeRecordDto
        {
            DeviceId = device.Id,
            Colors = colors.ToDto(),
            ThemeId = themeId,
            IsRecorded = recorded,
            AppliedAt = recorded ? new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero) : null
        });

    private void ApplyReturns(params ThemeApplyOutcome[] outcomes) => _outcomes = outcomes;

    // ---- slot flags --------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_WithAnUnknownColor_IsAUsageError_BeforeTheEngineIsTouched()
    {
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "pink");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--border must be one of the C64's 16 colors").And.Contain("light red").And.Contain("not 'pink'");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Apply_WithNothingToApply_IsAUsageError_BeforeTheEngineIsTouched()
    {
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "apply");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("Name a theme, or give at least one color flag such as --border blue");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Apply_ReadsColorsByNameInAnyCaseAndByNumber()
    {
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "Light Blue", "--background", "0", "--keys", "LIGHT RED");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).ApplyAsync(
            Arg.Any<IReadOnlyList<DeviceSummary>>(),
            Arg.Is<ThemeApplyRequest>(r => r.Colors == null && r.ThemeId == null
                && r.Overrides.Count == 3 && r.Overrides[ThemeSlot.Border] == 14 && r.Overrides[ThemeSlot.Background] == 0 && r.Overrides[ThemeSlot.Keys] == 10),
            Arg.Any<CancellationToken>());
    }

    // ---- apply -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_OfAMissingTheme_ExitsNotFound_WithoutApplying()
    {
        ThemesAre(Shipped("blues", "The Blues", Blues));
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "apply", "No such");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        await _themes.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default);
    }

    [Fact]
    public async Task Apply_ANamedTheme_GoesToEveryOnlineDevice_WithTheThemesColorsAndId()
    {
        ThemesAre(Shipped("blues", "The Blues", Blues));
        var host = NewHost(false, Alpha, Gamma, Beta);

        var exitCode = await host.RunAsync("theme", "apply", "the blues", "--border", "red", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<DeviceSummary>>(d => d.Select(x => x.Id).SequenceEqual(new[] { "a-1", "b-2" })),
            Arg.Is<ThemeApplyRequest>(r => r.Colors == Blues && r.ThemeId == "blues" && r.Overrides[ThemeSlot.Border] == 2),
            Arg.Any<CancellationToken>());
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("theme").GetProperty("name").GetString().Should().Be("The Blues");
        var devices = document.GetProperty("devices");
        devices.GetArrayLength().Should().Be(2);
        devices[0].GetProperty("status").GetString().Should().Be("applied");
        devices[0].GetProperty("recorded").GetBoolean().Should().BeTrue();
        devices[0].GetProperty("colors").GetProperty("border").GetProperty("name").GetString().Should().Be("Light Blue");
        host.Consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task Apply_WithDevice_GoesToOnlyThatDevice()
    {
        ThemesAre(Shipped("blues", "The Blues", Blues));
        _chooser.ChooseAsync("Beta", DeviceScope.Online, Arg.Any<CancellationToken>()).Returns(Beta);
        var host = NewHost(false, Alpha, Beta);

        var exitCode = await host.RunAsync("theme", "apply", "The Blues", "--device", "Beta");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<DeviceSummary>>(d => d.Count == 1 && d[0].Id == "b-2"), Arg.Any<ThemeApplyRequest>(), Arg.Any<CancellationToken>());
        host.Consoles.StdOut.Should().Contain("Beta: applied The Blues; the C64 was reset.");
    }

    [Fact]
    public async Task Apply_WithAnOfflineDevice_ExitsNoDevice_WithTheChoosersMessage()
    {
        _chooser.ChooseAsync("Gamma", DeviceScope.Online, Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.NoDevice, "Gamma is offline. Run `trom device reconnect --device Gamma`."));
        var host = NewHost(false, Gamma);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "blue", "--device", "Gamma");

        exitCode.Should().Be((int)CliExitCode.NoDevice);
        host.Consoles.StdErr.Should().Contain("Gamma is offline");
        await _themes.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default);
    }

    [Fact]
    public async Task Apply_WithNoOnlineDevice_ExitsNoDevice()
    {
        var host = NewHost(false, Gamma);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "blue");

        exitCode.Should().Be((int)CliExitCode.NoDevice);
        host.Consoles.StdErr.Should().Contain("No TeensyROM is online.");
        await _themes.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default);
    }

    [Fact]
    public async Task Apply_Plain_WritesOneLinePerDevice()
    {
        ApplyReturns(Applied(Alpha), Busy(Beta), Failed(Gamma));
        var host = NewHost(false, Alpha, Beta, Gamma);

        await host.RunAsync("theme", "apply", "--border", "blue");

        host.Consoles.StdOut.Should().Contain("Alpha: applied; the C64 was reset.")
            .And.Contain("Beta: busy with a transfer — try again when it finishes.")
            .And.Contain("Gamma: failed — The device went away.");
    }

    [Fact]
    public async Task Apply_ExitCodes_AllApplied0_OnlyBusy6_Mixed1()
    {
        var host = NewHost(false, Alpha, Beta);

        ApplyReturns(Applied(Alpha), Applied(Beta));
        (await host.RunAsync("theme", "apply", "--border", "blue")).Should().Be(0);

        ApplyReturns(Busy(Alpha), Busy(Beta));
        (await host.RunAsync("theme", "apply", "--border", "blue")).Should().Be((int)CliExitCode.DeviceBusy);

        ApplyReturns(Applied(Alpha), Failed(Beta));
        (await host.RunAsync("theme", "apply", "--border", "blue")).Should().Be((int)CliExitCode.Failed);

        ApplyReturns(Busy(Alpha), Failed(Beta));
        (await host.RunAsync("theme", "apply", "--border", "blue")).Should().Be((int)CliExitCode.Failed);

        ApplyReturns(Applied(Alpha), Busy(Beta));
        (await host.RunAsync("theme", "apply", "--border", "blue")).Should().Be((int)CliExitCode.DeviceBusy);
    }

    [Fact]
    public async Task Apply_WhenSomeFail_JsonStdoutIsOneDocument_AndStderrEndsWithTheErrorObject()
    {
        ApplyReturns(Applied(Alpha), Failed(Beta));
        var host = NewHost(false, Alpha, Beta);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "blue", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        var devices = Parse(host.Consoles.StdOut).GetProperty("devices");
        devices[1].GetProperty("status").GetString().Should().Be("failed");
        devices[1].GetProperty("message").GetString().Should().Be("The device went away.");
        var lastLine = host.Consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Last();
        var error = Parse(lastLine).GetProperty("error");
        error.GetProperty("exitCode").GetInt32().Should().Be(1);
        error.GetProperty("message").GetString().Should().Be("1 of 2 TeensyROMs failed.");
    }

    [Fact]
    public async Task Apply_WhenTrWebCouldNotRecordTheColors_NoticesIt_AndStillExitsZero()
    {
        ApplyReturns(new ThemeApplyOutcome(Alpha, ThemeApplyStatus.Applied, Blues, false, null));
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "apply", "--border", "blue");

        exitCode.Should().Be(0);
        host.Consoles.StdErr.Should().Contain("Alpha's colors reached the C64, but tr-web couldn't record them");
    }

    // ---- save --------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Save_FromABaseTheme_CreatesACustomTheme_WithTheOverridesApplied()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "save", "Late night", "C64 Mono", "--border", "blue", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).CreateAsync("Late night", Mono.With(ThemeSlot.Border, 6), Arg.Any<CancellationToken>());
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("overwritten").GetBoolean().Should().BeFalse();
        var theme = document.GetProperty("theme");
        theme.GetProperty("kind").GetString().Should().Be("custom");
        theme.GetProperty("colors").GetProperty("border").GetProperty("index").GetInt32().Should().Be(6);
        theme.GetProperty("colors").GetProperty("keys").GetProperty("name").GetString().Should().Be("Medium Grey");
        await _chooser.DidNotReceiveWithAnyArgs().ChooseAsync(default, default, default);
    }

    [Fact]
    public async Task Save_OverAShippedName_IsAUsageError_AndSendsNothing()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "save", "c64 mono", "C64 Mono", "--overwrite");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("C64 Mono is a shipped theme and can't be saved over. Choose another name.");
        await _themes.DidNotReceiveWithAnyArgs().CreateAsync(default!, default!, default);
        await _themes.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Save_OverACustomName_NeedsOverwrite_ThenUpdatesThatTheme()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono), Custom("late", "Late night", Blues));
        var host = NewHost();

        var refused = await host.RunAsync("theme", "save", " late NIGHT ", "C64 Mono");

        refused.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("A custom theme named Late night already exists. Pass --overwrite to replace its colors.");
        await _themes.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default!, default!, default);
        await _themes.DidNotReceiveWithAnyArgs().CreateAsync(default!, default!, default);

        var replaced = await host.RunAsync("theme", "save", "late night", "C64 Mono", "--overwrite", "--json");

        replaced.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).UpdateAsync("late", "late night", Mono, Arg.Any<CancellationToken>());
        Parse(host.Consoles.StdOut).GetProperty("overwritten").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Save_WithoutABase_StartsFromTheOnlyOnlineDevicesColors()
    {
        ThemesAre();
        RecordIs(Alpha, Blues, null);
        var host = NewHost(false, Alpha);

        var exitCode = await host.RunAsync("theme", "save", "From bench");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _chooser.Received(1).ChooseAsync(null, DeviceScope.Online, Arg.Any<CancellationToken>());
        await _themes.Received(1).CreateAsync("From bench", Blues, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Save_WithDevice_ChoosesAmongKnownDevices()
    {
        ThemesAre();
        _chooser.ChooseAsync("Gamma", DeviceScope.Known, Arg.Any<CancellationToken>()).Returns(Gamma);
        RecordIs(Gamma, Mono, null);
        var host = NewHost(false, Gamma);

        var exitCode = await host.RunAsync("theme", "save", "Offline copy", "--device", "Gamma");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).CreateAsync("Offline copy", Mono, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Save_WithABaseAndADevice_IsAUsageError_BeforeTheEngineIsTouched()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "save", "X", "C64 Mono", "--device", "Alpha");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("Give a base theme or --device, not both");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Save_RefusedByTheEngine_ExitsWithTheMappedCode()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono));
        _createFailure = new TeensyApiException("Theme names are at most 24 characters.", 400);
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "save", "A name that is far too long to keep", "C64 Mono");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("Theme names are at most 24 characters.");
    }

    // ---- delete ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Delete_OfAShippedTheme_IsAUsageError_EvenWithYes()
    {
        ThemesAre(Shipped("default", "TR Default", Blues));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "delete", "TR Default", "--yes");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("TR Default is a shipped theme and can't be deleted.");
        await _themes.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    [Fact]
    public async Task Delete_WithoutATerminal_NeedsYes()
    {
        ThemesAre(Custom("late", "Late night", Blues));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "delete", "Late night");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("Pass --yes to delete Late night without a terminal to confirm it.");
        await _themes.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    [Fact]
    public async Task Delete_WithYes_DeletesWithoutAskingAndWritesTheIdAndName()
    {
        ThemesAre(Custom("late", "Late night", Blues));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "delete", "Late night", "--yes", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).DeleteAsync("late", Arg.Any<CancellationToken>());
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("id").GetString().Should().Be("late");
        document.GetProperty("name").GetString().Should().Be("Late night");
    }

    [Fact]
    public async Task Delete_InATerminal_AsksFirst_AndDeclineDeletesNothing()
    {
        ThemesAre(Custom("late", "Late night", Blues));
        var host = NewHost(terminal: true);
        host.Consoles.Err.Input.PushTextWithEnter("n");

        var exitCode = await host.RunAsync("theme", "delete", "Late night");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("Delete the theme Late night?").And.Contain("Cancelled; nothing was deleted.");
        await _themes.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    [Fact]
    public async Task Delete_InATerminal_DeletesWhenConfirmed()
    {
        ThemesAre(Custom("late", "Late night", Blues));
        var host = NewHost(terminal: true);
        host.Consoles.Err.Input.PushTextWithEnter("y");

        var exitCode = await host.RunAsync("theme", "delete", "Late night");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _themes.Received(1).DeleteAsync("late", Arg.Any<CancellationToken>());
    }

    // ---- list and show -----------------------------------------------------------------------------------------------

    [Fact]
    public async Task List_Json_IsAnArrayOfThemesWithTheirColorsKeyedBySlot()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono), Custom("late", "Late night", Blues));
        var host = NewHost();

        var exitCode = await host.RunAsync("theme", "list", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var themes = Parse(host.Consoles.StdOut);
        themes.GetArrayLength().Should().Be(2);
        themes[0].GetProperty("kind").GetString().Should().Be("shipped");
        themes[1].GetProperty("kind").GetString().Should().Be("custom");
        themes[1].GetProperty("colors").EnumerateObject().Select(p => p.Name)
            .Should().Equal("background", "border", "banner", "time", "keys", "sources", "names");
        var names = themes[1].GetProperty("colors").GetProperty("names");
        names.GetProperty("index").GetInt32().Should().Be(15);
        names.GetProperty("name").GetString().Should().Be("Light Grey");
    }

    [Fact]
    public async Task List_Plain_IsOneNamePerLine()
    {
        ThemesAre(Shipped("mono", "C64 Mono", Mono), Custom("late", "Late night", Blues));
        var host = NewHost();

        await host.RunAsync("theme", "list");

        host.Consoles.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Should().Equal("C64 Mono", "Late night");
    }

    [Fact]
    public async Task List_Human_RendersANameWithBracketsLiterally()
    {
        ThemesAre(Custom("odd", "[red]Odd[/] one", Blues));
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("theme", "list");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdOut.Should().Contain("[red]Odd[/] one").And.Contain("background").And.Contain("Light Blue");
    }

    [Fact]
    public async Task Show_NamesTheTheme_OnlyWhileItsColorsStillMatch()
    {
        ThemesAre(Shipped("blues", "The Blues", Blues));
        RecordIs(Alpha, Blues, "blues");
        RecordIs(Beta, Blues.With(ThemeSlot.Border, 2), "blues");
        var host = NewHost(false, Alpha, Beta);

        var exitCode = await host.RunAsync("theme", "show", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var devices = Parse(host.Consoles.StdOut);
        devices[0].GetProperty("themeId").GetString().Should().Be("blues");
        devices[0].GetProperty("themeName").GetString().Should().Be("The Blues");
        devices[0].GetProperty("recorded").GetBoolean().Should().BeTrue();
        devices[0].TryGetProperty("appliedAt", out _).Should().BeTrue();
        devices[1].TryGetProperty("themeId", out _).Should().BeFalse();
        devices[1].TryGetProperty("themeName", out _).Should().BeFalse();
        devices[1].GetProperty("colors").GetProperty("border").GetProperty("name").GetString().Should().Be("Red");
    }

    [Fact]
    public async Task Show_Plain_NamesTheThemeOrCustomColors_AndTheFactoryRecord()
    {
        ThemesAre(Shipped("blues", "The Blues", Blues));
        RecordIs(Alpha, Blues, "blues");
        RecordIs(Beta, Mono, null);
        RecordIs(Gamma, Blues, null, recorded: false);
        var host = NewHost(false, Alpha, Beta, Gamma);

        await host.RunAsync("theme", "show");

        host.Consoles.StdOut.Should().Contain("Alpha: The Blues")
            .And.Contain("Beta: custom colors")
            .And.Contain("Gamma: TR Default (factory, no record)");
    }

    [Fact]
    public async Task Show_WithDevice_ReadsOnlyThatKnownDevice()
    {
        ThemesAre();
        _chooser.ChooseAsync("Gamma", DeviceScope.Known, Arg.Any<CancellationToken>()).Returns(Gamma);
        RecordIs(Gamma, Blues, null, recorded: false);
        var host = NewHost(false, Alpha, Gamma);

        var exitCode = await host.RunAsync("theme", "show", "--device", "Gamma", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var devices = Parse(host.Consoles.StdOut);
        devices.GetArrayLength().Should().Be(1);
        devices[0].GetProperty("deviceName").GetString().Should().Be("Gamma");
        devices[0].GetProperty("online").GetBoolean().Should().BeFalse();
        devices[0].GetProperty("recorded").GetBoolean().Should().BeFalse();
        await _themes.DidNotReceive().GetDeviceRecordAsync(Alpha.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Show_WithNoKnownDevice_IsEmpty_AndExitsZero()
    {
        var json = NewHost();
        (await json.RunAsync("theme", "show", "--json")).Should().Be(0);
        Parse(json.Consoles.StdOut).GetArrayLength().Should().Be(0);

        var human = NewHost(terminal: true);
        (await human.RunAsync("theme", "show")).Should().Be(0);
        human.Consoles.StdErr.Should().Contain("tr-web doesn't know any TeensyROM yet.");
    }

    [Fact]
    public async Task Show_Human_RendersDeviceAndThemeNamesWithBracketsLiterally()
    {
        var odd = new DeviceSummary("o-1", "Bench [1]", true, "USB COM9", "Connected");
        ThemesAre(Custom("odd", "[b]Bold[/]", Blues));
        RecordIs(odd, Blues, "odd");
        var host = NewHost(true, odd);

        var exitCode = await host.RunAsync("theme", "show");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdOut.Should().Contain("Bench [1]").And.Contain("[b]Bold[/]");
    }
}
