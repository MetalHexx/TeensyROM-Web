using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Mutable, internally locked state for a single file transfer. One instance per job; the pump,
    /// the upload endpoint, the abandonment sweep, and the hub notifier all touch it concurrently.
    /// </summary>
    public sealed class TransferJob
    {
        private readonly object _lock = new();
        private readonly List<TransferFileCompleted> _failures = [];
        private readonly DateTime _startedUtc;

        private int _filesReceived;
        private int _filesSent;
        private int _filesFailed;
        private long _bytesSent;
        private string? _currentFile;
        private string? _error;

        public string JobId { get; }
        public string DeviceId { get; }
        public TeensyStorageType StorageType { get; }
        public DirectoryPath Destination { get; }
        public TransferJobState State { get; private set; }
        public DateTime LastActivityUtc { get; private set; }
        public int PendingCount { get; private set; }

        public TransferJob(string deviceId, TeensyStorageType storageType, DirectoryPath destination)
        {
            JobId = Guid.NewGuid().ToString("N");
            DeviceId = deviceId;
            StorageType = storageType;
            Destination = destination;
            State = TransferJobState.Created;
            _startedUtc = DateTime.UtcNow;
            LastActivityUtc = _startedUtc;
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
                return true;
            }
        }

        private static bool IsLegalTransition(TransferJobState from, TransferJobState to) => (from, to) switch
        {
            (TransferJobState.Created, TransferJobState.Receiving) => true,
            (TransferJobState.Created, TransferJobState.Cancelling) => true,
            (TransferJobState.Created, TransferJobState.Abandoned) => true,
            (TransferJobState.Created, TransferJobState.Aborted) => true,
            (TransferJobState.Receiving, TransferJobState.Sealed) => true,
            (TransferJobState.Receiving, TransferJobState.Cancelling) => true,
            (TransferJobState.Receiving, TransferJobState.Abandoned) => true,
            (TransferJobState.Receiving, TransferJobState.Aborted) => true,
            (TransferJobState.Sealed, TransferJobState.Completed) => true,
            (TransferJobState.Sealed, TransferJobState.Cancelling) => true,
            (TransferJobState.Sealed, TransferJobState.Aborted) => true,
            (TransferJobState.Cancelling, TransferJobState.Cancelled) => true,
            _ => false
        };

        public void Touch()
        {
            lock (_lock)
            {
                LastActivityUtc = DateTime.UtcNow;
            }
        }

        public void OnFileReceived(long sizeBytes)
        {
            lock (_lock)
            {
                _filesReceived++;
                PendingCount++;
                LastActivityUtc = DateTime.UtcNow;
            }
        }

        public void OnFileSent(long sizeBytes)
        {
            lock (_lock)
            {
                _filesSent++;
                _bytesSent += sizeBytes;
                PendingCount--;
                LastActivityUtc = DateTime.UtcNow;
            }
        }

        public void OnFileFailed(TransferFileCompleted f)
        {
            lock (_lock)
            {
                _filesFailed++;
                PendingCount--;
                _failures.Add(f);
                LastActivityUtc = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// The pump's cancellation path: an item discarded at dequeue leaves the queue without counting
        /// as sent or failed, and must not make a draining, cancelled job look alive to the sweeper.
        /// </summary>
        public void OnFileDropped()
        {
            lock (_lock)
            {
                PendingCount--;
            }
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
                LastActivityUtc = DateTime.UtcNow;
            }
        }

        public TransferJobSnapshot ToSnapshot()
        {
            lock (_lock)
            {
                var canStillAcceptFiles = State is TransferJobState.Created or TransferJobState.Receiving;

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
                    Failures = _failures.ToArray()
                };
            }
        }
    }
}
