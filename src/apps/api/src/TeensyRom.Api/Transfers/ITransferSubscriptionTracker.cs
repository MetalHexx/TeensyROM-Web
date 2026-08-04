namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Tracks which SignalR connections are subscribed to which transfer jobs. The set of subscribed
    /// job ids doubles as the liveness signal the abandonment sweep reads.
    /// </summary>
    public interface ITransferSubscriptionTracker
    {
        void Add(string connectionId, string jobId);
        void Remove(string connectionId, string jobId);
        void RemoveConnection(string connectionId);
        bool HasSubscribers(string jobId);
    }
}
