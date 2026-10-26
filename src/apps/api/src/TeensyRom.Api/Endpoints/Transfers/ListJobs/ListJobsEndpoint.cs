using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.ListJobs
{
    public class ListJobsEndpoint(ITransferJobRegistry registry) : RadEndpointWithoutRequest<ListJobsResponse>
    {
        public override void Configure()
        {
            Get("/api/transfers")
                .Produces<ListJobsResponse>(StatusCodes.Status200OK)
                .WithName("ListTransferJobs")
                .WithSummary("List Transfer Jobs")
                .WithDescription(
                    "Lists every transfer job the engine knows about, whatever its origin.\n\n" +
                    "- Newest first.\n" +
                    "- Returns 200 with an empty list when there are no jobs."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(CancellationToken ct)
        {
            Response = new()
            {
                Jobs = registry.All()
                    .Select(job => TransferJobDto.From(job.ToSnapshot()))
                    .OrderByDescending(dto => dto.StartedUtc)
                    .ToList()
            };
            Send();

            return Task.CompletedTask;
        }
    }
}
