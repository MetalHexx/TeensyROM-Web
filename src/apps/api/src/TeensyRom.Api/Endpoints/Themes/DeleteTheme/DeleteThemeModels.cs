using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.DeleteTheme
{
    /// <summary>
    /// Request model for deleting one custom theme.
    /// </summary>
    public record DeleteThemeRequest
    {
        /// <summary>
        /// The theme id: lowercase letters, digits and single hyphens.
        /// </summary>
        [FromRoute] public string ThemeId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model for the result of deleting a theme.
    /// </summary>
    public record DeleteThemeResponse
    {
        /// <summary>
        /// A message indicating the result of the delete operation.
        /// </summary>
        [Required] public string Message { get; init; } = "Theme deleted.";
    }

    public class DeleteThemeRequestValidator : AbstractValidator<DeleteThemeRequest>
    {
        public DeleteThemeRequestValidator()
        {
            RuleFor(x => x.ThemeId).MustBeThemeId();
        }
    }
}
