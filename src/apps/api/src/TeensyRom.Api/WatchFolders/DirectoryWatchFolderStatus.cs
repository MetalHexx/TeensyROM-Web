using TeensyRom.Core.Settings;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Derives a watch folder's state from its settings and whether its directory exists.
    /// </summary>
    public sealed class DirectoryWatchFolderStatus : IWatchFolderStatus
    {
        public WatchFolderState GetState(WatchFolder folder)
        {
            if (!folder.Enabled) return WatchFolderState.Off;

            return Directory.Exists(folder.Path) ? WatchFolderState.Watching : WatchFolderState.Unavailable;
        }
    }
}
