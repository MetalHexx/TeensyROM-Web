namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// What is at a path. <c>Readable</c> means the file opens with <c>FileAccess.Read, FileShare.Read</c>, which denies
    /// other writers, so a file another process still holds open for writing is not readable.
    /// </summary>
    public sealed record FileProbe(bool Exists, bool IsDirectory, long Size, bool Readable, bool IsLink);

    /// <summary>The read-only view of the file system the watcher needs; the seam that keeps tests off real files.</summary>
    public interface IWatchedFileSystem
    {
        bool DirectoryExists(string path);

        FileProbe Probe(string path);

        /// <summary>Every file under <paramref name="directory"/>, recursively; links, hidden and system entries are skipped.</summary>
        IEnumerable<string> EnumerateFiles(string directory);

        /// <summary>Opens the file for reading without blocking its writers.</summary>
        Stream OpenRead(string path);
    }
}
