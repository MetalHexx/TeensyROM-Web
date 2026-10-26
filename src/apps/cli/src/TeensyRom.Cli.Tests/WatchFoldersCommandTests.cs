using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The Watch Folders screen over substituted services, driven by keys and answers queued on an interactive console.
/// Back is the sixth choice, so every script ends by picking it.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class WatchFoldersCommandTests : IDisposable
{
    private const int AddFolder = 0;
    private const int AddDestination = 1;
    private const int RemoveDestination = 2;
    private const int ToggleFolder = 3;
    private const int RemoveFolder = 4;
    private const int Back = 5;

    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true);

    private readonly string _folder = Directory.CreateTempSubdirectory("trom-watch-folders-").FullName;
    private readonly IWatchFolderService _watchFolders = Substitute.For<IWatchFolderService>();
    private readonly ITransferService _transfers = Substitute.For<ITransferService>();
    private readonly TestHost _host;
    private readonly Keys _keys;

    public WatchFoldersCommandTests()
    {
        _host = new TestHost(terminal: true, configure: services =>
        {
            services.AddSingleton(_watchFolders);
            services.AddSingleton(_transfers);
        });
        _keys = new Keys(_host.Consoles.Out.Input);
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        _watchFolders.ListAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<WatchFolderDto>());
        _transfers.ListAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<TransferJobDto>());
        AnsiConsole.Console = _host.Consoles.Out;
    }

    public void Dispose()
    {
        _host.Dispose();
        Directory.Delete(_folder, recursive: true);
    }

    private string Screen => _host.Consoles.StdOut;

    /// <summary>Queues what the user would press and type, in order.</summary>
    private sealed class Keys(TestConsoleInput input)
    {
        public Keys Pick(int index)
        {
            for (var i = 0; i < index; i++) input.PushKey(ConsoleKey.DownArrow);
            input.PushKey(ConsoleKey.Enter);
            return this;
        }

        public Keys Enter() => Pick(0);

        public Keys Text(string text)
        {
            input.PushTextWithEnter(text);
            return this;
        }
    }

    private Task<int> Run() => CliHost.CreateTuiApp(_host.Composition.Registrar).RunAsync(["watch-folders"]);

    private WatchFolderDto Watched(bool enabled = true, params string[] deviceIds) => new()
    {
        Id = "wf-1",
        Path = _folder,
        Enabled = enabled,
        State = enabled ? WatchFolderState.Watching : WatchFolderState.Off,
        Destinations = (deviceIds.Length == 0 ? ["a-1"] : deviceIds)
            .Select(id => new WatchFolderDestinationDto { Id = $"d-{id}", DeviceId = id, DeviceName = id == "a-1" ? "Alpha" : id, StorageType = Api.Generated.TeensyStorageType.SD, Path = "/auto-transfer", Launch = true })
            .ToList()
    };

    private void HasFolders(params WatchFolderDto[] folders) =>
        _watchFolders.ListAsync(Arg.Any<CancellationToken>()).Returns(folders);

    [Fact]
    public async Task Back_LeavesTheScreen_WithoutTouchingAnyWatchFolder()
    {
        _keys.Pick(Back);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("Watch Folders").And.Contain("No watch folders yet.").And.Contain("Nothing is being sent.");
        await _watchFolders.DidNotReceiveWithAnyArgs().AddAsync(default!, default!, default, default, default, default);
        await _watchFolders.DidNotReceiveWithAnyArgs().RemoveAsync(default!, default);
    }

    [Fact]
    public async Task TheScreen_ListsFolders_AndOnlyTheTransfersThatAreNotFinished()
    {
        HasFolders(Watched());
        _transfers.ListAsync(Arg.Any<CancellationToken>()).Returns(new[]
        {
            new TransferJobDto { JobId = "j-1", DeviceId = "a-1", State = TransferJobState.Sealed, FilesSent = 3, TotalFiles = 5, Origin = new TransferOriginDto { WatchFolderPath = _folder } },
            new TransferJobDto { JobId = "j-2", DeviceId = "a-1", State = TransferJobState.Completed, FilesSent = 9, TotalFiles = 9, Origin = new TransferOriginDto() },
            new TransferJobDto { JobId = "j-3", DeviceId = "a-1", State = TransferJobState.Created, FilesReceived = 1, Origin = new TransferOriginDto() }
        });
        _keys.Pick(Back);

        await Run();

        Screen.Should().Contain("Watching").And.Contain("Alpha (SD) /auto-transfer")
            .And.Contain("3 of 5").And.Contain("Sending")
            .And.Contain("0 of 1").And.Contain("Receiving").And.Contain("upload")
            .And.NotContain("9 of 9").And.NotContain("Nothing is being sent.");
    }

    [Fact]
    public async Task AddWatchFolder_AsksForTheFolder_TakesTheOnlyDeviceAndStorage_AndUsesTheDefaultDeviceFolder()
    {
        _keys.Pick(AddFolder).Text(_folder).Enter().Enter().Pick(Back);

        await Run();

        await _watchFolders.Received(1).AddAsync(_folder, "a-1", TeensyStorageType.SD, "/auto-transfer", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddWatchFolder_AsksWhichStorage_WhenTheDeviceHasBoth_AndLaunchWhenAnswered()
    {
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha with { UsbAvailable = true } });
        _keys.Pick(AddFolder).Text(_folder).Pick(1).Text("/roms").Pick(1).Pick(Back);

        await Run();

        await _watchFolders.Received(1).AddAsync(_folder, "a-1", TeensyStorageType.USB, "/roms", true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddWatchFolder_ForAFolderThatDoesNotExist_ReportsItAndAddsNothing()
    {
        _keys.Pick(AddFolder).Text(Path.Combine(_folder, "nope")).Pick(Back);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("isn't a folder on this computer");
        await _watchFolders.DidNotReceiveWithAnyArgs().AddAsync(default!, default!, default, default, default, default);
    }

    [Fact]
    public async Task AddDestination_OffersOnlyOnlineDevicesTheFolderLacks()
    {
        var beta = new DeviceSummary("b-1", "Beta", true, "USB COM4", "Connected", SdAvailable: true);
        var gamma = new DeviceSummary("g-1", "Gamma", false, "USB COM5", "Offline", SdAvailable: true);
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha, beta, gamma });
        HasFolders(Watched());
        _keys.Pick(AddDestination).Enter().Enter().Enter().Pick(Back);

        await Run();

        await _watchFolders.Received(1).AddAsync(_folder, "b-1", TeensyStorageType.SD, "/auto-transfer", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddDestination_WhenEveryOnlineDeviceAlreadyReceivesTheFolder_SaysSo()
    {
        HasFolders(Watched());
        _keys.Pick(AddDestination).Enter().Pick(Back);

        await Run();

        Screen.Should().Contain("Every online TeensyROM already receives this folder.");
        await _watchFolders.DidNotReceiveWithAnyArgs().AddAsync(default!, default!, default, default, default, default);
    }

    [Fact]
    public async Task RemoveDestination_RemovesThePickedDevicesDestinations()
    {
        HasFolders(Watched(true, "a-1", "b-1"));
        _keys.Pick(RemoveDestination).Enter().Enter().Pick(Back);

        await Run();

        await _watchFolders.Received(1).RemoveDeviceAsync("wf-1", "a-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TurnFolderOnOff_FlipsWhetherTheFolderIsEnabled()
    {
        HasFolders(Watched(enabled: true));
        _keys.Pick(ToggleFolder).Enter().Pick(Back);

        await Run();

        await _watchFolders.Received(1).SetEnabledAsync("wf-1", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveWatchFolder_RemovesTheFolder_WhenConfirmed()
    {
        HasFolders(Watched());
        _keys.Pick(RemoveFolder).Enter().Pick(1).Pick(Back);

        await Run();

        await _watchFolders.Received(1).RemoveAsync("wf-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveWatchFolder_KeepsTheFolder_WhenNotConfirmed()
    {
        HasFolders(Watched());
        _keys.Pick(RemoveFolder).Enter().Enter().Pick(Back);

        await Run();

        await _watchFolders.DidNotReceiveWithAnyArgs().RemoveAsync(default!, default);
    }

    [Fact]
    public async Task TheFolderPickingActions_SayWhenThereAreNoWatchFolders()
    {
        _keys.Pick(ToggleFolder).Pick(Back);

        await Run();

        Screen.Should().Contain("No watch folders yet.");
        await _watchFolders.DidNotReceiveWithAnyArgs().SetEnabledAsync(default!, default, default);
    }

    [Fact]
    public async Task AnEngineError_IsShown_AndTheScreenReturns()
    {
        HasFolders(Watched());
        _watchFolders.SetEnabledAsync("wf-1", false, Arg.Any<CancellationToken>()).ThrowsAsync(new TeensyApiException("tr-web stopped answering."));
        _keys.Pick(ToggleFolder).Enter().Pick(Back);

        var exitCode = await Run();

        exitCode.Should().Be(0);
        Screen.Should().Contain("tr-web stopped answering.");
    }
}
