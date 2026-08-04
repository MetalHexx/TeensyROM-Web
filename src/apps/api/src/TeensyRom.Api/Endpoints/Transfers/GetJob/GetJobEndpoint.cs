using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.GetJob
{
    public class GetJobEndpoint(ITransferJobRegistry registry) : RadEndpoint<GetJobRequest, GetJobResponse>
    {
        public override void Configure()
        {
            Get("/api/transfers/{jobId}")
                .Produces<GetJobResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("GetTransferJob")
                .WithSummary("Get Transfer Job")
                .WithDescription(
                    "Gets the current snapshot of a transfer job - the same shape the transfer hub " +
                    "pushes over SignalR, so a client can poll this endpoint instead of subscribing."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(GetJobRequest r, CancellationToken ct)
        {
            var job = registry.Get(r.JobId);

            if (job is null)
            {
                SendNotFound($"No transfer job was found with id {r.JobId}.");
                return Task.CompletedTask;
            }

            Response = new() { Job = TransferJobDto.From(job.ToSnapshot()) };
            Send();

            return Task.CompletedTask;
        }
    }
}
