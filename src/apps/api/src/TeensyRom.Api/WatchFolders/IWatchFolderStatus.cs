using TeensyRom.Core.Settings;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>What a watch folder is doing right now.</summary>
    public enum WatchFolderState
    {
        /// <summary>Enabled and its folder is being watched.</summary>
        Watching,

        /// <summary>Turned off by the user.</summary>
        Off,

        /// <summary>Enabled, but the folder cannot be watched (for example, it no longer exists).</summary>
        Unavailable
    }

    /// <summary>Reports the live state of watch folders.</summary>
    public interface IWatchFolderStatus
    {
        WatchFolderState GetState(WatchFolder folder);
    }
}
