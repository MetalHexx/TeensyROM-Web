using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The color menu on an interactive true-color test console with the keys queued up front.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class SwatchChoicePromptTests
{
    private const string BlueForeground = "38;2;46;44;155";

    private static readonly C64Color Blue = C64Palette.Get(6);

    private static TestConsole NewConsole(params ConsoleKey[] keys)
    {
        var console = new TestConsole();

        console.Profile.Width = 120;
        console.EmitAnsiSequences();
        console.Profile.Capabilities.ColorSystem = ColorSystem.TrueColor;
        console.Interactive();
        foreach (var key in keys) console.Input.PushKey(key);
        return console;
    }

    private static string[] Lines(TestConsole console) => console.Output.ReplaceLineEndings("\n").Split('\n');

    [Fact]
    public void Enter_ReturnsTheCurrentColor_BecauseTheCursorStartsOnIt()
    {
        var console = NewConsole(ConsoleKey.Enter);

        var chosen = SwatchChoicePrompt.Show(console, "Border", Blue);

        chosen.Color.Should().Be(Blue);
        chosen.Label.Should().Be("Blue");
    }

    [Theory]
    [InlineData(ConsoleKey.DownArrow, 7)]
    [InlineData(ConsoleKey.UpArrow, 5)]
    public void UpAndDown_MoveTheCursorOneColor(ConsoleKey key, int expected)
    {
        var console = NewConsole(key, ConsoleKey.Enter);

        var chosen = SwatchChoicePrompt.Show(console, "Border", Blue);

        chosen.Color!.Index.Should().Be(expected);
    }

    [Fact]
    public void UpFromBlack_WrapsToKeepCurrent_WhichHasNoColor()
    {
        var console = NewConsole(ConsoleKey.UpArrow, ConsoleKey.Enter);

        var chosen = SwatchChoicePrompt.Show(console, "Border", C64Palette.Get(0));

        chosen.Color.Should().BeNull();
        chosen.Label.Should().Be("Keep current");
    }

    [Fact]
    public void DownFromKeepCurrent_WrapsToBlack()
    {
        var console = NewConsole(ConsoleKey.DownArrow, ConsoleKey.DownArrow, ConsoleKey.Enter);

        var chosen = SwatchChoicePrompt.Show(console, "Border", C64Palette.Get(15));

        chosen.Color!.Index.Should().Be(0);
    }

    [Fact]
    public void TheMenu_ShowsAllSixteenNames_MarksTheCurrentOne_AndCollapsesToTheAnswer()
    {
        var console = NewConsole(ConsoleKey.DownArrow, ConsoleKey.Enter);

        SwatchChoicePrompt.Show(console, "Border", Blue);

        var output = console.Output;

        foreach (var color in C64Palette.Colors) output.Should().Contain(color.Name);
        output.Should().Contain("Blue (current)").And.Contain("Keep current");
        Lines(console).Last(line => line.Contains("Border:")).Should().Contain("Border: ").And.Contain("Yellow");
    }

    [Fact]
    public void TheCursorRow_KeepsItsSwatchColor()
    {
        var console = NewConsole(ConsoleKey.Enter);

        SwatchChoicePrompt.Show(console, "Border", Blue);

        var cursorRow = Lines(console).First(line => line.Contains("> ") && line.Contains("Blue"));

        cursorRow.Should().Contain(BlueForeground);
    }
}
