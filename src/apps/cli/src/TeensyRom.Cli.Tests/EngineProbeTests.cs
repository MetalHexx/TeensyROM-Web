using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public class EngineProbeTests
{
    private static readonly TimeSpan Budget = TimeSpan.FromMilliseconds(300);
    private static readonly TimeSpan Connect = TimeSpan.FromSeconds(5);

    /// <summary>A loopback port nothing listens on.</summary>
    private static Uri ClosedPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return new Uri($"http://127.0.0.1:{port}");
    }

    /// <summary>A tiny Kestrel host answering every request with <paramref name="answer"/>.</summary>
    private static async Task<(WebApplication App, Uri Address)> Serve(Func<HttpContext, Task> answer)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        var app = builder.Build();
        app.MapFallback(context => answer(context));
        await app.StartAsync();
        return (app, new Uri(app.Urls.First()));
    }

    private static Func<HttpContext, Task> Reply(int status, string body = "", string contentType = "application/json") => async context =>
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = contentType;
        await context.Response.WriteAsync(body);
    };

    private static async Task<T> Against<T>(Func<HttpContext, Task> answer, Func<EngineProbe, Task<T>> act)
    {
        var (app, address) = await Serve(answer);
        await using var _ = app;
        return await act(new EngineProbe(address, Connect, Budget));
    }

    [Fact]
    public async Task Probe_OfAClosedPort_IsUnreachable()
    {
        var probe = new EngineProbe(ClosedPort(), Connect, Budget);

        var result = await probe.ProbeAsync(CancellationToken.None);

        result.Should().BeOfType<EngineProbeResult.Unreachable>();
    }

    [Fact]
    public async Task Probe_OfARefusalSlowerThanTheResponseBudget_IsStillUnreachable()
    {
        var slowRefusal = new ScriptedHandler(async ct =>
        {
            await Task.Delay(Budget * 2, ct);
            throw new HttpRequestException("refused", new SocketException((int)SocketError.ConnectionRefused));
        });
        var probe = new EngineProbe(new Uri("http://127.0.0.1:1"), Connect, Budget, slowRefusal);

        var result = await probe.ProbeAsync(CancellationToken.None);

        result.Should().BeOfType<EngineProbeResult.Unreachable>();
    }

    [Fact]
    public async Task Probe_OfAnEngineThatAnswersTooSlowly_IsNotReady()
    {
        var result = await Against(
            context => Task.Delay(Timeout.Infinite, context.RequestAborted),
            probe => probe.ProbeAsync(CancellationToken.None));

        result.Should().BeOfType<EngineProbeResult.NotReady>();
    }

    [Theory]
    [InlineData(500)]
    [InlineData(503)]
    public async Task Probe_OfAServerError_IsNotReady(int status)
    {
        var result = await Against(Reply(status, "{}"), probe => probe.ProbeAsync(CancellationToken.None));

        result.Should().BeOfType<EngineProbeResult.NotReady>();
    }

    [Fact]
    public async Task Probe_OfAVersionAnswer_IsTheEngineAndItsVersion()
    {
        var result = await Against(Reply(200, """{"version":"1.0.0-alpha.8+abc123"}"""), probe => probe.ProbeAsync(CancellationToken.None));

        result.Should().Be(new EngineProbeResult.Engine("1.0.0-alpha.8+abc123"));
    }

    [Fact]
    public async Task Probe_OfANotFound_IsForeign()
    {
        var result = await Against(Reply(404), probe => probe.ProbeAsync(CancellationToken.None));

        result.Should().BeOfType<EngineProbeResult.Foreign>();
    }

    [Theory]
    [InlineData("<html>hello</html>", "text/html")]
    [InlineData("{}", "application/json")]
    [InlineData("""{"version":""}""", "application/json")]
    public async Task Probe_OfASuccessThatIsNotAVersionPayload_IsForeign(string body, string contentType)
    {
        var result = await Against(Reply(200, body, contentType), probe => probe.ProbeAsync(CancellationToken.None));

        result.Should().BeOfType<EngineProbeResult.Foreign>();
    }

    [Fact]
    public async Task Probe_WhenTheCallerCancels_Throws()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();

        var act = () => Against(Reply(200, """{"version":"1"}"""), probe => probe.ProbeAsync(cancelled.Token));

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task RequestStop_OfAnEngineThatAccepts_IsAccepted()
    {
        var request = await Against(
            context => context.Request.Method == "POST" && context.Request.Path == "/api/engine/stop" ? Reply(200, """{"message":"stopping"}""")(context) : Reply(404)(context),
            probe => probe.RequestStopAsync(CancellationToken.None));

        request.Should().Be(EngineStopRequest.Accepted);
    }

    [Theory]
    [InlineData(404)]
    [InlineData(405)]
    public async Task RequestStop_OfAnEngineWithoutTheEndpoint_IsNotSupported(int status)
    {
        var request = await Against(Reply(status), probe => probe.RequestStopAsync(CancellationToken.None));

        request.Should().Be(EngineStopRequest.NotSupported);
    }

    [Theory]
    [InlineData(403)]
    [InlineData(500)]
    public async Task RequestStop_OfAnEngineThatRefuses_Fails(int status)
    {
        var request = await Against(Reply(status, "{}"), probe => probe.RequestStopAsync(CancellationToken.None));

        request.Should().Be(EngineStopRequest.Failed);
    }

    [Fact]
    public async Task RequestStop_OfAnEngineThatIsAlreadyGone_ReportsItGone()
    {
        var probe = new EngineProbe(ClosedPort(), Connect, Budget);

        var request = await probe.RequestStopAsync(CancellationToken.None);

        request.Should().Be(EngineStopRequest.Gone);
    }

    /// <summary>A transport that runs <paramref name="failure"/>, which is expected to end by throwing.</summary>
    private sealed class ScriptedHandler(Func<CancellationToken, Task> failure) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            await failure(cancellationToken);
            throw new InvalidOperationException("The scripted failure should have thrown.");
        }
    }
}
