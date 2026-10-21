using System.Text.Json;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The CLI starting, replacing and stopping the real engine. Each scenario hands the shared engine back when it ends.
/// An engine command here is <c>device list</c>; back-to-back runs can wait up to about 5 seconds on tr-web's
/// <c>/api/devices</c> rate limit, which is expected.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class EngineLifecycleScenarios
{
    private static readonly string CliVersion = AssemblyExtensions.GetVersion(typeof(CliHost).Assembly);

    [Fact]
    public async Task EngineCommand_StartsTheEngineItself_InAFreshHome()
    {
        using var bound = TestEngine.Bounded();
        var home = TestEngine.NewScenarioHome();
        var passed = false;

        await TestEngine.StopAsync(bound.Token);
        Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("device", "list")).Should().Be(0);

            cli.Error.Should().Contain("Starting the TeensyROM engine");
            cli.Output.Should().NotContain("Starting the TeensyROM engine", "engine notices belong on stderr");
            (await RunningVersionAsync(bound.Token)).Should().Be(CliVersion);
            TestEngine.IsEngineLockHeld(home).Should().BeTrue();
            File.Exists(Path.Combine(home, "api", "Assets", ".package-version")).Should().BeTrue();
            passed = true;
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
            if (passed) TestEngine.TryDeleteHome(home);
        }
    }

    [Fact]
    public async Task EngineCommand_ReplacesAnEngineOfAnotherVersion()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);
        var other = await FakeEngine.StartAsync("0.0.0-other");

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("device", "list")).Should().Be(0);

            cli.Error.Should().Contain("0.0.0-other").And.Contain("restarting");
            other.StopRequested.Should().BeTrue();
            (await RunningVersionAsync(bound.Token)).Should().Be(CliVersion);
        }
        finally
        {
            await other.DisposeAsync();
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    [Fact]
    public async Task EngineStatus_SaysNoEngineIsRunning_ThenSeesTheOneAnotherCommandStarted()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("engine", "status", "--json")).Should().Be(3);

            JsonDocument.Parse(cli.Output).RootElement.GetProperty("running").GetBoolean().Should().BeFalse();
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>("status never starts an engine");

            await TestEngine.EnsureAsync(bound.Token);
            using var after = new CliHarness();

            (await after.RunAsync("engine", "status", "--json")).Should().Be(0);

            var status = JsonDocument.Parse(after.Output).RootElement;
            status.GetProperty("running").GetBoolean().Should().BeTrue();
            status.GetProperty("matches").GetBoolean().Should().BeTrue();
            status.GetProperty("version").GetString()!.Split('+')[0].Should().Be(CliVersion);
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    [Fact]
    public async Task EngineStop_StopsTheEngine_AndSaysSoWhenNoneIsRunning()
    {
        using var bound = TestEngine.Bounded();
        var home = await TestEngine.EnsureAsync(bound.Token);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("engine", "stop")).Should().Be(0);

            cli.Error.Should().Contain("engine stopped");
            cli.Output.Should().BeEmpty();
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
            TestEngine.IsEngineLockHeld(home).Should().BeFalse();

            (await cli.RunAsync("engine", "stop", "--json")).Should().Be(0);

            cli.Error.Should().Contain("No TeensyROM engine is running.");
            JsonDocument.Parse(cli.Output).RootElement.GetProperty("outcome").GetString().Should().Be("notRunning");
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    private static async Task<string> RunningVersionAsync(CancellationToken ct)
    {
        var probe = await new EngineProbe().ProbeAsync(ct);

        return probe.Should().BeOfType<EngineProbeResult.Engine>().Subject.Version.Split('+')[0];
    }
}
