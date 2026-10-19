using Microsoft.AspNetCore.SignalR;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.Serial.GetLogs
{
    /// <summary>
    /// Streams engine log lines to the connections that subscribed. Each connection subscribes and
    /// unsubscribes only itself, so no listener can switch off another's log.
    /// </summary>
    public sealed class LogsHub(ILogSubscriptions subscriptions) : Hub
    {
        public const string ListenersGroup = "log-listeners";

        /// <summary>Starts delivering <c>LogProduced</c> to the calling connection.</summary>
        public async Task Subscribe()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ListenersGroup);
            subscriptions.Add(Context.ConnectionId);
        }

        /// <summary>Stops delivering <c>LogProduced</c> to the calling connection.</summary>
        public async Task Unsubscribe()
        {
            subscriptions.Remove(Context.ConnectionId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ListenersGroup);
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            subscriptions.Remove(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }
    }

    /// <summary>
    /// Pushes a log line to every connection subscribed to <see cref="LogsHub"/>.
    /// </summary>
    public class LogStream(IHubContext<LogsHub> hub) : ILogStream
    {
        public Task Push(string logMessage, CancellationToken ct)
        {
            return hub.Clients.Group(LogsHub.ListenersGroup).SendAsync("LogProduced", logMessage, ct);
        }
    }
}
