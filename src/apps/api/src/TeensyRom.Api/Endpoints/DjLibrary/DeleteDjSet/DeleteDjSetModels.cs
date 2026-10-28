using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.DeleteDjSet
{
    /// <summary>
    /// Request model for deleting one DJ set.
    /// </summary>
    public record DeleteDjSetRequest
    {
        /// <summary>
        /// The set id: a lowercase GUID in the hyphenated format.
        /// </summary>
        [FromRoute] public string SetId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model for the result of deleting a DJ set.
    /// </summary>
    public record DeleteDjSetResponse
    {
        /// <summary>
        /// A message indicating the result of the delete operation.
        /// </summary>
        [Required] public string Message { get; set; } = "DJ set deleted.";
    }

    // Validators
    public class DeleteDjSetRequestValidator : AbstractValidator<DeleteDjSetRequest>
    {
        public DeleteDjSetRequestValidator()
        {
            RuleFor(x => x.SetId)
                .Must(DjLibraryIds.IsSetId).WithMessage("Set ID must be a lowercase GUID.");
        }
    }
}
