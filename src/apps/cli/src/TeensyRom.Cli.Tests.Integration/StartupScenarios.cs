namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The menu's startup gate: it readies the engine and offers exactly the devices that are online.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class StartupScenarios(SharedApiFixture api)
{
    [Fact]
    public async Task Startup_OffersExactlyTheOnlineDevicesTheApiReports()
    {
        using var cli = new CliHarness(interactive: true);
        var online = api.OnlineDevices;
        if (online.Count > 0) cli.Out.Input.PushKey(ConsoleKey.Enter);

        var ready = await cli.StartAsync();

        cli.Output.Should().NotContain("Starting the TeensyROM engine").And.NotContain("restarting");

        if (online.Count == 0)
        {
            ready.Should().BeFalse();
            cli.Output.Should().Contain("No TeensyROM is online");
            return;
        }

        ready.Should().BeTrue();
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
}
