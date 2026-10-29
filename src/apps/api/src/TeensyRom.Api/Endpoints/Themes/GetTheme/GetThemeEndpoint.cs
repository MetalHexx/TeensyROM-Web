using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.GetTheme
{
    public class GetThemeEndpoint(IThemeStore store) : RadEndpoint<GetThemeRequest, GetThemeResponse>
    {
        public override void Configure()
        {
            Get("/api/themes/{themeId}")
                .Produces<GetThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("GetTheme")
                .WithSummary("Get Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Reads one shipped or custom theme.\n\n" +
                    "**Validation:**\n" +
                    "- The theme id is lowercase letters, digits and single hyphens"
                );
        }

        public override Task Handle(GetThemeRequest r, CancellationToken ct)
        {
            var theme = store.GetTheme(r.ThemeId);

            if (theme is null)
            {
                SendNotFound($"The theme {r.ThemeId} was not found.");
                return Task.CompletedTask;
            }

            Response = new() { Theme = ThemeMapping.ToDto(theme) };
            Send();
            return Task.CompletedTask;
        }
    }
}
