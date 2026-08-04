using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.CancelJob
{
    public class CancelJobEndpoint(ITransferJobRegistry registry, TransferPump pump) : RadEndpoint<CancelJobRequest, CancelJobResponse>
    {
        public override void Configure()
        {
            Post("/api/transfers/{jobId}/cancel")
                .Produces<CancelJobResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("CancelTransferJob")
                .WithSummary("Cancel Transfer Job")
                .WithDescription(
                    "Requests cancellation of a transfer job.\n\n" +
                    "- Returns immediately - it does not wait for the drain. The pump finishes any " +
                    "in-flight write and drains the rest of the queue in the background.\n" +
                    "- Idempotent: cancelling an already-cancelling or already-cancelled job returns " +
                    "success, as does cancelling any other terminal job, without changing anything."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(CancelJobRequest r, CancellationToken ct)
        {
            var job = registry.Get(r.JobId);

            if (job is null)
            {
                SendNotFound($"No transfer job was found with id {r.JobId}.");
                return Task.CompletedTask;
            }

            if (job.State != TransferJobState.Cancelling && !TransferJob.IsTerminal(job.State))
            {
                job.TryTransitionTo(TransferJobState.Cancelling);
            }

            // Finalizes immediately in case the queue is already empty - no worker will ever wake to
            // drain a job with nothing pending. A no-op otherwise; the pump finalizes once it drains.
            pump.TryFinalize(job);

            Response = new() { Job = TransferJobDto.From(job.ToSnapshot()) };
            Send();

            return Task.CompletedTask;
        }
    }
}
