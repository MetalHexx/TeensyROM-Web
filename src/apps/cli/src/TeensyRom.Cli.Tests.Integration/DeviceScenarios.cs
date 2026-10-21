using System.Text.Json;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// <c>trom device list</c> against the shared engine. The engine allows one device lookup per 5 seconds, so a run
/// right after another can wait on it; that is expected.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class DeviceScenarios(SharedApiFixture api)
{
    [Fact]
    public async Task DeviceList_PrintsTheNameOfEveryDeviceTheApiReports_OnePerLine()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "list");

        exitCode.Should().Be(0);
        cli.Output.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Should().BeEquivalentTo(api.Devices.Select(device => device.Name));
    }

    [Fact]
    public async Task DeviceList_Json_IsAnArrayOfEveryDeviceTheApiReports()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "list", "--json");

        exitCode.Should().Be(0);
        var devices = JsonDocument.Parse(cli.Output).RootElement.EnumerateArray().ToList();
        devices.Select(device => device.GetProperty("id").GetString()).Should().BeEquivalentTo(api.Devices.Select(device => device.DeviceId));
        devices.Select(device => device.GetProperty("isOnline").GetBoolean()).Should().BeEquivalentTo(api.Devices.Select(device => device.DeviceState != Api.Generated.DeviceState.ConnectionLost));
    }

    [SkippableFact]
    public async Task DevicePing_WithNoDeviceOnline_ExitsNoDevice()
    {
        Skip.If(api.OnlineDevices.Count > 0, "a TeensyROM is online in the test API");
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "ping");

        exitCode.Should().Be(4);
        cli.Output.Should().BeEmpty();
    }

    [Fact]
    public async Task DeviceForget_OfADeviceTheApiDoesNotKnow_ExitsNotFound()
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "forget", "--device", "nope");

        exitCode.Should().Be(5);
        cli.Output.Should().BeEmpty();
    }
}
