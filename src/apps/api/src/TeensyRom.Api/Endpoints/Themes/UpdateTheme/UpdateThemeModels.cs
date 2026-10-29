namespace TeensyRom.Api.Endpoints.Themes.UpdateTheme
{
    /// <summary>
    /// Request model for replacing a custom theme.
    /// </summary>
    public record UpdateThemeRequest
    {
        /// <summary>
        /// The theme id: lowercase letters, digits and single hyphens.
        /// </summary>
        [FromRoute] public string ThemeId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body carrying the name and colors.
        /// </summary>
        [FromBody] public SaveThemeBody Body { get; set; } = new();
    }

    public class UpdateThemeRequestValidator : AbstractValidator<UpdateThemeRequest>
    {
        public UpdateThemeRequestValidator()
        {
            RuleFor(x => x.ThemeId).MustBeThemeId();
            RuleFor(x => x.Body).SetValidator(new SaveThemeBodyValidator());
        }
    }
}
