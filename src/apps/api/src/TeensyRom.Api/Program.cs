using Microsoft.Extensions.FileProviders;
using System.Reflection;
using System.Text.Json.Serialization;
using TeensyRom.Api.Endpoints.GetDeviceEvents;
using TeensyRom.Api.Endpoints.Serial.GetLogs;
using TeensyRom.Api.Http;
using TeensyRom.Api.Services;
using TeensyRom.Api.Startup;
using TeensyRom.Core.Common;

AssetStartupHelper.UnpackAssets();

var builder = WebApplication.CreateBuilder(args);

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

app.UseUiCors();
app.UseRateLimiter();
app.MapApiDocs();
app.MapRadEndpoints();
app.MapHub<LogsHub>("/api/logHub");
app.MapHub<DeviceEventHub>("/api/deviceEventHub");

app.Run();

//TODO: Put this somewhere else.
AppDomain.CurrentDomain.UnhandledException += (sender, args) =>
{
    Console.WriteLine("UNHANDLED: " + args.ExceptionObject);
};

public partial class Program;
