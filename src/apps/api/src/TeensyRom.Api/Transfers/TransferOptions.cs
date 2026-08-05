using System.Reflection;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Single source of truth for every tuning constant in the staged file-transfer subsystem.
    /// Registered as a singleton; every property is settable so tests can override it. No later task
    /// may re-declare one of these values as a literal.
    /// </summary>
    public sealed class TransferOptions
    {
        /// Maximum number of staged files admitted across all jobs at once.
        public int MaxStagedFiles { get; set; } = 10_000;

        /// Maximum total staged bytes across all jobs at once (2 GB).
        public long MaxStagedBytes { get; set; } = 2L * 1024 * 1024 * 1024;

        /// A job with no pending work and no activity for this long is Abandoned.
        public TimeSpan IdleAbandonmentThreshold { get; set; } = TimeSpan.FromMinutes(2);

        /// How often the sweeper looks for abandoned and evictable jobs.
        public TimeSpan SweepInterval { get; set; } = TimeSpan.FromSeconds(30);

        /// Minimum interval between progress broadcasts for a given job.
        public TimeSpan SnapshotThrottle { get; set; } = TimeSpan.FromMilliseconds(250);

        /// How long a terminal job stays queryable before eviction.
        public TimeSpan TerminalJobRetention { get; set; } = TimeSpan.FromMinutes(5);

        /// Chunk size for the device write loop.
        public int DeviceChunkSize { get; set; } = 16 * 1024;

        /// Root directory for staged uploads. Overridable so tests can redirect to a temp directory.
        public string StagingRoot { get; set; } =
            Path.Combine(Assembly.GetExecutingAssembly().GetPath(), "staging");
    }
}
