namespace TeensyRom.Api.WatchFolders
{
    /// <inheritdoc cref="IFolderWatchFactory"/>
    public sealed class FileSystemFolderWatchFactory(WatchFolderOptions options) : IFolderWatchFactory
    {
        public IDisposable Watch(string folderPath, Action<FolderEvent> onEvent, Action<Exception> onError)
        {
            var watcher = new FileSystemWatcher(folderPath)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.Size | NotifyFilters.LastWrite,
                InternalBufferSize = options.EventBufferBytes
            };

            try
            {
                watcher.Created += (_, e) => onEvent(new FolderEvent(FolderEventKind.Created, e.FullPath));
                watcher.Changed += (_, e) => onEvent(new FolderEvent(FolderEventKind.Changed, e.FullPath));
                watcher.Renamed += (_, e) => onEvent(new FolderEvent(FolderEventKind.Renamed, e.FullPath, e.OldFullPath));
                watcher.Error += (_, e) => onError(e.GetException());

                watcher.EnableRaisingEvents = true;
                return watcher;
            }
            catch
            {
                watcher.Dispose();
                throw;
            }
        }
    }
}
