namespace TeensyRom.Core.Settings
{
    /// <summary>
    /// File-backed store for the MIDI settings set (midi-settings.json beside Settings.json).
    /// </summary>
    public interface IMidiSettingsService
    {
        /// <summary>
        /// A copy of the cached set. An empty set when there is no file, or the file cannot be read.
        /// </summary>
        MidiSettings Get();

        /// <summary>
        /// Replaces the stored set as a whole. Returns false, after logging, when the file could not be written.
        /// </summary>
        bool Save(MidiSettings settings);
    }
}
