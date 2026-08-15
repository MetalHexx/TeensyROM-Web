namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Holds an archive's extracted tree during expansion, under its own root and byte ceiling separate
    /// from staging. <see cref="TryReserve"/> refuses rather than waits: unlike staged bytes, scratch bytes
    /// are only freed by the archive that reserved them finishing, so waiting here could deadlock an
    /// archive against its own reservation.
    /// </summary>
    public interface ITransferScratchStore
    {
        string ScratchRoot { get; }
        long BytesInUse { get; }

        /// Creates the job's scratch directory if absent; returns its absolute path.
        string EnsureJobDirectory(string jobId);

        /// Reserves against the scratch ceiling. Returns false immediately when it would be exceeded —
        /// it never waits.
        bool TryReserve(string jobId, long bytes);

        /// Returns bytes to the ceiling without deleting anything on disk.
        void Release(string jobId, long bytes);

        /// Allocates an opaque scratch file path under the job's directory. Never derived from an entry name.
        string NewScratchFilePath(string jobId);

        /// Best-effort delete of the job's scratch tree, releasing its entire outstanding reservation.
        void PurgeJob(string jobId);

        /// Best-effort delete of everything under the scratch root, zeroing every reservation. Startup only.
        void SweepAll();
    }
}
