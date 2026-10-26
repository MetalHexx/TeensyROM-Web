using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom watch-folder</c> through the real tree over a substituted watch-folder service and device chooser.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class WatchFolderCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly string _root = Directory.CreateTempSubdirectory("trom-watch-").FullName;
    private readonly string _originalFolder = Directory.GetCurrentDirectory();
    private readonly IWatchFolderService _watchFolders = Substitute.For<IWatchFolderService>();
    private readonly IDeviceChooser _chooser = Substitute.For<IDeviceChooser>();
    private readonly List<TestHost> _hosts = [];

    public WatchFolderCommandTests()
    {
        Directory.SetCurrentDirectory(_root);
        Directory.CreateDirectory(Path.Combine(_root, "roms"));
        _chooser.ChooseAsync(Arg.Any<string?>(), Arg.Any<DeviceScope>(), Arg.Any<CancellationToken>()).Returns(Alpha);
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();

        Directory.SetCurrentDirectory(_originalFolder);
        Directory.Delete(_root, recursive: true);
    }

    private TestHost NewHost(bool terminal = false)
    {
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton(_chooser);
            services.AddSingleton(_watchFolders);
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.RequireDeviceId().Returns(Alpha.Id);
        _hosts.Add(host);
        return host;
    }

    private string RomsPath => Path.Combine(_root, "roms");

    private WatchFolderDto Folder(string? path = null, bool enabled = true, WatchFolderState state = WatchFolderState.Watching) => new()
    {
        Id = "wf-1",
        Path = path ?? RomsPath,
        Enabled = enabled,
        State = state,
        Destinations =
        [
            new WatchFolderDestinationDto { Id = "d-1", DeviceId = Alpha.Id, DeviceName = "Alpha", StorageType = Api.Generated.TeensyStorageType.SD, Path = "/auto-transfer", Launch = true }
        ]
    };

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private void Watched(WatchFolderDto folder) =>
        _watchFolders.FindAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(folder);

    // ---- add ---------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Add_SendsTheFullLocalPath_TheDevice_TheStorageAndTheDefaultDeviceFolder()
    {
        _watchFolders.AddAsync(default!, default!, default, default, default, default)
            .ReturnsForAnyArgs(new AddWatchFolderResponse { Created = true, WatchFolder = Folder() });
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "add", "roms", "--device", "Alpha", "--storage", "usb", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _watchFolders.Received(1).AddAsync(RomsPath, Alpha.Id, TeensyStorageType.USB, "/auto-transfer", false, Arg.Any<CancellationToken>());
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("created").GetBoolean().Should().BeTrue();
        var folder = document.GetProperty("folder");
        folder.GetProperty("id").GetString().Should().Be("wf-1");
        folder.GetProperty("path").GetString().Should().Be(RomsPath);
        folder.GetProperty("enabled").GetBoolean().Should().BeTrue();
        folder.GetProperty("state").GetString().Should().Be("watching");
        var destination = folder.GetProperty("destinations")[0];
        destination.GetProperty("deviceId").GetString().Should().Be(Alpha.Id);
        destination.GetProperty("deviceName").GetString().Should().Be("Alpha");
        destination.GetProperty("storage").GetString().Should().Be("sd");
        destination.GetProperty("path").GetString().Should().Be("/auto-transfer");
        destination.GetProperty("launch").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Add_WithPathAndLaunch_SendsThem()
    {
        _watchFolders.AddAsync(default!, default!, default, default, default, default)
            .ReturnsForAnyArgs(new AddWatchFolderResponse { Created = false, WatchFolder = Folder() });
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "add", RomsPath, "--path", "/games", "--launch", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _watchFolders.Received(1).AddAsync(RomsPath, Alpha.Id, Arg.Any<TeensyStorageType>(), "/games", true, Arg.Any<CancellationToken>());
        Parse(host.Consoles.StdOut).GetProperty("created").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Add_OfAFolderThatIsNotThere_IsAUsageError_BeforeTheEngineOrTheService()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "add", "nowhere");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("nowhere isn't a folder on this computer.");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await _watchFolders.DidNotReceiveWithAnyArgs().AddAsync(default!, default!, default, default, default, default);
    }

    [Fact]
    public async Task Add_RefusedWith409_IsExitOne_WithTheEnginesSentence()
    {
        _watchFolders.AddAsync(default!, default!, default, default, default, default)
            .ThrowsAsyncForAnyArgs(new TeensyApiException("The folder is inside another watch folder.", 409));
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "add", "roms");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("The folder is inside another watch folder.");
    }

    [Fact]
    public async Task Add_Human_ShowsTheFolderAndItsDestination()
    {
        _watchFolders.AddAsync(default!, default!, default, default, default, default)
            .ReturnsForAnyArgs(new AddWatchFolderResponse { Created = true, WatchFolder = Folder() });
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("watch-folder", "add", "roms");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdOut.Should().Contain("watching").And.Contain("Alpha").And.Contain("/auto-transfer");
    }

    // ---- list --------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task List_Json_IsTheFoldersInCamelCase_AndChoosesNoDevice()
    {
        _watchFolders.ListAsync(Arg.Any<CancellationToken>()).Returns([Folder(), Folder("/other", enabled: false, state: WatchFolderState.Off)]);
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "list", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var folders = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        folders.Select(f => f.GetProperty("state").GetString()).Should().Equal("watching", "off");
        _chooser.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task List_WithNone_IsAnEmptyArray_AndHumanSaysSo()
    {
        _watchFolders.ListAsync(Arg.Any<CancellationToken>()).Returns([]);

        var json = NewHost();
        (await json.RunAsync("watch-folder", "list", "--json")).Should().Be(0);
        Parse(json.Consoles.StdOut).GetArrayLength().Should().Be(0);

        var human = NewHost(terminal: true);
        (await human.RunAsync("watch-folder", "list")).Should().Be(0);
        (human.Consoles.StdOut + human.Consoles.StdErr).Should().Contain("No watch folders.");
    }

    [Fact]
    public async Task List_Human_ShowsATableOfFolderStateAndDestinations_AndPlainShowsPaths()
    {
        _watchFolders.ListAsync(Arg.Any<CancellationToken>()).Returns([Folder()]);

        var human = NewHost(terminal: true);
        (await human.RunAsync("watch-folder", "list")).Should().Be(0);
        human.Consoles.StdOut.Should().Contain("Folder").And.Contain("State").And.Contain("Destinations").And.Contain(RomsPath).And.Contain("Alpha");

        var plain = NewHost();
        (await plain.RunAsync("watch-folder", "list")).Should().Be(0);
        plain.Consoles.StdOut.Trim().Should().Be(RomsPath);
    }

    // ---- pause and resume --------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("pause", false)]
    [InlineData("resume", true)]
    public async Task PauseAndResume_SetTheFoldersEnabledFlag_ByItsFullPath(string verb, bool enabled)
    {
        Watched(Folder());
        _watchFolders.SetEnabledAsync("wf-1", enabled, Arg.Any<CancellationToken>()).Returns(Folder(enabled: enabled, state: enabled ? WatchFolderState.Watching : WatchFolderState.Off));
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", verb, "roms", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _watchFolders.Received(1).FindAsync(RomsPath, Arg.Any<CancellationToken>());
        var folder = Parse(host.Consoles.StdOut);
        folder.GetProperty("enabled").GetBoolean().Should().Be(enabled);
        folder.GetProperty("state").GetString().Should().Be(enabled ? "watching" : "off");
    }

    [Theory]
    [InlineData("pause")]
    [InlineData("resume")]
    [InlineData("remove")]
    public async Task AnUnwatchedFolder_IsExitFive(string verb)
    {
        _watchFolders.FindAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.NotFound, "x isn't a watch folder."));
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", verb, "x");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("x isn't a watch folder.");
    }

    // ---- remove ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Remove_WithoutADevice_RemovesTheFolder()
    {
        Watched(Folder());
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "remove", "roms", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _watchFolders.Received(1).RemoveAsync("wf-1", Arg.Any<CancellationToken>());
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("path").GetString().Should().Be(RomsPath);
        document.GetProperty("folderRemoved").GetBoolean().Should().BeTrue();
        document.TryGetProperty("deviceId", out _).Should().BeFalse();
        _chooser.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task Remove_WithADevice_RemovesOnlyThatDevicesDestinations()
    {
        Watched(Folder());
        _watchFolders.RemoveDeviceAsync("wf-1", Alpha.Id, Arg.Any<CancellationToken>())
            .Returns(new RemoveWatchFolderDeviceResponse { FolderRemoved = false });
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "remove", "roms", "--device", "Alpha", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _chooser.Received(1).ChooseAsync("Alpha", DeviceScope.Known, Arg.Any<CancellationToken>());
        await _watchFolders.DidNotReceiveWithAnyArgs().RemoveAsync(default!, default);
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("deviceId").GetString().Should().Be(Alpha.Id);
        document.GetProperty("folderRemoved").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Remove_WithADeviceTrWebForgot_FallsBackToTheDestinationsDeviceId()
    {
        _chooser.ChooseAsync("gone-1", DeviceScope.Known, Arg.Any<CancellationToken>()).ThrowsAsync(new CliException(CliExitCode.NotFound, "No TeensyROM matches 'gone-1'."));
        _watchFolders.RemoveDeviceAsync("wf-1", "gone-1", Arg.Any<CancellationToken>()).Returns(new RemoveWatchFolderDeviceResponse { FolderRemoved = true });
        var folder = Folder();
        folder.Destinations.Single().DeviceId = "gone-1";
        Watched(folder);
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "remove", "roms", "--device", "gone-1", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("deviceId").GetString().Should().Be("gone-1");
        document.GetProperty("folderRemoved").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Remove_WithAnUnknownDeviceNoDestinationHas_IsExitFive()
    {
        Watched(Folder());
        _chooser.ChooseAsync("nope", DeviceScope.Known, Arg.Any<CancellationToken>()).ThrowsAsync(new CliException(CliExitCode.NotFound, "No TeensyROM matches 'nope'."));
        var host = NewHost();

        var exitCode = await host.RunAsync("watch-folder", "remove", "roms", "--device", "nope");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        await _watchFolders.DidNotReceiveWithAnyArgs().RemoveDeviceAsync(default!, default!, default);
    }
}
