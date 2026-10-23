using Spectre.Console;
using Spectre.Console.Rendering;
using Spectre.Console.Testing;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Tests;

public class TerminalTextTests
{
    [Fact]
    public void Sanitize_KeepsNewlinesAndTabs_AndStripsEscBelAndCsi()
    {
        var text = "a\tb\nc\u001b[31md\u0007e\u009bf";

        TerminalText.Sanitize(text).Should().Be("a\tb\nc[31mdef");
    }

    [Fact]
    public void Sanitize_TurnsNullIntoEmpty()
    {
        TerminalText.Sanitize(null).Should().BeEmpty();
    }

    [Theory]
    [InlineData("https://deepsid.chordian.net/?file=x", true)]
    [InlineData("http://csdb.dk/release/?id=1", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("file:///etc/passwd", false)]
    [InlineData("/relative/path", false)]
    [InlineData("", false)]
    public void IsWebLink_IsTrueOnlyForAbsoluteHttpAndHttps(string url, bool expected)
    {
        TerminalText.IsWebLink(url).Should().Be(expected);
    }

    [Fact]
    public void Link_ShowsLabelAndAddress_AndIsAHyperlinkOnAnAnsiTerminal()
    {
        var output = Render(TerminalText.Link("DeepSID", "https://deepsid.chordian.net/"), ansi: true);

        output.Should().Contain("DeepSID — https://deepsid.chordian.net/").And.Contain("\u001b]8;");
    }

    [Fact]
    public void Link_WithoutAnsi_StillShowsTheAddress()
    {
        var output = Render(TerminalText.Link("DeepSID", "https://deepsid.chordian.net/"), ansi: false);

        output.Should().Contain("DeepSID — https://deepsid.chordian.net/").And.NotContain("\u001b]8;");
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("/relative")]
    public void Link_ToAnythingButHttpOrHttps_IsPlainText(string url)
    {
        var output = Render(TerminalText.Link(null, url), ansi: true);

        output.Should().Contain(url).And.NotContain("\u001b]8;");
    }

    [Fact]
    public void Link_CannotBreakOutOfTheHyperlinkWithControlBytes()
    {
        var output = Render(TerminalText.Link("x", "https://a.example/\u001b]8;;\u0007evil"), ansi: true);

        output.Should().NotContain("\u0007");
    }

    private static string Render(IRenderable renderable, bool ansi)
    {
        var console = ansi ? new TestConsole().EmitAnsiSequences() : new TestConsole();
        console.Profile.Width = 120;
        console.Write(renderable);
        return console.Output;
    }
}
