using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.MidiSettings.GetMidiSettings
{
    /// <summary>
    /// Response model containing the whole MIDI settings set.
    /// </summary>
    public record GetMidiSettingsResponse
    {
        /// <summary>
        /// MIDI controllers the app has seen before.
        /// </summary>
        [Required] public List<KnownMidiControllerDto> Controllers { get; set; } = [];

        /// <summary>
        /// Mappings from MIDI messages to deck and mixer controls.
        /// </summary>
        [Required] public List<MidiControlMappingDto> Mappings { get; set; } = [];

        /// <summary>
        /// Which TeensyROM cartridge each deck slot is bound to.
        /// </summary>
        [Required] public List<DeckDeviceBindingDto> DeckBindings { get; set; } = [];
    }
}
