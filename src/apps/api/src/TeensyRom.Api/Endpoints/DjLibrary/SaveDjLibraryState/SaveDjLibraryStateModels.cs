using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjLibraryState
{
    /// <summary>
    /// Request model for saving the DJ library state.
    /// </summary>
    public record SaveDjLibraryStateRequest
    {
        /// <summary>
        /// The JSON request body carrying the state.
        /// </summary>
        [FromBody] public DjLibraryStateDto Body { get; set; } = new();
    }

    /// <summary>
    /// Response model for the result of saving the DJ library state.
    /// </summary>
    public record SaveDjLibraryStateResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "DJ library state saved successfully.";
    }

    // Validators
    public class SaveDjLibraryStateRequestValidator : AbstractValidator<SaveDjLibraryStateRequest>
    {
        public SaveDjLibraryStateRequestValidator()
        {
            RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("A request body is required.")
                .SetValidator(new DjLibraryStateValidator());
        }
    }
}
