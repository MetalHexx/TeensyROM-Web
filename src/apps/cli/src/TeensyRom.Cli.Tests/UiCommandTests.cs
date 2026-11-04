using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Tests;

/// <summary><c>trom ui</c>: readies the engine, opens Trom UI and reports where it answers.</summary>
[Collection(ConsoleCollection.Name)]
public sealed class UiCommandTests : IDisposable
{
    private readonly IWebUiProbe _webUi = Substitute.For<IWebUiProbe>();
    private readonly IEngineLocator _locator = Substitute.For<IEngineLocator>();
    private readonly TestHost _host;

    public UiCommandTests()
    {
        _host = new TestHost(configure: services =>
        {
            services.AddSingleton(_webUi);
            services.AddSingleton(_locator);
            services.AddSingleton<ILanAddresses>(new FixedLanAddresses("192.168.1.20", "10.0.0.7"));
        });
        _locator.Locate().Returns(new EngineLookup(new EngineLocation(EngineMode.Packaged, "/install/api"), "/install/api"));
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _webUi.IsServingAsync(Arg.Any<CancellationToken>()).Returns(true);
        ReportHttps(null);
    }

    public void Dispose() => _host.Dispose();

    private void ReportHttps(EngineHttps? https) =>
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>())
            .Returns(new EngineStatus(true, "1.0.0", "1.0.0", true, "localhost:10213", null, Https: https));

    private static EngineHttps Https(bool listening, CertificateChange change = CertificateChange.None) =>
        new(10214, listening, listening ? null : "the port is busy", ["localhost"], null, null, change, null, HttpsNotice.For(change, null, 10214));

    [Fact]
    public async Task Ui_WhenHttpsListens_ListsASecureAddressBesideEachNetworkAddress()
    {
        ReportHttps(Https(listening: true));

        await _host.RunAsync("ui", "--no-open", "--json");

        Document.GetProperty("secureNetworkAddresses").EnumerateArray().Select(a => a.GetString()).Should()
            .Equal("https://192.168.1.20:10214", "https://10.0.0.7:10214");
        Document.GetProperty("address").GetString().Should().Be("http://localhost:10213");
    }

    [Fact]
    public async Task Ui_WithoutJson_InterleavesTheSecureRowsAfterEachNetworkRow()
    {
        ReportHttps(Https(listening: true));

        await _host.RunAsync("ui", "--no-open");

        var lines = _host.Consoles.StdOut.Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0).ToList();
        lines.Should().Equal(
            "Trom UI: http://localhost:10213",
            "On your network: http://192.168.1.20:10213",
            "Secure, for MIDI and video: https://192.168.1.20:10214",
            "On your network: http://10.0.0.7:10213",
            "Secure, for MIDI and video: https://10.0.0.7:10214");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Ui_WhenHttpsIsNotListeningOrNotReported_ListsNoSecureAddresses(bool reported)
    {
        ReportHttps(reported ? Https(listening: false) : null);

        await _host.RunAsync("ui", "--no-open", "--json");

        Document.GetProperty("secureNetworkAddresses").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Ui_PrintsTheCertificateNotice_OnlyWhenThisRunChangedIt()
    {
        ReportHttps(Https(listening: true, CertificateChange.Created));
        await _host.RunAsync("ui", "--no-open");
        var created = _host.Consoles.StdErr;

        using var quiet = new TestHost(configure: services => services.AddSingleton(_webUi).AddSingleton(_locator));
        quiet.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        quiet.Engine.GetStatusAsync(Arg.Any<CancellationToken>())
            .Returns(new EngineStatus(true, "1.0.0", "1.0.0", true, "localhost:10213", null, Https: Https(listening: true)));
        await quiet.RunAsync("ui", "--no-open");

        created.Should().Contain("created a security certificate");
        quiet.Consoles.StdErr.Should().NotContain("certificate");
    }

    private JsonElement Document => JsonDocument.Parse(_host.Consoles.StdOut).RootElement;

    [Fact]
    public async Task Ui_OpensTheBrowser_AndReportsTheLocalAndNetworkAddresses()
    {
        var exitCode = await _host.RunAsync("ui", "--json");

        exitCode.Should().Be(0);
        _host.BrowserOpener.Opened.Should().Equal("http://localhost:10213");
        Document.GetProperty("address").GetString().Should().Be("http://localhost:10213");
        Document.GetProperty("networkAddresses").EnumerateArray().Select(a => a.GetString()).Should()
            .Equal("http://192.168.1.20:10213", "http://10.0.0.7:10213");
        Document.GetProperty("available").GetBoolean().Should().BeTrue();
        Document.GetProperty("opened").GetBoolean().Should().BeTrue();
        Document.TryGetProperty("problem", out _).Should().BeFalse();
        Document.TryGetProperty("openFailure", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Ui_WithNoOpen_NeverOpensABrowser()
    {
        var exitCode = await _host.RunAsync("ui", "--no-open", "--json");

        exitCode.Should().Be(0);
        _host.BrowserOpener.Opened.Should().BeEmpty();
        Document.GetProperty("available").GetBoolean().Should().BeTrue();
        Document.GetProperty("opened").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Ui_WithoutJson_ListsTheAddresses()
    {
        await _host.RunAsync("ui", "--no-open");

        _host.Consoles.StdOut.Should().Contain("Trom UI: http://localhost:10213").And.Contain("On your network: http://192.168.1.20:10213");
    }

    [Fact]
    public async Task Ui_WhenTheWebUiIsNotServed_WritesTheDocument_ThenExitsOneWithTheProblem()
    {
        _webUi.IsServingAsync(Arg.Any<CancellationToken>()).Returns(false);

        var exitCode = await _host.RunAsync("ui", "--json");

        exitCode.Should().Be(1);
        Document.GetProperty("available").GetBoolean().Should().BeFalse();
        Document.GetProperty("opened").GetBoolean().Should().BeFalse();
        var problem = Document.GetProperty("problem").GetString();
        problem.Should().Contain("isn't serving Trom UI");
        _host.Consoles.StdErr.Should().Contain(problem!);
        _host.BrowserOpener.Opened.Should().BeEmpty();
    }

    [Fact]
    public async Task Ui_WhenTheBrowserWontOpen_TellsTheUserTheAddress_AndExitsZero()
    {
        _host.BrowserOpener.Result = new BrowserOpenResult(false, "xdg-open exited with code 3.");

        var exitCode = await _host.RunAsync("ui", "--json");

        exitCode.Should().Be(0);
        Document.GetProperty("opened").GetBoolean().Should().BeFalse();
        Document.GetProperty("openFailure").GetString().Should().Contain("xdg-open");
        _host.Consoles.StdErr.Should().Contain("open http://localhost:10213 yourself");
    }

    [Fact]
    public async Task Ui_WhenTheEngineCannotStart_ExitsThree_AndOpensNothing()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The port is in use."));

        var exitCode = await _host.RunAsync("ui");

        exitCode.Should().Be(3);
        _host.BrowserOpener.Opened.Should().BeEmpty();
        await _webUi.DidNotReceiveWithAnyArgs().IsServingAsync(default);
    }
}
