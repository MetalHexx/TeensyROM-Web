using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom device reconnect | rename | forget | ping | reset</c> through the real tree, with the real device chooser over
/// a substituted device service: which devices each verb can reach, and what it prints.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class DeviceVerbTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true);
    private static readonly DeviceSummary Charlie = new("c-3", "Charlie", false, "USB COM9", "ConnectionLost");

    private readonly TestHost _host = new(configure: services => services.AddSingleton<IDeviceChooser, DeviceChooser>());

    public DeviceVerbTests()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha, Charlie });
    }

    public void Dispose() => _host.Dispose();

    private string StdOut => _host.Consoles.StdOut;

    private string StdErr => _host.Consoles.StdErr;

    // ---- scope ----------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Forget_ReachesAnOfflineDevice()
    {
        _host.Devices.ForgetDeviceAsync("c-3", Arg.Any<CancellationToken>()).Returns("Charlie forgotten.");

        var exitCode = await _host.RunAsync("device", "forget", "--device", "Charlie");

        exitCode.Should().Be(0);
        StdOut.Replace("\r\n", "\n").Should().Be("Charlie forgotten.\n");
    }

    [Fact]
    public async Task Reconnect_ReachesAnOfflineDevice_AndShowsItAfterwards()
    {
        _host.Devices.ReconnectDeviceAsync("c-3", Arg.Any<CancellationToken>()).Returns(Charlie with { IsOnline = true, State = "Connected" });

        var exitCode = await _host.RunAsync("device", "reconnect", "--device", "Charlie");

        exitCode.Should().Be(0);
        StdOut.Should().Contain("Name: Charlie").And.Contain("Online: yes").And.Contain("State: Connected");
    }

    [Fact]
    public async Task Rename_ReachesAnOfflineDevice_AndShowsTheNewName()
    {
        _host.Devices.RenameDeviceAsync("c-3", "Bench", Arg.Any<CancellationToken>()).Returns(Charlie with { Name = "Bench" });

        var exitCode = await _host.RunAsync("device", "rename", "Bench", "--device", "Charlie");

        exitCode.Should().Be(0);
        StdOut.Should().Contain("Name: Bench").And.Contain("Id: c-3");
    }

    [Theory]
    [InlineData("ping")]
    [InlineData("reset")]
    public async Task PingAndReset_NeedAnOnlineDevice(string verb)
    {
        var exitCode = await _host.RunAsync("device", verb, "--device", "Charlie");

        exitCode.Should().Be((int)CliExitCode.NoDevice);
        await _host.Devices.DidNotReceiveWithAnyArgs().PingDeviceAsync(default!);
        await _host.Devices.DidNotReceiveWithAnyArgs().ResetDeviceAsync(default!);
    }

    [Fact]
    public async Task WithOneOnlineDevice_PingAndResetChooseItAutomatically()
    {
        _host.Devices.PingDeviceAsync("a-1", Arg.Any<CancellationToken>()).Returns("Pong.");
        _host.Devices.ResetDeviceAsync("a-1", Arg.Any<CancellationToken>()).Returns("Reset.");

        (await _host.RunAsync("device", "ping")).Should().Be(0);
        (await _host.RunAsync("device", "reset")).Should().Be(0);

        StdOut.Replace("\r\n", "\n").Should().Be("Pong.\nReset.\n");
    }

    [Fact]
    public async Task AnUnknownDevice_IsNotFound()
    {
        var exitCode = await _host.RunAsync("device", "forget", "--device", "nope");

        exitCode.Should().Be((int)CliExitCode.NotFound);
    }

    [Fact]
    public async Task AnApiNotFound_ExitsNotFound()
    {
        _host.Devices.ForgetDeviceAsync("c-3", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<string>(new TeensyApiException("Device not found.", 404)));

        var exitCode = await _host.RunAsync("device", "forget", "--device", "Charlie");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        StdErr.Should().Contain("Device not found.");
    }

    [Fact]
    public async Task Rename_WithABlankName_IsAUsageError_AndRenamesNothing()
    {
        var exitCode = await _host.RunAsync("device", "rename", " ", "--device", "Alpha");

        exitCode.Should().Be((int)CliExitCode.Usage);
        await _host.Devices.DidNotReceiveWithAnyArgs().RenameDeviceAsync(default!, default!);
    }

    // ---- JSON ---------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Rename_Json_IsTheDevice()
    {
        _host.Devices.RenameDeviceAsync("a-1", "Bench", Arg.Any<CancellationToken>()).Returns(Alpha with { Name = "Bench" });

        await _host.RunAsync("device", "rename", "Bench", "--device", "a-1", "--json");

        var device = JsonDocument.Parse(StdOut).RootElement;
        device.EnumerateObject().Select(p => p.Name).Should()
            .Equal("id", "name", "isOnline", "connection", "state", "sdAvailable", "usbAvailable", "sdIndexed", "usbIndexed");
        device.GetProperty("name").GetString().Should().Be("Bench");
    }

    [Theory]
    [InlineData("ping")]
    [InlineData("reset")]
    [InlineData("forget")]
    public async Task MessageVerbs_Json_AreTheDeviceIdAndTheMessage(string verb)
    {
        _host.Devices.PingDeviceAsync("a-1", Arg.Any<CancellationToken>()).Returns("done");
        _host.Devices.ResetDeviceAsync("a-1", Arg.Any<CancellationToken>()).Returns("done");
        _host.Devices.ForgetDeviceAsync("a-1", Arg.Any<CancellationToken>()).Returns("done");

        await _host.RunAsync("device", verb, "--device", "Alpha", "--json");

        var result = JsonDocument.Parse(StdOut).RootElement;
        result.EnumerateObject().Select(p => p.Name).Should().Equal("device", "message");
        result.GetProperty("device").GetString().Should().Be("a-1");
        result.GetProperty("message").GetString().Should().Be("done");
    }
}
