using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjSet
{
    /// <summary>
    /// Request model for saving a DJ set. The stored set is replaced as a whole.
    /// </summary>
    public record SaveDjSetRequest
    {
        /// <summary>
        /// The set id: a lowercase GUID in the hyphenated format.
        /// </summary>
        [FromRoute] public string SetId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the set. Its id must equal the route id.
        /// </summary>
        [FromBody] public DjSetDto Body { get; set; } = new();
    }

    /// <summary>
    /// Response model for the result of saving a DJ set.
    /// </summary>
    public record SaveDjSetResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "DJ set saved successfully.";
    }

    // Validators
    public class SaveDjSetRequestValidator : AbstractValidator<SaveDjSetRequest>
    {
        public SaveDjSetRequestValidator()
        {
            RuleFor(x => x.SetId)
                .Must(DjLibraryIds.IsSetId).WithMessage("Set ID must be a lowercase GUID.");

            RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("A request body is required.")
                .SetValidator(new DjSetValidator());

            RuleFor(x => x).Custom((request, context) =>
            {
                if (request.Body is not null && request.Body.Id != request.SetId)
                {
                    context.AddFailure("Body.Id", "Body ID must equal the set ID in the route.");
                }
            });
        }
    }
}
