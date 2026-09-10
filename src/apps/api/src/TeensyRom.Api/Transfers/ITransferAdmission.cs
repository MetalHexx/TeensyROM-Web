using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Why a relative path was refused, so the endpoint can still send the 400 it documents.
    /// </summary>
    public sealed record AdmissionResult(StagedFile? File, string? Error)
    {
        public bool Accepted => File is not null;
    }

    /// <summary>
    /// The single path everything entering staging goes through - an uploaded file and an extracted
    /// archive entry alike - so the disk ceiling the capacity gate enforces holds over both. Also owns
    /// the per-job hold that keeps an extracted entry off the device queue while its archive is still
    /// being unpacked.
    /// </summary>
    public interface ITransferAdmission
    {
        /// Reserves capacity, streams <paramref name="content"/> to staging, accounts it to the job, and
        /// either enqueues it or holds it. Carries the resolver's own message when the relative path is
        /// unusable.
        Task<AdmissionResult> AdmitAsync(
            TransferJob job,
            Stream content,
            string relativePath,
            long sizeHintBytes,
            bool countAsReceived,
            CancellationToken ct);

        /// Enqueues everything held for this job, in admission order, and stops holding.
        Task ReleaseHeldAsync(string jobId, CancellationToken ct);

        /// Discards everything held for this job without enqueueing - cancellation and abandonment.
        void DiscardHeld(string jobId);
    }
}
