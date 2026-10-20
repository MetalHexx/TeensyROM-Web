using System.Text.Json;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Needs a TeensyROM attached to the test API; excluded from the pipeline run.
/// </summary>
[Collection(RealApiCollection.Name)]
[Trait("Category", "Hardware")]
public sealed class HardwareScenarios(SharedApiFixture api)
{
    /// <summary>
    /// Launches the file named by CLI_BENCH_FILE (for example /music/MUSICIANS/T/Tjelta_Geir/Artillery.sid)
    /// on the first online device. The bench run extends this pattern.
    /// </summary>
    [SkippableFact]
    public async Task LaunchFile_RunsTheBenchFile_AndTheApiReportsItLaunched()
    {
        var path = Environment.GetEnvironmentVariable("CLI_BENCH_FILE") ?? string.Empty;
        Skip.If(string.IsNullOrWhiteSpace(path), "CLI_BENCH_FILE is not set");
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var storageType = CliServices.AvailableStorageOrSkip(device);

        using var cli = new CliServices();
        cli.SelectDevice(device);
        var item = FileItem.Create(path).Should().BeAssignableTo<ILaunchableItem>().Subject;

        var outcome = await cli.Get<ILaunchService>().LaunchFile(storageType, item);

        outcome.Status.Should().Be(LaunchStatus.Launched, outcome.Message);
    }

    [SkippableFact]
    public async Task DevicePing_AnswersOnTheBenchDevice()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("device", "ping", "--device", device.DeviceId, "--json");

        exitCode.Should().Be(0, cli.Error);
        JsonDocument.Parse(cli.Output).RootElement.GetProperty("device").GetString().Should().Be(device.DeviceId);
    }

    [SkippableFact]
    public async Task DeviceRename_ChangesTheBenchDeviceName_AndRestoresIt()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var temporaryName = $"{device.Name}-bench";

        try
        {
            using var rename = new CliHarness();
            (await rename.RunAsync("device", "rename", temporaryName, "--device", device.DeviceId, "--json")).Should().Be(0, rename.Error);
            JsonDocument.Parse(rename.Output).RootElement.GetProperty("name").GetString().Should().Be(temporaryName);
        }
        finally
        {
            using var restore = new CliHarness();
            (await restore.RunAsync("device", "rename", device.Name, "--device", device.DeviceId, "--json")).Should().Be(0, restore.Error);
            JsonDocument.Parse(restore.Output).RootElement.GetProperty("name").GetString().Should().Be(device.Name);
        }
    }

    /// <summary>Indexes the directory named by CLI_BENCH_INDEX_PATH (a small one, for example /music/MUSICIANS/T) on the first online device.</summary>
    [SkippableFact]
    public async Task IndexBuild_IndexesASmallPathOnTheBenchDevice()
    {
        var path = Environment.GetEnvironmentVariable("CLI_BENCH_INDEX_PATH") ?? string.Empty;
        Skip.If(string.IsNullOrWhiteSpace(path), "CLI_BENCH_INDEX_PATH is not set");
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var storageType = CliServices.AvailableStorageOrSkip(device);
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("index", "build", path, "--device", device.DeviceId, "--storage", storageType == TeensyStorageType.SD ? "sd" : "usb", "--json");

        exitCode.Should().Be(0, cli.Error);
        JsonDocument.Parse(cli.Output).RootElement.GetProperty("path").GetString().Should().Be(path);
    }
}
