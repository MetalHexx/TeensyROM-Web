namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// One entry as declared by an archive's own index — no bytes read, no compression touched.
    /// </summary>
    public sealed record ArchiveEntryInfo(string Path, long DeclaredSizeBytes, bool IsDirectory, bool IsSymlink);

    /// <summary>
    /// An archive's full entry list plus the sum of every non-directory entry's declared size — the
    /// disk-budget guard's admission check and the progress bar's denominator both read from here.
    /// </summary>
    public sealed record ArchiveIndex(
        IReadOnlyList<ArchiveEntryInfo> Entries,
        long DeclaredUncompressedBytes);

    /// <summary>
    /// Raised for any archive <see cref="IArchiveReader"/> cannot honor — corrupt, truncated, encrypted,
    /// or type-mismatched — so callers never see a library-specific exception type.
    /// </summary>
    public sealed class ArchiveReadException(string message) : Exception(message);
}
