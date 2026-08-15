using System.Collections.Concurrent;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Walks one top-level archive and everything nested inside it, iteratively and never by call
    /// recursion, admitting its contents to staging only once the job's last archive has finished
    /// expanding. See <see cref="ExpandAsync"/> for the walk itself; the private helpers below implement
    /// one rule each from the task's own "The change" contract.
    /// </summary>
    public sealed class ArchiveExpansionService(
        IArchiveReader reader,
        ITransferScratchStore scratch,
        ITransferAdmission admission,
        ITransferJobRegistry registry,
        TransferOptions options,
        ILoggingService log)
    {
        /// <summary>
        /// Mirrors <c>TRANSFER_SUPPORTED_EXTENSIONS</c> in
        /// <c>libs/application/src/lib/transfer/transfer.constants.ts</c> - the browser's own drop-scan
        /// filter - so an archive's contents are admitted exactly like a dropped folder's contents.
        /// Deliberately not <see cref="TeensyRom.Core.Entities.Storage.StorageHelper.FileTargets"/>: that
        /// list mis-maps `.nfo` to D64 and carries no `.zip`. `.zip` is included here for fidelity with the
        /// browser list even though <see cref="IArchiveReader.IsArchiveExtension"/> always intercepts it
        /// first and routes it to the nested-archive branch instead of this one.
        /// </summary>
        private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".sid", ".crt", ".prg", ".p00", ".hex", ".kla", ".koa", ".art", ".aas", ".hpi", ".seq", ".txt", ".d64", ".zip"
        };

        // Keyed by job id. A job's archives are processed one at a time on the global queue, so whichever
        // archive turns out to be the last one (HasExpansionOutstanding going false) drains everything
        // every archive before it produced - not just its own.
        private readonly ConcurrentDictionary<string, ConcurrentQueue<ProducedEntry>> _producedByJob = new();

        private sealed record ProducedEntry(string ScratchPath, string RelativePath, long SizeBytes);

        private sealed record WorkItem(string ScratchArchivePath, string ContentPrefix, string DisplayPath, int Depth);

        /// Signals "stop reading this archive" from inside the <see cref="IArchiveReader.ExtractAsync"/>
        /// callback without unwinding the whole walk - caught around that call and turned into one
        /// archive-level failure, the same way a corrupt read is.
        private sealed class ArchiveVolumeExceededException : Exception;

        /// <summary>
        /// Resolves <paramref name="request"/>'s job, walks its archive tree, and - once no more of the
        /// job's archives are outstanding - releases held uploads and admits everything the walk produced.
        /// </summary>
        public async Task ExpandAsync(ArchiveExpansionRequest request, CancellationToken ct)
        {
            var job = registry.Get(request.JobId);

            if (job is null)
            {
                // Cancelled, abandoned, or swept while this request sat in the channel. Nothing else will
                // ever consume this archive, so its whole scratch presence for this job - this file and
                // anything else still queued for the same dead job - is reclaimed in one call rather than
                // guessed at piecemeal.
                scratch.PurgeJob(request.JobId);
                return;
            }

            try
            {
                await WalkAsync(job, request, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // A failure outside any single work item's own handling (e.g. the stack bookkeeping
                // itself) must still fail only this archive, not the job - the walk continuing is
                // meaningless past this point since the stack is local and unrecoverable, but the job
                // itself must not hang, so it is recorded exactly like any other archive failure.
                log.InternalError($"ArchiveExpansionService: unexpected failure expanding '{request.ArchiveRelativePath}' for job '{job.JobId}': {ex.Message}");
                job.OnExpansionFailure(new TransferFileCompleted(job.JobId, request.ArchiveRelativePath, request.ArchiveRelativePath, false, ex.Message, 0));
            }
            finally
            {
                // Exactly once per accepted archive - the PendingCount slot OnFileReceived took when it
                // was uploaded. Runs whatever the outcome, so a throw still releases it.
                job.OnArchiveExpansionFinished();
            }

            if (job.HasExpansionOutstanding)
            {
                // Another archive for this job is still mid-expansion or still inbound. Releasing now
                // would start the device write and publish a total that then grows.
                return;
            }

            await admission.ReleaseHeldAsync(job.JobId, ct);
            await AdmitProducedAsync(job, ct);
        }

        private async Task WalkAsync(TransferJob job, ArchiveExpansionRequest request, CancellationToken ct)
        {
            // Scoped to one top-level request, matching ArchiveEntryPathSet's own "one expansion" doc and
            // TransferOptions.MaxExpandedBytesPerArchive's "recursion included" cumulative ceiling.
            var pathSet = new ArchiveEntryPathSet();
            var work = new Stack<WorkItem>();
            var cumulativeBytes = 0L;

            work.Push(new WorkItem(
                request.ScratchArchivePath,
                ContentPrefixFor(request.ArchiveRelativePath),
                request.ArchiveRelativePath,
                Depth: 0));

            // An explicit stack, not call recursion - MaxExpansionDepth defaults far above any legitimate
            // nesting so it never refuses a real archive, which means depth must never cost a stack frame.
            while (work.Count > 0)
            {
                var item = work.Pop();
                cumulativeBytes = await ProcessArchiveAsync(job, item, work, pathSet, cumulativeBytes, ct);
            }
        }

        private async Task<long> ProcessArchiveAsync(
            TransferJob job, WorkItem item, Stack<WorkItem> work, ArchiveEntryPathSet pathSet, long cumulativeBytes, CancellationToken ct)
        {
            try
            {
                if (item.Depth > options.MaxExpansionDepth)
                {
                    FailArchive(job, item.DisplayPath, "Archive nesting exceeds the maximum allowed depth.");
                    return cumulativeBytes;
                }

                ArchiveIndex index;

                try
                {
                    index = reader.ReadIndex(item.ScratchArchivePath);
                }
                catch (ArchiveReadException ex)
                {
                    log.InternalWarning($"ArchiveExpansionService: failed to read '{item.DisplayPath}': {ex.Message}");
                    FailArchive(job, item.DisplayPath, ex.Message);
                    return cumulativeBytes;
                }

                if (cumulativeBytes + index.DeclaredUncompressedBytes > options.MaxExpandedBytesPerArchive)
                {
                    FailArchive(job, item.DisplayPath, "Expanded volume exceeds the maximum allowed for one archive.", index.DeclaredUncompressedBytes);
                    return cumulativeBytes;
                }

                if (!scratch.TryReserve(job.JobId, index.DeclaredUncompressedBytes))
                {
                    FailArchive(job, item.DisplayPath, "Insufficient scratch space to expand this archive.", index.DeclaredUncompressedBytes);
                    return cumulativeBytes;
                }

                // The name changing and the bar resetting are the same event - this fires for every
                // archive the walk enters, top-level or nested, so the UI always names the one currently
                // being read.
                job.OnArchiveExpansionStarted(item.DisplayPath, index.DeclaredUncompressedBytes);

                await ExtractArchiveAsync(job, item, index, work, pathSet, ct);

                return cumulativeBytes + index.DeclaredUncompressedBytes;
            }
            finally
            {
                // This archive's own file is never read again after this point, whatever the outcome.
                DeleteScratchFile(item.ScratchArchivePath);
            }
        }

        private async Task ExtractArchiveAsync(
            TransferJob job, WorkItem item, ArchiveIndex index, Stack<WorkItem> work, ArchiveEntryPathSet pathSet, CancellationToken ct)
        {
            var written = 0L;
            var producedBytes = 0L;
            var lastReportedPercent = -1;

            try
            {
                await reader.ExtractAsync(item.ScratchArchivePath, async (entry, stream, entryCt) =>
                {
                    if (entry.IsSymlink)
                    {
                        // Resolve-then-check is impossible for a link that has not been written, and a
                        // check that cannot resolve can be laundered - refuse outright.
                        FailEntry(job, entry.Path, "Symlinked archive entries are not supported.", entry.DeclaredSizeBytes);
                        return;
                    }

                    if (!ArchiveEntryPathResolver.TryResolve(entry.Path, out var relativePath, out var resolveError))
                    {
                        FailEntry(job, entry.Path, resolveError!, entry.DeclaredSizeBytes);
                        return;
                    }

                    var isNestedArchive = reader.IsArchiveExtension(entry.Path);
                    var isSupported = SupportedExtensions.Contains(Path.GetExtension(entry.Path));

                    if (!isNestedArchive && !isSupported)
                    {
                        // A `.doc` inside a collection is not an error - never copied, so it costs nothing
                        // and never counts against this archive's declared-byte budget.
                        return;
                    }

                    var targetPath = item.ContentPrefix + relativePath;

                    if (!pathSet.TryAdd(targetPath))
                    {
                        FailEntry(job, targetPath, "Another entry already produced this path, differing only in case.", entry.DeclaredSizeBytes);
                        return;
                    }

                    var scratchPath = scratch.NewScratchFilePath(job.JobId);
                    var actualBytes = await CopyEntryToScratchAsync(stream, scratchPath, entryCt);

                    if (written + actualBytes > index.DeclaredUncompressedBytes)
                    {
                        // Enforced during extraction, not only against the up-front declaration - reading
                        // the declaration without enforcing it here would be decorative.
                        DeleteScratchFile(scratchPath);
                        throw new ArchiveVolumeExceededException();
                    }

                    written += actualBytes;
                    lastReportedPercent = ReportProgress(job, written, index.DeclaredUncompressedBytes, lastReportedPercent);

                    if (isNestedArchive)
                    {
                        work.Push(new WorkItem(scratchPath, ContentPrefixFor(targetPath), targetPath, item.Depth + 1));
                    }
                    else
                    {
                        EnqueueProduced(job.JobId, scratchPath, targetPath, actualBytes);
                        producedBytes += actualBytes;
                    }
                }, ct);
            }
            catch (ArchiveVolumeExceededException)
            {
                FailArchive(job, item.DisplayPath, "Archive contents exceed its own declared uncompressed size.", index.DeclaredUncompressedBytes);
            }
            catch (ArchiveReadException ex)
            {
                log.InternalWarning($"ArchiveExpansionService: failed mid-extraction for '{item.DisplayPath}': {ex.Message}");
                FailArchive(job, item.DisplayPath, ex.Message, index.DeclaredUncompressedBytes);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.InternalError($"ArchiveExpansionService: unexpected failure extracting '{item.DisplayPath}': {ex.Message}");
                FailArchive(job, item.DisplayPath, ex.Message, index.DeclaredUncompressedBytes);
            }
            finally
            {
                // Everything this archive wrote to scratch is covered by its own reservation except the
                // portion now sitting in the produced list - that portion stays reserved until admission
                // releases it, or scratch pressure would read as though the whole tree were already gone.
                scratch.Release(job.JobId, index.DeclaredUncompressedBytes - producedBytes);
            }
        }

        /// <summary>
        /// An archive becomes a folder of its own name minus its extension, at the position it occupied -
        /// applied uniformly whether <paramref name="archiveRelativePath"/> names the top-level request or
        /// a nested archive discovered mid-walk.
        /// </summary>
        private static string ContentPrefixFor(string archiveRelativePath)
        {
            var extension = Path.GetExtension(archiveRelativePath);
            var withoutExtension = extension.Length > 0
                ? archiveRelativePath[..^extension.Length]
                : archiveRelativePath;

            return withoutExtension + "/";
        }

        private static async Task<long> CopyEntryToScratchAsync(Stream source, string scratchPath, CancellationToken ct)
        {
            await using var destination = File.Create(scratchPath);
            await source.CopyToAsync(destination, ct);
            return destination.Length;
        }

        /// Throttled to whole-percent changes so a 60,000-entry archive does not mark the job dirty 60,000
        /// times; the notifier's own 250 ms throttle handles the rest.
        private static int ReportProgress(TransferJob job, long written, long declaredBytes, int lastReportedPercent)
        {
            var percent = declaredBytes <= 0 ? 100 : (int)Math.Min(100, written * 100 / declaredBytes);

            if (percent == lastReportedPercent)
            {
                return lastReportedPercent;
            }

            job.OnArchiveExpansionProgress(written);
            return percent;
        }

        private void EnqueueProduced(string jobId, string scratchPath, string relativePath, long sizeBytes) =>
            _producedByJob.GetOrAdd(jobId, _ => new ConcurrentQueue<ProducedEntry>())
                .Enqueue(new ProducedEntry(scratchPath, relativePath, sizeBytes));

        /// <summary>
        /// Streams every entry this job's whole archive tree produced from scratch into staging, deleting
        /// and releasing each scratch file as it lands. Never runs while any archive is still outstanding -
        /// see <see cref="ExpandAsync"/>.
        /// </summary>
        private async Task AdmitProducedAsync(TransferJob job, CancellationToken ct)
        {
            if (!_producedByJob.TryRemove(job.JobId, out var queue))
            {
                return;
            }

            while (queue.TryDequeue(out var entry))
            {
                try
                {
                    using var content = File.OpenRead(entry.ScratchPath);
                    var result = await admission.AdmitAsync(job, content, entry.RelativePath, entry.SizeBytes, countAsReceived: false, ct);

                    if (!result.Accepted)
                    {
                        FailEntry(job, entry.RelativePath, result.Error ?? "Admission refused this extracted entry.", entry.SizeBytes);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.InternalError($"ArchiveExpansionService: failed to admit extracted entry '{entry.RelativePath}' for job '{job.JobId}': {ex.Message}");
                    FailEntry(job, entry.RelativePath, ex.Message, entry.SizeBytes);
                }
                finally
                {
                    scratch.Release(job.JobId, entry.SizeBytes);
                    DeleteScratchFile(entry.ScratchPath);
                }
            }
        }

        private static void FailArchive(TransferJob job, string displayPath, string error, long sizeBytes = 0) =>
            job.OnExpansionFailure(new TransferFileCompleted(job.JobId, displayPath, displayPath, false, error, sizeBytes));

        private static void FailEntry(TransferJob job, string relativePath, string error, long sizeBytes) =>
            job.OnExpansionFailure(new TransferFileCompleted(job.JobId, relativePath, relativePath, false, error, sizeBytes));

        private void DeleteScratchFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                log.InternalWarning($"ArchiveExpansionService: failed to delete scratch file '{path}': {ex.Message}");
            }
        }
    }
}
