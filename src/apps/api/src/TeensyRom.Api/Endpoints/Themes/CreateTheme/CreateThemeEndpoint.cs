using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.CreateTheme
{
    public class CreateThemeEndpoint(IThemeStore store) : RadEndpoint<CreateThemeRequest, SaveThemeResponse>
    {
        public override void Configure()
        {
            Post("/api/themes")
                .Produces<SaveThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("CreateTheme")
                .WithSummary("Create Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Saves a new custom theme. The id is generated from the name.\n\n" +
                    "**Validation:**\n" +
                    "- Name is 1-24 characters after trimming, with no control characters\n" +
                    "- Each device color is 0-15\n" +
                    "- The name is not used by another theme"
                );
        }

        public override Task Handle(CreateThemeRequest r, CancellationToken ct)
        {
            var result = store.CreateCustom(r.Body.Name, ThemeMapping.ToPart(r.Body.Device));

            switch (result.Status)
            {
                case ThemeSaveStatus.Saved:
                    Response = new() { Theme = ThemeMapping.ToDto(result.Theme!) };
                    Send();
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
