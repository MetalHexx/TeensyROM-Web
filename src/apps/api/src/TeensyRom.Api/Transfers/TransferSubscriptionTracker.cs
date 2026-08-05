using System.Collections.Concurrent;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Bidirectional connection/job membership, kept consistent under a single lock since a connection
    /// can subscribe to several jobs and a job can have several subscribers.
    /// </summary>
    public sealed class TransferSubscriptionTracker : ITransferSubscriptionTracker
    {
        private readonly object _lock = new();
        private readonly ConcurrentDictionary<string, HashSet<string>> _connectionToJobs = new();
        private readonly ConcurrentDictionary<string, HashSet<string>> _jobToConnections = new();

        public void Add(string connectionId, string jobId)
        {
            lock (_lock)
            {
                GetOrAddSet(_connectionToJobs, connectionId).Add(jobId);
                GetOrAddSet(_jobToConnections, jobId).Add(connectionId);
            }
        }

        public void Remove(string connectionId, string jobId)
        {
            lock (_lock)
            {
                RemoveFromSet(_connectionToJobs, connectionId, jobId);
                RemoveFromSet(_jobToConnections, jobId, connectionId);
            }
        }

        public void RemoveConnection(string connectionId)
        {
            lock (_lock)
            {
                if (!_connectionToJobs.TryRemove(connectionId, out var jobIds)) return;

                foreach (var jobId in jobIds)
                {
                    RemoveFromSet(_jobToConnections, jobId, connectionId);
                }
            }
        }

        public bool HasSubscribers(string jobId)
        {
            lock (_lock)
            {
                return _jobToConnections.TryGetValue(jobId, out var connections) && connections.Count > 0;
            }
        }

        private static HashSet<string> GetOrAddSet(ConcurrentDictionary<string, HashSet<string>> map, string key) =>
            map.GetOrAdd(key, _ => []);

        private static void RemoveFromSet(ConcurrentDictionary<string, HashSet<string>> map, string key, string value)
        {
            if (!map.TryGetValue(key, out var set)) return;

            set.Remove(value);
            if (set.Count == 0) map.TryRemove(key, out _);
        }
    }
}
