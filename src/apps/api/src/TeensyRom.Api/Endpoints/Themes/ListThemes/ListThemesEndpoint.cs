using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.ListThemes
{
    public class ListThemesEndpoint(IThemeStore store) : RadEndpointWithoutRequest<ListThemesResponse>
    {
        public override void Configure()
        {
            Get("/api/themes")
                .Produces<ListThemesResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("ListThemes")
                .WithSummary("List Themes")
                .WithTags("Themes")
                .WithDescription(
                    "Lists every theme: the shipped themes by sort order, then the custom themes by name.\n\n" +
                    "A custom theme whose file is corrupt is skipped and left on disk."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            Response = new() { Themes = store.ListThemes().Select(ThemeMapping.ToDto).ToList() };
            Send();
            return Task.CompletedTask;
        }
    }
}
