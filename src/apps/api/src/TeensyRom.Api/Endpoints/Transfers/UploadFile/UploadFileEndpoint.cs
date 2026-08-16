using Microsoft.AspNetCore.Http.Features;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.UploadFile
{
    /// <summary>
    /// Streams one file's raw body straight to disk per request. The request waits for capacity instead
    /// of failing when the gate is saturated - there is no rejection and no client-side pacing anywhere
    /// in this design; a slow device just means in-flight uploads take longer to return. An archive is the
    /// one exception: it routes to scratch instead of staging and never touches the capacity gate at all,
    /// since scratch enforces its own, separate ceiling.
    /// </summary>
    public class UploadFileEndpoint(
        ITransferJobRegistry registry,
        ITransferAdmission admission,
        ITransferScratchStore scratch,
        IArchiveReader archiveReader,
        IArchiveExpansionQueue expansionQueue) : RadEndpoint<UploadFileRequest, UploadFileResponse>
    {
        // Used only when the client omits Content-Length (e.g. chunked transfer encoding). Adjust()
        // reconciles this reservation to the real size once the body is fully staged.
        private const long DefaultReservationBytes = 1 * 1024 * 1024;

        // Matches TransferStagingStore's own copy buffer - there is no shared constant between the two,
        // just the same well-worn stream-copy size.
        private const int CopyBufferSize = 81_920;

        public override void Configure()
        {
            Post("/api/transfers/{jobId}/files")
                .WithMetadata(new RequestSizeLimitAttribute(long.MaxValue))
                .Produces<UploadFileResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("UploadTransferFile")
                .WithSummary("Upload Transfer File")
                .WithDescription(
                    "Streams a single file's raw body (application/octet-stream) into a transfer job.\n\n" +
                    "- One file per request; the body is streamed straight to disk, never buffered.\n" +
                    "- Blocks until the capacity gate has a free slot instead of failing - a slow device " +
                    "shows up as a slower response, never as an error.\n" +
                    "- Rejected immediately (400) when the job cannot accept files, and before any file " +
                    "is staged when the relative path is unusable."
                )
                .WithTags("Transfers");
        }

        public override async Task Handle(UploadFileRequest r, CancellationToken ct)
        {
            // Endpoint metadata alone does not always reach Kestrel's own request-body limit; clear it
            // directly on the feature too. TestServer and other hosts may not expose the feature at all,
            // or may expose it read-only, so both are treated as a no-op rather than an exception.
            var bodySizeFeature = HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (bodySizeFeature is { IsReadOnly: false })
            {
                bodySizeFeature.MaxRequestBodySize = null;
            }

            var job = registry.Get(r.JobId);

            if (job is null)
            {
                SendNotFound($"No transfer job was found with id {r.JobId}.");
                return;
            }

            if (job.State is not (TransferJobState.Created or TransferJobState.Receiving))
            {
                SendValidationError($"Job {r.JobId} is not accepting files in its current state ({job.State}).");
                return;
            }

            if (archiveReader.IsArchiveExtension(r.Path))
            {
                await HandleArchiveAsync(job, r.Path, ct);
                return;
            }

            var reserved = HttpContext.Request.ContentLength ?? DefaultReservationBytes;

            var result = await admission.AdmitAsync(job, HttpContext.Request.Body, r.Path, reserved, countAsReceived: true, ct);

            if (!result.Accepted)
            {
                SendValidationError(result.Error!);
                return;
            }

            Response = new() { RelativePath = r.Path, SizeBytes = result.File!.SizeBytes, Queued = true };
            Send();
        }

        /// <summary>
        /// Streams an archive's raw body to scratch rather than staging and hands it to the expansion
        /// queue instead of the device queue. The archive itself still counts toward
        /// <see cref="TransferJobSnapshot.FilesReceived"/> - it was uploaded - but never reaches the
        /// device; only what it expands to does.
        /// </summary>
        private async Task HandleArchiveAsync(TransferJob job, string relativePath, CancellationToken ct)
        {
            scratch.EnsureJobDirectory(job.JobId);
            var scratchPath = scratch.NewScratchFilePath(job.JobId);

            await using (var fs = new FileStream(
                scratchPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                bufferSize: CopyBufferSize, useAsync: true))
            {
                await HttpContext.Request.Body.CopyToAsync(fs, ct);
            }

            var actualBytes = new FileInfo(scratchPath).Length;

            job.OnFileReceived(actualBytes);
            job.OnArchiveAccepted();

            await expansionQueue.EnqueueAsync(new ArchiveExpansionRequest(job.JobId, scratchPath, relativePath), ct);

            // Same shape as the ordinary path - the browser cannot tell an archive from any other file
            // and should not need to.
            Response = new() { RelativePath = relativePath, SizeBytes = actualBytes, Queued = true };
            Send();
        }
    }
}
