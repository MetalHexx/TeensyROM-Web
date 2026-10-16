namespace TeensyRom.Core.Settings
{
    /// <summary>
    /// The MIDI controller setup: known controllers, their control mappings and the deck-to-cartridge bindings.
    /// Persisted on its own in midi-settings.json, independent of Settings.json.
    /// </summary>
    public record MidiSettings
    {
        public List<KnownMidiController> Controllers { get; init; } = [];
        public List<MidiControlMapping> Mappings { get; init; } = [];
        public List<DeckDeviceBinding> DeckBindings { get; init; } = [];
    }

    /// <summary>
    /// A MIDI controller the app has seen. <see cref="LastPortId"/> is the browser's port id the last time it was connected.
    /// </summary>
    public record KnownMidiController
    {
        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string? LastPortId { get; init; }
        public bool Listening { get; init; }
    }

    /// <summary>
    /// The MIDI message a mapping listens for. <see cref="Kind"/> is "note" or "cc".
    /// </summary>
    public record MidiSource
    {
        public string ControllerId { get; init; } = string.Empty;
        public int Channel { get; init; }
        public string Kind { get; init; } = string.Empty;
        public int Number { get; init; }
    }

    /// <summary>
    /// How a mapped message drives its control. <see cref="Amount"/> is only set for relative and step styles.
    /// </summary>
    public record MidiMappingStyle
    {
        public string Kind { get; init; } = string.Empty;
        public double? Amount { get; init; }
    }

    /// <summary>
    /// Binds a <see cref="MidiSource"/> to a control on a deck ("A", "B") or the mixer ("mixer").
    /// </summary>
    public record MidiControlMapping
    {
        public string Id { get; init; } = string.Empty;
        public MidiSource Source { get; init; } = new();
        public string Owner { get; init; } = string.Empty;
        public string Control { get; init; } = string.Empty;
        public MidiMappingStyle Style { get; init; } = new();
    }

    /// <summary>
    /// Binds a deck slot ("A" or "B") to a TeensyROM cartridge by device id.
    /// </summary>
    public record DeckDeviceBinding
    {
        public string Slot { get; init; } = string.Empty;
        public string DeviceId { get; init; } = string.Empty;
        public string LastSeenName { get; init; } = string.Empty;
    }
}
