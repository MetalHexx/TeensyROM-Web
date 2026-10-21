using Spectre.Console;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Tests;

public class CliOutputTests
{
    private readonly TestConsoles _consoles = new();

    private CliOutput Output(bool outIsTerminal = false, bool errIsTerminal = false, bool inIsTerminal = false) =>
        new(_consoles.With(outIsTerminal, errIsTerminal, inIsTerminal));

    [Fact]
    public void Mode_FollowsWhetherStdoutIsATerminal()
    {
        Output(outIsTerminal: true).Mode.Should().Be(OutputMode.Human);
        Output(outIsTerminal: false).Mode.Should().Be(OutputMode.Plain);
    }

    [Fact]
    public void Mode_IsJsonOnceAskedFor_AndGoesBackWhenNot()
    {
        var output = Output(outIsTerminal: true);

        output.UseJson(true);
        output.Mode.Should().Be(OutputMode.Json);

        output.UseJson(false);
        output.Mode.Should().Be(OutputMode.Human);
    }

    [Theory]
    [InlineData(true, true, true, true)]
    [InlineData(true, true, false, false)]
    [InlineData(true, false, true, false)]
    [InlineData(false, true, true, false)]
    public void CanPrompt_NeedsStdinStdoutAndStderrToAllBeTerminals(bool inIsTerminal, bool outIsTerminal, bool errIsTerminal, bool expected)
    {
        Output(outIsTerminal, errIsTerminal, inIsTerminal).CanPrompt.Should().Be(expected);
    }

    [Fact]
    public void CanPrompt_IsFalseWhenOnlyStderrIsRedirected()
    {
        Output(outIsTerminal: true, errIsTerminal: false, inIsTerminal: true).CanPrompt.Should().BeFalse();
    }

    [Fact]
    public void RunMode_IsOneShotUntilTheMenuSetsIt()
    {
        var output = Output();

        output.RunMode.Should().Be(CliRunMode.OneShot);

        output.SetRunMode(CliRunMode.Tui);
        output.RunMode.Should().Be(CliRunMode.Tui);
    }

