using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.CreateJob
{
    public class CreateJobEndpoint(ITransferJobService jobs, IDeviceConnectionManager deviceManager) : RadEndpoint<CreateJobRequest, CreateJobResponse>
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
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer.\n" +
                    "- Issues no device traffic - the device reset, when the device isn't idle, happens on the first uploaded file."
                )
                .WithTags("Transfers");
        }

        public override Task Handle(CreateJobRequest r, CancellationToken ct)
        {
            var result = jobs.Start(new TransferJobStart(
                r.DeviceId, r.StorageType, r.Body.DestinationDirectory, r.Body.ExpectedArchiveCount, TransferOrigin.Upload, r.Body.Launch));

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
                        SendProblem(DeviceBusyProblem.Create(
                            r.DeviceId,
                            deviceManager.GetAvailableDevice(r.DeviceId)?.Cart.Name,
                            result.ActiveJobId!,
                            detail: result.Message));
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
