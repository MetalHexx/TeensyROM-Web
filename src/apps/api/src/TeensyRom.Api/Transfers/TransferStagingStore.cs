using System.Collections.Concurrent;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    public sealed class TransferStagingStore : ITransferStagingStore
    {
        private const int CopyBufferSize = 81_920;

        private readonly TransferOptions _options;
        private readonly ILoggingService _log;
        private readonly ConcurrentDictionary<string, int> _fileCounters = new();

        public string StagingRoot => _options.StagingRoot;

        public TransferStagingStore(TransferOptions options, ILoggingService log)
        {
            _options = options;
            _log = log;
        }

        public async Task<string> StageAsync(string jobId, Stream body, CancellationToken ct)
        {
            var jobDir = Path.Combine(StagingRoot, jobId);
            Directory.CreateDirectory(jobDir);

            var index = _fileCounters.AddOrUpdate(jobId, 0, (_, current) => current + 1);
            var stagingPath = Path.Combine(jobDir, $"{index}.bin");

            try
            {
                await using var fs = new FileStream(
                    stagingPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                    bufferSize: CopyBufferSize, useAsync: true);

                await body.CopyToAsync(fs, ct);
            }
            catch
            {
                DeleteStagedFile(stagingPath);
                throw;
            }

            return stagingPath;
        }

        public void DeleteStagedFile(string stagingPath)
        {
            try
            {
                if (File.Exists(stagingPath))
                {
                    File.Delete(stagingPath);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalWarning($"TransferStagingStore: failed to delete staged file '{stagingPath}': {ex.Message}");
            }
        }

        public void PurgeJob(string jobId)
        {
            var jobDir = Path.Combine(StagingRoot, jobId);

            try
            {
                if (Directory.Exists(jobDir))
                {
                    Directory.Delete(jobDir, recursive: true);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _log.InternalWarning($"TransferStagingStore: failed to purge job directory '{jobDir}': {ex.Message}");
            }
            finally
            {
                _fileCounters.TryRemove(jobId, out _);
            }
        }

        public void SweepAll()
        {
            if (!Directory.Exists(StagingRoot)) return;

            foreach (var entry in Directory.EnumerateFileSystemEntries(StagingRoot))
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
                    _log.InternalWarning($"TransferStagingStore: failed to delete '{entry}' during sweep: {ex.Message}");
                }
            }
        }
    }
}
