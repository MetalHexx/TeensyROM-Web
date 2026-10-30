using TeensyRom.Core.Settings;
using MidiSettingsEntity = TeensyRom.Core.Settings.MidiSettings;

namespace TeensyRom.Api.Endpoints.MidiSettings.GetMidiSettings
{
    public class GetMidiSettingsMapper : IRadMapper<object, GetMidiSettingsResponse, MidiSettingsEntity>
    {
        public GetMidiSettingsResponse FromEntity(MidiSettingsEntity entity)
        {
            return new GetMidiSettingsResponse
            {
                Controllers = entity.Controllers.Select(MapController).ToList(),
                Mappings = entity.Mappings.Select(MapMapping).ToList(),
                DeckBindings = entity.DeckBindings.Select(MapDeckBinding).ToList()
            };
        }

        public MidiSettingsEntity ToEntity(object request) => throw new NotImplementedException();

        private static KnownMidiControllerDto MapController(KnownMidiController entity)
        {
            return new KnownMidiControllerDto
            {
                Id = entity.Id,
                Name = entity.Name,
                LastPortId = entity.LastPortId,
                Listening = entity.Listening
            };
        }

        private static MidiControlMappingDto MapMapping(MidiControlMapping entity)
        {
            return new MidiControlMappingDto
            {
                Id = entity.Id,
                Source = new MidiSourceDto
                {
                    ControllerId = entity.Source.ControllerId,
                    Channel = entity.Source.Channel,
                    Kind = entity.Source.Kind,
                    Number = entity.Source.Number
                },
                Owner = entity.Owner,
                Control = entity.Control,
                Style = new MidiMappingStyleDto
                {
                    Kind = entity.Style.Kind,
                    Amount = entity.Style.Amount,
                    Grip = entity.Style.Grip
                }
            };
        }

        private static DeckDeviceBindingDto MapDeckBinding(DeckDeviceBinding entity)
        {
            return new DeckDeviceBindingDto
            {
                Slot = entity.Slot,
                DeviceId = entity.DeviceId,
                LastSeenName = entity.LastSeenName
            };
        }
    }
}
