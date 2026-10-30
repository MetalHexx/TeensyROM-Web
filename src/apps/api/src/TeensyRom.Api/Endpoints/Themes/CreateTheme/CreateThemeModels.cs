using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.CreateTheme
{
    /// <summary>
    /// Request model for creating a custom theme.
    /// </summary>
    public record CreateThemeRequest
    {
        /// <summary>
        /// The JSON request body carrying the name and colors.
        /// </summary>
        [FromBody] public SaveThemeBody Body { get; set; } = new();
    }

    /// <summary>
    /// Response model carrying the saved theme. Shared by create and update.
    /// </summary>
    public record SaveThemeResponse
    {
        /// <summary>
        /// The theme as stored.
        /// </summary>
        [Required] public ThemeDto Theme { get; init; } = new();
    }

    public class CreateThemeRequestValidator : AbstractValidator<CreateThemeRequest>
    {
        public CreateThemeRequestValidator()
        {
            RuleFor(x => x.Body).SetValidator(new SaveThemeBodyValidator());
        }
    }
}
