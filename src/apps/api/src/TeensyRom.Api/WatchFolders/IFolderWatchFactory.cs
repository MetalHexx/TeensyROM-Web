namespace TeensyRom.Api.WatchFolders
{
    public enum FolderEventKind { Created, Changed, Renamed }

    /// <summary>
    /// One file-system event. For <see cref="FolderEventKind.Renamed"/>, <c>FullPath</c> is the new path and
    /// <c>OldFullPath</c> the old one; other kinds carry no old path.
    /// </summary>
    public sealed record FolderEvent(FolderEventKind Kind, string FullPath, string? OldFullPath = null);

    /// <summary>Starts file-system watches; the seam that keeps tests off a real <see cref="FileSystemWatcher"/>.</summary>
    public interface IFolderWatchFactory
    {
        /// <summary>
        /// Starts watching <paramref name="folderPath"/> and its subfolders. <paramref name="onError"/> gets watcher errors,
        /// a buffer overflow (<see cref="InternalBufferOverflowException"/>) included. Disposing stops the watch.
        /// </summary>
        IDisposable Watch(string folderPath, Action<FolderEvent> onEvent, Action<Exception> onError);
    }
}
