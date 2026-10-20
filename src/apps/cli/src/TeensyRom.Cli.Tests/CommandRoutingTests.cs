using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

public class CommandRoutingTests
{
    [Theory]
    [InlineData("chipsynth")]
    [InlineData("cs")]
    [InlineData("credits")]
    [InlineData("c")]
    [InlineData("stop")]
    [InlineData("CREDITS")]
    [InlineData("Stop")]
    public void NeedsEngine_ForTheDeviceFreeCommands_IsFalse(string command)
    {
        CommandRouting.NeedsEngine([command]).Should().BeFalse();
    }

    [Fact]
    public void NeedsEngine_ForAnEngineFreeCommandWithItsOwnArguments_IsFalse()
    {
        CommandRouting.NeedsEngine(["chipsynth", "--presets", "all"]).Should().BeFalse();
    }

    [Fact]
    public void NeedsEngine_WithNoArguments_IsFalseBecauseTheMenuAloneNeedsNothing()
    {
        CommandRouting.NeedsEngine([]).Should().BeFalse();
    }

    [Theory]
    [InlineData("-h")]
    [InlineData("--help")]
    [InlineData("-v")]
    [InlineData("--version")]
    public void NeedsEngine_ForHelpOrVersionAnywhere_IsFalse(string flag)
    {
        CommandRouting.NeedsEngine([flag]).Should().BeFalse();
        CommandRouting.NeedsEngine(["launch", flag]).Should().BeFalse();
        CommandRouting.NeedsEngine(["launch", "random", flag]).Should().BeFalse();
    }

    [Theory]
    [InlineData("launch")]
    [InlineData("index")]
    [InlineData("i")]
    [InlineData("settings")]
    [InlineData("ports")]
    [InlineData("p")]
    public void NeedsEngine_ForTheCommandsThatTalkToTheEngine_IsTrue(string command)
    {
        CommandRouting.NeedsEngine([command]).Should().BeTrue();
    }

    [Fact]
    public void NeedsEngine_OnlyLooksAtTheFirstTokenForTheCommand()
    {
        CommandRouting.NeedsEngine(["launch", "credits"]).Should().BeTrue();
    }

    [Theory]
    [InlineData("stop", true)]
    [InlineData("STOP", true)]
    [InlineData("ports", false)]
    public void IsStop_RecognizesTheStopCommand(string command, bool expected)
    {
        CommandRouting.IsStop([command]).Should().Be(expected);
    }
}
