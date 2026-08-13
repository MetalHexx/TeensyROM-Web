using Microsoft.Extensions.Configuration;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Binds the "Transfer" configuration section onto a fresh <see cref="TransferOptions"/> and clamps
    /// every tunable numeric/duration value to something sane, so a misconfigured or absent section can
    /// never produce a divide-by-zero, an always-empty bound, or a runaway hot loop.
    /// </summary>
    public static class TransferOptionsBinder
    {
        public static TransferOptions BindFrom(IConfiguration configuration)
        {
            var options = new TransferOptions();
            var defaultRateWindow = options.RateWindow;

            configuration.GetSection("Transfer").Bind(options);

            options.MaxStagedBytes = Math.Max(1, options.MaxStagedBytes);
            options.BatchSize = Math.Max(1, options.BatchSize);
            options.RecentCompletionsBound = Math.Max(1, options.RecentCompletionsBound);
            options.RetainedFailuresBound = Math.Max(1, options.RetainedFailuresBound);
            options.RateWindow = options.RateWindow > TimeSpan.Zero ? options.RateWindow : defaultRateWindow;

            return options;
        }
    }
}
