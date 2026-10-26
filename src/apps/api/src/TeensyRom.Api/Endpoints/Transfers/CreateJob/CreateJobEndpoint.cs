using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.CreateJob
{
    public class CreateJobEndpoint(ITransferJobService jobs) : RadEndpoint<CreateJobRequest, CreateJobResponse>
    {
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/storage/{storageType}/transfers")
                .Produces<CreateJobResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .WithName("CreateTransferJob")
                .WithSummary("Create Transfer Job")
                .WithDescription(
                    "Starts a new file transfer job for a device's storage.\n\n" +
                    "- Acquires an exclusive lease on the device for the lifetime of the job - a device " +
                    "can only have one active transfer at a time.\n" +
                    "- Issues no device traffic - the device reset happens on the first uploaded file."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(CreateJobRequest r, CancellationToken ct)
        {
            var result = jobs.Start(new TransferJobStart(
                r.DeviceId, r.StorageType, r.Body.DestinationDirectory, r.Body.ExpectedArchiveCount, TransferOrigin.Upload));

            if (!result.Started)
            {
                switch (result.Error)
                {
                    case TransferStartError.DeviceNotFound:
                    case TransferStartError.StorageUnavailable:
                        SendNotFound(result.Message!);
                        break;
                    case TransferStartError.InvalidDestination:
                        SendValidationError(result.Message!);
                        break;
                    default:
                        SendProblem(TypedResults.Problem(
                            title: "Device already has an active transfer.",
                            statusCode: StatusCodes.Status409Conflict,
                            detail: result.Message,
                            extensions: new Dictionary<string, object?> { ["activeJobId"] = result.ActiveJobId }
                        ));
                        break;
                }

                return Task.CompletedTask;
            }

            var job = result.Job!;

            try
            {
                Response = new()
                {
                    JobId = job.JobId,
                    Job = TransferJobDto.From(job.ToSnapshot())
                };
                Send();
            }
            catch
            {
                // The lease is only safe to hold once the job is actually returned to the caller - if
                // anything blows up finishing the response, release it so a failed create cannot leak it.
                jobs.Discard(job);
                throw;
            }

            return Task.CompletedTask;
        }
    }
}
