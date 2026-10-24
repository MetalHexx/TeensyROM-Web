using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console.Cli;
using System.Text.Json;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.Device;
using TeensyRom.Cli.Commands.Engine;
using TeensyRom.Cli.Commands.Main;
using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The public <c>trom</c> tree as shipped: what it registers, retires and does on the streams.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class CliHostTests : IDisposable
{
    private readonly TestHost _host = new();

    public void Dispose() => _host.Dispose();

    private string StdOut => _host.Consoles.StdOut;

    private string StdErr => _host.Consoles.StdErr;

    private void EngineAnswers(bool running = true, string? version = null) =>
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(running
            ? new EngineStatus(true, version ?? "1.0.0", "1.0.0", (version ?? "1.0.0") == "1.0.0", "localhost:10213", null)
            : new EngineStatus(false, null, "1.0.0", false, "localhost:10213", "No TeensyROM engine is running at localhost:10213 — run `trom device list` to start one."));

    // ---- help, version and the retired surface --------------------------------------------------------------------

    [Fact]
    public async Task Version_IsTromAndItsVersionOnTheFirstLine_OnStdout_WithNoEngine()
    {
        var exitCode = await _host.RunAsync("--version");

        exitCode.Should().Be(0);
        StdOut.Split('\n')[0].Trim().Should().StartWith("trom ").And.Contain(AssemblyExtensions.GetVersion(typeof(CliHost).Assembly));
        StdErr.Should().BeEmpty();
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task RootHelp_ListsTheNounsAndTheExitCodes_OnStdout_WithNoEngine()
    {
        var exitCode = await _host.RunAsync("--help");

        exitCode.Should().Be(0);
        StdOut.Should().Contain("COMMANDS").And.Contain("engine").And.Contain("device").And.Contain("EXIT CODES").And.Contain("--json");
        StdErr.Should().BeEmpty();
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await _host.Devices.DidNotReceiveWithAnyArgs().GetDevicesAsync(default);
    }

    [Fact]
    public async Task EveryNounsAndVerbsHelp_GoesToStdout_AndStartsNothing()
    {
        foreach (var args in new[] { new[] { "engine", "--help" }, ["engine", "status", "--help"], ["device", "list", "-h"], ["device", "discover", "--help"] })
        {
            (await _host.RunAsync(args)).Should().Be(0, string.Join(' ', args));
        }

        StdOut.Should().Contain("--json");
        StdErr.Should().BeEmpty();
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Theory]
    [InlineData("launch")]
    [InlineData("i")]
    [InlineData("ports")]
    [InlineData("p")]
    [InlineData("cs")]
    [InlineData("credits")]
    [InlineData("c")]
    [InlineData("stop")]
    public async Task TheOldCommandNames_AreUsageErrors_ThatStartNoEngine(string oldName)
    {
        var exitCode = await _host.RunAsync(oldName);

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain($"Unknown command '{oldName}'");
        StdOut.Should().BeEmpty();
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task AnUnknownOption_IsAUsageError_NotSilentlyIgnored()
    {
        EngineAnswers();

        var exitCode = await _host.RunAsync("engine", "status", "--bogus");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("Unknown option 'bogus'");
        StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task ABareNoun_IsAUsageError_WithTheNounsHelpOnStderr()
    {
        var exitCode = await _host.RunAsync("engine");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("`trom engine` needs a command").And.Contain("status").And.Contain("stop");
        StdOut.Should().BeEmpty();
    }

    // ---- engine ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task EngineStatus_WhenAnEngineAnswers_SucceedsAndStartsNothing()
    {
        EngineAnswers();

        var exitCode = await _host.RunAsync("engine", "status");

        exitCode.Should().Be(0);
        StdOut.Should().Contain("Status: running").And.Contain("Engine version: 1.0.0");
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await _host.Engine.DidNotReceiveWithAnyArgs().StopAsync(default);
    }

    [Fact]
    public async Task EngineStatus_JsonAfterTheVerb_IsOneDocumentOnStdout()
    {
        EngineAnswers();

        var exitCode = await _host.RunAsync("engine", "status", "--json");

        exitCode.Should().Be(0);
        var status = JsonDocument.Parse(StdOut).RootElement;
        status.GetProperty("running").GetBoolean().Should().BeTrue();
        status.GetProperty("matches").GetBoolean().Should().BeTrue();
        status.GetProperty("cliVersion").GetString().Should().Be("1.0.0");
        status.TryGetProperty("problem", out _).Should().BeFalse();
        StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task EngineStatus_NamesTheLogFolderAndLogFile_InTheRowsAndUnderJson()
    {
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(new EngineStatus(
            true, "1.0.0", "1.0.0", true, "localhost:10213", null, "/home/logs", "/home/logs/Logs-2026-10-02.txt"));

        await _host.RunAsync("engine", "status");

        StdOut.Should().Contain("Log folder: /home/logs").And.Contain("Log file: /home/logs/Logs-2026-10-02.txt");
    }

    [Fact]
    public async Task EngineStatus_JsonCarriesTheLogFolderAndLogFileFields()
    {
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(new EngineStatus(
            true, "1.0.0", "1.0.0", true, "localhost:10213", null, "/home/logs", "/home/logs/Logs-2026-10-02.txt"));

        await _host.RunAsync("engine", "status", "--json");

        var status = JsonDocument.Parse(StdOut).RootElement;
        status.GetProperty("logFolder").GetString().Should().Be("/home/logs");
        status.GetProperty("logFile").GetString().Should().Be("/home/logs/Logs-2026-10-02.txt");
    }

    [Fact]
    public async Task EngineStatus_WithAnEngineOfAnotherVersion_StillSucceeds_AndWarnsOnStderr()
    {
        EngineAnswers(version: "0.9.0");

        var exitCode = await _host.RunAsync("engine", "status", "--json");

        exitCode.Should().Be(0);
        JsonDocument.Parse(StdOut).RootElement.GetProperty("matches").GetBoolean().Should().BeFalse();
        StdErr.Should().Contain("0.9.0");
    }

    [Fact]
    public async Task EngineStatus_WhenNoEngineAnswers_ExitsThree_WithTheJsonErrorLastOnStderr()
    {
        EngineAnswers(running: false);

        var exitCode = await _host.RunAsync("engine", "status", "--json");

        exitCode.Should().Be((int)CliExitCode.EngineUnavailable);
        JsonDocument.Parse(StdOut).RootElement.GetProperty("running").GetBoolean().Should().BeFalse();
        var error = JsonDocument.Parse(StdErr.TrimEnd().Split('\n')[^1]).RootElement.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("engineUnavailable");
        error.GetProperty("exitCode").GetInt32().Should().Be(3);
    }

    [Theory]
    [InlineData("Stopped", 0, "stopped")]
    [InlineData("NotRunning", 0, "notRunning")]
    [InlineData("NotSupported", 1, "notSupported")]
    [InlineData("Foreign", 1, "foreign")]
    [InlineData("Failed", 1, "failed")]
    public async Task EngineStop_ReportsItsOutcomeAsJson_AndExitsZeroOnlyWhenNoEngineIsLeft(string outcomeName, int expectedExit, string expectedJson)
    {
        _host.Engine.StopAsync(Arg.Any<CancellationToken>()).Returns(Enum.Parse<EngineStopOutcome>(outcomeName));

        var exitCode = await _host.RunAsync("engine", "stop", "--json");

        exitCode.Should().Be(expectedExit);
        JsonDocument.Parse(StdOut).RootElement.GetProperty("outcome").GetString().Should().Be(expectedJson);
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task EngineStop_SaysWhatHappenedOnStderr_NeverOnStdout()
    {
        _host.Engine.StopAsync(Arg.Any<CancellationToken>()).Returns(EngineStopOutcome.Stopped);

        var exitCode = await _host.RunAsync("engine", "stop");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("TeensyROM engine stopped. The web app it served has stopped too.");
        StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task EngineStop_OfAnEngineThatDoesNotLetGo_NamesTheLogs()
    {
        _host.Engine.StopAsync(Arg.Any<CancellationToken>()).Returns(EngineStopOutcome.Failed);

        var exitCode = await _host.RunAsync("engine", "stop");

        exitCode.Should().Be(1);
        StdErr.Should().Contain("didn't stop within 45 seconds").And.Contain(TeensyRomHome.EngineLogsPath);
    }

    // ---- device list and discover --------------------------------------------------------------------------------------

    private static DeviceSummary Alpha => new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: false);

    private static DeviceSummary Charlie => new("c-3", "Charlie", false, "USB COM9", "ConnectionLost");

    private void ReadyEngine() => _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);

    private void TrWebKnows(params DeviceSummary[] known)
    {
        _host.Devices.FindAsync(Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(known);
    }

    [Fact]
    public async Task DeviceList_StartsTheEngine_AndAsksForNoScan()
    {
        ReadyEngine();
        TrWebKnows(Alpha);

        var exitCode = await _host.RunAsync("device", "list");

        exitCode.Should().Be(0);
        await _host.Engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        await _host.Devices.Received(1).FindAsync(false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeviceDiscover_AsksForAFullScan()
    {
        ReadyEngine();
        TrWebKnows(Alpha);

        var exitCode = await _host.RunAsync("device", "discover");

        exitCode.Should().Be(0);
        await _host.Devices.Received(1).FindAsync(true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeviceList_WhenRedirected_IsOneNamePerLine_WithNoTableOrBorder()
    {
        ReadyEngine();
        TrWebKnows(Alpha, Charlie);

        await _host.RunAsync("device", "list");

        StdOut.Replace("\r\n", "\n").Should().Be("Alpha\nCharlie\n");
        StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task DeviceList_Json_IsAnArrayOfDevices()
    {
        ReadyEngine();
        TrWebKnows(Alpha, Charlie);

        await _host.RunAsync("device", "list", "--json");

        var devices = JsonDocument.Parse(StdOut).RootElement.EnumerateArray().ToList();
        devices.Should().HaveCount(2);
        devices[0].EnumerateObject().Select(p => p.Name).Should()
            .Equal("id", "name", "isOnline", "connection", "state", "sdAvailable", "usbAvailable", "sdIndexed", "usbIndexed");
        devices[0].GetProperty("name").GetString().Should().Be("Alpha");
        devices[0].GetProperty("sdAvailable").GetBoolean().Should().BeTrue();
        devices[1].GetProperty("isOnline").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task DeviceList_WhenTrWebKnowsNone_Json_IsAnEmptyArray_AndSaysSoOnStderr()
    {
        ReadyEngine();
        TrWebKnows();

        (await _host.RunAsync("device", "list", "--json")).Should().Be(0);

        JsonDocument.Parse(StdOut).RootElement.GetArrayLength().Should().Be(0);
        StdErr.Should().Contain("No TeensyROM devices found.");
    }

    [Fact]
    public async Task DeviceDiscover_WhenTrWebKnowsNone_WritesNoLines_AndSaysSoOnStderr()
    {
        ReadyEngine();
        TrWebKnows();

        (await _host.RunAsync("device", "discover")).Should().Be(0);

        StdOut.Should().BeEmpty();
        StdErr.Should().Contain("No TeensyROM devices found.");
    }

    [Fact]
    public async Task DeviceList_OnATerminal_IsATableWithTheDevicesFields()
    {
        using var terminal = new TestHost(terminal: true);
        terminal.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        terminal.Devices.FindAsync(Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(new[] { Alpha });

        await terminal.RunAsync("device", "list");

        terminal.Consoles.StdOut.Should().Contain("Name").And.Contain("Id").And.Contain("State").And.Contain("Connection").And.Contain("Online")
            .And.Contain("SD indexed").And.Contain("USB indexed").And.Contain("Alpha").And.Contain("a-1").And.Contain("USB COM3");
    }

    [Fact]
    public async Task DeviceList_WhenNoEngineCanBeStarted_ExitsThree_AndNeverListsDevices()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The TeensyROM engine didn't start."));

        var exitCode = await _host.RunAsync("device", "list");

        exitCode.Should().Be((int)CliExitCode.EngineUnavailable);
        StdErr.Should().Contain("The TeensyROM engine didn't start.");
        StdOut.Should().BeEmpty();
        await _host.Devices.DidNotReceiveWithAnyArgs().FindAsync(default, default);
    }

    [Fact]
    public async Task EngineNoticesAndErrors_NeverReachStdout()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The TeensyROM engine didn't start."));

        await _host.RunAsync("device", "list", "--json");

        StdOut.Should().BeEmpty();
        StdErr.Should().Contain("didn't start");
    }

    // ---- registrations -----------------------------------------------------------------------------------------------------

    private static IEnumerable<Type> ConcreteCommands() => typeof(CliHost).Assembly.GetTypes()
        .Where(type => type is { IsClass: true, IsAbstract: false } && type.IsAssignableTo(typeof(ICommand)))
        .Where(type => type.Namespace?.StartsWith("TeensyRom.Cli.Commands") == true);

    private static Type SettingsOf(Type command) => command.GetInterfaces()
        .First(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(ICommand<>))
        .GetGenericArguments()[0];

    private ServiceLifetime? LifetimeOf(Type type) => _host.Services.LastOrDefault(d => d.ServiceType == type)?.Lifetime;

    [Fact]
    public void EveryCommandAndSettingsType_IsRegisteredUpFront_SoSpectreNeverRegistersOneLate()
    {
        var commands = ConcreteCommands().ToList();

        commands.Should().NotBeEmpty();
        foreach (var command in commands)
        {
            LifetimeOf(command).Should().NotBeNull($"{command.Name} must be registered up front");
            LifetimeOf(SettingsOf(command)).Should().NotBeNull($"{SettingsOf(command).Name} must be registered up front");
        }
    }

    [Fact]
    public void PublicCommandsAndSettings_AreTransient_SoNoOptionValueSurvivesIntoTheNextRun()
    {
        foreach (var command in new[] { typeof(EngineStatusCommand), typeof(EngineStopCommand), typeof(DeviceListCommand) })
        {
            LifetimeOf(command).Should().Be(ServiceLifetime.Transient, command.Name);
            LifetimeOf(SettingsOf(command)).Should().Be(ServiceLifetime.Transient, SettingsOf(command).Name);
        }
    }

    [Fact]
    public void MenuFlowTypes_AreSingletons_AsTheyRelyOnClearingTheirOwnSettings()
    {
        foreach (var command in new[] { typeof(LaunchCommand), typeof(IndexCommand), typeof(RandomCommand) })
        {
            LifetimeOf(command).Should().Be(ServiceLifetime.Singleton, command.Name);
            LifetimeOf(SettingsOf(command)).Should().Be(ServiceLifetime.Singleton, SettingsOf(command).Name);
        }
    }

    [Fact]
    public void ThePlayerCommand_IsASingleton_BecauseItSubscribesToLaunchesInItsConstructor()
    {
        LifetimeOf(typeof(PlayerCommand)).Should().Be(ServiceLifetime.Singleton);
    }
}
