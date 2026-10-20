using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Commands that need no engine run without one: they start nothing and ask for no device.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class DeviceFreeScenarios
{
    [Fact]
    public async Task CreditsAndChipsynth_RunWithoutAnEngine_AndStartNone()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);
        var presets = Directory.CreateTempSubdirectory("teensyrom-cli-presets-");

        try
        {
            using var cli = new CliHarness();

            (await cli.RunThroughSessionAsync("credits")).Should().Be(0);

            cli.Console.Input.PushKey(ConsoleKey.Enter);
            var chipsynth = await cli.RunThroughSessionAsync("chipsynth", "--clock", "ntsc", "--source", presets.FullName, "--target", "ASID");

            chipsynth.Should().Be(0);
            cli.Output.Should().Contain("Credits").And.Contain("Preset Generation Completed")
                .And.NotContain("Starting the TeensyROM engine").And.NotContain("No TeensyROM is online");
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
        }
        finally
        {
            presets.Delete(recursive: true);
            await TestEngine.EnsureAsync(bound.Token);
        }
    }
}
