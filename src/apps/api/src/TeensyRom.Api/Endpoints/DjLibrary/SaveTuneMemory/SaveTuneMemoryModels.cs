using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneMemory
{
    /// <summary>
    /// Request model for saving the memory kept for one tune. The stored memory is replaced as a whole.
    /// </summary>
    public record SaveTuneMemoryRequest
    {
        /// <summary>
        /// The tune SID hash: 32 lowercase hexadecimal characters.
        /// </summary>
        [FromRoute] public string SidHash { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the memory. Its SID hash must equal the route SID hash.
        /// </summary>
        [FromBody] public DjTuneMemoryDto Body { get; set; } = new();
    }

    /// <summary>
    /// Response model for the result of saving tune memory.
    /// </summary>
    public record SaveTuneMemoryResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Tune memory saved successfully.";
    }

    // Validators
    public class SaveTuneMemoryRequestValidator : AbstractValidator<SaveTuneMemoryRequest>
    {
        public SaveTuneMemoryRequestValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");

            RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("A request body is required.")
                .SetValidator(new DjTuneMemoryValidator());

            RuleFor(x => x).Custom((request, context) =>
            {
                if (request.Body is not null && request.Body.SidHash != request.SidHash)
                {
                    context.AddFailure("Body.SidHash", "Body SID hash must equal the SID hash in the route.");
                }
            });
        }
    }
}
