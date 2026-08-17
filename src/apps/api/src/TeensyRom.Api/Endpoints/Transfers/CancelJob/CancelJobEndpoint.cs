using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

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
                    "Cancels a transfer job.\n\n" +
                    "- Returns the job already cancelled: its device, staged files, and expansion " +
                    "workspace are all released before this responds, so the device can immediately " +
                    "take a new job. Files already handed to the device are discarded rather than sent.\n" +
                    "- Idempotent: cancelling an already-cancelled job returns success, as does " +
                    "cancelling any other terminal job, without changing anything."
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

            // Terminal before this returns, whatever the job was doing - a no-op for a job that already
            // reached a terminal state by any route.
            pump.Cancel(job);

            Response = new() { Job = TransferJobDto.From(job.ToSnapshot()) };
            Send();

            return Task.CompletedTask;
        }
    }
}
