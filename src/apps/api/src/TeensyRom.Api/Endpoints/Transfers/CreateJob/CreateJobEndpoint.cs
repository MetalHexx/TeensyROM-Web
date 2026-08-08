using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Transfers.CreateJob
{
    public class CreateJobEndpoint(
        IDeviceConnectionManager deviceManager,
        ITransferJobRegistry registry,
        IDeviceLeaseCoordinator leases) : RadEndpoint<CreateJobRequest, CreateJobResponse>
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
            var device = deviceManager.GetAvailableDevice(r.DeviceId);

            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return Task.CompletedTask;
            }

            var storage = device.GetStorage(r.StorageType);

            if (storage is null)
            {
                var message = r.StorageType is TeensyStorageType.SD
                    ? $"The device {r.DeviceId} does not have an SD card."
                    : $"The device {r.DeviceId} does not have USB storage.";
                SendNotFound(message);
                return Task.CompletedTask;
            }

            DirectoryPath destination;

            try
            {
                destination = new DirectoryPath(r.Body.DestinationDirectory);
            }
            catch (ArgumentException ex)
            {
                SendValidationError(ex.Message);
                return Task.CompletedTask;
            }

            var job = registry.Create(r.DeviceId, r.StorageType, destination);

            if (!leases.TryAcquire(r.DeviceId, job.JobId))
            {
                var holder = leases.GetHolder(r.DeviceId);
                registry.Remove(job.JobId);
                SendProblem(TypedResults.Problem(
                    title: "Device already has an active transfer.",
                    statusCode: StatusCodes.Status409Conflict,
                    detail: $"Device {r.DeviceId} already has an active transfer (job {holder}).",
                    extensions: new Dictionary<string, object?> { ["activeJobId"] = holder }
                ));
                return Task.CompletedTask;
            }

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
                leases.Release(r.DeviceId, job.JobId);
                registry.Remove(job.JobId);
                throw;
            }

            return Task.CompletedTask;
        }
    }
}
