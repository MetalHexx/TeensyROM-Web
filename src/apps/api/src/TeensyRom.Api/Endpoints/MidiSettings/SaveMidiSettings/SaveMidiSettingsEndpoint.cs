using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.MidiSettings.SaveMidiSettings
{
    public class SaveMidiSettingsEndpoint(IMidiSettingsService midiSettingsService)
        : RadEndpoint<SaveMidiSettingsRequest, SaveMidiSettingsResponse, SaveMidiSettingsMapper>
    {
        public override void Configure()
        {
            Post("/api/midi-settings")
                .Produces<SaveMidiSettingsResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveMidiSettings")
                .WithSummary("Save MIDI Settings")
                .WithTags("MidiSettings")
                .WithDescription(
                    "Saves the whole MIDI settings set: known controllers, control mappings and deck-to-cartridge bindings.\n\n" +
                    "The set replaces the stored one and is persisted to midi-settings.json beside Settings.json.\n\n" +
                    "**Validation:**\n" +
                    "- At most 64 controllers, 1024 mappings and 2 deck bindings\n" +
                    "- Controller and mapping IDs are 1-64 letters, digits, hyphens or underscores, and unique\n" +
                    "- Each mapping source names a controller in the same request, and no two mappings share a source\n" +
                    "- Mapping owner is A, B or mixer; the control must be a known deck control (A, B); the mixer owns none\n" +
                    "- Style kind must be known; amount is required (and range-checked) for relative-offset, relative-signed and step, optional (range-checked) for hold, and null otherwise\n" +
                    "- Deck slots are A or B, each bound at most once, to different devices\n\n" +
                    "Anything outside these rules is rejected with a 400 and nothing is written."
                );
        }

        public override Task Handle(SaveMidiSettingsRequest request, CancellationToken ct)
        {
            var settings = Map.ToEntity(request);
            var saveSuccess = midiSettingsService.Save(settings);

            if (!saveSuccess)
            {
                SendExternalError("Failed to save MIDI settings to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = Map.FromEntity(settings);
            Send();
            return Task.CompletedTask;
        }
    }
}
