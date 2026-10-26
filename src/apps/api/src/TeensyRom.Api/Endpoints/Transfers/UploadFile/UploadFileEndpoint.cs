using Microsoft.AspNetCore.Http.Features;
using TeensyRom.Api.Transfers;

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
        ITransferJobService jobs) : RadEndpoint<UploadFileRequest, UploadFileResponse>
    {
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

            var result = await jobs.AddFileAsync(job, HttpContext.Request.Body, r.Path, HttpContext.Request.ContentLength, ct);

            if (!result.Accepted)
            {
                SendValidationError(result.Error!);
                return;
            }

            Response = new() { RelativePath = r.Path, SizeBytes = result.SizeBytes, Queued = true };
            Send();
        }
    }
}
