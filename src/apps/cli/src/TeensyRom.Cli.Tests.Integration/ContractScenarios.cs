using System.Text.Json;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The composability contract against the real engine: stdout carries only the result, stderr carries everything
/// else, <c>--json</c> output and errors parse, and the exit code says what happened. Back-to-back device commands do not
/// wait: tr-web rate limits only full scans on <c>/api/devices</c>, not plain listings.
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
    public async Task EngineStatus_Json_NamesTheEnginesLogFolder_AndAnExistingLogFile()
    {
        await WaitForTheEnginesFirstLogFileAsync();
        using var cli = new CliHarness();

        (await cli.RunAsync("engine", "status", "--json")).Should().Be(0);

        var status = JsonDocument.Parse(cli.Output).RootElement;
        status.GetProperty("logFolder").GetString().Should().Be(TeensyRomHome.EngineLogsPath);
        var logFile = status.GetProperty("logFile").GetString();
        Path.GetFileName(logFile).Should().StartWith("Logs-").And.EndWith(".txt");
        File.Exists(logFile).Should().BeTrue();
    }

    /// <summary>
    /// The engine batches its file logging, flushing every 5 seconds or at 20 entries, so its first <c>Logs-*.txt</c> can
    /// land a few seconds after it starts answering. Waits for that file, up to 15 seconds, so the status call under test
    /// has one to name.
    /// </summary>
    private static async Task WaitForTheEnginesFirstLogFileAsync()
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);

        while (DateTime.UtcNow < deadline)
        {
            if (Directory.Exists(TeensyRomHome.EngineLogsPath)
                && Directory.EnumerateFiles(TeensyRomHome.EngineLogsPath, "Logs-*.txt").Any()) return;

            await Task.Delay(250);
        }
    }

    [Fact]
    public async Task Init_AgainstTheTestEngine_ReportsARunningEngine_Problems_AndTheCommands()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        using var report = JsonDocument.Parse(cli.Output);
        var root = report.RootElement;
        root.GetProperty("engine").GetProperty("running").GetBoolean().Should().BeTrue();
        root.GetProperty("webUi").GetProperty("available").ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);
        root.GetProperty("problems").ValueKind.Should().Be(JsonValueKind.Array);
        root.GetProperty("commands").EnumerateArray().Select(command => command.GetProperty("name").GetString())
            .Should().Contain(["file", "init"]);
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
