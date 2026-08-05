using TeensyRom.Core.Entities.Transfers;

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
        /// pump calls this on every file.
        /// </summary>
        void JobChanged(TransferJob job);

        /// <summary>
        /// Broadcasts a per-file completion event immediately. Feeds a recent-activity list; not
        /// required for correctness since the job snapshot is authoritative.
        /// </summary>
        Task FileCompletedAsync(TransferFileCompleted completed);
    }
}
