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

// Initialize global exception handlers BEFORE anything else
GlobalExceptionHandler.Initialize();

AssetStartupHelper.UnpackAssets();

var builder = WebApplication.CreateBuilder(args);

// The desktop shell provides a private, ephemeral loopback URL. When the API
// runs on its own it still binds only to loopback and asks Kestrel to select a
// free port, avoiding a fixed listener or public network exposure.
var listeningUrl = Environment.GetEnvironmentVariable("TEENSYROM_URL") ?? "http://127.0.0.1:0";
builder.WebHost.UseUrls(listeningUrl);

builder.Logging.AddFilter("Microsoft.AspNetCore.SignalR", LogLevel.Debug);
builder.Logging.AddFilter("Microsoft.AspNetCore.Http.Connections", LogLevel.Debug);

builder.Services.AddSignalR();

builder.Services
    .AddApiDocs()
    .AddTeensyRomMediatR()
    .AddUiCors()
    .AddTeensyRomServices()
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

// Configure static file serving for assets
// Use the same path resolution as AssetHelper to ensure we serve from where assets are actually unpacked
var assetsPath = Path.Combine(Assembly.GetExecutingAssembly().GetPath(), "Assets");
if (Directory.Exists(assetsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(assetsPath),
        RequestPath = "/Assets"
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

app.Lifetime.ApplicationStarted.Register(() =>
{
    app.Logger.LogInformation("TeensyROM API listening at {Urls}", string.Join(", ", app.Urls));
});

app.Run();

public partial class Program;
