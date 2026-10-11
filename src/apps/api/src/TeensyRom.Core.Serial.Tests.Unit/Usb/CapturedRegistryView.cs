using System.Text.Json;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Usb
{
    /// <summary>
    /// Loads a captured registry key/value set (see Usb/Captured/windows-registry.json) into an
    /// <see cref="IRegistryView"/> fake, so <see cref="WindowsRegistryDescriptorReader"/> tests run against
    /// a captured layout instead of the live registry.
    /// </summary>
    internal sealed class CapturedRegistryView : IRegistryView
    {
        private readonly Dictionary<string, RegistryKeyFixture> _keys;

        private CapturedRegistryView(Dictionary<string, RegistryKeyFixture> keys)
        {
            _keys = keys;
        }

        public static CapturedRegistryView Load(string jsonFilePath)
        {
            var json = File.ReadAllText(jsonFilePath);
            var document = JsonSerializer.Deserialize<RegistryFixtureFile>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? throw new InvalidOperationException($"Captured registry fixture '{jsonFilePath}' is empty or malformed.");

            return new CapturedRegistryView(new Dictionary<string, RegistryKeyFixture>(document.Keys, StringComparer.OrdinalIgnoreCase));
        }

        public string[] SubKeys(string path) =>
            _keys.TryGetValue(path, out var key) ? key.SubKeys ?? [] : [];

        public string? Value(string path, string name) =>
            _keys.TryGetValue(path, out var key) && key.Values is not null && key.Values.TryGetValue(name, out var value)
                ? value
                : null;

        private sealed class RegistryFixtureFile
        {
            public Dictionary<string, RegistryKeyFixture> Keys { get; set; } = [];
        }

        private sealed class RegistryKeyFixture
        {
            public string[]? SubKeys { get; set; }
            public Dictionary<string, string>? Values { get; set; }
        }
    }
}
