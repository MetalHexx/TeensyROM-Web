using TeensyRom.Core.Settings;
using MidiSettingsEntity = TeensyRom.Core.Settings.MidiSettings;

namespace TeensyRom.Api.Endpoints.MidiSettings.SaveMidiSettings
{
    public class SaveMidiSettingsMapper : IRadMapper<SaveMidiSettingsRequest, SaveMidiSettingsResponse, MidiSettingsEntity>
    {
        public SaveMidiSettingsResponse FromEntity(MidiSettingsEntity entity)
        {
            return new SaveMidiSettingsResponse
            {
                Message = "MIDI settings saved successfully."
            };
        }

        /// <summary>
        /// Maps the request to the entity as a whole. There is no merge with the stored set:
        /// the app always sends the complete set.
        /// </summary>
        public MidiSettingsEntity ToEntity(SaveMidiSettingsRequest request)
        {
            return new MidiSettingsEntity
            {
                Controllers = request.Controllers.Select(MapController).ToList(),
                Mappings = request.Mappings.Select(MapMapping).ToList(),
                DeckBindings = request.DeckBindings.Select(MapDeckBinding).ToList()
            };
        }

        private static KnownMidiController MapController(KnownMidiControllerDto dto)
        {
            return new KnownMidiController
            {
                Id = dto.Id,
                Name = dto.Name,
                LastPortId = dto.LastPortId,
                Listening = dto.Listening
            };
        }

        private static MidiControlMapping MapMapping(MidiControlMappingDto dto)
        {
            return new MidiControlMapping
            {
                Id = dto.Id,
                Source = new MidiSource
                {
                    ControllerId = dto.Source.ControllerId,
                    Channel = dto.Source.Channel,
                    Kind = dto.Source.Kind,
                    Number = dto.Source.Number
                },
                Owner = dto.Owner,
                Control = dto.Control,
                Style = new MidiMappingStyle
                {
                    Kind = dto.Style.Kind,
                    Amount = dto.Style.Amount
                }
            };
        }

        private static DeckDeviceBinding MapDeckBinding(DeckDeviceBindingDto dto)
        {
            return new DeckDeviceBinding
            {
                Slot = dto.Slot,
                DeviceId = dto.DeviceId,
                LastSeenName = dto.LastSeenName
            };
        }
    }
}
