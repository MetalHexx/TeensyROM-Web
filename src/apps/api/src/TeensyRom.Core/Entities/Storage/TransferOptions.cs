namespace TeensyRom.Core.Entities.Storage
{
    /// <summary>
    /// Tuning knobs for the staged file-transfer pipeline. Introduced ahead of the staging
    /// implementation itself so its integration tests have a fixture-registered instance to build on.
    /// </summary>
    public sealed class TransferOptions
    {
        public required string StagingRoot { get; set; }
        public int MaxStagedFiles { get; set; } = 60_000;
        public TimeSpan IdleAbandonmentThreshold { get; set; } = TimeSpan.FromMinutes(30);
        public TimeSpan SweepInterval { get; set; } = TimeSpan.FromMinutes(5);
    }
}
