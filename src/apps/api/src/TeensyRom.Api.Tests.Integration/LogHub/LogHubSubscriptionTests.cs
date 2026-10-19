using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Serial.GetLogs;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Integration.Logs
{
    /// <summary>
    /// Drives the log hub through its real SignalR pipeline: each connection subscribes itself, and one
    /// leaving never switches off another. The "Transfer" fixture is used only because it fakes the device
    /// manager; the log hub has no device dependency.
    /// </summary>
    [Collection("Transfer")]
    public class LogHubSubscriptionTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

        private readonly List<HubConnection> _connections = [];

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            foreach (var connection in _connections)
            {
                await connection.DisposeAsync();
            }

            await WaitUntilAsync(() => Subscriptions.Count == 0, "all listeners to leave");
        }

        private ILogSubscriptions Subscriptions => f.Services.GetRequiredService<ILogSubscriptions>();

        [Fact]
        public async Task Unsubscribe_OneOfTwoListeners_LeavesTheOtherReceiving()
        {
            var first = await ConnectAsync();
            var second = await ConnectAsync();
            await first.Connection.InvokeAsync("Subscribe");
            await second.Connection.InvokeAsync("Subscribe");

            await first.Connection.InvokeAsync("Unsubscribe");
            var line = WriteLine();

            await WaitUntilAsync(() => second.Lines.Contains(line), "the remaining listener to receive the line");
            await Task.Delay(300);
            first.Lines.Should().NotContain(line);
            Subscriptions.Count.Should().Be(1);
        }

        [Fact]
        public async Task Disconnect_OneOfTwoListenersWithoutUnsubscribing_LeavesTheOtherReceiving()
        {
            var first = await ConnectAsync();
            var second = await ConnectAsync();
            await first.Connection.InvokeAsync("Subscribe");
            await second.Connection.InvokeAsync("Subscribe");

            await first.Connection.DisposeAsync();
            await WaitUntilAsync(() => Subscriptions.Count == 1, "the dropped listener to be removed");
            var line = WriteLine();

            await WaitUntilAsync(() => second.Lines.Contains(line), "the remaining listener to receive the line");
        }

        [Fact]
        public async Task Subscribe_AfterTheLastListenerLeft_ReceivesLinesAgain()
        {
            var first = await ConnectAsync();
            await first.Connection.InvokeAsync("Subscribe");
            await first.Connection.InvokeAsync("Unsubscribe");
            Subscriptions.Count.Should().Be(0);

            var second = await ConnectAsync();
            await second.Connection.InvokeAsync("Subscribe");
            var line = WriteLine();

            await WaitUntilAsync(() => second.Lines.Contains(line), "the new listener to receive the line");
            first.Lines.Should().NotContain(line);
        }

        [Fact]
        public async Task Connect_WithoutSubscribing_ReceivesNothing()
        {
            var subscribed = await ConnectAsync();
            var bystander = await ConnectAsync();
            await subscribed.Connection.InvokeAsync("Subscribe");

            var line = WriteLine();

            await WaitUntilAsync(() => subscribed.Lines.Contains(line), "the subscribed listener to receive the line");
            bystander.Lines.Should().NotContain(line);
        }

        private string WriteLine()
        {
            var line = $"log-hub-test-{Guid.NewGuid():N}";
            f.Services.GetRequiredService<ILoggingService>().Internal(line);
            return line;
        }

        private async Task<Listener> ConnectAsync()
        {
            var connection = new HubConnectionBuilder()
                .WithUrl("http://localhost/api/logHub", options =>
                {
                    options.HttpMessageHandlerFactory = _ => f.Server.CreateHandler();
                    options.Transports = HttpTransportType.LongPolling;
                })
                .Build();

            var lines = new ConcurrentQueue<string>();
            connection.On<string>("LogProduced", lines.Enqueue);
            _connections.Add(connection);

            await connection.StartAsync();
            return new Listener(connection, lines);
        }

        private static async Task WaitUntilAsync(Func<bool> condition, string waitingFor)
        {
            var deadline = DateTime.UtcNow + Timeout;
            while (!condition())
            {
                if (DateTime.UtcNow > deadline) throw new TimeoutException($"Timed out waiting for {waitingFor}.");
                await Task.Delay(50);
            }
        }

        private sealed record Listener(HubConnection Connection, ConcurrentQueue<string> Lines);
    }
}
