using System.Net;
using System.Net.Http.Headers;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

/// <summary>What the web UI probe counts as "the engine serves the web app".</summary>
public sealed class WebUiProbeTests
{
    private sealed class StubHandler(Func<CancellationToken, HttpResponseMessage> answer) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(answer(cancellationToken));
        }
    }

    private static HttpResponseMessage Answer(HttpStatusCode status, string mediaType) =>
        new(status) { Content = new StringContent("body") { Headers = { ContentType = new MediaTypeHeaderValue(mediaType) } } };

    private static WebUiProbe Probe(Func<CancellationToken, HttpResponseMessage> answer) => new(new StubHandler(answer));

    [Theory]
    [InlineData(HttpStatusCode.OK, "text/html", true)]
    [InlineData(HttpStatusCode.OK, "application/xhtml+xml", true)]
    [InlineData(HttpStatusCode.NotFound, "text/html", false)]
    [InlineData(HttpStatusCode.OK, "application/json", false)]
    public async Task IsServing_IsTrueOnlyForASuccessfulHtmlPage(HttpStatusCode status, string mediaType, bool expected)
    {
        var served = await Probe(_ => Answer(status, mediaType)).IsServingAsync(CancellationToken.None);

        served.Should().Be(expected);
    }

    [Fact]
    public async Task IsServing_IsFalse_WhenTheConnectionFails()
    {
        var served = await Probe(_ => throw new HttpRequestException("refused")).IsServingAsync(CancellationToken.None);

        served.Should().BeFalse();
    }

    [Fact]
    public async Task IsServing_IsFalse_WhenTheRequestTimesOut()
    {
        var served = await Probe(_ => throw new TaskCanceledException("timed out")).IsServingAsync(CancellationToken.None);

        served.Should().BeFalse();
    }

    [Fact]
    public async Task IsServing_Rethrows_WhenTheCallerCancels()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var probe = () => Probe(_ => Answer(HttpStatusCode.OK, "text/html")).IsServingAsync(cts.Token);

        await probe.Should().ThrowAsync<OperationCanceledException>();
    }
}
