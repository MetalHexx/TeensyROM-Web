using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSubstitute;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text.Json.Serialization;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Services;
using static TeensyRom.Cli.Tests.TransferLinesTests;

namespace TeensyRom.Cli.Tests;

public class TransferLineStreamTests
{
    [Fact]
    public async Task ASeededJob_GetsNoStartLine_AndItsEndLineComesOnce()
    {
        await using var engine = await FakeEngine.StartAsync(seed: [Job(id: "a", filesSent: 3)]);
        await using var stream = engine.Stream(out var alerts);

        await stream.StartAsync(default);
        await engine.PushAsync(Job(id: "a", filesSent: 3));
        await engine.PushAsync(Job(TransferJobState.Completed, id: "a", filesSent: 3));
        await alerts.WaitForAsync(1);

        alerts.Lines.Should().Equal("success: Sent 3 files to Alpha");
    }

    [Fact]
    public async Task ASeededTerminalJob_GetsNoEndLine()
    {
        await using var engine = await FakeEngine.StartAsync(seed: [Job(TransferJobState.Completed, id: "old", filesSent: 3)]);
        await using var stream = engine.Stream(out var alerts);

        await stream.StartAsync(default);
        await engine.PushAsync(Job(TransferJobState.Completed, id: "old", filesSent: 3));
        await engine.PushAsync(Job(id: "marker"));
        await alerts.WaitForAsync(1);

        alerts.Lines.Should().Equal("plain: Sending files to Alpha");
    }

    [Fact]
    public async Task ANewJob_GetsAStartLine_ThenOneEndLineOnceItsLaunchHasSettled()
    {
        await using var engine = await FakeEngine.StartAsync();
        await using var stream = engine.Stream(out var alerts);
        await stream.StartAsync(default);

        await engine.PushAsync(Job(id: "n", totalFiles: 2, watchFolder: true));
        await engine.PushAsync(Job(TransferJobState.Completed, id: "n", filesSent: 2, launch: TransferLaunchState.Pending, launchedPath: "/g/a.prg"));
        await engine.PushAsync(Job(id: "tick"));
        await alerts.WaitForAsync(2);

        alerts.Lines.Should().Equal("plain: Sending 2 files from Incoming to Alpha", "plain: Sending files to Alpha");

        await engine.PushAsync(Job(TransferJobState.Completed, id: "n", filesSent: 2, launch: TransferLaunchState.Launched, launchedPath: "/g/a.prg"));
        await engine.PushAsync(Job(TransferJobState.Completed, id: "n", filesSent: 2, launch: TransferLaunchState.Launched, launchedPath: "/g/a.prg"));
        await engine.PushAsync(Job(id: "last"));
        await alerts.WaitForAsync(4);

        alerts.Lines.Should().Equal(
            "plain: Sending 2 files from Incoming to Alpha",
            "plain: Sending files to Alpha",
            "success: Sent 2 files to Alpha · launched a.prg",
            "plain: Sending files to Alpha");
    }

    [Fact]
    public async Task AJobFirstSeenAlreadyTerminal_GetsOnlyItsEndLine_AsAnErrorWhenItFailed()
    {
        await using var engine = await FakeEngine.StartAsync();
        await using var stream = engine.Stream(out var alerts);
        await stream.StartAsync(default);

        await engine.PushAsync(Job(TransferJobState.Aborted, id: "x", filesSent: 1, error: "boom"));
        await alerts.WaitForAsync(1);

        alerts.Lines.Should().Equal("error: Transfer to Alpha stopped: boom · 1 file sent");
    }

    [Fact]
    public async Task AStartWithNoHubListening_LogsAndReturnsWithoutThrowing()
    {
        var log = Substitute.For<ILoggingService>();
        await using var stream = new TransferLineStream(new RecordingAlert(), Devices(), log, UnusedAddress());

        var start = () => stream.StartAsync(default);

        await start.Should().NotThrowAsync();
        log.Received(1).InternalError(Arg.Is<string>(m => m.StartsWith("Couldn't follow transfers")));
    }

    [Fact]
    public async Task AStartAfterAFailedOne_TriesAgain()
    {
        var address = UnusedAddress();
        await using var stream = new TransferLineStream(new RecordingAlert(), Devices(), Substitute.For<ILoggingService>(), address);
        await stream.StartAsync(default);

        await using var engine = await FakeEngine.StartAsync(address);
        await stream.StartAsync(default);

        engine.Connections.Should().Be(1);
    }

    [Fact]
    public async Task OverlappingStarts_OpenOneConnection_AndLaterOnesJoinIt()
    {
        await using var engine = await FakeEngine.StartAsync();
        await using var stream = engine.Stream(out _);

        await Task.WhenAll(stream.StartAsync(default), stream.StartAsync(default), stream.StartAsync(default));
        await stream.StartAsync(default);

        engine.Connections.Should().Be(1);
    }

