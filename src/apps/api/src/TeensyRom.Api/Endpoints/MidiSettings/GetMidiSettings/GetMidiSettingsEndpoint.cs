using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.MidiSettings.GetMidiSettings
{
    public class GetMidiSettingsEndpoint(IMidiSettingsService midiSettingsService)
        : RadEndpointWithoutRequest<GetMidiSettingsResponse, GetMidiSettingsMapper>
    {
        public override void Configure()
        {
            Get("/api/midi-settings")
                .Produces<GetMidiSettingsResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetMidiSettings")
                .WithSummary("Get MIDI Settings")
                .WithTags("MidiSettings")
                .WithDescription(
                    "Retrieves the MIDI settings set: known controllers, control mappings and deck-to-cartridge bindings.\n\n" +
                    "The set lives in midi-settings.json beside Settings.json and is cached in memory. " +
                    "When no file exists yet, all three lists are empty and no file is created."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var settings = midiSettingsService.Get();
            Response = Map.FromEntity(settings);
            Send();
            return Task.CompletedTask;
        }
    }
}
