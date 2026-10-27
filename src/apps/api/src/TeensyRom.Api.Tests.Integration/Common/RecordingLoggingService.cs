using System.Collections.Concurrent;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Integration.Common
{
    public sealed record LoggedLine(string Level, string Message, string? DeviceId);

    /// <summary>Forwards to the engine's logger and keeps every line, so a test can assert what the engine logged.</summary>
    public sealed class RecordingLoggingService(ILoggingService inner) : ILoggingService
    {
        private readonly ConcurrentQueue<LoggedLine> _lines = new();

        public IReadOnlyList<LoggedLine> Lines => [.. _lines];

        public IObservable<string> Logs => inner.Logs;

        public void External(string message, string? deviceId = null) { Record(nameof(External), message, deviceId); inner.External(message, deviceId); }
        public void ExternalSuccess(string message, string? deviceId = null) { Record(nameof(ExternalSuccess), message, deviceId); inner.ExternalSuccess(message, deviceId); }
        public void ExternalError(string message, string? deviceId = null) { Record(nameof(ExternalError), message, deviceId); inner.ExternalError(message, deviceId); }
        public void Internal(string message, string? deviceId = null) { Record(nameof(Internal), message, deviceId); inner.Internal(message, deviceId); }
        public void InternalError(string message, string? deviceId = null) { Record(nameof(InternalError), message, deviceId); inner.InternalError(message, deviceId); }
        public void InternalWarning(string message, string? deviceId = null) { Record(nameof(InternalWarning), message, deviceId); inner.InternalWarning(message, deviceId); }
        public void InternalSuccess(string message, string? deviceId = null) { Record(nameof(InternalSuccess), message, deviceId); inner.InternalSuccess(message, deviceId); }

        private void Record(string level, string message, string? deviceId) => _lines.Enqueue(new LoggedLine(level, message, deviceId));
    }
}
