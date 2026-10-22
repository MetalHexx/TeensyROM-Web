using System.Text.Json;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Storage.Entities;
using CartDto = TeensyRom.Cli.Api.Generated.CartDto;

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
    public async Task FileLaunch_RunsTheBenchFile_AndReportsItLaunched()
    {
        var path = BenchFileOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("file", "launch", path, "--device", device.DeviceId, "--storage", storage, "--json");

        exitCode.Should().Be(0, cli.Error);
        var result = JsonDocument.Parse(cli.Output).RootElement;
        result.GetProperty("status").GetString().Should().Be("launched");
        var file = result.GetProperty("file");
        file.GetProperty("path").GetString().Should().BeEquivalentTo(path);
        AssertFullRecord(file);
    }

    private static readonly string[] FullRecordFields =
        ["description", "links", "tags", "youTubeVideos", "competitions", "ratingCount", "images", "metadataSource", "meta1", "meta2", "parentPath", "type"];

    private static void AssertFullRecord(JsonElement file)
    {
        file.TryGetProperty("storageType", out _).Should().BeFalse();
        foreach (var field in FullRecordFields) file.TryGetProperty(field, out _).Should().BeTrue($"a launched file carries {field}");
    }

    [SkippableFact]
    public async Task FileLs_ListsTheRootOfTheBenchStorage()
    {
        var (device, storage) = BenchDeviceOrSkip();
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("file", "ls", "/", "--device", device.DeviceId, "--storage", storage, "--json");

        exitCode.Should().Be(0, cli.Error);
        var listing = JsonDocument.Parse(cli.Output).RootElement;
        listing.GetProperty("path").GetString().Should().Be("/");
        listing.GetProperty("storage").GetString().Should().Be(storage);
        listing.GetProperty("directories").EnumerateArray().Concat(listing.GetProperty("files").EnumerateArray())
            .Should().OnlyContain(entry => entry.GetProperty("storage").GetString() == storage && entry.GetProperty("path").GetString()!.StartsWith('/'));
    }

    /// <summary>
    /// Searches for CLI_BENCH_SEARCH, or the name of CLI_BENCH_FILE without its extension. The storage must be indexed
    /// for the search to find anything; an empty result is still a successful search.
    /// </summary>
    [SkippableFact]
    public async Task FileSearch_AnswersWithItemsThatCarryTheirPathAndStorage()
    {
        var text = Environment.GetEnvironmentVariable("CLI_BENCH_SEARCH");
        if (string.IsNullOrWhiteSpace(text)) text = Path.GetFileNameWithoutExtension(Environment.GetEnvironmentVariable("CLI_BENCH_FILE") ?? string.Empty);
        Skip.If(string.IsNullOrWhiteSpace(text), "neither CLI_BENCH_SEARCH nor CLI_BENCH_FILE is set");
        var (device, storage) = BenchDeviceOrSkip();
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("file", "search", text!, "--take", "5", "--device", device.DeviceId, "--storage", storage, "--json");

        exitCode.Should().Be(0, cli.Error);
        JsonDocument.Parse(cli.Output).RootElement.EnumerateArray()
            .Should().OnlyContain(item => item.GetProperty("storage").GetString() == storage && item.GetProperty("path").GetString()!.StartsWith('/'));
    }

    /// <summary>A song in the search results carries its play length in the compact form.</summary>
    [SkippableFact]
    public async Task FileSearch_CarriesThePlayLengthOfSongs()
    {
        var text = Environment.GetEnvironmentVariable("CLI_BENCH_SEARCH");
        if (string.IsNullOrWhiteSpace(text)) text = Path.GetFileNameWithoutExtension(Environment.GetEnvironmentVariable("CLI_BENCH_FILE") ?? string.Empty);
        Skip.If(string.IsNullOrWhiteSpace(text), "neither CLI_BENCH_SEARCH nor CLI_BENCH_FILE is set");
        var (device, storage) = BenchDeviceOrSkip();
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("file", "search", text!, "--filter", "music", "--take", "5", "--device", device.DeviceId, "--storage", storage, "--json");

        exitCode.Should().Be(0, cli.Error);
        var songs = JsonDocument.Parse(cli.Output).RootElement.EnumerateArray().ToList();
        Skip.If(songs.Count == 0, "the bench storage has no matching music");
        songs.Select(song => song.TryGetProperty("playLength", out var length) && length.ValueKind == JsonValueKind.String).Should().AllBeEquivalentTo(true);
    }

    /// <summary>Has tr-web pick a music file on the bench storage; the scenario is skipped when the storage has none.</summary>
    [SkippableFact]
    public async Task FileRandom_LaunchesAMusicFileFromTheBenchStorage()
    {
        var (device, storage) = BenchDeviceOrSkip();
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync("file", "random", "--filter", "music", "--device", device.DeviceId, "--storage", storage, "--json");

        Skip.If(exitCode == (int)CliExitCode.NotFound, "the bench storage has no music files");
        exitCode.Should().Be(0, cli.Error);
        var result = JsonDocument.Parse(cli.Output).RootElement;
        result.GetProperty("status").GetString().Should().Be("launched");
        var file = result.GetProperty("file");
        file.GetProperty("fileType").GetString().Should().Be("sid");
        AssertFullRecord(file);
        foreach (var field in new[] { "playLength", "subtuneLengths", "startSubtuneNum" }) file.TryGetProperty(field, out _).Should().BeTrue($"a launched song carries {field}");
    }

    /// <summary>Tags the bench file as a favorite, then untags it, leaving the storage as it was found.</summary>
    [SkippableFact]
    public async Task FileFavoriteThenUnfavorite_TagsAndUntagsTheBenchFile()
    {
        var path = BenchFileOrSkip();
        var (device, storage) = BenchDeviceOrSkip();

        using (var favorite = new CliHarness())
        {
            var exitCode = await favorite.RunAsync("file", "favorite", path, "--device", device.DeviceId, "--storage", storage, "--json");

            exitCode.Should().Be(0, favorite.Error);
            JsonDocument.Parse(favorite.Output).RootElement[0].GetProperty("ok").GetBoolean().Should().BeTrue();
        }
        using var unfavorite = new CliHarness();

        var unfavoriteExit = await unfavorite.RunAsync("file", "unfavorite", path, "--device", device.DeviceId, "--storage", storage, "--json");

        unfavoriteExit.Should().Be(0, unfavorite.Error);
        JsonDocument.Parse(unfavorite.Output).RootElement[0].GetProperty("ok").GetBoolean().Should().BeTrue();
    }

    private static string BenchFileOrSkip()
    {
        var path = Environment.GetEnvironmentVariable("CLI_BENCH_FILE") ?? string.Empty;
        Skip.If(string.IsNullOrWhiteSpace(path), "CLI_BENCH_FILE is not set");
        return path;
    }

    /// <summary>The first online device and the storage to use on it, as <c>--storage</c> writes it.</summary>
    private (CartDto Device, string Storage) BenchDeviceOrSkip()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];

        return (device, CliServices.AvailableStorageOrSkip(device) == TeensyStorageType.SD ? "sd" : "usb");
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
