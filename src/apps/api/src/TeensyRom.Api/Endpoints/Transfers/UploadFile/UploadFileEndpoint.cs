using Microsoft.AspNetCore.Http.Features;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.UploadFile
{
    /// <summary>
    /// Streams one file's raw body straight to disk per request. The request waits for capacity instead
    /// of failing when the gate is saturated - there is no rejection and no client-side pacing anywhere
    /// in this design; a slow device just means in-flight uploads take longer to return.
    /// </summary>
    public class UploadFileEndpoint(
        ITransferJobRegistry registry,
        ITransferStagingStore staging,
        ITransferCapacityGate gate,
        ITransferQueue queue,
        ITransferProgressNotifier notifier) : RadEndpoint<UploadFileRequest, UploadFileResponse>
    {
        // Used only when the client omits Content-Length (e.g. chunked transfer encoding). Adjust()
        // reconciles this reservation to the real size once the body is fully staged.
        private const long DefaultReservationBytes = 1 * 1024 * 1024;

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

            if (!TransferPathResolver.TryResolve(job.Destination, r.Path, out var target, out var error))
            {
                SendValidationError(error!);
                return;
            }

            var reserved = HttpContext.Request.ContentLength ?? DefaultReservationBytes;
            await gate.WaitForSlotAsync(reserved, ct);

            string? stagingPath = null;
            var effective = reserved;

            try
            {
                stagingPath = await staging.StageAsync(job.JobId, HttpContext.Request.Body, ct);
                var actualBytes = new FileInfo(stagingPath).Length;
                effective = gate.Adjust(reserved, actualBytes);

                job.OnFileReceived(actualBytes);
                await queue.EnqueueAsync(
                    job.DeviceId,
                    new StagedFile(job.JobId, stagingPath, r.Path, target, job.StorageType, actualBytes, effective),
                    ct);
                notifier.JobChanged(job);

                if (job.State == TransferJobState.Created)
                {
                    job.TryTransitionTo(TransferJobState.Receiving);
                }

                Response = new() { RelativePath = r.Path, SizeBytes = actualBytes, Queued = true };
                Send();
            }
            catch
            {
                // A slot leaked here is permanent and eventually deadlocks every upload for the process
                // lifetime - releasing exactly `effective` (never the raw reservation once Adjust ran)
                // keeps the byte counter from drifting.
                gate.ReleaseSlot(effective);

                if (stagingPath is not null)
                {
                    staging.DeleteStagedFile(stagingPath);
                }

                throw;
            }
        }
    }
}
