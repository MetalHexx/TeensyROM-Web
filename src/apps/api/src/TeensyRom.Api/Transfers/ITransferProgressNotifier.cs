namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Pushes transfer job progress to subscribed clients. Snapshot broadcasts are throttled; the
    /// implementation also runs the throttle loop as a hosted service.
    /// </summary>
    public interface ITransferProgressNotifier
    {
        /// <summary>
        /// Marks the job dirty for the next throttled broadcast. Must be cheap and non-blocking — the
        /// pump calls this on every file. The snapshot's bounded recent-completions list, not a
        /// per-file event, is what carries per-file activity to subscribers.
        /// </summary>
        void JobChanged(TransferJob job);
    }
}
