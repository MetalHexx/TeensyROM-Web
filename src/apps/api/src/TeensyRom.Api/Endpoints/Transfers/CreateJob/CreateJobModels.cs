using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Endpoints.Transfers.CreateJob
{
    /// <summary>
    /// Request model for starting a new file transfer job to a device's storage.
    /// </summary>
    public class CreateJobRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The storage type to receive the transfer (SD or USB).
        /// </summary>
        [FromRoute] public TeensyStorageType StorageType { get; set; } = TeensyStorageType.SD;

        /// <summary>
        /// The JSON request body. Bound as a whole via <c>[FromBody]</c> - a scalar property cannot
        /// carry that attribute itself and still accept an object body such as
        /// <c>{ "destinationDirectory": "/music/incoming" }</c>.
        /// </summary>
        [FromBody] public CreateJobBody Body { get; set; } = new();
    }

    /// <summary>
    /// The JSON body of a create-job request.
    /// </summary>
    public class CreateJobBody
    {
        /// <summary>
        /// The directory on device storage that received files will be written to. Must be a valid
        /// Unix-style directory path.
        /// </summary>
        public string DestinationDirectory { get; set; } = string.Empty;
    }

    public class CreateJobRequestValidator : AbstractValidator<CreateJobRequest>
    {
        public CreateJobRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(id => id.IsValidFilenameSafeHash()).WithMessage("Device ID must be a valid filename-safe hash of 8 characters long.");

            RuleFor(x => x.StorageType)
                .IsInEnum().WithMessage("Storage type must be a valid enum value.");

            RuleFor(x => x.Body.DestinationDirectory)
                .NotEmpty().WithMessage("Destination directory is required.");
        }
    }

    /// <summary>
    /// Response model for a newly created transfer job.
    /// </summary>
    public class CreateJobResponse
    {
        /// <summary>
        /// The ID of the newly created transfer job, surfaced alongside <see cref="Job"/> for convenience.
        /// </summary>
        [Required] public string JobId { get; set; } = string.Empty;

        /// <summary>
        /// The full snapshot of the newly created job.
        /// </summary>
        [Required] public TransferJobDto Job { get; set; } = null!;
    }
}
