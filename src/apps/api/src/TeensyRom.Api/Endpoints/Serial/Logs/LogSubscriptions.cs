using TeensyRom.Api.Services;

namespace TeensyRom.Api.Endpoints.Serial.GetLogs
{
    /// <summary>
    /// Tracks which hub connections listen to the log stream, and runs the stream only while at least one does.
    /// </summary>
    public interface ILogSubscriptions
    {
        /// <summary>Registers a listener. Adding a connection that is already registered does nothing.</summary>
        void Add(string connectionId);

        /// <summary>Removes a listener. Removing an unknown connection does nothing.</summary>
        void Remove(string connectionId);

        /// <summary>The number of connections currently listening.</summary>
        int Count { get; }
    }

    /// <summary>
    /// Starts the log stream when the first listener joins and stops it when the last one leaves.
    /// </summary>
    public class LogSubscriptions(IQueuedChannelLogger logger) : ILogSubscriptions
    {
        private readonly object _gate = new();
        private readonly HashSet<string> _connectionIds = [];

        public int Count
        {
            get
            {
                lock (_gate) return _connectionIds.Count;
            }
        }

        public void Add(string connectionId)
        {
            lock (_gate)
            {
                if (!_connectionIds.Add(connectionId)) return;
                if (_connectionIds.Count == 1) logger.StartLogStream();
            }
        }

        public void Remove(string connectionId)
        {
            lock (_gate)
            {
                if (!_connectionIds.Remove(connectionId)) return;
                if (_connectionIds.Count == 0) logger.StopLogStream();
            }
        }
    }
}
