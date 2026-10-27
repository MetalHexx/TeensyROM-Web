using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Owns job creation, file admission and sealing so every entry point (HTTP, watch folders) goes
    /// through the same rules. An archive is the one file kind that bypasses staging and the capacity gate:
    /// it routes to scratch, which enforces its own, separate ceiling.
    /// </summary>
    public sealed class TransferJobService(
        IDeviceConnectionManager deviceManager,
        ITransferJobRegistry registry,
        IDeviceLeaseCoordinator leases,
        ITransferAdmission admission,
        ITransferScratchStore scratch,
        IArchiveReader archiveReader,
        IArchiveExpansionQueue expansionQueue,
        ITransferProgressNotifier notifier,
        TransferPump pump) : ITransferJobService
    {
        // Used only when the caller has no size hint (e.g. chunked transfer encoding). Adjust()
        // reconciles this reservation to the real size once the body is fully staged.
        private const long DefaultReservationBytes = 1 * 1024 * 1024;

        // Matches TransferStagingStore's own copy buffer - there is no shared constant between the two,
        // just the same well-worn stream-copy size.
        private const int CopyBufferSize = 81_920;

        public TransferStartResult Start(TransferJobStart request)
        {
            var device = deviceManager.GetAvailableDevice(request.DeviceId);

            if (device is null)
            {
                return Failed(TransferStartError.DeviceNotFound, $"The device {request.DeviceId} was not found.");
            }

            var storage = device.GetStorage(request.StorageType);

            if (storage is null)
            {
                var message = request.StorageType is TeensyStorageType.SD
                    ? $"The device {request.DeviceId} does not have an SD card."
                    : $"The device {request.DeviceId} does not have USB storage.";
                return Failed(TransferStartError.StorageUnavailable, message);
            }

            DirectoryPath destination;

            try
            {
                destination = new DirectoryPath(request.DestinationDirectory);
            }
            catch (ArgumentException ex)
            {
                return Failed(TransferStartError.InvalidDestination, ex.Message);
            }

            var job = registry.Create(request.DeviceId, request.StorageType, destination, request.ExpectedArchiveCount, request.Origin, request.LaunchRequested);

            if (!leases.TryAcquire(request.DeviceId, job.JobId))
            {
                var holder = leases.GetHolder(request.DeviceId);
                registry.Remove(job.JobId);
                return new TransferStartResult(
                    null,
                    TransferStartError.DeviceBusy,
                    $"Device {request.DeviceId} already has an active transfer (job {holder}).",
                    holder);
            }

            notifier.JobChanged(job);

            return new TransferStartResult(job, null, null, null);
        }

        public void Discard(TransferJob job)
        {
            leases.Release(job.DeviceId, job.JobId);
            registry.Remove(job.JobId);
        }

        public async Task<TransferFileResult> AddFileAsync(
            TransferJob job, Stream content, string relativePath, long? sizeHintBytes, CancellationToken ct)
        {
            if (job.State is not (TransferJobState.Created or TransferJobState.Receiving))
            {
                return Refused($"Job {job.JobId} is not accepting files in its current state ({job.State}).");
            }

            var reserved = sizeHintBytes ?? DefaultReservationBytes;

            if (archiveReader.IsArchiveExtension(relativePath))
            {
                return await AddArchiveAsync(job, content, relativePath, reserved, ct);
            }

            var result = await admission.AdmitAsync(job, content, relativePath, reserved, countAsReceived: true, ct);

            return result.Accepted
                ? new TransferFileResult(true, result.File!.SizeBytes, null)
                : Refused(result.Error!);
        }

        public TransferSealResult Seal(TransferJob job)
        {
            if (job.State != TransferJobState.Sealed)
            {
                // TransferJob's legal-transition table only has an edge from Receiving to Sealed - a
                // job that never received a file (still Created) has to pass through Receiving first,
                // in the same request, to reach Sealed.
                if (job.State == TransferJobState.Created)
                {
                    job.TryTransitionTo(TransferJobState.Receiving);
                }

                if (!job.TryTransitionTo(TransferJobState.Sealed))
                {
                    return new TransferSealResult(false, $"Job {job.JobId} cannot be sealed from its current state ({job.State}).");
                }
            }

            // Finalizes immediately in case the queue is already empty - no worker will ever wake to
            // drain a job that never had anything enqueued.
            pump.TryFinalize(job);

            return new TransferSealResult(true, null);
        }

        /// <summary>
        /// Streams an archive's raw body to scratch rather than staging and hands it to the expansion
        /// queue instead of the device queue. Reserves against the scratch ceiling for the raw upload
        /// itself, exactly like <see cref="ArchiveExpansionService"/> separately reserves for the archive's
        /// declared uncompressed size once expansion starts - without this, a raw archive body could grow
        /// scratch disk usage without bound or backpressure while it waits its turn on the expansion queue.
        /// <see cref="ArchiveExpansionService.ExpandAsync"/> releases the reservation once this archive's
        /// scratch file is gone. The archive itself still counts toward
        /// <see cref="TransferJobSnapshot.FilesReceived"/> - it was uploaded - but never reaches the
        /// device; only what it expands to does.
        /// </summary>
        private async Task<TransferFileResult> AddArchiveAsync(
            TransferJob job, Stream content, string relativePath, long reserved, CancellationToken ct)
        {
            scratch.EnsureJobDirectory(job.JobId);

            if (!scratch.TryReserve(job.JobId, reserved))
            {
                return Refused("Insufficient scratch space to accept this archive.");
            }

            var scratchPath = scratch.NewScratchFilePath(job.JobId);

            try
            {
                await using (var fs = new FileStream(
                    scratchPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                    bufferSize: CopyBufferSize, useAsync: true))
                {
                    await content.CopyToAsync(fs, ct);
                }
            }
            catch
            {
                // Whatever landed on disk is orphaned until this job's scratch tree is purged at job exit,
                // but the reservation itself must not wait that long - a run of failed archive uploads
                // would otherwise exhaust the ceiling for every other job.
                scratch.Release(job.JobId, reserved);
                throw;
            }

            var actualBytes = new FileInfo(scratchPath).Length;
            var effectiveReserved = scratch.Adjust(job.JobId, reserved, actualBytes);

            job.OnFileReceived(actualBytes);
            job.OnArchiveAccepted();

            await expansionQueue.EnqueueAsync(new ArchiveExpansionRequest(job.JobId, scratchPath, relativePath, effectiveReserved), ct);

            return new TransferFileResult(true, actualBytes, null);
        }

        private static TransferStartResult Failed(TransferStartError error, string message) =>
            new(null, error, message, null);

        private static TransferFileResult Refused(string error) => new(false, 0, error);
    }
}
