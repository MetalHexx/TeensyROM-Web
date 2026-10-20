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
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

public class DeviceLogStreamTests
{
    private const string DeviceId = "abc123";

    [Theory]
    [InlineData("(abc123) Internal: => Indexing (SD): /music", "=> Indexing (SD): /music")]
    [InlineData("(abc123) Internal Success: Indexing completed for SD storage.", "Indexing completed for SD storage.")]
    [InlineData("(abc123) External Error: Failed: timed out", "Failed: timed out")]
    public void TryReadMessage_GivesTheDevicesLineWithoutItsPrefix(string line, string expected)
    {
        DeviceLogStream.TryReadMessage(line, DeviceId, out var message).Should().BeTrue();

        message.Should().Be(expected);
    }

    [Theory]
    [InlineData("(other) Internal: => Indexing (SD): /music")]
    [InlineData("Log streaming faulted: boom")]
    [InlineData("seen (abc123) Internal: not at the start")]
    [InlineData("(abc1234) Internal: a device whose id only starts the same")]
    public void TryReadMessage_IgnoresLinesThatAreNotTheDevices(string line)
    {
        DeviceLogStream.TryReadMessage(line, DeviceId, out _).Should().BeFalse();
    }

    [Fact]
    public async Task FollowAsync_SubscribesBeforeTheSelectedDevicesLinesArrive_AndUnsubscribesWhenDisposed()
    {
        await using var trWeb = await FakeTrWebLogs.StartAsync<FakeLogsHub>();
        var stream = StreamTo(trWeb.Address);

        var following = await stream.FollowAsync(line => trWeb.Events.Enqueue($"line: {line}"));
        await trWeb.LogAsync("(abc123) Internal: => Indexing (SD): /music");
        await trWeb.LogAsync("(other) Internal: => Indexing (SD): /games");
        await trWeb.LogAsync("Log streaming faulted: boom");
        await trWeb.LogAsync("(abc123) Internal: Indexing completed for SD storage.");
        await following.DisposeAsync();

        trWeb.Events.Should().Equal("subscribe", "line: => Indexing (SD): /music", "line: Indexing completed for SD storage.", "unsubscribe");
    }

    [Fact]
    public async Task DisposeAsync_WaitsForLinesTrWebStillHasQueuedBeforeUnsubscribing()
    {
        await using var trWeb = await FakeTrWebLogs.StartAsync<FakeLogsHub>();
        var stream = StreamTo(trWeb.Address);

        var following = await stream.FollowAsync(line => trWeb.Events.Enqueue($"line: {line}"));
        var disposing = following.DisposeAsync().AsTask();
        await Task.Delay(100);
        await trWeb.LogAsync("(abc123) Internal: Indexing completed for SD storage.");
        await disposing;

        trWeb.Events.Should().Equal("subscribe", "line: Indexing completed for SD storage.", "unsubscribe");
    }

    [Fact]
    public async Task DisposeAsync_WhenUnsubscribingFails_SaysSoAndStillCompletes()
    {
        await using var trWeb = await FakeTrWebLogs.StartAsync<UnsubscribeRefusingLogsHub>();
        var log = Substitute.For<ILoggingService>();
        var following = await StreamTo(trWeb.Address, log).FollowAsync(_ => { });

        var dispose = async () => await following.DisposeAsync();

        await dispose.Should().NotThrowAsync();
        log.Received(1).InternalError(Arg.Is<string>(message => message.StartsWith("Couldn't stop following tr-web's log")));
    }

    [Fact]
    public async Task FollowAsync_WhenTrWebRefusesTheSubscription_FailsWithAPlainMessage()
    {
        await using var trWeb = await FakeTrWebLogs.StartAsync<SubscribeRefusingLogsHub>();
        var stream = StreamTo(trWeb.Address);

        var follow = () => stream.FollowAsync(_ => { });

        (await follow.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().Contain("not today");
    }

    [Fact]
    public async Task FollowAsync_WhenTrWebHasNoSubscribeMethod_FailsWithAPlainMessage()
    {
        await using var trWeb = await FakeTrWebLogs.StartAsync<LogsHubWithoutSubscribe>();
        var stream = StreamTo(trWeb.Address);

        var follow = () => stream.FollowAsync(_ => { });

        (await follow.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task FollowAsync_WhenTrWebIsNotListening_FailsWithAPlainMessage()
    {
        var stream = StreamTo(UnusedAddress());

        var follow = () => stream.FollowAsync(_ => { });

        (await follow.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().NotBeNullOrWhiteSpace();
    }

    private static DeviceLogStream StreamTo(Uri address, ILoggingService? log = null)
    {
        var devices = Substitute.For<IDeviceService>();
        devices.RequireDeviceId().Returns(DeviceId);

        return new DeviceLogStream(devices, log ?? Substitute.For<ILoggingService>(), address);
    }

    private static Uri UnusedAddress()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return new Uri($"http://127.0.0.1:{port}");
    }

    /// <summary>tr-web's log hub: records the calls it gets in the test's event list.</summary>
    public sealed class FakeLogsHub(ConcurrentQueue<string> events) : Hub
    {
        public void Subscribe() => events.Enqueue("subscribe");

        public void Unsubscribe() => events.Enqueue("unsubscribe");
    }

    /// <summary>A hub whose Subscribe fails.</summary>
    public sealed class SubscribeRefusingLogsHub : Hub
    {
        public void Subscribe() => throw new HubException("not today");
    }

    /// <summary>A hub that subscribes but fails to unsubscribe.</summary>
    public sealed class UnsubscribeRefusingLogsHub : Hub
    {
        public void Subscribe() { }

        public void Unsubscribe() => throw new HubException("not today");
    }

    /// <summary>The log hub of a tr-web older than per-listener logs: it has no Subscribe method.</summary>
    public sealed class LogsHubWithoutSubscribe : Hub;

    /// <summary>The corner of tr-web the stream talks to: its log hub.</summary>
    private sealed class FakeTrWebLogs : IAsyncDisposable
    {
        private readonly WebApplication _app;
        private readonly Func<string, Task> _log;

        /// <summary>The hub's "subscribe" and "unsubscribe" calls, in order, plus whatever the test adds.</summary>
        public ConcurrentQueue<string> Events { get; }

        public Uri Address { get; }

        private FakeTrWebLogs(WebApplication app, ConcurrentQueue<string> events, Func<string, Task> log)
        {
            _app = app;
            _log = log;
            Events = events;
            Address = new Uri(app.Urls.First());
        }

        public static async Task<FakeTrWebLogs> StartAsync<THub>() where THub : Hub
        {
            var events = new ConcurrentQueue<string>();
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Logging.ClearProviders();
            builder.Services.AddSignalR();
            builder.Services.AddSingleton(events);

            var app = builder.Build();
            app.MapHub<THub>("/api/logHub");

            await app.StartAsync();

            var hub = app.Services.GetRequiredService<IHubContext<THub>>();
            return new FakeTrWebLogs(app, events, line => hub.Clients.All.SendAsync("LogProduced", line));
        }

        public Task LogAsync(string line) => _log(line);

        public async ValueTask DisposeAsync()
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }
}
