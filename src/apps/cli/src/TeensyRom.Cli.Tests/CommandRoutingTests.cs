using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

public class CommandRoutingTests
{
    private static readonly Dictionary<string, string[]> Nouns = new()
    {
        ["engine"] = ["status", "stop"],
        ["device"] = ["list"]
    };

    [Theory]
    [InlineData(new[] { "--json" }, true)]
    [InlineData(new[] { "engine", "status", "--json" }, true)]
    [InlineData(new[] { "engine", "--json", "status" }, true)]
    [InlineData(new[] { "engine", "status" }, false)]
    [InlineData(new[] { "engine", "status", "--", "--json" }, false)]
    [InlineData(new[] { "launch", "--bogus", "--json" }, true)]
    public void WantsJson_LooksAtTheRawArguments_EvenWhenTheyWillNotParse(string[] args, bool expected)
    {
        CommandRouting.WantsJson(args).Should().Be(expected);
    }

    [Fact]
    public void ReplaceStdinMarker_SwapsOnlyAStandaloneDash()
    {
        var replaced = CommandRouting.ReplaceStdinMarker(["file", "-", "--name", "-x", "a-b", "-"]);

        replaced.Should().Equal("file", StdinPaths.Marker, "--name", "-x", "a-b", StdinPaths.Marker);
    }

    [Theory]
    [InlineData(new[] { "engine" }, "engine")]
    [InlineData(new[] { "device", "--json" }, "device")]
    [InlineData(new[] { "device", "--json", "-d" }, "device")]
    public void FindBareNoun_FindsAKnownNounWithNoVerb(string[] args, string expected)
    {
        CommandRouting.FindBareNoun(args, Nouns).Should().Be(expected);
    }

    [Theory]
    [InlineData]
    [InlineData("engine", "status")]
    [InlineData("engine", "--help")]
    [InlineData("engine", "--json", "-h")]
    [InlineData("launch")]
    [InlineData("--help")]
    [InlineData("Engine")]
    public void FindBareNoun_LeavesEverythingElseToSpectre(params string[] args)
    {
        CommandRouting.FindBareNoun(args, Nouns).Should().BeNull();
    }

    [Theory]
    [InlineData(new[] { "engine", "status", "--bogus" }, new[] { "engine", "status" })]
    [InlineData(new[] { "engine", "bogus" }, new[] { "engine" })]
    [InlineData(new[] { "engine", "--bogus" }, new[] { "engine" })]
    [InlineData(new[] { "device" }, new[] { "device" })]
    [InlineData(new[] { "launch", "random" }, new string[0])]
    [InlineData(new string[0], new string[0])]
    public void HelpPrefix_IsTheLeadingNounAndVerbWhenKnown_ThenTheNoun_OtherwiseTheRoot(string[] args, string[] expected)
    {
        CommandRouting.HelpPrefix(args, Nouns).Should().Equal(expected);
    }
}
