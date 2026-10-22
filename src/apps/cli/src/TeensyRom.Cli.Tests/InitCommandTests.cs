using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Init;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom init</c>: the report is written whatever state the engine, web UI and devices are in, and the exit code
/// follows only whether the engine could be made ready.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class InitCommandTests
{
    private const string CliVersion = "1.2.3";

    private readonly IWebUiProbe _webUi = Substitute.For<IWebUiProbe>();
    private readonly IEngineLocator _locator = Substitute.For<IEngineLocator>();

    private TestHost NewHost(
        bool engineReady = true,
        string? failure = null,
        bool running = true,
        string engineVersion = CliVersion,
        bool webUiServing = true,
        bool terminal = false,
        params DeviceSummary[] devices)
    {
        var host = new TestHost(terminal, configure: services => services.AddSingleton(_webUi).AddSingleton(_locator));

        _locator.Locate().Returns(new EngineLookup(new EngineLocation(EngineMode.Packaged, @"C:pps	eensyrom"), @"C:pps	eensyrom"));

        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(new EngineReady(engineReady, failure));
        host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(new EngineStatus(
            running, running ? engineVersion : null, CliVersion, engineVersion == CliVersion, "localhost:10213", running ? null : "Nothing answers."));
        host.Devices.FindAsync(false, Arg.Any<CancellationToken>()).Returns(devices);
        _webUi.IsServingAsync(Arg.Any<CancellationToken>()).Returns(webUiServing);
        return host;
    }

    private static DeviceSummary Device(
        string name = "Bench", bool online = true, bool sd = true, bool usb = false, bool sdIndexed = true, bool usbIndexed = false) =>
        new("id-" + name, name, online, "USB COM3", "Connected", sd, usb, sdIndexed, usbIndexed);

    private static JsonElement Parse(TestHost host) => JsonDocument.Parse(host.Consoles.StdOut).RootElement;

    private static string[] Problems(JsonElement report) =>
        report.GetProperty("problems").EnumerateArray().Select(problem => problem.GetString()!).ToArray();

    [Fact]
    public async Task Init_WithARunningEngineAndAnIndexedDevice_ReportsEverythingAndExitsZero()
    {
        using var host = NewHost(devices: Device());

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        var report = Parse(host);
        report.GetProperty("trom").GetProperty("version").GetString().Should().Be(CliVersion);
        var engine = report.GetProperty("engine");
        engine.GetProperty("running").GetBoolean().Should().BeTrue();
        engine.GetProperty("matches").GetBoolean().Should().BeTrue();
        engine.GetProperty("address").GetString().Should().Be("http://127.0.0.1:10213");
        var webUi = report.GetProperty("webUi");
        webUi.GetProperty("address").GetString().Should().Be("http://127.0.0.1:10213/");
        webUi.GetProperty("available").GetBoolean().Should().BeTrue();
        report.GetProperty("devices").EnumerateArray().Single().GetProperty("name").GetString().Should().Be("Bench");
        Problems(report).Should().BeEmpty();
    }

    [Fact]
    public async Task Init_WhenTheEngineCannotStart_WritesTheReportThenExitsThree()
    {
        using var host = NewHost(engineReady: false, failure: "The port is in use.", running: false, webUiServing: true);

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(3);
        var report = Parse(host);
        report.GetProperty("engine").GetProperty("running").GetBoolean().Should().BeFalse();
        report.GetProperty("webUi").GetProperty("available").GetBoolean().Should().BeFalse("the web UI is not probed without an engine");
        Problems(report).Should().Equal("The port is in use.");
        report.GetProperty("devices").GetArrayLength().Should().Be(0);
        await host.Devices.DidNotReceiveWithAnyArgs().FindAsync(default, default);
        await _webUi.DidNotReceiveWithAnyArgs().IsServingAsync(default);
        host.Consoles.StdErr.Should().Contain("The port is in use.");
    }

    [Fact]
    public async Task Init_WithNoDeviceOnline_ExitsZero_WithAProblem()
    {
        using var host = NewHost(devices: Device(online: false));

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        Problems(Parse(host)).Should().Equal("No TeensyROM is online.");
    }

    [Fact]
    public async Task Init_WithAnOnlineDeviceWhoseAvailableStorageIsNotIndexed_NamesTheIndexBuildCommand()
    {
        using var host = NewHost(devices: Device(name: "My Bench", sd: true, sdIndexed: false, usb: true, usbIndexed: false));

        await host.RunAsync("init", "--json");

        Problems(Parse(host)).Should().Equal(
            "My Bench's SD storage isn't fully indexed — run `trom index build --device \"My Bench\" --storage sd`.",
            "My Bench's USB storage isn't fully indexed — run `trom index build --device \"My Bench\" --storage usb`.");
    }

    [Fact]
    public async Task Init_WithAnUnavailableStorage_ReportsNoProblemForIt()
    {
        using var host = NewHost(devices: Device(sd: true, sdIndexed: true, usb: false, usbIndexed: false));

        await host.RunAsync("init", "--json");

        Problems(Parse(host)).Should().BeEmpty();
    }

    [Fact]
    public async Task Init_WhenTheWebUiIsNotServed_ReportsItUnavailable_WithoutFailing()
    {
        using var host = NewHost(webUiServing: false, devices: Device());

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        Parse(host).GetProperty("webUi").GetProperty("available").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Init_WhenASourceEngineHasNoBuiltFrontEnd_NamesTheMissingIndexAndTheFix()
    {
        var root = Directory.CreateTempSubdirectory("teensyrom-init").FullName;

        try
        {
            var api = Path.Combine(root, "src", "apps", "api", "src", "TeensyRom.Api");
            Directory.CreateDirectory(api);
            using var host = NewHost(webUiServing: false, devices: Device());
            _locator.Locate().Returns(new EngineLookup(new EngineLocation(EngineMode.Source, root, Path.Combine(api, "TeensyRom.Api.csproj")), root));

            await host.RunAsync("init", "--json");

            var problem = Problems(Parse(host)).Should().ContainSingle().Subject;
            problem.Should().Contain(Path.Combine(api, "wwwroot")).And.Contain("no index.html")
                .And.Contain("pnpm run build:frontend").And.Contain(Path.Combine(root, "src"))
                .And.Contain("trom engine stop").And.Contain("trom init");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task Init_WhenASourceEngineHasABuiltFrontEndButDoesNotServeIt_SaysToRestartTheEngine()
    {
        var root = Directory.CreateTempSubdirectory("teensyrom-init").FullName;

        try
        {
            var api = Path.Combine(root, "src", "apps", "api", "src", "TeensyRom.Api");
            Directory.CreateDirectory(Path.Combine(api, "wwwroot"));
            File.WriteAllText(Path.Combine(api, "wwwroot", "index.html"), "<html></html>");
            using var host = NewHost(webUiServing: false, devices: Device());
            _locator.Locate().Returns(new EngineLookup(new EngineLocation(EngineMode.Source, root, Path.Combine(api, "TeensyRom.Api.csproj")), root));

            await host.RunAsync("init", "--json");

            Problems(Parse(host)).Should().ContainSingle().Which.Should().Contain("trom engine stop").And.NotContain("build:frontend");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task Init_WhenAPackagedEngineDoesNotServeTheWebUi_PointsAtTheEngineLogs()
    {
        using var host = NewHost(webUiServing: false, devices: Device());

        await host.RunAsync("init", "--json");

        Problems(Parse(host)).Should().ContainSingle().Which.Should().Contain("isn't serving the web UI").And.Contain("logs");
    }

    [Fact]
    public async Task Init_WhenTheWebUiIsNotServed_CarriesTheProblemInTheHumanOutputToo()
    {
        using var host = NewHost(webUiServing: false, devices: Device());

        await host.RunAsync("init");

        host.Consoles.StdOut.Should().Contain("isn't serving the web UI");
    }

    [Fact]
    public async Task Init_WhenTheEngineVersionDiffers_SaysTheNextEngineCommandRestartsIt()
    {
        using var host = NewHost(engineVersion: "0.9.0", devices: Device());

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        var report = Parse(host);
        report.GetProperty("engine").GetProperty("matches").GetBoolean().Should().BeFalse();
        Problems(report).Should().ContainSingle().Which.Should().Contain("0.9.0").And.Contain("restarts it");
    }

    [Fact]
    public async Task Init_WhenListingDevicesFails_PutsTheFailureInProblems()
    {
        using var host = NewHost();
        host.Devices.FindAsync(false, Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<DeviceSummary>>(_ => throw new TeensyApiException("tr-web is busy listing devices — try again in a few seconds.", 503));

        var exitCode = await host.RunAsync("init", "--json");

        exitCode.Should().Be(0);
        Problems(Parse(host)).Should().ContainSingle().Which.Should().Contain("Couldn't list").And.Contain("busy listing devices");
    }

    [Fact]
    public async Task Init_ListsCapabilitiesAndCommandsFromTheTreeAndTheTopLevelCommands()
    {
        using var host = NewHost();

        await host.RunAsync("init", "--json");

        var report = Parse(host);
        var capabilities = report.GetProperty("capabilities").EnumerateArray().Select(c => c.GetString()).ToArray();
        capabilities.Should().Equal(
            [.. CliHost.PublicTree.SelectMany(noun => noun.Verbs.Select(verb => $"{noun.Name} {verb.Name}")), .. CliHost.PublicCommands.Select(c => c.Name)]);
        capabilities.Should().Contain(["file launch", "init"]);
        var commands = report.GetProperty("commands").EnumerateArray().Select(c => c.GetProperty("name").GetString()).ToArray();
        commands.Should().Equal([.. CliHost.PublicTree.Select(noun => noun.Name), .. CliHost.PublicCommands.Select(c => c.Name)]);
    }

    [Fact]
    public async Task Init_Redirected_WritesLabelValueLinesIncludingTheProblemsToStdout()
    {
        using var host = NewHost(devices: Device(online: false));

        var exitCode = await host.RunAsync("init");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("Engine").And.Contain("Web UI").And.Contain("Bench").And.Contain("Problem").And.Contain("No TeensyROM is online.");
        await host.Engine.DidNotReceiveWithAnyArgs().StopAsync(default);
    }

    [Fact]
    public async Task Init_OnATerminal_WritesTheFieldsAndDevicesToStdout_AndTheProblemsToStderr()
    {
        using var host = NewHost(terminal: true, devices: Device(online: false));

        var exitCode = await host.RunAsync("init");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("Engine").And.Contain("Web UI").And.Contain("Bench");
        host.Consoles.StdErr.Should().Contain("No TeensyROM is online.");
    }
}
