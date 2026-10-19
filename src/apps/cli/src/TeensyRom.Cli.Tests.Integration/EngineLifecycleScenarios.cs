using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The CLI starting, replacing and stopping the real engine. Each scenario hands the shared engine back when it ends.
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
            cli.Console.Input.PushKey(ConsoleKey.Enter);

            await cli.RunThroughSessionAsync("ports");

            cli.Output.Should().Contain("Starting the TeensyROM engine");
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
            cli.Console.Input.PushKey(ConsoleKey.Enter);

            await cli.RunThroughSessionAsync("ports");

            cli.Output.Should().Contain("0.0.0-other").And.Contain("restarting");
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
    public async Task Stop_StopsTheEngine_AndSaysSoWhenNoneIsRunning()
    {
        using var bound = TestEngine.Bounded();
        var home = await TestEngine.EnsureAsync(bound.Token);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunThroughSessionAsync("stop")).Should().Be(0);

            cli.Output.Should().Contain("engine stopped");
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
            TestEngine.IsEngineLockHeld(home).Should().BeFalse();

            (await cli.RunThroughSessionAsync("stop")).Should().Be(0);

            cli.Output.Should().Contain("No TeensyROM engine is running.");
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
