using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Services
{
    /// <summary>
    /// TODO: This is a temporary stub implementation. Replace with proper LogStream implementation.
    /// This was created to resolve compilation issues after removing missing GetLogs namespace references.
    /// </summary>
    public class LogStream : ILogStream
    {
        public Task Push(string message, CancellationToken ct = default)
        {
            // Stub implementation - logs are currently only written to file
            // The actual SignalR streaming functionality is not yet implemented
            return Task.CompletedTask;
        }
    }
}
