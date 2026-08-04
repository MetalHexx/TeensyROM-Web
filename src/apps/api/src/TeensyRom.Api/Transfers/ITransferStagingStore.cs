namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Streams uploaded bodies to disk under an opaque, per-job path so the browser is never throttled
    /// by device write speed. Staged filenames are a monotonic counter, never the client-supplied name —
    /// the client's relative path travels separately on <see cref="TeensyRom.Core.Entities.Transfers.StagedFile"/>.
    /// This removes host-side path traversal as a category rather than defending against it.
    /// </summary>
    public interface ITransferStagingStore
    {
        /// Streams <paramref name="body"/> to &lt;StagingRoot&gt;/&lt;jobId&gt;/&lt;n&gt;.bin; returns the absolute staged path.
        Task<string> StageAsync(string jobId, Stream body, CancellationToken ct);

        /// Best-effort delete of a single staged file.
        void DeleteStagedFile(string stagingPath);

        /// Best-effort delete of the whole per-job directory.
        void PurgeJob(string jobId);

        /// Best-effort delete of everything under the staging root. Called once at startup.
        void SweepAll();

        string StagingRoot { get; }
    }
}
