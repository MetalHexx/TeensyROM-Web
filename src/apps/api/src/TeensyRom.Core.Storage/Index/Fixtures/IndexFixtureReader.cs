using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index.Fixtures
{
    /// <summary>
    /// Reads the tab-separated index fixture format produced by the (throwaway) index extractor. Streams one
    /// record at a time so a consumer never holds the whole collection in memory.
    /// </summary>
    public static class IndexFixtureReader
    {
        private const string MagicHeader = "#teensyrom-index-fixture";

        public static IndexFixtureHeader ReadHeader(string fixturePath)
        {
            using var reader = new StreamReader(fixturePath);
            return ParseHeader(reader.ReadLine());
        }

        public static IEnumerable<IndexFixtureRecord> Read(string fixturePath)
        {
            using var reader = new StreamReader(fixturePath);

            ParseHeader(reader.ReadLine());

            var lineNumber = 1;
            string? line;

            while ((line = reader.ReadLine()) is not null)
            {
                lineNumber++;

                var fields = line.Split('\t');
                if (fields.Length != 3)
                {
                    throw new InvalidDataException(
                        $"Malformed fixture record at line {lineNumber}: expected 3 tab-separated fields, found {fields.Length}.");
                }

                if (!long.TryParse(fields[2], out var size))
                {
                    throw new InvalidDataException(
                        $"Malformed fixture record at line {lineNumber}: size '{fields[2]}' is not a valid integer.");
                }

                yield return new IndexFixtureRecord(fields[0], fields[1], size);
            }
        }

        private static IndexFixtureHeader ParseHeader(string? line)
        {
            const int lineNumber = 1;

            if (string.IsNullOrEmpty(line))
            {
                throw new InvalidDataException($"Fixture header missing at line {lineNumber}.");
            }

            var fields = line.Split('\t');
            if (fields.Length != 5 || fields[0] != MagicHeader)
            {
                throw new InvalidDataException($"Malformed fixture header at line {lineNumber}.");
            }

            if (!fields[1].StartsWith('v') || !int.TryParse(fields[1].AsSpan(1), out var version) || version != 1)
            {
                throw new InvalidDataException($"Unsupported fixture version '{fields[1]}' at line {lineNumber}.");
            }

            var deviceId = ParseKeyValue(fields[2], "device", lineNumber);
            var storageTypeRaw = ParseKeyValue(fields[3], "storage", lineNumber);
            var fileCountRaw = ParseKeyValue(fields[4], "files", lineNumber);

            var storageType = storageTypeRaw.ToLowerInvariant() switch
            {
                "sd" => TeensyStorageType.SD,
                "usb" => TeensyStorageType.USB,
                _ => throw new InvalidDataException(
                    $"Malformed fixture header at line {lineNumber}: unknown storage type '{storageTypeRaw}'.")
            };

            if (!int.TryParse(fileCountRaw, out var fileCount))
            {
                throw new InvalidDataException(
                    $"Malformed fixture header at line {lineNumber}: files count '{fileCountRaw}' is not a valid integer.");
            }

            return new IndexFixtureHeader(version, deviceId, storageType, fileCount);
        }

        private static string ParseKeyValue(string field, string expectedKey, int lineNumber)
        {
            var parts = field.Split('=', 2);
            if (parts.Length != 2 || parts[0] != expectedKey)
            {
                throw new InvalidDataException(
                    $"Malformed fixture header at line {lineNumber}: expected a '{expectedKey}=...' field.");
            }

            return parts[1];
        }
    }
}
