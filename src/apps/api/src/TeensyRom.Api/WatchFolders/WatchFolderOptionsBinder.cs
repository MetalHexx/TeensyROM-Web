using Microsoft.Extensions.Configuration;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Binds the "WatchFolders" configuration section onto a fresh <see cref="WatchFolderOptions"/> and puts
    /// any non-positive value back to its default, so a misconfigured section can never produce a hot loop.
    /// </summary>
    public static class WatchFolderOptionsBinder
    {
        public static WatchFolderOptions BindFrom(IConfiguration configuration)
        {
            var defaults = new WatchFolderOptions();
            var options = new WatchFolderOptions();

            configuration.GetSection("WatchFolders").Bind(options);

            options.SettleTime = Positive(options.SettleTime, defaults.SettleTime);
            options.PollInterval = Positive(options.PollInterval, defaults.PollInterval);
            options.GroupingWindow = Positive(options.GroupingWindow, defaults.GroupingWindow);
            options.MaxSetHold = Positive(options.MaxSetHold, defaults.MaxSetHold);
            options.UnavailableRetryInterval = Positive(options.UnavailableRetryInterval, defaults.UnavailableRetryInterval);
            options.EventBufferBytes = options.EventBufferBytes > 0 ? options.EventBufferBytes : defaults.EventBufferBytes;

            return options;
        }

        private static TimeSpan Positive(TimeSpan value, TimeSpan fallback) => value > TimeSpan.Zero ? value : fallback;
    }
}
