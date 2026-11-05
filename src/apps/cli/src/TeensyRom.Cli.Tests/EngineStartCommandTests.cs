using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Tests;

/// <summary><c>trom api start</c> (<c>trom engine start</c>): readies the engine, then reports what <c>status</c> would.</summary>
[Collection(ConsoleCollection.Name)]
public sealed class EngineStartCommandTests : IDisposable
{
    private static readonly EngineStatus Running =
        new(true, "1.0.0", "1.0.0", true, "localhost:10213", null, "/home/logs", "/home/logs/Logs-1.txt");

    private readonly TestHost _host = new();

    public void Dispose() => _host.Dispose();

    [Fact]
    public async Task Start_ReadiesTheEngine_AndPrintsTheStatusDocument()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        var exitCode = await _host.RunAsync("api", "start", "--json");

        exitCode.Should().Be(0);
        await _host.Engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        var status = JsonDocument.Parse(_host.Consoles.StdOut).RootElement;
        status.GetProperty("running").GetBoolean().Should().BeTrue();
        status.GetProperty("version").GetString().Should().Be("1.0.0");
        status.GetProperty("logFolder").GetString().Should().Be("/home/logs");
    }

    [Fact]
    public async Task Start_PrintsTheSameDocumentAsStatus()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        await _host.RunAsync("api", "start", "--json");
        var started = _host.Consoles.StdOut;
        using var other = new TestHost();
        other.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);
        await other.RunAsync("api", "status", "--json");

        started.Should().Be(other.Consoles.StdOut);
    }

    [Fact]
    public async Task Start_WithoutJson_ShowsTheStatusRows()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        var exitCode = await _host.RunAsync("engine", "start");

        exitCode.Should().Be(0);
        _host.Consoles.StdOut.Should().Contain("Status: running").And.Contain("Trom API version: 1.0.0");
    }

    private static EngineStatus WithHttps(EngineHttps https) => Running with { Https = https };

    private static EngineHttps CreatedHttps(CertificateChange change = CertificateChange.Created, bool listening = true) =>
        new(10214, listening, listening ? null : "the port is busy", ["localhost"],
            new DateTimeOffset(2026, 11, 2, 10, 0, 0, TimeSpan.Zero), new DateTimeOffset(2028, 11, 1, 10, 0, 0, TimeSpan.Zero),
            change, null, HttpsNotice.For(change, null, 10214));

    [Fact]
    public async Task Start_WhenThisRunCreatedTheCertificate_ShowsTheSecureRows_AndTheNoticeOnStderr()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(WithHttps(CreatedHttps()));

        var exitCode = await _host.RunAsync("api", "start");

        exitCode.Should().Be(0);
        _host.Consoles.StdOut.Should().Contain("Secure address: https://localhost:10214").And.Contain("Certificate expires: 2028-11-01");
        _host.Consoles.StdOut.Should().NotContain("security certificate");
        _host.Consoles.StdErr.Should().Contain("created a security certificate");
    }

    [Fact]
    public async Task Start_WhenTheCertificateWasReused_PrintsNoNotice()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(WithHttps(CreatedHttps(CertificateChange.None)));

        await _host.RunAsync("api", "start");

        _host.Consoles.StdErr.Should().NotContain("certificate");
    }

    [Fact]
    public async Task Start_WithHttpsNotListening_SaysWhyItIsNotAvailable()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(WithHttps(CreatedHttps(CertificateChange.None, listening: false)));

        await _host.RunAsync("api", "start");

        _host.Consoles.StdOut.Should().Contain("Secure address: not available — the port is busy");
    }

    [Fact]
    public async Task Status_Json_CarriesTheHttpsObject_WithTheNoticeAndCamelCaseChange()
    {
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(WithHttps(CreatedHttps()));

        var exitCode = await _host.RunAsync("api", "status", "--json");

        exitCode.Should().Be(0);
        var https = JsonDocument.Parse(_host.Consoles.StdOut).RootElement.GetProperty("https");
        https.GetProperty("change").GetString().Should().Be("created");
        https.GetProperty("listening").GetBoolean().Should().BeTrue();
        https.GetProperty("notice").GetString().Should().Contain("created a security certificate");
    }

    [Fact]
    public async Task Status_AgainstAnEngineWithoutHttps_HasNoHttpsRowsOrProperty()
    {
        _host.Engine.GetStatusAsync(Arg.Any<CancellationToken>()).Returns(Running);

        await _host.RunAsync("api", "status", "--json");

        JsonDocument.Parse(_host.Consoles.StdOut).RootElement.TryGetProperty("https", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Start_WhenTheEngineCannotStart_ExitsThree_WithNothingOnStdout()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The port is in use."));

        var exitCode = await _host.RunAsync("api", "start", "--json");

        exitCode.Should().Be((int)CliExitCode.EngineUnavailable);
        _host.Consoles.StdOut.Should().BeEmpty();
        _host.Consoles.StdErr.Should().Contain("The port is in use.");
        await _host.Engine.DidNotReceiveWithAnyArgs().GetStatusAsync(default);
    }
}
