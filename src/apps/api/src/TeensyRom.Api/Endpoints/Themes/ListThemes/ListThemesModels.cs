using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Themes.ListThemes
{
    /// <summary>
    /// Response model listing every theme.
    /// </summary>
    public record ListThemesResponse
    {
        /// <summary>
        /// Shipped themes by sort order, then custom themes by name.
        /// </summary>
        [Required] public List<ThemeDto> Themes { get; init; } = [];
    }
}
