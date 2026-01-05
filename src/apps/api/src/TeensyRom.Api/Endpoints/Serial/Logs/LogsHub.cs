using Microsoft.AspNetCore.SignalR;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.Serial.GetLogs
{
    public sealed class LogsHub : Hub { }

    public class LogStream(IHubContext<LogsHub> hub) : ILogStream
    {
        public Task Push(string logMessage, CancellationToken ct)
        {
            return hub.Clients.All.SendAsync("LogProduced", logMessage, ct);
        }
    }
}
