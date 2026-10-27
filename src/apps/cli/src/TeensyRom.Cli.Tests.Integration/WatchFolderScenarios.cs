using System.Text.Json;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// <c>trom watch-folder</c> and <c>trom transfer list</c> against the real engine: what needs no device always runs, and
/// the round trip runs when a TeensyROM is online.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class WatchFolderScenarios(SharedApiFixture api)
{
    private static string Missing() => Path.Combine(Path.GetTempPath(), $"trom-unwatched-{Guid.NewGuid():N}");

    [Fact]
    public async Task List_AndTransferList_AreJsonArrays_WithoutAskingForADevice()
    {
        using var folders = new CliHarness();
        using var transfers = new CliHarness();

        (await folders.RunAsync("watch-folder", "list", "--json")).Should().Be(0, folders.Error);
        (await transfers.RunAsync("transfer", "list", "--json")).Should().Be(0, transfers.Error);

        var watched = JsonDocument.Parse(folders.Output).RootElement;
        watched.ValueKind.Should().Be(JsonValueKind.Array);
        JsonDocument.Parse(transfers.Output).RootElement.ValueKind.Should().Be(JsonValueKind.Array);
        if (api.Devices.Count == 0) watched.GetArrayLength().Should().Be(0);
    }

    [Theory]
    [InlineData("remove")]
    [InlineData("pause")]
    [InlineData("resume")]
    public async Task AnUnwatchedFolder_ExitsNotFound(string verb)
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("watch-folder", verb, Missing());

        exitCode.Should().Be(5);
        cli.Output.Should().BeEmpty();
    }

    [Fact]
    public async Task Add_OfAFolderThatIsNotThere_IsAUsageError()
    {
        using var cli = new CliHarness();

        (await cli.RunAsync("watch-folder", "add", Missing())).Should().Be(2);
    }

    [SkippableFact]
    public async Task AddListPauseResumeRemove_RoundTrip_ThroughTheEngine()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var folder = Directory.CreateTempSubdirectory("trom-watch-scenario-").FullName;

        try
        {
            var added = await RunJsonAsync("watch-folder", "add", folder, "--device", device.DeviceId, "--path", "/cli-watch-scenario", "--json");
            added.GetProperty("created").GetBoolean().Should().BeTrue();
            var watched = added.GetProperty("folder");
            watched.GetProperty("state").GetString().Should().Be("watching");
            watched.GetProperty("destinations")[0].GetProperty("deviceId").GetString().Should().Be(device.DeviceId);
            watched.GetProperty("destinations")[0].GetProperty("path").GetString()!.TrimEnd('/').Should().Be("/cli-watch-scenario");

            var listed = await RunJsonAsync("watch-folder", "list", "--json");
            listed.EnumerateArray().Select(f => f.GetProperty("id").GetString()).Should().Contain(watched.GetProperty("id").GetString());

            var paused = await RunJsonAsync("watch-folder", "pause", folder, "--json");
            paused.GetProperty("enabled").GetBoolean().Should().BeFalse();
            paused.GetProperty("state").GetString().Should().Be("off");

            var resumed = await RunJsonAsync("watch-folder", "resume", folder, "--json");
            resumed.GetProperty("enabled").GetBoolean().Should().BeTrue();

            var removed = await RunJsonAsync("watch-folder", "remove", folder, "--json");
            removed.GetProperty("folderRemoved").GetBoolean().Should().BeTrue();

            using var after = new CliHarness();
            (await after.RunAsync("watch-folder", "pause", folder)).Should().Be(5);
        }
        finally
        {
            using var cleanup = new CliHarness();
            await cleanup.RunAsync("watch-folder", "remove", folder);
            Directory.Delete(folder, recursive: true);
        }
    }

    private static async Task<JsonElement> RunJsonAsync(params string[] args)
    {
        using var cli = new CliHarness();

        (await cli.RunAsync(args)).Should().Be(0, cli.Error);

        return JsonDocument.Parse(cli.Output).RootElement.Clone();
    }
}
