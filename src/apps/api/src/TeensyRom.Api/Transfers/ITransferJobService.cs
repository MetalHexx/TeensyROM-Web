using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Transfers
{
    public sealed record TransferJobStart(
        string DeviceId,
        TeensyStorageType StorageType,
        string DestinationDirectory,
        int ExpectedArchiveCount,
        TransferOrigin Origin,
        bool LaunchRequested = false);

    public enum TransferStartError { DeviceNotFound, StorageUnavailable, InvalidDestination, DeviceBusy }

    public sealed record TransferStartResult(TransferJob? Job, TransferStartError? Error, string? Message, string? ActiveJobId)
    {
        public bool Started => Job is not null;
    }

    public sealed record TransferFileResult(bool Accepted, long SizeBytes, string? Error);

    public sealed record TransferSealResult(bool Sealed, string? Error);

    /// <summary>
    /// The engine-side lifecycle of a transfer job - creation, file admission and sealing - independent
    /// of how the request arrived (HTTP endpoint, watch folder, ...).
    /// </summary>
    public interface ITransferJobService
    {
        /// <summary>
        /// Finds the available device and its storage, validates the destination, creates the job and takes the
        /// device lease. On a lease conflict the job is removed again and ActiveJobId names the holder.
        /// </summary>
        TransferStartResult Start(TransferJobStart request);

        /// <summary>
        /// Rolls back a started job whose caller failed before handing it on: releases the lease, removes the job.
        /// </summary>
        void Discard(TransferJob job);

        /// <summary>
        /// Refuses a job that is not Created/Receiving; routes an archive (<c>IArchiveReader.IsArchiveExtension</c>)
        /// to scratch and the expansion queue, everything else through <c>ITransferAdmission.AdmitAsync</c>
        /// (countAsReceived: true). A null size hint reserves the 1 MB default.
        /// </summary>
        Task<TransferFileResult> AddFileAsync(TransferJob job, Stream content, string relativePath, long? sizeHintBytes, CancellationToken ct);

        /// <summary>
        /// Created -> Receiving -> Sealed (idempotent when already Sealed), then <c>TransferPump.TryFinalize</c>.
        /// </summary>
        TransferSealResult Seal(TransferJob job);
    }
}
