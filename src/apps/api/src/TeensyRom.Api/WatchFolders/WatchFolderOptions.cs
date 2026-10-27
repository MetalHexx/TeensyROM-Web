namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Every tuning constant of the watch-folder watcher. Registered as a singleton; every property is
    /// settable so tests can override it. No other code may re-declare one of these values as a literal.
    /// </summary>
    public sealed class WatchFolderOptions
    {
        /// How long a file's size must stay unchanged, and the file stay readable, before it counts as arrived.
        public TimeSpan SettleTime { get; set; } = TimeSpan.FromSeconds(2);

        /// How often pending files are probed.
        public TimeSpan PollInterval { get; set; } = TimeSpan.FromMilliseconds(500);

        /// The quiet gap, with nothing new settling, that closes a set.
        public TimeSpan GroupingWindow { get; set; } = TimeSpan.FromSeconds(3);

        /// The longest a set waits on files that are still being written, counted from when it opened.
        public TimeSpan MaxSetHold { get; set; } = TimeSpan.FromMinutes(2);

        /// How often a folder that cannot be watched is retried, and a watched folder is checked for being gone.
        public TimeSpan UnavailableRetryInterval { get; set; } = TimeSpan.FromSeconds(10);

        /// <see cref="FileSystemWatcher.InternalBufferSize"/> of each watch.
        public int EventBufferBytes { get; set; } = 64 * 1024;
    }
}
