using RadEndpoints;
using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    public class GetSettingsEndpoint(ISettingsService settingsService) 
        : RadEndpointWithoutRequest<GetSettingsResponse, GetSettingsMapper>
    {
        public override void Configure()
        {
            Get("/settings")
                .Produces<GetSettingsResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetSettings")
                .WithSummary("Get User Settings")
                .WithTags("Settings")
                .WithDescription(
                    "Retrieves all current user settings for the TeensyROM application.\n\n" +
                    "**Settings Categories:**\n" +
                    "- **Connection Settings**: Device connectivity preferences (Serial/TCP)\n" +
                    "- **Player Settings**: Playback behavior and startup preferences\n" +
                    "- **File Transfer Settings**: Auto-copy and directory watching configuration\n" +
                    "- **Search Settings**: Search weights, stop words, and content exclusions\n" +
                    "- **App Settings**: Application lifecycle state\n\n" +
                    "Settings are loaded from the Settings.json file and cached in memory. " +
                    "This endpoint always returns the current in-memory settings state."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var settings = settingsService.GetSettings();
            Response = Map.FromEntity(settings);
            Send();
            return Task.CompletedTask;
        }
    }
}
