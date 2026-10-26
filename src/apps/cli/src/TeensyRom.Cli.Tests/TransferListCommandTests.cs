using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary><c>trom transfer list</c> through the real tree over a substituted transfer service.</summary>
[Collection(ConsoleCollection.Name)]
public sealed class TransferListCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected");

    private readonly ITransferService _transfers = Substitute.For<ITransferService>();
    private readonly List<TestHost> _hosts = [];

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(bool terminal = false)
    {
        var host = new TestHost(terminal, services => services.Replace(ServiceDescriptor.Singleton(_transfers)));
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        _hosts.Add(host);
        return host;
    }

    private void Jobs(params TransferJobDto[] jobs) => _transfers.ListAsync(Arg.Any<CancellationToken>()).Returns(jobs);

    private static TransferJobDto Upload() => new()
    {
        JobId = "job-1",
        DeviceId = Alpha.Id,
        StorageType = Api.Generated.TeensyStorageType.USB,
        DestinationDirectory = "/games",
        State = TransferJobState.Receiving,
        FilesReceived = 5,
        FilesSent = 3,
        TotalFiles = null,
        Origin = new TransferOriginDto { Kind = TransferOriginKind.Upload },
        LaunchState = TransferLaunchState.Pending
    };

    private static TransferJobDto Watched() => new()
    {
        JobId = "job-2",
        DeviceId = "unknown-device",
        StorageType = Api.Generated.TeensyStorageType.SD,
        DestinationDirectory = "/auto-transfer",
        State = TransferJobState.Completed,
        FilesReceived = 2,
        FilesSent = 2,
        TotalFiles = 2,
        Origin = new TransferOriginDto { Kind = TransferOriginKind.WatchFolder, WatchFolderId = "wf-1", WatchFolderPath = "/home/me/roms" },
        LaunchState = TransferLaunchState.Launched,
        LaunchedPath = "/auto-transfer/a.prg"
    };

    [Fact]
    public async Task Json_IsTheTransfersWithTheirOriginDeviceNameAndLaunch()
    {
        Jobs(Upload(), Watched());
        var host = NewHost();

        var exitCode = await host.RunAsync("transfer", "list", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var jobs = JsonDocument.Parse(host.Consoles.StdOut).RootElement.EnumerateArray().ToArray();
        var upload = jobs[0];
        upload.GetProperty("jobId").GetString().Should().Be("job-1");
        upload.GetProperty("deviceName").GetString().Should().Be("Alpha");
        upload.GetProperty("storage").GetString().Should().Be("usb");
        upload.GetProperty("destination").GetString().Should().Be("/games");
        upload.GetProperty("state").GetString().Should().Be("receiving");
        upload.GetProperty("from").GetProperty("kind").GetString().Should().Be("upload");
        upload.GetProperty("filesReceived").GetInt32().Should().Be(5);
        upload.TryGetProperty("totalFiles", out _).Should().BeFalse();
        upload.GetProperty("launch").GetProperty("state").GetString().Should().Be("pending");

        var watched = jobs[1];
        watched.TryGetProperty("deviceName", out _).Should().BeFalse();
        watched.GetProperty("from").GetProperty("kind").GetString().Should().Be("watchFolder");
        watched.GetProperty("from").GetProperty("watchFolderPath").GetString().Should().Be("/home/me/roms");
        watched.GetProperty("launch").GetProperty("state").GetString().Should().Be("launched");
        watched.GetProperty("launch").GetProperty("path").GetString().Should().Be("/auto-transfer/a.prg");
    }

    [Fact]
    public async Task WithNone_IsAnEmptyArray_WithoutAskingForDevices()
    {
        Jobs();
        var host = NewHost();

        var exitCode = await host.RunAsync("transfer", "list", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        JsonDocument.Parse(host.Consoles.StdOut).RootElement.GetArrayLength().Should().Be(0);
        await host.Devices.DidNotReceiveWithAnyArgs().GetDevicesAsync(default);
    }

    [Fact]
    public async Task Human_ShowsATableWithFilesAsSentOfTotal_FallingBackToFilesReceived()
    {
        Jobs(Upload(), Watched());
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("transfer", "list");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdOut.Should().Contain("Device").And.Contain("Destination").And.Contain("From").And.Contain("Files").And.Contain("State")
            .And.Contain("Alpha").And.Contain("3 of 5").And.Contain("2 of 2").And.Contain("/home/me/roms").And.Contain("upload");
    }
}
