using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.DeleteTheme
{
    public class DeleteThemeEndpoint(IThemeStore store) : RadEndpoint<DeleteThemeRequest, DeleteThemeResponse>
    {
        public override void Configure()
        {
            Delete("/api/themes/{themeId}")
                .Produces<DeleteThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("DeleteTheme")
                .WithSummary("Delete Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Deletes a custom theme file. Shipped themes can't be deleted.\n\n" +
                    "Device records that name the theme are kept.\n\n" +
                    "**Validation:**\n" +
                    "- The theme id is lowercase letters, digits and single hyphens"
                );
        }

        public override Task Handle(DeleteThemeRequest r, CancellationToken ct)
        {
            switch (store.DeleteCustom(r.ThemeId))
            {
                case ThemeDeleteStatus.Deleted:
                    Response = new();
                    Send();
                    break;
                case ThemeDeleteStatus.NotFound:
                    SendNotFound($"The theme {r.ThemeId} was not found.");
                    break;
                case ThemeDeleteStatus.ShippedReadOnly:
                    SendValidationError("Shipped themes can't be changed. Save a copy with a new name.");
                    break;
                default:
                    SendInternalError("Failed to delete the theme from disk. Please check file permissions and try again.");
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
