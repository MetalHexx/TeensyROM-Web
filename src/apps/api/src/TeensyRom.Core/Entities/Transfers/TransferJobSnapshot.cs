using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Entities.Transfers
{
    public sealed record TransferJobSnapshot
    {
        public required string JobId { get; init; }
        public required string DeviceId { get; init; }
        public required TeensyStorageType StorageType { get; init; }
        public required string DestinationDirectory { get; init; }
        public required TransferJobState State { get; init; }
        public required int FilesReceived { get; init; }   // uploads accepted into staging
        public required int FilesSent { get; init; }       // written to the device successfully
        public required int FilesFailed { get; init; }
        public required long BytesSent { get; init; }
        public int? TotalFiles { get; init; }               // null until sealed; then FilesReceived
        public string? CurrentFile { get; init; }            // relative path being written, or null
        public required DateTime StartedUtc { get; init; }
        public required DateTime LastActivityUtc { get; init; }
        public string? Error { get; init; }                  // set on Aborted

        /// <summary>
        /// The first <c>RetainedFailuresBound</c> failures, oldest-first (insertion order). The earliest
        /// failures in a run are the diagnostically useful ones; the end-of-job summary reports the true
        /// total via <see cref="FilesFailed"/> and an "and N more" overflow beyond what this list holds.
        /// </summary>
        public required IReadOnlyList<TransferFileCompleted> Failures { get; init; }

        /// <summary>
        /// The last <c>RecentCompletionsBound</c> completions - successes and failures alike - newest
        /// first. A liveness indicator for the live activity feed, not a record: a failure past the
        /// <see cref="Failures"/> bound can still appear here, and will eventually age out of here too.
        /// </summary>
        public required IReadOnlyList<TransferFileCompleted> RecentCompletions { get; init; }

        /// <summary>Rolling bytes/second while active; the lifetime average once terminal. 0 when idle.</summary>
        public required double BytesPerSecond { get; init; }

        /// <summary>Rolling files/second while active; the lifetime average once terminal. 0 when idle.</summary>
        public required double FilesPerSecond { get; init; }

        public string? ExpandingArchive { get; init; }        // relative path; null when nothing is expanding
        public long ExpansionBytesWritten { get; init; }
        public long ExpansionBytesDeclared { get; init; }
        public int? ExpandedFileCount { get; init; }          // null until every archive has finished
    }
}
