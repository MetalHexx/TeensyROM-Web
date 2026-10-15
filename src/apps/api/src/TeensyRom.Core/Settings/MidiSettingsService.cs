using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Settings
{
    /// <summary>
    /// Keeps the MIDI settings set in midi-settings.json, cached in memory after the first read.
    /// A missing file is an empty set and is only created by <see cref="Save"/>. A file that cannot be read
    /// is treated as empty and left in place until the next <see cref="Save"/> replaces it.
    /// </summary>
    public class MidiSettingsService(ILoggingService log) : IMidiSettingsService
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

        private static string FilePath => Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), SettingsConstants.MidiSettingsPath);

        private readonly object _lock = new();
        private MidiSettings? _current;

        public MidiSettings Get()
        {
            lock (_lock)
            {
                _current ??= Load();
                return Copy(_current);
            }
        }

        public bool Save(MidiSettings settings)
        {
            lock (_lock)
            {
                var path = FilePath;
                var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";

                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                    File.WriteAllText(tempPath, JsonSerializer.Serialize(settings, JsonOptions));
                    File.Move(tempPath, path, overwrite: true);
                    _current = Copy(settings);
                    return true;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    log.InternalError($"Failed to save MIDI settings to '{path}': {ex.Message}");
                    TryDelete(tempPath);
                    return false;
                }
            }
        }

        private MidiSettings Load()
        {
            var path = FilePath;
            if (!File.Exists(path)) return new MidiSettings();

            try
            {
                var settings = JsonSerializer.Deserialize<MidiSettings>(File.ReadAllText(path), JsonOptions);
                if (settings is not null) return Copy(settings);

                log.InternalWarning($"The MIDI settings file '{path}' is empty. Using an empty set.");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
            {
                log.InternalWarning($"The MIDI settings file '{path}' could not be read ({ex.Message}). Using an empty set.");
            }
            return new MidiSettings();
        }

        /// <summary>
        /// Copies the lists so callers and the cache never share them. A list the file holds as null becomes empty.
        /// </summary>
        private static MidiSettings Copy(MidiSettings settings) => new()
        {
            Controllers = [.. settings.Controllers ?? []],
            Mappings = [.. settings.Mappings ?? []],
            DeckBindings = [.. settings.DeckBindings ?? []]
        };

        private void TryDelete(string path)
        {
            try
            {
                File.Delete(path);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                log.InternalWarning($"Could not remove the temporary MIDI settings file '{path}': {ex.Message}");
            }
        }
    }
}
