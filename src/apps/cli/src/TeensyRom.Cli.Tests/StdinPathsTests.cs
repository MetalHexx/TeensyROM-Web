using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Tests;

public class StdinPathsTests
{
    private static StdinPaths Piped(string input) => new(new StringReader(input), inputIsTerminal: false);

    [Fact]
    public void Expand_ReplacesTheMarkerWithEveryTrimmedNonBlankLine_AndKeepsOtherArguments()
    {
        var sut = Piped("/music/a.sid\r\n  /music/b.sid  \n\n   \n/games/c.prg");

        var expanded = sut.Expand(["/first.sid", StdinPaths.Marker, "/last.sid"]);

        expanded.Should().Equal("/first.sid", "/music/a.sid", "/music/b.sid", "/games/c.prg", "/last.sid");
    }

    [Fact]
    public void Expand_WithoutAMarker_NeverReadsStdin()
    {
        var sut = new StdinPaths(new ThrowingReader(), inputIsTerminal: false);

        sut.Expand(["/a.sid", "/b.sid"]).Should().Equal("/a.sid", "/b.sid");
    }

    [Fact]
    public void ExpandOne_ReplacesTheMarkerWithTheFirstPath_AndReturnsOtherArgumentsAsTheyAre()
    {
        var sut = Piped("/music/a.sid\n/music/b.sid\n");

        sut.ExpandOne(StdinPaths.Marker).Should().Be("/music/a.sid");
        sut.ExpandOne("/other.sid").Should().Be("/other.sid");
    }

    [Fact]
    public void Stdin_IsReadOnceNoMatterHowManyMarkersAsk()
    {
        var reader = new CountingReader("/a.sid\n/b.sid\n");
        var sut = new StdinPaths(reader, inputIsTerminal: false);

        sut.Expand([StdinPaths.Marker, StdinPaths.Marker]).Should().Equal("/a.sid", "/b.sid", "/a.sid", "/b.sid");
        sut.ExpandOne(StdinPaths.Marker).Should().Be("/a.sid");

        reader.Reads.Should().Be(1);
    }

    [Fact]
    public void AMarkerWhileStdinIsATerminal_IsAUsageErrorThatNeverBlocksOnTheKeyboard()
    {
        var sut = new StdinPaths(new ThrowingReader(), inputIsTerminal: true);

        var act = () => sut.Expand([StdinPaths.Marker]);

        act.Should().Throw<CliException>()
            .Where(e => e.Code == CliExitCode.Usage)
            .WithMessage("`-` reads paths from a pipe; pass a path instead.");
    }

    [Theory]
    [InlineData("")]
    [InlineData("\n  \r\n\n")]
    public void AMarkerWithNoPathsOnStdin_IsAUsageError(string input)
    {
        var sut = Piped(input);

        sut.Invoking(s => s.ExpandOne(StdinPaths.Marker)).Should().Throw<CliException>().Where(e => e.Code == CliExitCode.Usage);
        sut.Invoking(s => s.Expand([StdinPaths.Marker])).Should().Throw<CliException>().Where(e => e.Code == CliExitCode.Usage);
    }

    private sealed class ThrowingReader : TextReader
    {
        public override string ReadToEnd() => throw new InvalidOperationException("stdin must not be read");
    }

    private sealed class CountingReader(string content) : TextReader
    {
        public int Reads { get; private set; }

        public override string ReadToEnd()
        {
            Reads++;
            return content;
        }
    }
}
