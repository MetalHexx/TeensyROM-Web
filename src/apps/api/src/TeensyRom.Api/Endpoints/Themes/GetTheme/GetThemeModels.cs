using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.GetTheme
{
    /// <summary>
    /// Request model for reading one theme.
    /// </summary>
    public record GetThemeRequest
    {
        /// <summary>
        /// The theme id: lowercase letters, digits and single hyphens.
        /// </summary>
        [FromRoute] public string ThemeId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model carrying one theme.
    /// </summary>
    public record GetThemeResponse
    {
        /// <summary>
        /// The theme.
        /// </summary>
        [Required] public ThemeDto Theme { get; init; } = new();
    }

    public class GetThemeRequestValidator : AbstractValidator<GetThemeRequest>
    {
        public GetThemeRequestValidator()
        {
            RuleFor(x => x.ThemeId).MustBeThemeId();
        }
    }
}
