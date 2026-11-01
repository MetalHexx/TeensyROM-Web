using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneGrids
{
    /// <summary>
    /// Request model for saving the beat grids kept for one tune. The stored grids are replaced as a whole.
    /// </summary>
    public record SaveTuneGridsRequest
    {
        /// <summary>
        /// The tune SID hash: 32 lowercase hexadecimal characters.
        /// </summary>
        [FromRoute] public string SidHash { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the grids. Its SID hash must equal the route SID hash.
        /// </summary>
        [FromBody] public DjTuneGridsDto Body { get; set; } = new();
    }

    /// <summary>
    /// Response model for the result of saving tune grids.
    /// </summary>
    public record SaveTuneGridsResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Tune grids saved successfully.";
    }

    // Validators
    public class SaveTuneGridsRequestValidator : AbstractValidator<SaveTuneGridsRequest>
    {
        public SaveTuneGridsRequestValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");

            RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("A request body is required.")
                .SetValidator(new DjTuneGridsValidator());

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
