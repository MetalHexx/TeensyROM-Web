using NSubstitute;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// Every level of the public tree is discoverable from its own help, and help never reaches for the engine or a device.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class HelpSurfaceTests
{
    public static IEnumerable<object[]> Nouns() => CliHost.PublicTree.Select(noun => new object[] { noun.Name });

    public static IEnumerable<object[]> Verbs() =>
        CliHost.PublicTree.SelectMany(noun => noun.Verbs.Select(verb => new object[] { noun.Name, verb.Name }));

    public static IEnumerable<object[]> TopLevelCommands() => CliHost.PublicCommands.Select(command => new object[] { command.Name });

    [Theory]
    [MemberData(nameof(TopLevelCommands))]
    public async Task TopLevelCommandHelp_HasADescription_UsageAndAnExample_AndTouchesNothing(string name)
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync(name, "--help");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("DESCRIPTION").And.Contain("USAGE").And.Contain("EXAMPLES").And.Contain($"trom {name}");
        host.Consoles.StdErr.Should().BeEmpty();
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Fact]
    public async Task RootHelp_ListsTheTopLevelCommands()
    {
        using var host = new TestHost();

        await host.RunAsync("--help");

        foreach (var command in CliHost.PublicCommands) host.Consoles.StdOut.Should().Contain(command.Name);
    }

    [Fact]
    public async Task ABadOptionOnATopLevelCommand_PointsAtItsHelp()
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync("init", "--bogus");

        exitCode.Should().Be(2);
        host.Consoles.StdOut.Should().BeEmpty();
        host.Consoles.StdErr.Should().Contain("trom init --help");
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Theory]
    [MemberData(nameof(Nouns))]
    public async Task NounHelp_HasADescription_UsageAndExamples_AndListsItsVerbs(string noun)
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync(noun, "--help");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("DESCRIPTION").And.Contain("USAGE").And.Contain("EXAMPLES").And.Contain("COMMANDS");
        foreach (var verb in CliHost.PublicTree.Single(n => n.Name == noun).Verbs)
        {
            host.Consoles.StdOut.Should().Contain(verb.Name);
        }
        host.Consoles.StdErr.Should().BeEmpty();
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Theory]
    [MemberData(nameof(Verbs))]
    public async Task VerbHelp_HasADescription_UsageAndAnExample(string noun, string verb)
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync(noun, verb, "--help");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("DESCRIPTION").And.Contain("USAGE").And.Contain("EXAMPLES").And.Contain($"trom {noun} {verb}");
        host.Consoles.StdErr.Should().BeEmpty();
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Theory]
    [InlineData("file", "search", "notice")]
    [InlineData("file", "random", "notice")]
    [InlineData("device", "list", "sdIndexed")]
    public async Task VerbHelp_DescribesTheIndexNoticeAndTheIndexedFlags(string noun, string verb, string expected)
    {
        using var host = new TestHost();

        await host.RunAsync(noun, verb, "--help");

        host.Consoles.StdOut.Should().Contain(expected);
    }

    [Fact]
    public async Task RootHelp_SaysStderrCanEndWithAJsonErrorOrNoticeObject()
    {
        using var host = new TestHost();

        await host.RunAsync("--help");

        var help = string.Join(' ', host.Consoles.StdOut.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        help.Should().Contain("JSON error object").And.Contain("JSON notice object");
    }

    [Fact]
    public async Task RootHelp_MentionsTheMenu_Json_TheExitCodes_AndThePipeExample()
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync("--help");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("interactive menu").And.Contain("--json").And.Contain("EXIT CODES").And.Contain("EXAMPLES")
            .And.Contain("trom file search commando --json | jq -r '.[0].path' | trom file launch -");
        foreach (var code in new[] { "0", "1", "2", "3", "4", "5" })
        {
            host.Consoles.StdOut.Should().MatchRegex($@"(?m)^\s+{code}\s+\S");
        }
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Fact]
    public async Task Version_TouchesNoEngineOrDevice()
    {
        using var host = new TestHost();

        (await host.RunAsync("--version")).Should().Be(0);

        await AssertNoEngineOrDeviceTouched(host);
    }

    [Theory]
    [InlineData("bogus")]
    [InlineData("device", "bogus")]
    [InlineData("device", "list", "--bogus")]
    [InlineData("file")]
    public async Task UnknownInput_AndABareNoun_AreUsageErrors_WithTheNearestHelpOnStderr(params string[] args)
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync(args);

        exitCode.Should().Be(2);
        host.Consoles.StdOut.Should().BeEmpty();
        host.Consoles.StdErr.Should().Contain("USAGE");
        await AssertNoEngineOrDeviceTouched(host);
    }

    [Fact]
    public async Task ABadOption_PointsAtTheVerbsHelp()
    {
        using var host = new TestHost();

        var exitCode = await host.RunAsync("device", "list", "--bogus");

        exitCode.Should().Be(2);
        host.Consoles.StdErr.Should().Contain("trom device list --help");
    }

    private static async Task AssertNoEngineOrDeviceTouched(TestHost host)
    {
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await host.Devices.DidNotReceiveWithAnyArgs().GetDevicesAsync(default);
    }
}