    [Fact]
    public void Json_WritesOneIndentedCamelCaseDocumentToStdoutOnly()
    {
        Output().Json(new { DeviceId = "a", Online = true, Missing = (string?)null, State = CliExitCode.NoDevice });

        using var document = JsonDocument.Parse(_consoles.StdOut);
        document.RootElement.GetProperty("deviceId").GetString().Should().Be("a");
        document.RootElement.GetProperty("state").GetString().Should().Be("noDevice");
        document.RootElement.TryGetProperty("missing", out _).Should().BeFalse("nulls are omitted");
        _consoles.StdOut.Should().Contain("\n  ", "the document is indented");
        _consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public void Lines_WritesOneItemPerLine_WithoutWrappingLongPathsOrReadingBracketsAsMarkup()
    {
        var longPath = "/music/" + new string('a', 400) + "[red].sid";

        Output().Lines([longPath, "/b"]);

        _consoles.StdOut.Replace("\r\n", "\n").Should().Be($"{longPath}\n/b\n");
    }

    [Fact]
    public void Fields_WhenRedirected_AreLabelValueLines()
    {
        Output(outIsTerminal: false).Fields([("Status", "running"), ("Address", "localhost:10213")]);

        _consoles.StdOut.Replace("\r\n", "\n").Should().Be("Status: running\nAddress: localhost:10213\n");
    }

    [Fact]
    public void Fields_OnATerminal_AreATable()
    {
        Output(outIsTerminal: true).Fields([("Status", "running")]);

        _consoles.StdOut.Should().Contain("Status").And.Contain("running").And.ContainAny("│", "|");
    }

    [Fact]
    public void Notice_GoesToStderr_NotStdout()
    {
        Output().Notice("Starting the TeensyROM engine…");

        _consoles.StdErr.Should().Contain("Starting the TeensyROM engine…");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public void Notice_WhileTheMenuRuns_GoesToTheMenusScreen()
    {
        var output = Output(outIsTerminal: true, errIsTerminal: true);
        output.SetRunMode(CliRunMode.Tui);

        output.Notice("Starting the TeensyROM engine…");

        _consoles.StdOut.Should().Contain("Starting the TeensyROM engine…");
        _consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public void Error_IsASentenceOnStderr_WithNoJsonUnlessAskedFor()
    {
        Output().Error(new CliException(CliExitCode.NoDevice, "No TeensyROM is online."));

        _consoles.StdErr.Trim().Should().Be("No TeensyROM is online.");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public void Error_UnderJson_EndsStderrWithOneCompactJsonLine()
    {
        var output = Output();
        output.UseJson(true);
        output.Notice("Starting the TeensyROM engine…");

        output.Error(new CliException(CliExitCode.NoDevice, "No TeensyROM is online."));

        var lines = _consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        lines.Should().HaveCount(3);
        lines[1].Should().Be("No TeensyROM is online.");

        using var document = JsonDocument.Parse(lines[^1]);
        var error = document.RootElement.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("noDevice");
        error.GetProperty("exitCode").GetInt32().Should().Be(4);
        error.GetProperty("message").GetString().Should().Be("No TeensyROM is online.");
    }

    [Fact]
    public void Error_UnderJson_CarriesDetailsWhenThereAreSome_AndOmitsThemOtherwise()
    {
        var output = Output();
        output.UseJson(true);
        var details = new ErrorDetails("/music/H", "TR-1", 3, ["It is missing.", "The device did not answer."]);

        output.Error(new CliException(CliExitCode.NotFound, "Not found.", details));
        output.Error(new CliException(CliExitCode.NotFound, "Not found."));

        var lines = _consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(l => l.StartsWith('{')).ToList();
        var withDetails = JsonDocument.Parse(lines[0]).RootElement.GetProperty("error").GetProperty("details");
        withDetails.EnumerateObject().Select(p => p.Name).Should().Equal("path", "device", "attempts", "possibleCauses");
        withDetails.GetProperty("path").GetString().Should().Be("/music/H");
        withDetails.GetProperty("device").GetString().Should().Be("TR-1");
        withDetails.GetProperty("attempts").GetInt32().Should().Be(3);
        withDetails.GetProperty("possibleCauses").GetArrayLength().Should().Be(2);
        JsonDocument.Parse(lines[1]).RootElement.GetProperty("error").TryGetProperty("details", out _).Should().BeFalse();
    }

    [Fact]
    public void Notice_UnderJson_EndsStderrWithOneCompactJsonNoticeObject()
    {
        var output = Output();
        output.UseJson(true);

        output.Notice(new CliNotice("indexIncomplete", "TR-1 is not indexed.", "TR-1", "14470230", "sd", "trom index build --device TR-1 --storage sd"));

        var lines = _consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        lines.Should().HaveCount(2);
        lines[0].Should().Be("TR-1 is not indexed.");
        var notice = JsonDocument.Parse(lines[1]).RootElement.GetProperty("notice");
        notice.EnumerateObject().Select(p => p.Name).Should().Equal("code", "message", "device", "deviceId", "storage", "fix");
        notice.GetProperty("code").GetString().Should().Be("indexIncomplete");
        notice.GetProperty("fix").GetString().Should().Be("trom index build --device TR-1 --storage sd");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public void Notice_WithoutJson_IsOnlyTheSentenceOnStderr()
    {
        Output().Notice(new CliNotice("indexIncomplete", "TR-1 is not indexed.", "TR-1", "1", "sd", "trom index build"));

        _consoles.StdErr.Trim().Should().Be("TR-1 is not indexed.");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Theory]
    [InlineData((int)CliExitCode.Failed, "failed")]
    [InlineData((int)CliExitCode.Usage, "usage")]
    [InlineData((int)CliExitCode.EngineUnavailable, "engineUnavailable")]
    [InlineData((int)CliExitCode.NoDevice, "noDevice")]
    [InlineData((int)CliExitCode.NotFound, "notFound")]
    public void TheJsonErrorCodeIsTheCamelCasedName(int code, string expected)
    {
        var output = Output();
        output.UseJson(true);

        output.Error(new CliException((CliExitCode)code, "x"));

        var json = _consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries)[^1];
        JsonDocument.Parse(json).RootElement.GetProperty("error").GetProperty("code").GetString().Should().Be(expected);
    }

    [Fact]
    public void ARedirectedStreamGetsNeitherAnsiNorColour()
    {
        var settings = CliConsoles.SettingsFor(new StringWriter(), redirected: true, noColor: false);

        settings.Ansi.Should().Be(AnsiSupport.No);
        settings.ColorSystem.Should().Be(ColorSystemSupport.NoColors);
    }

    [Fact]
    public void NoColor_DropsColourOnly_BecauseWithoutAnsiEverySelectionPromptThrows()
    {
        var settings = CliConsoles.SettingsFor(new StringWriter(), redirected: false, noColor: true);

        settings.Ansi.Should().Be(AnsiSupport.Detect);
        settings.ColorSystem.Should().Be(ColorSystemSupport.NoColors);
    }

    [Fact]
    public void ATerminalWithoutNoColor_IsLeftToSpectresDetection()
    {
        var settings = CliConsoles.SettingsFor(new StringWriter(), redirected: false, noColor: false);

        settings.Ansi.Should().Be(AnsiSupport.Detect);
        settings.ColorSystem.Should().Be(ColorSystemSupport.Detect);
    }
}
