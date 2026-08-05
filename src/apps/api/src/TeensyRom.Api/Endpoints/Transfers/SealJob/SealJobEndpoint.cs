using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.SealJob
{
    public class SealJobEndpoint(ITransferJobRegistry registry, TransferPump pump) : RadEndpoint<SealJobRequest, SealJobResponse>
    {
        public override void Configure()
        {
            Post("/api/transfers/{jobId}/seal")
                .Produces<SealJobResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("SealTransferJob")
                .WithSummary("Seal Transfer Job")
                .WithDescription(
                    "Marks a transfer job as sealed - no further files will be accepted.\n\n" +
                    "- Idempotent when the job is already sealed.\n" +
                    "- Rejected with a clear message when the job cannot reach Sealed from its current state.\n" +
                    "- A job sealed with an empty queue reaches Completed immediately - no upload required."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(SealJobRequest r, CancellationToken ct)
        {
            var job = registry.Get(r.JobId);

            if (job is null)
            {
                SendNotFound($"No transfer job was found with id {r.JobId}.");
                return Task.CompletedTask;
            }

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
                    SendValidationError($"Job {r.JobId} cannot be sealed from its current state ({job.State}).");
                    return Task.CompletedTask;
                }
            }

            // Finalizes immediately in case the queue is already empty - no worker will ever wake to
            // drain a job that never had anything enqueued.
            pump.TryFinalize(job);

            Response = new() { Job = TransferJobDto.From(job.ToSnapshot()) };
            Send();

            return Task.CompletedTask;
        }
    }
}
