using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;

namespace TeensyRom.Api.Endpoints.Transfers.UploadFile
{
    /// <summary>
    /// Request model for streaming a single file's raw body into a transfer job. Deliberately carries no
    /// body-bound property - the framework would buffer and deserialize it, which is exactly what this
    /// endpoint exists to avoid. The bytes are read directly from <c>HttpContext.Request.Body</c>.
    /// </summary>
    public class UploadFileRequest
    {
        /// <summary>
        /// The ID of the transfer job this file belongs to.
        /// </summary>
        [FromRoute] public string JobId { get; set; } = string.Empty;

        /// <summary>
        /// The client-supplied path the file should land at on the device, relative to the job's
        /// destination directory.
        /// </summary>
        [FromQuery] public string Path { get; set; } = string.Empty;
    }

    public class UploadFileRequestValidator : AbstractValidator<UploadFileRequest>
    {
        public UploadFileRequestValidator()
        {
            RuleFor(x => x.JobId).NotEmpty().WithMessage("Job ID is required.");
            RuleFor(x => x.Path).NotEmpty().WithMessage("Path is required.");
        }
    }

    /// <summary>
    /// Response model confirming a single uploaded file was staged and queued.
    /// </summary>
    public class UploadFileResponse
    {
        /// <summary>
        /// The client-supplied relative path this file will land at on the device.
        /// </summary>
        [Required] public string RelativePath { get; set; } = string.Empty;

        /// <summary>
        /// The true size of the uploaded file, in bytes.
        /// </summary>
        [Required] public long SizeBytes { get; set; }

        /// <summary>
        /// Always true - the response is only sent once the file is staged and queued for the device.
        /// </summary>
        [Required] public bool Queued { get; set; }
    }
}
