using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TeensyRom.Cli.Api;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Stands in for an engine of another version on the engine's port: reports <c>version</c>, and stops listening when
/// asked to stop, as the real one does. The port must be free when it starts.
/// </summary>
internal sealed class FakeEngine : IAsyncDisposable
{
    private readonly WebApplication _app;
    private int _stopRequests;

    private FakeEngine(WebApplication app) => _app = app;

    /// <summary>True once the fake has been asked to stop through <c>POST /api/engine/stop</c>.</summary>
    public bool StopRequested => Volatile.Read(ref _stopRequests) > 0;

    public static async Task<FakeEngine> StartAsync(string version)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(kestrel => kestrel.Listen(IPAddress.Loopback, EngineAddress.Port));

        var app = builder.Build();
        var fake = new FakeEngine(app);

        app.MapGet("/api/version", () => Results.Text($$"""{"version":"{{version}}"}""", "application/json"));
        app.MapPost("/api/engine/stop", () =>
        {
            Interlocked.Increment(ref fake._stopRequests);
            _ = Task.Run(() => app.StopAsync());

            return Results.Text("""{"message":"stopping"}""", "application/json");
        });

        await app.StartAsync();

        return fake;
    }

    public async ValueTask DisposeAsync()
    {
        await _app.StopAsync();
        await _app.DisposeAsync();
    }
}
