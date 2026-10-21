using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The menu's startup gate: it readies the engine and takes the only online device without asking, or offers exactly
/// the devices that are online when there are several.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class StartupScenarios(SharedApiFixture api)
{
    [Fact]
    public async Task Startup_OffersExactlyTheOnlineDevicesTheApiReports()
    {
        using var cli = new CliHarness(interactive: true);
        var online = api.OnlineDevices;

        // The gate asks only when several devices are online; take the first one it offers.
        if (online.Count > 1) cli.Out.Input.PushKey(ConsoleKey.Enter);

        var ready = await cli.StartAsync();

        cli.Output.Should().NotContain("Starting the TeensyROM engine").And.NotContain("restarting");

        if (online.Count == 0)
        {
            ready.Should().BeFalse();
            cli.Output.Should().Contain("No TeensyROM is online");
            return;
        }

        ready.Should().BeTrue();

        if (online.Count == 1)
        {
            // Nothing to choose from, so nothing is asked and the only online device is the one selected.
            cli.Output.Should().NotContain(online[0].Name);
            SelectedDeviceId(cli).Should().Be(online[0].DeviceId);
            return;
        }

        foreach (var device in online)
        {
            cli.Output.Should().Contain(device.Name);
        }

        var offlineOnly = api.Devices.Except(online).Where(d => !online.Any(o => o.Name.Contains(d.Name)));
        foreach (var device in offlineOnly)
        {
            cli.Output.Should().NotContain(device.Name);
        }
    }

    private static string? SelectedDeviceId(CliHarness cli)
    {
        using var provider = cli.Host.Services.BuildServiceProvider();

        return provider.GetRequiredService<IDeviceService>().SelectedDevice?.Id;
    }
}
