using System.Text.Json;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// A device in the middle of a transfer answers every command to it with exit 6, <c>deviceBusy</c>.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class BusyScenarios(SharedApiFixture api)
{
    [SkippableFact]
    public async Task ACommandToADeviceWithAnOpenTransfer_ExitsDeviceBusy_WithAJsonError()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var job = await api.Api.CreateTransferJobAsync(device.DeviceId, TeensyStorageType.SD, new CreateJobBody { DestinationDirectory = "/", ExpectedArchiveCount = 0, Launch = false });

        try
        {
            using var cli = new CliHarness();

            var exitCode = await cli.RunAsync("device", "reset", "--device", device.Name, "--json");

            exitCode.Should().Be(6, cli.Error);
            cli.Output.Should().BeEmpty();
            var error = LastLineAsError(cli.Error);
            error.GetProperty("code").GetString().Should().Be("deviceBusy");
            error.GetProperty("exitCode").GetInt32().Should().Be(6);
        }
        finally
        {
            await api.Api.CancelTransferJobAsync(job.JobId);
        }
    }

    private static JsonElement LastLineAsError(string stderr) =>
        JsonDocument.Parse(stderr.TrimEnd().Replace("\r\n", "\n").Split('\n')[^1]).RootElement.GetProperty("error");
}
