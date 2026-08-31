namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Lists and streams the contents of a `.zip`, `.7z`, or `.rar` archive without ever holding more
    /// than one decompressed entry in memory at a time. The index feeds the disk-budget guard and the
    /// progress bar's denominator before anything is expanded; the stream keeps peak memory flat
    /// regardless of archive size during expansion itself.
    /// </summary>
    public interface IArchiveReader
    {
        /// Case-insensitive extension test against .zip / .7z / .rar. Pure — no file access.
        bool IsArchiveExtension(string relativePath);

        /// Reads the index without decompressing. Throws <see cref="ArchiveReadException"/> for corrupt,
        /// truncated, encrypted, or type-mismatched archives.
        ArchiveIndex ReadIndex(string archivePath);

        /// <summary>
        /// Streams each non-directory entry in archive order. The reader owns the stream's lifetime —
        /// the callback must not retain it past its own completion.
        /// </summary>
        Task ExtractAsync(
            string archivePath,
            Func<ArchiveEntryInfo, Stream, CancellationToken, Task> onEntry,
            CancellationToken ct);
    }
}