    [Fact]
    public async Task AJobThatEndedDuringAGap_GetsItsEndLineOnceTheConnectionIsBack()
    {
        var address = UnusedAddress();
        var engine = await FakeEngine.StartAsync(address, seed: [Job(id: "gap", filesSent: 1)]);
        await using var stream = engine.Stream(out var alerts, address);
        await stream.StartAsync(default);
        await engine.PushAsync(Job(id: "seen"));
        await alerts.WaitForAsync(1);

        await engine.DisposeAsync();
        await using var back = await FakeEngine.StartAsync(address, seed:
        [
            Job(TransferJobState.Completed, id: "gap", filesSent: 4),
            Job(TransferJobState.Completed, id: "never-seen", filesSent: 9),
            Job(id: "began-in-gap"),
            Job(id: "seen")
        ]);
        await alerts.WaitForAsync(3, timeout: TimeSpan.FromSeconds(20));
        await Task.Delay(300);

        alerts.Lines.Should().Equal(
            "plain: Sending files to Alpha",
            "plain: Sending files to Alpha",
            "success: Sent 4 files to Alpha");
    }

    [Fact]
    public async Task DisposeDuringAPendingStart_CancelsIt_AndOpensNoConnectionAfterwards()
    {
        var address = UnusedAddress();
        var stream = new TransferLineStream(new RecordingAlert(), Devices(), Substitute.For<ILoggingService>(), address);
        var start = stream.StartAsync(default);

        await stream.DisposeAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
        await start.WaitAsync(TimeSpan.FromSeconds(10));

        await using var engine = await FakeEngine.StartAsync(address);
        await stream.StartAsync(default);
        await Task.Delay(300);

        engine.Connections.Should().Be(0);
    }

    [Fact]
    public async Task Dispose_UnsubscribesAndClosesTheConnection()
    {
        await using var engine = await FakeEngine.StartAsync();
        var stream = engine.Stream(out _);
        await stream.StartAsync(default);

        await stream.DisposeAsync();

        engine.Unsubscribes.Should().Be(1);
    }

    private static IDeviceService Devices()
    {
        var devices = Substitute.For<IDeviceService>();
        devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { new DeviceSummary("dev-1", "Alpha", true, "USB COM3", "Connected") });
        return devices;
    }

    private static Uri UnusedAddress()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return new Uri($"http://127.0.0.1:{port}");
    }

    private sealed class RecordingAlert : IAlertService
    {
        private readonly ConcurrentQueue<string> _lines = new();

        public IObservable<string> CommandErrors => throw new NotSupportedException();

        public IReadOnlyList<string> Lines => _lines.ToArray();

        public void Publish(string message) => _lines.Enqueue($"plain: {message}");

        public void PublishSuccess(string message) => _lines.Enqueue($"success: {message}");

        public void PublishError(string message) => _lines.Enqueue($"error: {message}");

        public async Task WaitForAsync(int count, TimeSpan? timeout = null)
        {
            var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(5));
            while (_lines.Count < count)
            {
                if (DateTime.UtcNow > deadline) throw new TimeoutException($"Only {_lines.Count} of {count} lines arrived: {string.Join(" | ", _lines)}");
                await Task.Delay(10);
            }
        }
    }

    public sealed class FakeTransferState
    {
        public List<TransferJobDto> Seed { get; init; } = [];
        public int Connections;
        public int Unsubscribes;
    }

    /// <summary>The engine's transfer hub: lists the seed on SubscribeAll and counts connections and unsubscribes.</summary>
    public sealed class FakeTransferHub(FakeTransferState state) : Hub
    {
        public override Task OnConnectedAsync()
        {
            Interlocked.Increment(ref state.Connections);
            return base.OnConnectedAsync();
        }

        public List<TransferJobDto> SubscribeAll() => state.Seed;

        public void UnsubscribeAll() => Interlocked.Increment(ref state.Unsubscribes);
    }

    private sealed class FakeEngine : IAsyncDisposable
    {
        private readonly WebApplication _app;
        private readonly FakeTransferState _state;

        private FakeEngine(WebApplication app, FakeTransferState state)
        {
            _app = app;
            _state = state;
            Address = new Uri(app.Urls.First());
        }

        public Uri Address { get; }

        public int Connections => Volatile.Read(ref _state.Connections);

        public int Unsubscribes => Volatile.Read(ref _state.Unsubscribes);

        public static async Task<FakeEngine> StartAsync(Uri? address = null, List<TransferJobDto>? seed = null)
        {
            var state = new FakeTransferState { Seed = seed ?? [] };
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseUrls(address?.ToString().TrimEnd('/') ?? "http://127.0.0.1:0");
            builder.Logging.ClearProviders();
            builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
            builder.Services.AddSingleton(state);

            var app = builder.Build();
            app.MapHub<FakeTransferHub>("/api/transferHub");
            await app.StartAsync();

            return new FakeEngine(app, state);
        }

        public TransferLineStream Stream(out RecordingAlert alerts, Uri? address = null)
        {
            alerts = new RecordingAlert();
            return new TransferLineStream(alerts, Devices(), Substitute.For<ILoggingService>(), address ?? Address);
        }

        public Task PushAsync(TransferJobDto job) =>
            _app.Services.GetRequiredService<IHubContext<FakeTransferHub>>().Clients.All.SendAsync("JobSnapshot", job);

        public async ValueTask DisposeAsync()
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }
}
