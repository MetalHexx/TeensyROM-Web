using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;

namespace TeensyRom.Api.Endpoints.Transfers.SealJob
{
    /// <summary>
    /// Request model for sealing a transfer job - no further files will be accepted after sealing.
    /// </summary>
    public class SealJobRequest
    {
        /// <summary>
        /// The ID of the transfer job to seal.
        /// </summary>
        [FromRoute] public string JobId { get; set; } = string.Empty;
    }

    public class SealJobRequestValidator : AbstractValidator<SealJobRequest>
    {
        public SealJobRequestValidator()
        {
            RuleFor(x => x.JobId).NotEmpty().WithMessage("Job ID is required.");
        }
    }

    /// <summary>
    /// Response model for the result of sealing a transfer job.
    /// </summary>
    public class SealJobResponse
    {
        /// <summary>
        /// The updated snapshot of the sealed job.
        /// </summary>
        [Required] public TransferJobDto Job { get; set; } = null!;
    }
}
