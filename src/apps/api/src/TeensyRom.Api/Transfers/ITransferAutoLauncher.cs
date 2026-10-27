namespace TeensyRom.Api.Transfers
{
    public interface ITransferAutoLauncher
    {
        /// <summary>Whether a job completing now should launch: reads the auto-launch setting, the job's origin and its request.</summary>
        bool ShouldLaunch(TransferJob job);

        /// <summary>
        /// For a job <see cref="TransferJob.TryComplete"/> left Pending: launches its LaunchedPath in the background
        /// (never on the caller's thread), then reports the outcome on the job and notifies. Does nothing for a job
        /// that is not Pending.
        /// </summary>
        void StartLaunch(TransferJob job);
    }
}
