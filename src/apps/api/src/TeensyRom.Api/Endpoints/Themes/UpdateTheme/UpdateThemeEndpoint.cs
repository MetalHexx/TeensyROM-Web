using TeensyRom.Api.Endpoints.Themes.CreateTheme;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.UpdateTheme
{
    public class UpdateThemeEndpoint(IThemeStore store) : RadEndpoint<UpdateThemeRequest, SaveThemeResponse>
    {
        public override void Configure()
        {
            Put("/api/themes/{themeId}")
                .Produces<SaveThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("UpdateTheme")
                .WithSummary("Update Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Replaces the name and colors of a custom theme. The id does not change.\n\n" +
                    "Shipped themes can't be changed; save a copy with a new name instead.\n\n" +
                    "**Validation:**\n" +
                    "- The theme id is lowercase letters, digits and single hyphens\n" +
                    "- Name is 1-24 characters after trimming, with no control characters\n" +
                    "- Each device color is 0-15\n" +
                    "- The name is not used by another theme"
                );
        }

        public override Task Handle(UpdateThemeRequest r, CancellationToken ct)
        {
            var result = store.UpdateCustom(r.ThemeId, r.Body.Name, ThemeMapping.ToPart(r.Body.Device));

            switch (result.Status)
            {
                case ThemeSaveStatus.Saved:
                    Response = new() { Theme = ThemeMapping.ToDto(result.Theme!) };
                    Send();
                    break;
                case ThemeSaveStatus.NotFound:
                    SendNotFound($"The theme {r.ThemeId} was not found.");
                    break;
                case ThemeSaveStatus.ShippedReadOnly:
                    SendValidationError("Shipped themes can't be changed. Save a copy with a new name.");
                    break;
                case ThemeSaveStatus.NameTaken:
                    SendValidationError($"A theme named \"{r.Body.Name}\" already exists.");
                    break;
                default:
                    SendInternalError("Failed to save the theme to disk. Please check file permissions and try again.");
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
