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

    /// <summary>
    /// Two device commands in a row both resolve the device with a plain listing, which the engine does not rate limit,
    /// so neither waits on the other.
    /// </summary>
    [SkippableFact]
    public async Task DevicePing_RunTwiceInARow_DoesNotWaitOnTheDeviceListingRateLimit()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        using var first = new CliHarness();
        using var second = new CliHarness();
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        var firstExit = await first.RunAsync("device", "ping", "--device", device.DeviceId);
        var secondExit = await second.RunAsync("device", "ping", "--device", device.DeviceId);

        stopwatch.Stop();
        firstExit.Should().Be(0, first.Error);
        secondExit.Should().Be(0, second.Error);
        stopwatch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(3));
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

    /// <summary>
    /// Runs one command line in a fresh CLI, as a separate <c>trom</c> invocation would: nothing but the CLI's home carries
    /// over from the previous one.
    /// </summary>
    private static async Task<(int ExitCode, JsonElement Json, string Error)> RunJsonAsync(params string[] args)
    {
        using var cli = new CliHarness();

        var exitCode = await cli.RunAsync(args);

        return (exitCode, string.IsNullOrWhiteSpace(cli.Output) ? default : JsonDocument.Parse(cli.Output).RootElement, cli.Error);
    }

    private static string FilePath(JsonElement launch) => launch.GetProperty("file").GetProperty("path").GetString()!;

    private static bool IsFileOfType(string path, params string[] extensions) =>
        extensions.Any(extension => path.EndsWith(extension, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// After launching the bench file from its folder, <c>file next</c> in another invocation launches a file of the
    /// same folder and <c>file previous</c> comes back to the bench file.
    /// </summary>
    [SkippableFact]
    public async Task FileNextThenPrevious_AfterALaunchFromAFolder_StayInThatFolder_AndComeBack()
    {
        var path = BenchFileOrSkip();
        var (device, storage) = BenchDeviceOrSkip();

        var launch = await RunJsonAsync("file", "launch", path, "--device", device.DeviceId, "--storage", storage, "--json");
        launch.ExitCode.Should().Be(0, launch.Error);
        var next = await RunJsonAsync("file", "next", "--device", device.DeviceId, "--json");
        var previous = await RunJsonAsync("file", "previous", "--device", device.DeviceId, "--json");

        next.ExitCode.Should().Be(0, next.Error);
        next.Json.GetProperty("status").GetString().Should().Be("launched");
        Path.GetDirectoryName(FilePath(next.Json))!.Replace('\\', '/').Should().BeEquivalentTo(Path.GetDirectoryName(path)!.Replace('\\', '/'));
        previous.ExitCode.Should().Be(0, previous.Error);
        FilePath(previous.Json).Should().BeEquivalentTo(path);
    }

    /// <summary>After <c>file random</c>, <c>file next</c> picks again and <c>file previous</c> walks back to the first pick.</summary>
    [SkippableFact]
    public async Task FileNextThenPrevious_AfterFileRandom_WalkBackThroughThePicks()
    {
        BenchFileOrSkip();
        var (device, storage) = BenchDeviceOrSkip();

        var random = await RunJsonAsync("file", "random", "--filter", "music", "--device", device.DeviceId, "--storage", storage, "--json");
        Skip.If(random.ExitCode == (int)CliExitCode.NotFound, "the bench storage has no music files");
        random.ExitCode.Should().Be(0, random.Error);
        var next = await RunJsonAsync("file", "next", "--device", device.DeviceId, "--json");
        var previous = await RunJsonAsync("file", "previous", "--device", device.DeviceId, "--json");

        next.ExitCode.Should().Be(0, next.Error);
        next.Json.GetProperty("file").GetProperty("fileType").GetString().Should().Be("sid", "the filter of the first pick carries over");
        previous.ExitCode.Should().Be(0, previous.Error);
        FilePath(previous.Json).Should().BeEquivalentTo(FilePath(random.Json));
    }

    /// <summary>Pauses the bench song, then resumes it, each from its own invocation. Needs CLI_BENCH_FILE to be a SID.</summary>
    [SkippableFact]
    public async Task FilePause_OnASong_PausesThenResumes()
    {
        var path = BenchFileOrSkip();
        Skip.IfNot(IsFileOfType(path, ".sid"), "CLI_BENCH_FILE is not a SID");
        var (device, storage) = BenchDeviceOrSkip();

        (await RunJsonAsync("file", "launch", path, "--device", device.DeviceId, "--storage", storage, "--json")).ExitCode.Should().Be(0);
        var pause = await RunJsonAsync("file", "pause", "--device", device.DeviceId, "--json");
        var resume = await RunJsonAsync("file", "pause", "--device", device.DeviceId, "--json");
        await RunJsonAsync("file", "stop", "--device", device.DeviceId, "--json");

        pause.ExitCode.Should().Be(0, pause.Error);
        pause.Json.GetProperty("action").GetString().Should().Be("paused");
        resume.ExitCode.Should().Be(0, resume.Error);
        resume.Json.GetProperty("action").GetString().Should().Be("resumed");
    }

    /// <summary>
    /// A game can't be paused: <c>file pause</c> stops it by resetting the device, and the next one launches it again.
    /// Needs CLI_BENCH_FILE to be a game or program.
    /// </summary>
    [SkippableFact]
    public async Task FilePause_OnAGame_StopsIt_AndTheNextPauseLaunchesItAgain()
    {
        var path = BenchFileOrSkip();
        Skip.IfNot(IsFileOfType(path, ".prg", ".crt", ".p00", ".d64"), "CLI_BENCH_FILE is not a game or program");
        var (device, storage) = BenchDeviceOrSkip();

        (await RunJsonAsync("file", "launch", path, "--device", device.DeviceId, "--storage", storage, "--json")).ExitCode.Should().Be(0);
        var stop = await RunJsonAsync("file", "pause", "--device", device.DeviceId, "--json");
        var again = await RunJsonAsync("file", "pause", "--device", device.DeviceId, "--json");
        await RunJsonAsync("file", "stop", "--device", device.DeviceId, "--json");

        stop.ExitCode.Should().Be(0, stop.Error);
        stop.Json.GetProperty("action").GetString().Should().Be("stopped");
        stop.Json.GetProperty("reason").GetString().Should().NotBeNullOrWhiteSpace();
        again.ExitCode.Should().Be(0, again.Error);
        again.Json.GetProperty("action").GetString().Should().Be("relaunched");
    }

    /// <summary>Stops the launched bench file by resetting the device; the stop is remembered, so the next pause launches it again.</summary>
    [SkippableFact]
    public async Task FileStop_ResetsTheDevice_AndLeavesTheLastLaunchStopped()
    {
        var path = BenchFileOrSkip();
        var (device, storage) = BenchDeviceOrSkip();

        (await RunJsonAsync("file", "launch", path, "--device", device.DeviceId, "--storage", storage, "--json")).ExitCode.Should().Be(0);
        var stop = await RunJsonAsync("file", "stop", "--device", device.DeviceId, "--json");
        var pause = await RunJsonAsync("file", "pause", "--device", device.DeviceId, "--json");
        await RunJsonAsync("file", "stop", "--device", device.DeviceId, "--json");

        stop.ExitCode.Should().Be(0, stop.Error);
        stop.Json.GetProperty("action").GetString().Should().Be("stopped");
        FilePath(stop.Json).Should().BeEquivalentTo(path);
        pause.Json.GetProperty("action").GetString().Should().Be("relaunched");
    }

    /// <summary>
    /// The scratch folder on the bench storage that the upload scenarios write into (for example /cli-bench). Uploads are
    /// never cleaned up from the device, so use a folder you can empty by hand.
    /// </summary>
    private static string UploadFolderOrSkip()
    {
        var folder = (Environment.GetEnvironmentVariable("CLI_BENCH_UPLOAD_FOLDER") ?? string.Empty).TrimEnd('/');
        Skip.If(string.IsNullOrWhiteSpace(folder), "CLI_BENCH_UPLOAD_FOLDER is not set");
        return folder;
    }

    /// <summary>The smallest launchable program: <c>10 END</c> in BASIC at $0801.</summary>
    private static readonly byte[] TinyProgram = [0x01, 0x08, 0x0B, 0x08, 0x0A, 0x00, 0x80, 0x00, 0x00, 0x00];

    private static string NewLocalFolder() => Directory.CreateTempSubdirectory("trom-bench-upload-").FullName;

    private static string WriteProgram(string folder, string relative)
    {
        var path = Path.Combine(folder, relative);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, TinyProgram);
        return path;
    }

    private static async Task<(int ExitCode, JsonElement Json, string Error)> ListAsync(string folder, string deviceId, string storage) =>
        await RunJsonAsync("file", "ls", folder, "--device", deviceId, "--storage", storage, "--json");

    private static string[] FilePaths(JsonElement listing) =>
        listing.GetProperty("files").EnumerateArray().Select(file => file.GetProperty("path").GetString()!).ToArray();

    /// <summary>Uploads one local file, then finds it in the device folder.</summary>
    [SkippableFact]
    public async Task FileUpload_OneFile_LandsInTheDeviceFolder()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();

        try
        {
            var name = $"bench-{Guid.NewGuid():N}.prg";
            var file = WriteProgram(local, name);

            var upload = await RunJsonAsync("file", "upload", file, "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");

            upload.ExitCode.Should().Be(0, upload.Error);
            upload.Json.GetProperty("files")[0].GetProperty("ok").GetBoolean().Should().BeTrue();
            upload.Json.GetProperty("files")[0].GetProperty("devicePath").GetString().Should().Be($"{target}/{name}");
            var listing = await ListAsync(target, device.DeviceId, storage);
            FilePaths(listing.Json).Should().Contain(path => path.Equals($"{target}/{name}", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(local, recursive: true);
        }
    }

    /// <summary>Uploads a folder with a nested folder: it arrives as a folder of its own name with the layout kept.</summary>
    [SkippableFact]
    public async Task FileUpload_ANestedFolder_KeepsItsLayoutUnderItsOwnName()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();

        try
        {
            var tree = $"tree-{Guid.NewGuid():N}";
            WriteProgram(local, $"{tree}/top.prg");
            WriteProgram(local, $"{tree}/inner/deep.prg");

            var upload = await RunJsonAsync("file", "upload", Path.Combine(local, tree), "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");

            upload.ExitCode.Should().Be(0, upload.Error);
            upload.Json.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(2);
            var inner = await ListAsync($"{target}/{tree}/inner", device.DeviceId, storage);
            FilePaths(inner.Json).Should().Contain(path => path.EndsWith("/deep.prg", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(local, recursive: true);
        }
    }

    /// <summary>Uploads a .zip, which the engine expands into a folder named after it.</summary>
    [SkippableFact]
    public async Task FileUpload_AnArchive_IsExpandedOnTheDevice()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();

        try
        {
            var pack = $"pack-{Guid.NewGuid():N}";
            WriteProgram(local, "contents/one.prg");
            WriteProgram(local, "contents/two.prg");
            var archive = Path.Combine(local, $"{pack}.zip");
            System.IO.Compression.ZipFile.CreateFromDirectory(Path.Combine(local, "contents"), archive);

            var upload = await RunJsonAsync("file", "upload", archive, "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");

            upload.ExitCode.Should().Be(0, upload.Error);
            upload.Json.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(2);
            var expanded = await ListAsync($"{target}/{pack}", device.DeviceId, storage);
            FilePaths(expanded.Json).Should().HaveCount(2);
        }
        finally
        {
            Directory.Delete(local, recursive: true);
        }
    }

    /// <summary>With no paths and --yes, the current folder's contents arrive directly in the device folder.</summary>
    [SkippableFact]
    public async Task FileUpload_WithNoPathsAndYes_SendsTheCurrentFoldersContents()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();
        var original = Directory.GetCurrentDirectory();

        try
        {
            var destination = $"{target}/cwd-{Guid.NewGuid():N}";
            WriteProgram(local, "first.prg");
            WriteProgram(local, "sub/second.prg");
            Directory.SetCurrentDirectory(local);

            var upload = await RunJsonAsync("file", "upload", "--to", destination, "--yes", "--device", device.DeviceId, "--storage", storage, "--json");

            upload.ExitCode.Should().Be(0, upload.Error);
            upload.Json.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(2);
            var listing = await ListAsync(destination, device.DeviceId, storage);
            FilePaths(listing.Json).Should().Contain(path => path.EndsWith("/first.prg", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.SetCurrentDirectory(original);
            Directory.Delete(local, recursive: true);
        }
    }

    /// <summary>Uploads one program with --launch, which then runs and is reported as <c>file launch</c> reports it.</summary>
    [SkippableFact]
    public async Task FileUploadLaunch_SendsTheFile_ThenLaunchesIt()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();

        try
        {
            var name = $"launch-{Guid.NewGuid():N}.prg";
            var file = WriteProgram(local, name);

            var upload = await RunJsonAsync("file", "upload", "--launch", file, "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");
            await RunJsonAsync("file", "stop", "--device", device.DeviceId, "--json");

            upload.ExitCode.Should().Be(0, upload.Error);
            upload.Json.GetProperty("status").GetString().Should().Be("launched");
            FilePath(upload.Json).Should().BeEquivalentTo($"{target}/{name}");
        }
        finally
        {
            Directory.Delete(local, recursive: true);
        }
    }

    /// <summary>Uploads one program, then downloads it into a throwaway folder: the bytes come back unchanged.</summary>
    [SkippableFact]
    public async Task FileDownload_OneFile_IsSavedByItsName()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();
        var saved = NewLocalFolder();

        try
        {
            var name = $"down-{Guid.NewGuid():N}.prg";
            var file = WriteProgram(local, name);

            var upload = await RunJsonAsync("file", "upload", file, "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");
            upload.ExitCode.Should().Be(0, upload.Error);

            var download = await RunJsonAsync("file", "download", $"{target}/{name}", "--to", saved, "--device", device.DeviceId, "--storage", storage, "--json");

            download.ExitCode.Should().Be(0, download.Error);
            download.Json.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(1);
            File.ReadAllBytes(Path.Combine(saved, name)).Should().Equal(TinyProgram);
            Directory.GetFiles(saved, "*.partial", SearchOption.AllDirectories).Should().BeEmpty();
        }
        finally
        {
            Directory.Delete(local, recursive: true);
            Directory.Delete(saved, recursive: true);
        }
    }

    /// <summary>Uploads a nested folder, then downloads it: it arrives as a folder of its own name with the layout kept.</summary>
    [SkippableFact]
    public async Task FileDownload_ANestedFolder_KeepsItsLayoutUnderItsOwnName()
    {
        var target = UploadFolderOrSkip();
        var (device, storage) = BenchDeviceOrSkip();
        var local = NewLocalFolder();
        var saved = NewLocalFolder();

        try
        {
            var tree = $"tree-{Guid.NewGuid():N}";
            WriteProgram(local, $"{tree}/top.prg");
            WriteProgram(local, $"{tree}/inner/deep.prg");

            var upload = await RunJsonAsync("file", "upload", Path.Combine(local, tree), "--to", target, "--device", device.DeviceId, "--storage", storage, "--json");
            upload.ExitCode.Should().Be(0, upload.Error);

            var download = await RunJsonAsync("file", "download", $"{target}/{tree}", "--to", saved, "--device", device.DeviceId, "--storage", storage, "--json");

            download.ExitCode.Should().Be(0, download.Error);
            download.Json.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(2);
            File.Exists(Path.Combine(saved, tree, "top.prg")).Should().BeTrue();
            File.Exists(Path.Combine(saved, tree, "inner", "deep.prg")).Should().BeTrue();
        }
        finally
        {
            Directory.Delete(local, recursive: true);
            Directory.Delete(saved, recursive: true);
        }
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
