using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using Spectre.Console.Cli;
using System.Reactive.Subjects;
using System.Text.Json;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;
using ApiStorageType = TeensyRom.Cli.Api.Generated.TeensyStorageType;
using TeensyFilterType = TeensyRom.Cli.Settings.TeensyFilterType;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file ls|search|launch|random</c> through the real tree over substituted storage, launch and player services.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FileCommandTests : IDisposable
{
    private const string PlayerHeader = "Stream Player";
    private const int Back = 7;

    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true, SdIndexed: true, UsbIndexed: true);
    private static readonly DeviceSummary Unindexed = Alpha with { SdIndexed = false, UsbIndexed = false };

    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly ILaunchService _launches = Substitute.For<ILaunchService>();
    private readonly IPlayerService _player = Substitute.For<IPlayerService>();
    private readonly ITypeResolver _resolver = Substitute.For<ITypeResolver>();
    private readonly Subject<ILaunchableItem> _fileLaunched = new();
    private readonly List<string> _calls = [];
    private readonly List<TestHost> _hosts = [];
    private readonly PlayerState _playerState = new();
    private TeensyStorageType _storageType = TeensyStorageType.SD;

    public FileCommandTests()
    {
        _storage.StorageType.Returns(_ => _storageType);
        _storage.When(s => s.UseStorage(Arg.Any<TeensyStorageType>())).Do(call => _storageType = call.Arg<TeensyStorageType>());
        _storage.GetDirectory(Arg.Any<string>()).Returns(_ => new DirectoryListing());
        _storage.GetFile(Arg.Any<string>()).Returns((ILaunchableItem?)null);
        _storage.Search(Arg.Any<string>(), Arg.Any<TeensyFilterType>()).Returns(new List<ILaunchableItem>());

        _player.FileLaunched.Returns(_fileLaunched);
        _player.GetState().Returns(_ => _playerState with { });
        _player.LaunchItem(Arg.Any<ILaunchableItem>()).Returns(call =>
        {
            _calls.Add("launch");
            _fileLaunched.OnNext(call.Arg<ILaunchableItem>());
            return Task.FromResult(true);
        });
        _resolver.Resolve(typeof(PlayerCommand)).Returns(_ =>
        {
            _calls.Add("resolve player");
            return new PlayerCommand(_player, _storage);
        });
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(bool terminal = false, string stdin = "", Action<ServiceCollection>? extra = null, DeviceSummary? device = null)
    {
        device ??= Alpha;
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.AddSingleton(_launches);
            services.AddSingleton(_player);
            services.AddSingleton(_resolver);
            services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin), inputIsTerminal: false));
            extra?.Invoke(services);
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { device });
        host.Devices.SelectedDevice.Returns(device);
        _hosts.Add(host);
        return host;
    }

    private static SongItem Song(string path, bool compatible = true) => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path,
        Title = "Commando",
        Creator = "Hubbard",
        ReleaseInfo = "1985",
        Size = 4096,
        IsCompatible = compatible
    };

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static string[] Names(JsonElement element) => element.EnumerateObject().Select(p => p.Name).ToArray();

    private static readonly string[] ItemShape =
        ["name", "path", "storage", "fileType", "size", "isFavorite", "isCompatible", "title", "creator", "releaseInfo", "shareUrl"];

    private static void Leave(TestHost host)
    {
        for (var i = 0; i < Back; i++) host.Consoles.Out.Input.PushKey(ConsoleKey.DownArrow);
        host.Consoles.Out.Input.PushKey(ConsoleKey.Enter);
    }

    private static bool PlayerOpened(TestHost host) => host.Consoles.StdOut.Contains(PlayerHeader);

    // ---- ls ----------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Ls_WithoutAPath_ListsTheRoot_AndPipedWritesDirectoriesWithASlashThenFiles()
    {
        _storage.GetDirectory("/").Returns(new DirectoryListing
        {
            Path = "/",
            Directories = [new DirectoryItem { Name = "music", Path = "/music" }],
            Files = [Song("/readme.sid")]
        });
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ls");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/\n/readme.sid\n");
    }

    [Fact]
    public async Task Ls_Json_CarriesPathAndStorageOnEveryEntry_DirectoriesToo()
    {
        _storage.GetDirectory("/music").Returns(new DirectoryListing
        {
            Path = "/music",
            Directories = [new DirectoryItem { Name = "MUSICIANS", Path = "/music/MUSICIANS" }],
            Files = [Song("/music/a.sid")]
        });
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ls", "/music", "-s", "usb", "--json");

        exitCode.Should().Be(0);
        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("path", "storage", "directories", "files");
        result.GetProperty("path").GetString().Should().Be("/music");
        result.GetProperty("storage").GetString().Should().Be("usb");
        var directory = result.GetProperty("directories")[0];
        Names(directory).Should().Equal("name", "path", "storage");
        directory.GetProperty("path").GetString().Should().Be("/music/MUSICIANS");
        directory.GetProperty("storage").GetString().Should().Be("usb");
        var file = result.GetProperty("files")[0];
        Names(file).Should().Equal(ItemShape);
        file.GetProperty("path").GetString().Should().Be("/music/a.sid");
        file.GetProperty("fileType").GetString().Should().Be("sid");
        file.GetProperty("storage").GetString().Should().Be("usb");
    }

    [Fact]
    public async Task Ls_ADash_ListsTheFirstPathFromStdin()
    {
        var host = NewHost(stdin: "/games\n/music\n");

        await host.RunAsync("file", "ls", "-");

        await _storage.Received(1).GetDirectory("/games");
    }

    [Fact]
    public async Task Ls_ABadPath_IsAUsageError_AndStartsNothing()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ls", "music");

        exitCode.Should().Be((int)CliExitCode.Usage);
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Ls_WithAStorage_UsesItForThisRunOnly()
    {
        var host = NewHost();

        await host.RunAsync("file", "ls", "-s", "usb");

        _storage.Received(1).UseStorage(TeensyStorageType.USB);
        _storage.DidNotReceive().SwitchStorage(Arg.Any<TeensyStorageType>());
    }

    [Fact]
    public async Task Ls_WithAStorage_LeavesTheSavedDefaultStorageAlone()
    {
        var api = Substitute.For<ITeensyRomApiClient>();
        api.GetDirectoryAsync(Arg.Any<string>(), ApiStorageType.USB, "/", Arg.Any<CancellationToken>())
            .Returns(new GetDirectoryResponse { StorageItem = new StorageCacheDto { Path = "/", Directories = [], Files = [] } });
        var host = NewHost(extra: services =>
        {
            services.Replace(ServiceDescriptor.Singleton<IStorageService, StorageService>());
            services.Replace(ServiceDescriptor.Singleton(api));
        });
        var settings = host.Services.BuildServiceProvider().GetRequiredService<ISettingsService>();
        var saved = settings.GetSettings().StorageType;

        var exitCode = await host.RunAsync("file", "ls", "-s", "usb");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await api.Received(1).GetDirectoryAsync(Arg.Any<string>(), ApiStorageType.USB, "/", Arg.Any<CancellationToken>());
        settings.GetSettings().StorageType.Should().Be(saved);
    }

    // ---- search ------------------------------------------------------------------------------------------------------

    private void Found(params ILaunchableItem[] items) =>
        _storage.Search(Arg.Any<string>(), Arg.Any<TeensyFilterType>()).Returns(items.ToList());

    [Fact]
    public async Task Search_Piped_WritesOnePathPerLine_FirstTakeOnly()
    {
        Found(Song("/music/a.sid"), Song("/music/b.sid"), Song("/music/c.sid"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "search", "commando", "--take", "2");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/a.sid\n/music/b.sid\n");
    }

    [Fact]
    public async Task Search_TakesFiftyByDefault()
    {
        Found(Enumerable.Range(0, 60).Select(i => (ILaunchableItem)Song($"/music/{i}.sid")).ToArray());
        var host = NewHost();

        await host.RunAsync("file", "search", "sid");

        host.Consoles.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries).Should().HaveCount(50);
    }

    [Fact]
    public async Task Search_Json_IsAnArrayOfItems_CarryingPathAndStorage()
    {
        Found(Song("/music/a.sid"));
        var host = NewHost();

        await host.RunAsync("file", "search", "commando", "--json");

        var results = Parse(host.Consoles.StdOut);
        results.GetArrayLength().Should().Be(1);
        Names(results[0]).Should().Equal(ItemShape);
        results[0].GetProperty("path").GetString().Should().Be("/music/a.sid");
        results[0].GetProperty("storage").GetString().Should().Be("sd");
    }

    private const string AlphaFix = "trom index build --device Alpha --storage sd";

    [Fact]
    public async Task Search_OnAnUnindexedStorage_NoticesOnStderr_NamingTheDeviceStorageAndTheIndexCommand_LeavingStdoutAlone()
    {
        Found(Song("/music/a.sid"));
        var host = NewHost(device: Unindexed);

        var exitCode = await host.RunAsync("file", "search", "commando");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/a.sid\n");
        var notice = host.Consoles.StdErr.Trim();
        notice.Split('\n').Should().ContainSingle();
        notice.Should().Contain("Alpha").And.Contain("SD").And.Contain($"`{AlphaFix}`");
    }

    [Fact]
    public async Task Search_OnAnUnindexedStorage_NoticesEvenWhenNothingMatches()
    {
        var host = NewHost(device: Unindexed);

        var exitCode = await host.RunAsync("file", "search", "zzz");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().BeEmpty();
        host.Consoles.StdErr.Should().Contain("No files matched.").And.Contain(AlphaFix);
    }

    [Fact]
    public async Task Search_OnAnIndexedStorage_HasNoNotice()
    {
        Found(Song("/music/a.sid"));
        var host = NewHost();

        await host.RunAsync("file", "search", "commando");

        host.Consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task Search_NoticesAboutTheStorageItSearched_NotTheOtherOne()
    {
        var onlyUsbIndexed = Alpha with { SdIndexed = false, UsbIndexed = true };
        var usb = NewHost(device: onlyUsbIndexed);
        await usb.RunAsync("file", "search", "zzz", "--storage", "usb");
        usb.Consoles.StdErr.Should().NotContain("index build");

        var sd = NewHost(device: onlyUsbIndexed);
        await sd.RunAsync("file", "search", "zzz", "--storage", "sd");
        sd.Consoles.StdErr.Should().Contain(AlphaFix);
    }

    [Fact]
    public async Task Search_Json_OnAnUnindexedStorage_KeepsStdoutABareArray_AndEndsStderrWithTheNoticeObject()
    {
        Found(Song("/music/a.sid"));
        var host = NewHost(device: Unindexed);

        await host.RunAsync("file", "search", "commando", "--json");

        Parse(host.Consoles.StdOut).GetArrayLength().Should().Be(1);
        var lastLine = host.Consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[^1];
        var notice = Parse(lastLine).GetProperty("notice");
        Names(notice).Should().Equal("code", "message", "device", "deviceId", "storage", "fix");
        notice.GetProperty("code").GetString().Should().Be("indexIncomplete");
        notice.GetProperty("device").GetString().Should().Be("Alpha");
        notice.GetProperty("deviceId").GetString().Should().Be("a-1");
        notice.GetProperty("storage").GetString().Should().Be("sd");
        notice.GetProperty("fix").GetString().Should().Be(AlphaFix);
    }

    [Fact]
    public async Task Search_Json_OnAnIndexedStorage_WritesNothingToStderr()
    {
        var host = NewHost();

        await host.RunAsync("file", "search", "zzz", "--json");

        host.Consoles.StdErr.Should().NotContain("{");
    }

    [Theory]
    [InlineData("Music", TeensyFilterType.Music)]
    [InlineData("HEX", TeensyFilterType.Hex)]
    public async Task Search_ReadsTheFilterWithoutRegardToCase(string value, TeensyFilterType expected)
    {
        var host = NewHost();

        await host.RunAsync("file", "search", "commando", "-f", value);

        await _storage.Received(1).Search("commando", expected);
    }

    [Fact]
    public async Task Search_ABadFilter_IsAUsageError_BeforeAnythingStarts()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "search", "commando", "--filter", "films");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--filter must be one of: all, games, music, images, hex");
        await _storage.DidNotReceiveWithAnyArgs().Search(default!, default);
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Search_ATakeBelowOne_IsAUsageError()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "search", "commando", "--take", "0");

        exitCode.Should().Be((int)CliExitCode.Usage);
    }

    // ---- launch ------------------------------------------------------------------------------------------------------

    private SongItem Launchable(string path = "/music/1.sid")
    {
        var song = Song(path);
        _storage.GetFile(path).Returns(song);
        _launches.LaunchFile(Arg.Any<TeensyStorageType>(), song).Returns(new LaunchOutcome(LaunchStatus.Launched, song, "Launched"));
        return song;
    }

    [Fact]
    public async Task Launch_LaunchesTheExactlyMatchedFile_PrintsItsPath_AndTouchesNoPlayerState()
    {
        var song = Launchable();
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid");

        exitCode.Should().Be(0);
        await _launches.Received(1).LaunchFile(TeensyStorageType.SD, song);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/1.sid\n");
        _player.ReceivedCalls().Should().BeEmpty();
        _resolver.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task Launch_Json_IsTheStatusTheFileAndTr_WebsMessage()
    {
        Launchable();
        var host = NewHost();

        await host.RunAsync("file", "launch", "/music/1.sid", "--json");

        var result = Parse(host.Consoles.StdOut);
        Names(result).Should().Equal("status", "file", "message");
        result.GetProperty("status").GetString().Should().Be("launched");
        result.GetProperty("message").GetString().Should().Be("Launched");
        Names(result.GetProperty("file")).Should().Equal(ItemShape);
    }

    [Fact]
    public async Task Launch_WithAStorage_LaunchesFromItWithoutSavingIt()
    {
        var song = Launchable();
        var host = NewHost();

        await host.RunAsync("file", "launch", "/music/1.sid", "-s", "usb");

        await _launches.Received(1).LaunchFile(TeensyStorageType.USB, song);
        _storage.DidNotReceive().SwitchStorage(Arg.Any<TeensyStorageType>());
    }

    [Fact]
    public async Task Launch_OfAnIncompatibleFile_FailsWithTr_WebsMessage_AndStillPrintsTheFile()
    {
        var song = Launchable();
        _launches.LaunchFile(Arg.Any<TeensyStorageType>(), song).Returns(new LaunchOutcome(LaunchStatus.Incompatible, song, "That SID needs more RAM."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("That SID needs more RAM.");
        Parse(host.Consoles.StdOut).GetProperty("status").GetString().Should().Be("incompatible");
    }

    [Fact]
    public async Task Launch_OfAPathNoFileHas_IsNotFound_AndLaunchesNothing()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/missing.sid");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("/music/missing.sid");
        await _launches.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
    }

    [Fact]
    public async Task Launch_WhenTr_WebCantFindTheFile_IsNotFound()
    {
        var song = Launchable();
        _launches.LaunchFile(Arg.Any<TeensyStorageType>(), song).Returns(new LaunchOutcome(LaunchStatus.NotFound, null, "The storage USB is not available."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("The storage USB is not available.");
    }

    [Fact]
    public async Task Launch_WhenTr_WebRefuses_Fails()
    {
        var song = Launchable();
        _launches.LaunchFile(Arg.Any<TeensyStorageType>(), song).Returns(new LaunchOutcome(LaunchStatus.Failed, null, "The device is busy."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("The device is busy.");
    }

    [Fact]
    public async Task SearchPipedIntoLaunch_FindsTheFileOnTheDefaultStorage_WithNoOtherFlags()
    {
        Found(Song("/music/MUSICIANS/H/Hubbard_Rob/Commando.sid"));
        var search = NewHost();
        await search.RunAsync("file", "search", "commando", "--json");
        var path = Parse(search.Consoles.StdOut)[0].GetProperty("path").GetString();
        var song = Launchable(path!);
        var launch = NewHost(stdin: path + "\n");

        var exitCode = await launch.RunAsync("file", "launch", "-");

        exitCode.Should().Be(0, launch.Consoles.StdErr);
        await _launches.Received(1).LaunchFile(TeensyStorageType.SD, song);
    }

    // ---- launch --player --------------------------------------------------------------------------------------------

    [Fact]
    public async Task Player_WithoutATerminal_IsAUsageError_BeforeAnythingStartsOrLaunches()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid", "--player");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--player needs an interactive terminal.");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await _launches.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
        await _player.DidNotReceiveWithAnyArgs().LaunchItem(default!);
    }

    [Fact]
    public async Task Player_WithJson_IsAUsageError_BeforeAnythingLaunches()
    {
        Launchable();
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid", "--player", "--json");

        exitCode.Should().Be((int)CliExitCode.Usage);
        await _player.DidNotReceiveWithAnyArgs().LaunchItem(default!);
        _calls.Should().BeEmpty();
    }

    [Fact]
    public async Task LaunchPlayer_ResolvesThePlayerFirst_ThenPlaysTheExactItem_AndOpensThePlayerOnStdout()
    {
        var song = Launchable("/music/1.sid");
        var host = NewHost(terminal: true);
        Leave(host);

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid", "-s", "usb", "--player");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        _calls.Should().Equal("resolve player", "launch");
        await _player.Received(1).LaunchItem(song);
        _player.Received(1).UseStorage(TeensyStorageType.USB);
        _player.Received(1).SetDirectoryMode("/music/1.sid");
        _player.DidNotReceive().SetStorage(Arg.Any<TeensyStorageType>());
        _storage.DidNotReceive().SwitchStorage(Arg.Any<TeensyStorageType>());
        await _launches.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
        host.Consoles.StdOut.Should().Contain("/music/1.sid", "the player was subscribed before the launch, so Now Playing was drawn on stdout");
        PlayerOpened(host).Should().BeTrue();
    }

    [Fact]
    public async Task LaunchPlayer_WhenThePlayerCouldntPlayIt_Fails_AndDoesNotOpenThePlayer()
    {
        Launchable();
        _player.LaunchItem(Arg.Any<ILaunchableItem>()).Returns(false);
        _playerState.PlayState = PlayState.Playing;
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "launch", "/music/1.sid", "--player");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("Couldn't play /music/1.sid.");
        PlayerOpened(host).Should().BeFalse("the player's state says Playing, but the launch itself failed");
    }

    // ---- random ------------------------------------------------------------------------------------------------------

    private SongItem Picked(string path = "/music/pick.sid")
    {
        var song = Song(path);
        _launches.LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), Arg.Any<string>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchOutcome(LaunchStatus.Launched, song, "Launched"));
        return song;
    }

    [Fact]
    public async Task Random_Defaults_PickFromTheWholeStorageDeep_OfEveryFile()
    {
        Picked();
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "random");

        exitCode.Should().Be(0);
        await _launches.Received(1).LaunchRandom(TeensyStorageType.SD, StorageScope.DirDeep, "/", TeensyFilterType.All);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/pick.sid\n");
        _player.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task Random_ReadsItsOptionsWithoutRegardToCase()
    {
        Picked();
        var host = NewHost();

        await host.RunAsync("file", "random", "--filter", "HEX", "--scope", "Dir-Shallow", "--directory", "/demos", "-s", "USB");

        await _launches.Received(1).LaunchRandom(TeensyStorageType.USB, StorageScope.DirShallow, "/demos", TeensyFilterType.Hex);
    }

    [Fact]
    public async Task Random_DirectoryDash_UsesTheFirstPathFromStdin()
    {
        Picked();
        var host = NewHost(stdin: "/from/stdin\n/second\n");

        await host.RunAsync("file", "random", "--directory", "-");

        await _launches.Received(1).LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), "/from/stdin", Arg.Any<TeensyFilterType>());
    }

    [Fact]
    public async Task Random_Json_IsTheStatusAndThePick()
    {
        Picked();
        var host = NewHost();

        await host.RunAsync("file", "random", "--json");

        var result = Parse(host.Consoles.StdOut);
        result.GetProperty("status").GetString().Should().Be("launched");
        result.GetProperty("file").GetProperty("path").GetString().Should().Be("/music/pick.sid");
    }

    [Fact]
    public async Task Random_OnAnUnindexedStorage_NoticesOnStderr_AndKeepsStdoutAndTheExitCode()
    {
        Picked();
        var host = NewHost(device: Unindexed);

        var exitCode = await host.RunAsync("file", "random");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/pick.sid\n");
        host.Consoles.StdErr.Trim().Should().Contain(AlphaFix);
    }

    [Fact]
    public async Task Random_Json_OnAnUnindexedStorage_EndsStderrWithTheNoticeObject()
    {
        Picked();
        var host = NewHost(device: Unindexed);

        await host.RunAsync("file", "random", "--json");

        Parse(host.Consoles.StdOut).GetProperty("status").GetString().Should().Be("launched");
        var lastLine = host.Consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[^1];
        Parse(lastLine).GetProperty("notice").GetProperty("fix").GetString().Should().Be(AlphaFix);
    }

    [Fact]
    public async Task Random_OnAnIndexedStorage_HasNoNotice()
    {
        Picked();
        var host = NewHost();

        await host.RunAsync("file", "random", "--json");

        host.Consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task Random_WithNoFilesToPick_OnAnUnindexedStorage_NoticesBeforeTheErrorObject()
    {
        _launches.LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), Arg.Any<string>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchOutcome(LaunchStatus.NotFound, null, LaunchOutcome.NoFilesFoundMessage));
        var host = NewHost(device: Unindexed);

        var exitCode = await host.RunAsync("file", "random", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        var lines = host.Consoles.StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(l => l.StartsWith('{')).ToList();
        lines.Should().HaveCount(2);
        Parse(lines[0]).TryGetProperty("notice", out _).Should().BeTrue();
        Parse(lines[1]).TryGetProperty("error", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Random_WithNoFilesToPick_IsNotFound()
    {
        _launches.LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), Arg.Any<string>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchOutcome(LaunchStatus.NotFound, null, LaunchOutcome.NoFilesFoundMessage));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "random", "--filter", "images");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("No files were found.");
        host.Consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task Random_OfAnIncompatibleFile_PrintsThePick_AndFailsWithTr_WebsMessage()
    {
        var song = Song("/games/odd.prg", compatible: false);
        _launches.LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), Arg.Any<string>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchOutcome(LaunchStatus.Incompatible, song, "That PRG needs a REU."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "random");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdOut.Should().Contain("/games/odd.prg");
        host.Consoles.StdErr.Should().Contain("That PRG needs a REU.");
    }

    [Fact]
    public async Task Random_WhenTr_WebFailsTheLaunch_Fails()
    {
        _launches.LaunchRandom(Arg.Any<TeensyStorageType>(), Arg.Any<StorageScope>(), Arg.Any<string>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchOutcome(LaunchStatus.Failed, null, "The device is busy."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "random");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("The device is busy.");
    }

    [Theory]
    [InlineData("--timer", "5m", "--timer")]
    [InlineData("--override", null, "--override")]
    public async Task Random_WithoutAPlayer_RefusesThePlayersOptions_NamingTheFlag(string flag, string? value, string named)
    {
        var host = NewHost();
        string[] args = value is null ? ["file", "random", flag] : ["file", "random", flag, value];

        var exitCode = await host.RunAsync(args);

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain($"{named} only works with --player");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Random_APlayerWithANonDefaultScope_IsAUsageError()
    {
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "random", "--player", "--scope", "storage");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--scope");
        _calls.Should().BeEmpty();
    }

    // ---- random --player --------------------------------------------------------------------------------------------

    private void PlayerPicks(ILaunchableItem? item, PlayState state)
    {
        _player.PlayRandom().Returns(_ =>
        {
            _calls.Add("random");
            _playerState.CurrentItem = item;
            _playerState.PlayState = state;
            if (item is not null) _fileLaunched.OnNext(item);
            return Task.CompletedTask;
        });
    }

    [Fact]
    public async Task RandomPlayer_ConfiguresThePlayerFromTheOptions_ResolvesItFirst_AndOpensIt()
    {
        PlayerPicks(Song("/music/pick.sid"), PlayState.Playing);
        var host = NewHost(terminal: true);
        Leave(host);

        var exitCode = await host.RunAsync("file", "random", "--player", "-s", "usb", "--filter", "Music", "--directory", "/music", "--timer", "5m", "--override");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        _calls.Should().Equal("resolve player", "random");
        _player.Received(1).UseStorage(TeensyStorageType.USB);
        _player.Received(1).SetDirectoryScope("/music");
        _player.Received(1).SetFilter(TeensyFilterType.Music);
        _player.Received(1).SetStreamTime(TimeSpan.FromMinutes(5));
        _player.Received(1).SetSidTimer(SidTimer.TimerOverride);
        _player.DidNotReceive().SetStorage(Arg.Any<TeensyStorageType>());
        _storage.DidNotReceive().SwitchStorage(Arg.Any<TeensyStorageType>());
        await _launches.DidNotReceiveWithAnyArgs().LaunchRandom(default, default, default!, default);
        host.Consoles.StdOut.Should().Contain("/music/pick.sid");
        PlayerOpened(host).Should().BeTrue();
    }

    [Fact]
    public async Task RandomPlayer_WithoutTimerOrOverride_PlaysSidsForTheirLength_WithNoTimer()
    {
        PlayerPicks(Song("/music/pick.sid"), PlayState.Playing);
        var host = NewHost(terminal: true);
        Leave(host);

        await host.RunAsync("file", "random", "--player");

        _player.Received(1).SetStreamTime(null);
        _player.Received(1).SetSidTimer(SidTimer.SongLength);
        _player.Received(1).SetDirectoryScope("/");
        _player.Received(1).SetFilter(TeensyFilterType.All);
    }

    [Fact]
    public async Task RandomPlayer_WhenNothingWasPicked_IsNotFound_AndDoesNotOpenThePlayer()
    {
        PlayerPicks(null, PlayState.Playing);
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "random", "--player");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        PlayerOpened(host).Should().BeFalse();
    }

    [Fact]
    public async Task RandomPlayer_WhenAFileWasPickedButIsNotPlaying_Fails_AndDoesNotOpenThePlayer()
    {
        PlayerPicks(Song("/music/pick.sid"), PlayState.Stopped);
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "random", "--player");

        exitCode.Should().Be((int)CliExitCode.Failed);
        PlayerOpened(host).Should().BeFalse();
    }
}
