using System.Collections.Concurrent;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Holds archive expansion output under its own root and byte ceiling. Mirrors
    /// <see cref="TransferStagingStore"/>'s opaque-filename, best-effort-delete, per-job-directory shape,
    /// but <see cref="TryReserve"/> refuses instead of waiting — see the interface doc for why.
    /// </summary>
    public sealed class TransferScratchStore : ITransferScratchStore
    {
        private readonly TransferOptions _options;
        private readonly ILoggingService _log;
        private readonly ConcurrentDictionary<string, int> _fileCounters = new();
        private readonly ConcurrentDictionary<string, long> _jobReservations = new();
        private readonly object _byteLock = new();
        private long _bytesInUse;

        public string ScratchRoot => _options.ScratchRoot;

        public long BytesInUse
        {
            get
            {
                lock (_byteLock)
                {
                    return _bytesInUse;
                }
            }
        }

        public TransferScratchStore(TransferOptions options, ILoggingService log)
        {
            _options = options;
            _log = log;
        }

        public string EnsureJobDirectory(string jobId)
        {
            var jobDir = Path.Combine(ScratchRoot, jobId);
            Directory.CreateDirectory(jobDir);
            return jobDir;
        }

        public bool TryReserve(string jobId, long bytes)
        {
            lock (_byteLock)
            {
                if (_bytesInUse + bytes > _options.MaxScratchBytes)
                {
                    return false;
                }

                _bytesInUse += bytes;
                _jobReservations.AddOrUpdate(jobId, bytes, (_, current) => current + bytes);
                return true;
            }
        }

        public void Release(string jobId, long bytes)
        {
            lock (_byteLock)
            {
                _bytesInUse -= bytes;
                _jobReservations.AddOrUpdate(jobId, 0, (_, current) => current - bytes);
            }
        }

        public string NewScratchFilePath(string jobId)
        {
            var jobDir = Path.Combine(ScratchRoot, jobId);
            var index = _fileCounters.AddOrUpdate(jobId, 0, (_, current) => current + 1);
            return Path.Combine(jobDir, $"{index}.bin");
        }

        public void PurgeJob(string jobId)
        {
            var jobDir = Path.Combine(ScratchRoot, jobId);

            try
            {
                if (Directory.Exists(jobDir))
                {
                    Directory.Delete(jobDir, recursive: true);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalWarning($"TransferScratchStore: failed to purge job directory '{jobDir}': {ex.Message}");
            }
            finally
            {
                _fileCounters.TryRemove(jobId, out _);

                lock (_byteLock)
                {
                    if (_jobReservations.TryRemove(jobId, out var outstanding))
                    {
                        _bytesInUse -= outstanding;
                    }
                }
            }
        }

        public void SweepAll()
        {
            lock (_byteLock)
            {
                _jobReservations.Clear();
                _bytesInUse = 0;
            }

            if (!Directory.Exists(ScratchRoot)) return;

            foreach (var entry in Directory.EnumerateFileSystemEntries(ScratchRoot))
            {
                try
                {
                    if (Directory.Exists(entry))
                    {
                        Directory.Delete(entry, recursive: true);
                    }
                    else
                    {
                        File.Delete(entry);
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    _log.InternalWarning($"TransferScratchStore: failed to delete '{entry}' during sweep: {ex.Message}");
                }
            }
        }
    }
}
