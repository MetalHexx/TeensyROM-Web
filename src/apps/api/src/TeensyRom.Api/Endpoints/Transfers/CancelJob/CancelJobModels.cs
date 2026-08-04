using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;

namespace TeensyRom.Api.Endpoints.Transfers.CancelJob
{
    /// <summary>
    /// Request model for cancelling a transfer job.
    /// </summary>
    public class CancelJobRequest
    {
        /// <summary>
        /// The ID of the transfer job to cancel.
        /// </summary>
        [FromRoute] public string JobId { get; set; } = string.Empty;
    }

    public class CancelJobRequestValidator : AbstractValidator<CancelJobRequest>
    {
        public CancelJobRequestValidator()
        {
            RuleFor(x => x.JobId).NotEmpty().WithMessage("Job ID is required.");
        }
    }

    /// <summary>
    /// Response model for the result of cancelling a transfer job.
    /// </summary>
    public class CancelJobResponse
    {
        /// <summary>
        /// The updated snapshot of the job being cancelled.
        /// </summary>
        [Required] public TransferJobDto Job { get; set; } = null!;
    }
}
