using System.Net;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Logging;

namespace TeensyRom.Cli.Tests;

[Collection(LoggingCollection.Name)]
public class ApiLoggingHandlerTests
{
    [Fact]
    public async Task OverALoggerThatThrows_AnAnsweredCall_StillReturnsTheResponse()
    {
        var expected = new HttpResponseMessage(HttpStatusCode.OK);
        using var client = ClientOver(new ThrowingLogger(), (_, _) => Task.FromResult(expected));

        var response = await client.GetAsync("http://tr-web.test/api/transfers");

        response.Should().BeSameAs(expected);
    }

    [Fact]
    public async Task OverALoggerThatThrows_AFailedCall_RethrowsTheRequestException()
    {
        var original = new HttpRequestException("connection refused");
        using var client = ClientOver(new ThrowingLogger(), (_, _) => throw original);

        var act = () => client.GetAsync("http://tr-web.test/api/transfers");

        (await act.Should().ThrowAsync<HttpRequestException>()).Which.Should().BeSameAs(original);
    }

    private static HttpClient ClientOver(ILoggingService log, Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> engine) =>
        new(new ApiLoggingHandler(log) { InnerHandler = new StubHandler(engine) });

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> engine) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            engine(request, cancellationToken);
    }

    private sealed class ThrowingLogger : LoggingService
    {
        public override void Log(string message, string hExColor, bool newLine = true) =>
            throw new InvalidOperationException("logger fault");
    }
}
