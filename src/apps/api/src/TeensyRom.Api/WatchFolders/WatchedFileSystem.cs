namespace TeensyRom.Api.WatchFolders
{
    /// <inheritdoc cref="IWatchedFileSystem"/>
    public sealed class WatchedFileSystem : IWatchedFileSystem
    {
        private const int StreamBufferSize = 81_920;

        // Links are never followed, so a walk can't leave the watched folder or loop; hidden and system files (.DS_Store, Thumbs.db) stay home.
        private static readonly EnumerationOptions WalkOptions = new()
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = true,
            AttributesToSkip = FileAttributes.Hidden | FileAttributes.System | FileAttributes.ReparsePoint
        };

        public bool DirectoryExists(string path) => Directory.Exists(path);

        public FileProbe Probe(string path)
        {
            try
            {
                var attributes = File.GetAttributes(path);
                var isLink = attributes.HasFlag(FileAttributes.ReparsePoint);

                if (attributes.HasFlag(FileAttributes.Directory))
                {
                    return new FileProbe(Exists: true, IsDirectory: true, Size: 0, Readable: false, isLink);
                }

                var size = new FileInfo(path).Length;
                return new FileProbe(Exists: true, IsDirectory: false, size, !isLink && CanRead(path), isLink);
            }
            catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
            {
                return new FileProbe(Exists: false, IsDirectory: false, Size: 0, Readable: false, IsLink: false);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // Something is there but cannot be inspected right now: report it as present and unreadable so the caller keeps waiting.
                return new FileProbe(Exists: true, IsDirectory: false, Size: 0, Readable: false, IsLink: false);
            }
        }

        public IEnumerable<string> EnumerateFiles(string directory) =>
            Directory.EnumerateFiles(directory, "*", WalkOptions);

        public Stream OpenRead(string path) =>
            new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, StreamBufferSize, FileOptions.Asynchronous | FileOptions.SequentialScan);

        private static bool CanRead(string path)
        {
            try
            {
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
                return true;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return false;
            }
        }
    }
}
