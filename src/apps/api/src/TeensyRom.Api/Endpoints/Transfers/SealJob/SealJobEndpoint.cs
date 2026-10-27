using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.SealJob
{
    public class SealJobEndpoint(ITransferJobRegistry registry, ITransferJobService jobs) : RadEndpoint<SealJobRequest, SealJobResponse>
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

            var result = jobs.Seal(job);

            if (!result.Sealed)
            {
                SendValidationError(result.Error!);
                return Task.CompletedTask;
            }

            Response = new() { Job = TransferJobDto.From(job.ToSnapshot()) };
            Send();

            return Task.CompletedTask;
        }
    }
}
