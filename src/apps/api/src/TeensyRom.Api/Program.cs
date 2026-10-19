using Microsoft.Extensions.FileProviders;
using System.Reflection;
using System.Text.Json.Serialization;
using TeensyRom.Api.Endpoints.Audio.Hub;
using TeensyRom.Api.Endpoints.Serial.GetLogs;
using TeensyRom.Api.Endpoints.Transfers.Hub;
using TeensyRom.Api.Http;
using TeensyRom.Api.Middleware;
using TeensyRom.Api.Services;
using TeensyRom.Api.Startup;
using TeensyRom.Core.Common;

// The OpenAPI build step runs this file past builder.Build() and starts the host. Point it at a throwaway
// home before anything resolves a path, so a build never touches the real home or an engine running on it.
var isBuildTimeDocumentGeneration = EngineHostMode.IsBuildTimeDocumentGeneration;

if (isBuildTimeDocumentGeneration)
{
    UseThrowawayHome();
}
else if (!EngineInstanceLock.TryAcquire(TeensyRomHome.ApiPath))
{
    // Ahead of everything that writes to the home or the service container, so a second engine neither
    // touches the serial port nor writes into the home it is refusing to share.
    Console.Error.WriteLine($"Another TeensyROM engine is already running with the home {TeensyRomHome.Root}.");
    Environment.Exit(1);
}

// Initialize global exception handlers BEFORE anything else that can fail
GlobalExceptionHandler.Initialize();

if (!isBuildTimeDocumentGeneration)
{
    PackageAssetSync.Sync(
        packageAssets: Path.Combine(Assembly.GetExecutingAssembly().GetPath(), "Assets"),
        homeAssets: Path.Combine(TeensyRomHome.ApiPath, "Assets"),
        version: Assembly.GetExecutingAssembly().GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0");
}

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFilter("Microsoft.AspNetCore.SignalR", LogLevel.Debug);
builder.Logging.AddFilter("Microsoft.AspNetCore.Http.Connections", LogLevel.Debug);

builder.Services.AddSignalR();

builder.Services
    .AddApiDocs()
    .AddTeensyRomMediatR()
    .AddUiCors()
    .AddTeensyRomServices(registerHostedServices: !isBuildTimeDocumentGeneration)
    .AddStrictRateLimiting()
    .AddProblemDetailsWithLogging()
    .AddRadEndpoints(typeof(Program));

// Configure JSON options for HTTP endpoints (RadEndpoints)
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.AddSignalR().AddJsonProtocol(options =>
{
    options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

// Global exception middleware - catches HTTP request exceptions
app.UseMiddleware<ExceptionMiddleware>();

// Permissive CORS for all requests (API, SignalR, static assets)
app.UseUiCors();

// Serve only the asset subtrees the UI displays. The home's Assets folder also holds System/
// (settings, connection records, logs) and Tools/, which must never be reachable over HTTP.
foreach (var servedFolder in new[] { "Game", "Music", "Other" })
{
    var servedPath = Path.Combine(TeensyRomHome.ApiPath, "Assets", servedFolder);

    if (!Directory.Exists(servedPath)) continue;

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(servedPath),
        RequestPath = $"/Assets/{servedFolder}"
    });
}

// Configure static file serving for Angular SPA from wwwroot
app.UseDefaultFiles();  // Serves index.html for root requests
app.UseStaticFiles();   // Serves files from wwwroot

app.UseRateLimiter();
app.MapApiDocs();
app.MapRadEndpoints();
app.MapHub<LogsHub>("/api/logHub");
app.MapHub<AudioHub>("/api/audioHub");
app.MapHub<TransferHub>("/api/transferHub");

// SPA fallback routing - must be AFTER all API routes and SignalR hubs
// This allows Angular to handle client-side routing for unknown routes
app.MapFallbackToFile("index.html");

app.Run();

static void UseThrowawayHome()
{
    var home = Path.Combine(Path.GetTempPath(), $"teensyrom-openapi-{Guid.NewGuid():N}");
    Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);

    AppDomain.CurrentDomain.ProcessExit += (_, _) =>
    {
        // Best-effort: the home lives in the temp directory, so a leftover folder is harmless.
        try { Directory.Delete(home, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    };
}

public partial class Program;
