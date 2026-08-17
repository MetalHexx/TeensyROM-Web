using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Mutable, internally locked state for a single file transfer. One instance per job; the pump,
    /// the upload endpoint, the abandonment sweep, and the hub notifier all touch it concurrently.
    /// </summary>
    public sealed class TransferJob : IDisposable
    {
        /// <summary>
        /// Floor for the rate divisor so a burst of files completing within a few milliseconds of job
        /// start cannot collapse the divisor toward zero and blow the computed rate up unrealistically.
        /// </summary>
        private static readonly TimeSpan MinRateDivisor = TimeSpan.FromMilliseconds(100);

        private readonly object _lock = new();
        private readonly CancellationTokenSource _cancellation = new();
        private readonly List<TransferFileCompleted> _failures = [];
        private readonly Queue<TransferFileCompleted> _recentCompletions = new();
        private readonly Queue<(DateTime CompletedUtc, long SizeBytes)> _rateSamples = new();
        private readonly TransferOptions _options;
        private readonly Func<DateTime> _clock;
        private readonly DateTime _startedUtc;
        private readonly int _expectedArchiveCount; // from the browser at create time; 0 for an archive-free job

        private int _filesReceived;
        private int _filesSent;
        private int _filesFailed;
        private long _bytesSent;
        private string? _currentFile;
        private string? _error;
        private string? _expandingArchive;   // relative path of the archive currently being expanded
        private long _expansionBytesWritten; // for that archive only — resets when the next one starts
        private long _expansionBytesDeclared; // for that archive only
        private int _expandedFileCount;      // job-wide running total
        private int _archivesAccepted;       // archives uploaded and handed to expansion
        private int _archivesOutstanding;    // accepted but not yet finished expanding
        private int _archiveSlotsPendingRelease; // finished archives whose own PendingCount slot is still held

        public string JobId { get; }
        public string DeviceId { get; }
        public TeensyStorageType StorageType { get; }
        public DirectoryPath Destination { get; }
        public TransferJobState State { get; private set; }
        public DateTime LastActivityUtc { get; private set; }

        /// <summary>
        /// Work this job still owns: files staged and not yet written to the device, plus the slot each
        /// accepted archive holds until its expansion has admitted everything it produced. Purely
        /// informational once the job is terminal - nothing waits for it to reach zero, and the pump
        /// dropping a file whose job was cancelled mid-batch can legitimately drive it below zero.
        /// </summary>
        public int PendingCount { get; private set; }

        /// <summary>
        /// Signalled the moment this job is cancelled, so work already running on its behalf - an
        /// archive expansion mid-walk above all - stops instead of writing into a tree cancellation has
        /// already reclaimed. Cancellation only: the other terminal states either follow the work
        /// finishing or leave it to unwind on its own.
        /// </summary>
        public CancellationToken Cancellation { get; }

        /// <summary>
        /// <paramref name="clock"/> is a test seam only - production callers omit it and get the wall
        /// clock. It lets unit tests drive the rolling-rate window deterministically without sleeping.
        /// </summary>
        public TransferJob(
            string deviceId,
            TeensyStorageType storageType,
            DirectoryPath destination,
            TransferOptions options,
            Func<DateTime>? clock = null,
            int expectedArchiveCount = 0)
        {
            JobId = Guid.NewGuid().ToString("N");
            DeviceId = deviceId;
            StorageType = storageType;
            Destination = destination;
            _options = options;
            _clock = clock ?? (() => DateTime.UtcNow);
            _expectedArchiveCount = expectedArchiveCount;
            State = TransferJobState.Created;
            _startedUtc = _clock();
            LastActivityUtc = _startedUtc;

            // Captured once here rather than read from the source on demand: the registry disposes the
            // source when it evicts the job, and a disposed source refuses to hand out its token.
            Cancellation = _cancellation.Token;
        }

        /// <summary>
        /// Single source of truth for whether a job state accepts no further transitions.
        /// </summary>
        public static bool IsTerminal(TransferJobState state) =>
            state is TransferJobState.Completed
                or TransferJobState.Cancelled
                or TransferJobState.Abandoned
                or TransferJobState.Aborted;

        public bool TryTransitionTo(TransferJobState next)
        {
            lock (_lock)
            {
                if (!IsLegalTransition(State, next)) return false;

                State = next;
            }

            if (next is TransferJobState.Cancelled)
            {
                // Deliberately outside _lock: Cancel runs its registrations synchronously on this
                // thread, and anything they touch that takes _lock in turn would deadlock against this
                // very call. Only the caller that won the transition above ever reaches here, so the
                // source is signalled exactly once and never after the registry has disposed it.
                _cancellation.Cancel();
            }

            return true;
        }

        private static bool IsLegalTransition(TransferJobState from, TransferJobState to) => (from, to) switch
        {
            (TransferJobState.Created, TransferJobState.Receiving) => true,
            (TransferJobState.Created, TransferJobState.Cancelled) => true,
            (TransferJobState.Created, TransferJobState.Abandoned) => true,
            (TransferJobState.Created, TransferJobState.Aborted) => true,
            (TransferJobState.Receiving, TransferJobState.Sealed) => true,
            (TransferJobState.Receiving, TransferJobState.Cancelled) => true,
            (TransferJobState.Receiving, TransferJobState.Abandoned) => true,
            (TransferJobState.Receiving, TransferJobState.Aborted) => true,
            (TransferJobState.Sealed, TransferJobState.Completed) => true,
            (TransferJobState.Sealed, TransferJobState.Cancelled) => true,
            (TransferJobState.Sealed, TransferJobState.Aborted) => true,
            _ => false
        };

        public void Touch()
        {
            lock (_lock)
            {
                LastActivityUtc = _clock();
            }
        }

        public void OnFileReceived(long sizeBytes)
        {
            lock (_lock)
            {
                _filesReceived++;
                PendingCount++;
                LastActivityUtc = _clock();
            }
        }

        public void OnFileSent(TransferFileCompleted completed)
        {
            lock (_lock)
            {
                var now = _clock();

                _filesSent++;
                _bytesSent += completed.SizeBytes;
                PendingCount--;
                LastActivityUtc = now;
                RecordRateSample(now, completed.SizeBytes);
                RecordCompletion(completed);
            }
        }

        public void OnFileFailed(TransferFileCompleted f)
        {
            lock (_lock)
            {
                _filesFailed++;
                PendingCount--;

                // Bounded to the first RetainedFailuresBound - the earliest failures in a run are the
                // diagnostically useful ones - while _filesFailed above stays an unbounded plain
                // counter so the end-of-job summary's "and N more" overflow line stays accurate.
                if (_failures.Count < _options.RetainedFailuresBound)
                {
                    _failures.Add(f);
                }

                RecordCompletion(f);
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// The pump's discard path: an item dropped at dequeue leaves the queue without counting as sent
        /// or failed. A job cancelled while files were still queued for it drops those files after it is
        /// already terminal, so this can take <see cref="PendingCount"/> below zero - harmless, since
        /// nothing gates on the count once the job has stopped.
        /// </summary>
        public void OnFileDropped()
        {
            lock (_lock)
            {
                PendingCount--;
            }
        }

        /// <summary>
        /// An archive has been accepted for expansion. Raises both archive counters; does not touch
        /// <see cref="PendingCount"/> — <see cref="OnFileReceived"/> already took this archive's slot
        /// when it was uploaded.
        /// </summary>
        public void OnArchiveAccepted()
        {
            lock (_lock)
            {
                _archivesAccepted++;
                _archivesOutstanding++;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// Extraction of one archive begins. Resets the byte pair and names it — the name changing and
        /// the bar resetting are the same event, and that is what explains the reset to the user.
        /// </summary>
        public void OnArchiveExpansionStarted(string relativePath, long declaredUncompressedBytes)
        {
            lock (_lock)
            {
                _expandingArchive = relativePath;
                _expansionBytesWritten = 0;
                _expansionBytesDeclared = declaredUncompressedBytes;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// Absolute bytes written for the archive named by <see cref="OnArchiveExpansionStarted"/> —
        /// never a delta, so a retry cannot double-count.
        /// </summary>
        public void OnArchiveExpansionProgress(long uncompressedBytesWritten)
        {
            lock (_lock)
            {
                _expansionBytesWritten = uncompressedBytesWritten;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// One extracted entry has been admitted. Raises <see cref="PendingCount"/> and the expanded-file
        /// total; deliberately does NOT raise the received-file count — the entry was never uploaded. Must
        /// be called before <see cref="ReleaseFinishedArchiveSlots"/> runs for the archive that produced
        /// it, never after — see the ordering note there.
        /// </summary>
        public void OnEntryExpanded()
        {
            lock (_lock)
            {
                PendingCount++;
                _expandedFileCount++;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// A failure produced by expansion — a refused entry, a refused nested archive, an unreadable
        /// archive. Records it exactly as <see cref="OnFileFailed"/> does but WITHOUT decrementing
        /// <see cref="PendingCount"/>, because a refused entry never took a slot: routing it through
        /// <see cref="OnFileFailed"/> would decrement against nothing and drive <see cref="PendingCount"/>
        /// negative.
        /// </summary>
        public void OnExpansionFailure(TransferFileCompleted f)
        {
            lock (_lock)
            {
                _filesFailed++;

                if (_failures.Count < _options.RetainedFailuresBound)
                {
                    _failures.Add(f);
                }

                RecordCompletion(f);
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// This archive's walk is done, successfully or not. Clears the in-progress archive name and
        /// lowers the outstanding-archive count immediately, so <see cref="HasExpansionOutstanding"/>
        /// reflects it right away. Deliberately does NOT release the archive's own <see cref="PendingCount"/>
        /// slot — the one <see cref="OnFileReceived"/> took when it was uploaded — that release is deferred
        /// to <see cref="ReleaseFinishedArchiveSlots"/>. Releasing it here instead would let
        /// <see cref="PendingCount"/> touch zero before this archive's entries are admitted, and the pump
        /// would complete a job that is still mid-expansion. Exactly once per accepted archive, whatever
        /// the outcome.
        /// </summary>
        public void OnArchiveExpansionFinished()
        {
            lock (_lock)
            {
                _expandingArchive = null;
                _archivesOutstanding--;
                _archiveSlotsPendingRelease++;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// Releases every archive slot <see cref="OnArchiveExpansionFinished"/> has deferred, all at once.
        /// The caller — <see cref="Archives.ArchiveExpansionService.ExpandAsync"/> — must call this only
        /// after admitting (or failing) every entry every finished archive produced; that ordering is what
        /// keeps <see cref="PendingCount"/> from ever touching zero while an expanded entry is still
        /// sitting unadmitted.
        /// </summary>
        public void ReleaseFinishedArchiveSlots()
        {
            lock (_lock)
            {
                PendingCount -= _archiveSlotsPendingRelease;
                _archiveSlotsPendingRelease = 0;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// True once no further archives can arrive: the browser has sent all it said it would, or the
        /// job has been sealed — the backstop for an archive whose upload never succeeded.
        /// </summary>
        private bool NoMoreArchivesInbound =>
            _archivesAccepted >= _expectedArchiveCount || State is not (TransferJobState.Created or TransferJobState.Receiving);

        /// <summary>
        /// True while this job could still produce expanded entries — either an archive is mid-expansion,
        /// or one the browser promised has not arrived yet. NOT just <c>_archivesOutstanding &gt; 0</c>:
        /// between two archives that would read false, releasing the device write and publishing a total
        /// that then grows.
        /// </summary>
        public bool HasExpansionOutstanding
        {
            get { lock (_lock) return _archivesOutstanding > 0 || !NoMoreArchivesInbound; }
        }

        public void SetCurrentFile(string? relativePath)
        {
            lock (_lock)
            {
                _currentFile = relativePath;
            }
        }

        public void Abort(string error)
        {
            lock (_lock)
            {
                if (!IsLegalTransition(State, TransferJobState.Aborted)) return;

                State = TransferJobState.Aborted;
                _error = error;
                LastActivityUtc = _clock();
            }
        }

        /// <summary>
        /// The live activity feed: keeps only the last <see cref="TransferOptions.RecentCompletionsBound"/>
        /// completions - successes and failures alike, in completion order - dropping the oldest once the
        /// bound is exceeded. Deliberately a different retention policy than <see cref="_failures"/>: this
        /// list is a liveness indicator, not a record, so it always favors what happened most recently.
        /// </summary>
        private void RecordCompletion(TransferFileCompleted completed)
        {
            _recentCompletions.Enqueue(completed);

            while (_recentCompletions.Count > _options.RecentCompletionsBound)
            {
                _recentCompletions.Dequeue();
            }
        }

        /// <summary>
        /// Appends one throughput sample and evicts anything older than
        /// <see cref="TransferOptions.RateWindow"/>. Memory is bounded by the window's duration, not the
        /// job's lifetime.
        /// </summary>
        private void RecordRateSample(DateTime completedUtc, long sizeBytes)
        {
            _rateSamples.Enqueue((completedUtc, sizeBytes));
            PruneRateSamples(completedUtc);
        }

        private void PruneRateSamples(DateTime asOfUtc)
        {
            while (_rateSamples.Count > 0 && asOfUtc - _rateSamples.Peek().CompletedUtc > _options.RateWindow)
            {
                _rateSamples.Dequeue();
            }
        }

        /// <summary>
        /// Rolling throughput while the job is active; the lifetime average once it is terminal. Must be
        /// called under <see cref="_lock"/>.
        /// </summary>
        private (double BytesPerSecond, double FilesPerSecond) ComputeRates()
        {
            if (IsTerminal(State))
            {
                var elapsedSeconds = Math.Max((LastActivityUtc - _startedUtc).TotalSeconds, MinRateDivisor.TotalSeconds);
                return (_bytesSent / elapsedSeconds, _filesSent / elapsedSeconds);
            }

            var now = _clock();
            PruneRateSamples(now);

            if (_rateSamples.Count == 0)
            {
                // No samples inside the window: report zero rather than the last computed value - a
                // stalled transfer must look stalled.
                return (0, 0);
            }

            var sinceStart = now - _startedUtc;
            var divisor = sinceStart < _options.RateWindow ? sinceStart : _options.RateWindow;
            var divisorSeconds = Math.Max(divisor.TotalSeconds, MinRateDivisor.TotalSeconds);

            long windowBytes = 0;
            foreach (var sample in _rateSamples)
            {
                windowBytes += sample.SizeBytes;
            }

            return (windowBytes / divisorSeconds, _rateSamples.Count / divisorSeconds);
        }

        public TransferJobSnapshot ToSnapshot()
        {
            lock (_lock)
            {
                var canStillAcceptFiles = State is TransferJobState.Created or TransferJobState.Receiving;
                var (bytesPerSecond, filesPerSecond) = ComputeRates();

                return new TransferJobSnapshot
                {
                    JobId = JobId,
                    DeviceId = DeviceId,
                    StorageType = StorageType,
                    DestinationDirectory = Destination.Value,
                    State = State,
                    FilesReceived = _filesReceived,
                    FilesSent = _filesSent,
                    FilesFailed = _filesFailed,
                    BytesSent = _bytesSent,
                    TotalFiles = canStillAcceptFiles ? null : _filesReceived,
                    CurrentFile = _currentFile,
                    StartedUtc = _startedUtc,
                    LastActivityUtc = LastActivityUtc,
                    Error = _error,
                    Failures = _failures.ToArray(),
                    RecentCompletions = _recentCompletions.Reverse().ToArray(),
                    BytesPerSecond = bytesPerSecond,
                    FilesPerSecond = filesPerSecond,
                    ExpandingArchive = _expandingArchive,
                    ExpansionBytesWritten = _expansionBytesWritten,
                    ExpansionBytesDeclared = _expansionBytesDeclared,
                    // Null until no further archives can arrive AND none is still expanding. The browser
                    // composes the job's expected total from this; a count published while an archive is
                    // still inbound gives it a total that grows, which is the exact backwards movement the
                    // design forbids. Gating on _archivesOutstanding == 0 alone leaks a wrong value twice —
                    // before the first archive has finished uploading, and in the gap between one archive
                    // finishing and the next arriving.
                    ExpandedFileCount = HasExpansionOutstanding ? null : _expandedFileCount
                };
            }
        }

        /// <summary>
        /// Releases the job's cancellation source. Called by <see cref="ITransferJobRegistry.Remove"/>
        /// when a terminal job is evicted - the job is unreachable from that point on.
        /// </summary>
        public void Dispose() => _cancellation.Dispose();
    }
}
