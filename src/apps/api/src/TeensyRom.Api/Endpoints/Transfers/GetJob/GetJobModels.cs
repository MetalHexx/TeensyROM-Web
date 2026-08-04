using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;

namespace TeensyRom.Api.Endpoints.Transfers.GetJob
{
    /// <summary>
    /// Request model for retrieving a transfer job's current snapshot.
    /// </summary>
    public class GetJobRequest
    {
        /// <summary>
        /// The ID of the transfer job to retrieve.
        /// </summary>
        [FromRoute] public string JobId { get; set; } = string.Empty;
    }

    public class GetJobRequestValidator : AbstractValidator<GetJobRequest>
    {
        public GetJobRequestValidator()
        {
            RuleFor(x => x.JobId).NotEmpty().WithMessage("Job ID is required.");
        }
    }

    /// <summary>
    /// Response model containing a transfer job's current snapshot.
    /// </summary>
    public class GetJobResponse
    {
        /// <summary>
        /// The current snapshot of the job - the same field set the transfer hub pushes over SignalR.
        /// </summary>
        [Required] public TransferJobDto Job { get; set; } = null!;
    }
}
