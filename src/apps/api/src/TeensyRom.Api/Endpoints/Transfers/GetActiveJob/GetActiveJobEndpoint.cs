using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.GetActiveJob
{
    public class GetActiveJobEndpoint(ITransferJobRegistry registry) : RadEndpoint<GetActiveJobRequest, GetActiveJobResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/{deviceId}/transfers/active")
                .Produces<GetActiveJobResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .WithName("GetActiveTransferJob")
                .WithSummary("Get Active Transfer Job")
                .WithDescription(
                    "Gets the device's currently active transfer job.\n\n" +
                    "- Returns 200 with a null job when the device has no transfer in progress - an " +
                    "idle device is a normal answer, not a 404."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(GetActiveJobRequest r, CancellationToken ct)
        {
            var job = registry.GetActive(r.DeviceId);

            Response = new()
            {
                Job = job is null ? null : TransferJobDto.From(job.ToSnapshot())
            };
            Send();

            return Task.CompletedTask;
        }
    }
}
