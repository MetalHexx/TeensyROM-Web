using System.Text.Json;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The composability contract against the real engine: stdout carries only the result, stderr carries everything
/// else, <c>--json</c> output and errors parse, and the exit code says what happened. Back-to-back device commands can
/// wait up to about 5 seconds on tr-web's <c>/api/devices</c> rate limit; that is expected.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class ContractScenarios(SharedApiFixture api)
{
    [Fact]
    public async Task DeviceList_WritesOnlyPlainNamesToStdout_AndTheEngineNoticesOnlyToStderr()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("device", "list")).Should().Be(0);

            cli.Output.Should().NotContain("\u001b").And.NotContainAny("[bold", "[/]", "Starting the TeensyROM engine");
            cli.Output.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Should().BeEquivalentTo(api.Devices.Select(device => device.Name), "stdout holds the names and nothing else");
            cli.Error.Should().Contain("Starting the TeensyROM engine");
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    [Theory]
    [InlineData("engine", "status")]
    [InlineData("settings", "show")]
    [InlineData("device", "list")]
    public async Task JsonOutput_ParsesAsOneDocument_WithNothingElseOnStdout(params string[] command)
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync([.. command, "--json"]);

        exitCode.Should().Be(0);
        var parse = () => JsonDocument.Parse(cli.Output).Dispose();
        parse.Should().NotThrow();
    }

    [Fact]
    public async Task AnUnknownCommand_ExitsUsage_WithItsSentenceAndTheNearestHelpOnStderr()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("bogus");

        exitCode.Should().Be(2);
        cli.Output.Should().BeEmpty();
        cli.Error.Should().Contain("see `trom --help`").And.Contain("USAGE");
    }

    [SkippableFact]
    public async Task DevicePing_WithNoDeviceOnline_ExitsNoDevice_AndWithJsonEndsStderrWithAJsonError()
    {
        Skip.If(api.OnlineDevices.Count > 0, "a TeensyROM is online in the test API");
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "ping", "--json");

        exitCode.Should().Be(4);
        cli.Output.Should().BeEmpty();
        var error = LastLineAsError(cli.Error);
        error.GetProperty("code").GetString().Should().Be("noDevice");
        error.GetProperty("exitCode").GetInt32().Should().Be(4);
    }

    [Fact]
    public async Task AnUnknownOptionWithJson_ExitsUsage_AndEndsStderrWithAJsonError()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("engine", "status", "--bogus", "--json");

        exitCode.Should().Be(2);
        cli.Output.Should().BeEmpty();
        var error = LastLineAsError(cli.Error);
        error.GetProperty("code").GetString().Should().Be("usage");
        error.GetProperty("exitCode").GetInt32().Should().Be(2);
    }

    private static JsonElement LastLineAsError(string stderr) =>
        JsonDocument.Parse(stderr.TrimEnd().Replace("\r\n", "\n").Split('\n')[^1]).RootElement.GetProperty("error");
}
