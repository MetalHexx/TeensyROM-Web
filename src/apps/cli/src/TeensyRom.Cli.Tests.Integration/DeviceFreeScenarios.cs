using System.Text.Json;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Commands that need no engine run without one: they start nothing and ask for no device. And the old command names
/// are gone.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class DeviceFreeScenarios
{
    [Fact]
    public async Task EngineStatus_HelpAndVersion_RunWithoutAnEngine_AndStartNone()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("engine", "status")).Should().Be(3);
            (await cli.RunAsync("--help")).Should().Be(0);
            (await cli.RunAsync("engine", "--help")).Should().Be(0);
            (await cli.RunAsync("device", "list", "--help")).Should().Be(0);
            (await cli.RunAsync("--version")).Should().Be(0);

            cli.Output.Should().Contain("trom ").And.Contain("EXIT CODES");
            cli.Error.Should().NotContain("Starting the TeensyROM engine").And.NotContain("No TeensyROM is online");
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    [Fact]
    public async Task TheOldCommandNames_AreUsageErrors_AndStartNoEngine()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);

        try
        {
            foreach (var oldName in new[] { "launch", "index", "ports", "credits", "stop" })
            {
                using var cli = new CliHarness();

                (await cli.RunAsync(oldName, "--json")).Should().Be(2, oldName);

                cli.Output.Should().BeEmpty();
                var error = JsonDocument.Parse(cli.Error.TrimEnd().Split('\n')[^1]).RootElement.GetProperty("error");
                error.GetProperty("code").GetString().Should().Be("usage", oldName);
            }
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
        }
        finally
        {
            await TestEngine.EnsureAsync(bound.Token);
        }
    }

    [Fact]
    public async Task ChipsynthGenerate_AndSettingsShow_RunWithoutAnEngine_AndStartNone()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.StopAsync(bound.Token);

        var source = Path.Combine(Path.GetTempPath(), $"chipsynth-{Guid.NewGuid():N}");

        try
        {
            Directory.CreateDirectory(source);
            await File.WriteAllTextAsync(Path.Combine(source, "lead.fermatax"), "<Preset><Settings sc=\"0\" /><Slot id=\"0\" version=\"1\" /></Preset>", bound.Token);

            using var cli = new CliHarness();

            (await cli.RunAsync("chipsynth", "generate", "--clock", "ntsc", "--source", source, "--target", "ASID")).Should().Be(0);
            (await cli.RunAsync("settings", "show")).Should().Be(0);

            File.Exists(Path.Combine(source, "ASID", "lead.fermatax")).Should().BeTrue();
            cli.Output.Should().Contain("storage: ");
            cli.Error.Should().NotContain("Starting the TeensyROM engine");
            (await new EngineProbe().ProbeAsync(bound.Token)).Should().BeOfType<EngineProbeResult.Unreachable>();
        }
        finally
        {
            if (Directory.Exists(source)) Directory.Delete(source, recursive: true);
            await TestEngine.EnsureAsync(bound.Token);
        }
    }
}
