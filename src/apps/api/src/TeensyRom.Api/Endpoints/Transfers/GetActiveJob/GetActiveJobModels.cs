using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Api.Models;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.Transfers.GetActiveJob
{
    /// <summary>
    /// Request model for retrieving a device's currently active transfer job, if any.
    /// </summary>
    public class GetActiveJobRequest
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [FromRoute] public string DeviceId { get; set; } = string.Empty;
    }

    public class GetActiveJobRequestValidator : AbstractValidator<GetActiveJobRequest>
    {
        public GetActiveJobRequestValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.")
                .Must(id => id.IsValidFilenameSafeHash()).WithMessage("Device ID must be a valid filename-safe hash of 8 characters long.");
        }
    }

    /// <summary>
    /// Response model containing a device's active transfer job, or null when the device is idle.
    /// </summary>
    public class GetActiveJobResponse
    {
        /// <summary>
        /// The device's active job snapshot, or null when it has no transfer in progress. A null job is
        /// a normal, non-error state - not sent as a 404.
        /// </summary>
        public TransferJobDto? Job { get; set; }
    }
}
