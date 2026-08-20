using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index.Fixtures;
using Xunit;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// The pair of local, uncommitted inputs a full-scale comparison needs: an extracted index fixture and
    /// the real index file of the same device.
    /// </summary>
    public sealed record FixtureInputs(string FixturePath, IndexFixtureHeader Header, string DataDirectory, string IndexFilePath);

    /// <summary>
    /// Resolves the fixture/index pair, or explains which half is missing and where it was looked for.
    /// Resolution happens once per process: it touches the file system and every test in the suite asks.
    /// </summary>
    public static class FixtureAvailability
    {
        private const string Data_Dir_Environment_Variable = "TEENSYROM_DATA_DIR";
        private const string Fixture_Search_Pattern = "*.tsv";

        private static readonly Lazy<(FixtureInputs? Inputs, string? Reason)> Resolution =
            new(Resolve, LazyThreadSafetyMode.ExecutionAndPublication);

        /// <summary>
        /// Reports whether both inputs are present. <paramref name="why"/> names the missing half and the
        /// location that was searched, and is <see langword="null"/> only when the pair resolved.
        /// </summary>
        public static bool HasFixtureAndIndex(out string? why)
        {
            why = Resolution.Value.Reason;

            return why is null;
        }

        /// <summary>
        /// The resolved pair. Throws when the pair is absent — every caller is gated by
        /// <see cref="FixtureFactAttribute"/>, so reaching this without inputs is a wiring bug, not a skip.
        /// </summary>
        public static FixtureInputs Require() =>
            Resolution.Value.Inputs ?? throw new InvalidOperationException(Resolution.Value.Reason);

        /// <summary>
        /// Mirrors <see cref="SimpleStorageCache"/>'s own resolution so the cache and the comparison agree on
        /// which file is "the real index file" for a device.
        /// </summary>
        public static string ResolveIndexFilePath(string dataDirectory, IndexFixtureHeader header)
        {
            var prefix = header.StorageType == TeensyStorageType.SD
                ? StorageHelper.Sd_Cache_File_Name
                : StorageHelper.Usb_Cache_File_Name;

            return Path.Combine(
                dataDirectory,
                StorageHelper.Cache_File_Relative_Path,
                $"{prefix}{header.DeviceId}{StorageHelper.Cache_File_Extension}");
        }

        private static (FixtureInputs?, string?) Resolve()
        {
            string fixtureDirectory;

            try
            {
                fixtureDirectory = IndexFixturePaths.ResolveDirectory();
            }
            catch (DirectoryNotFoundException exception)
            {
                return (null, $"No index fixture: {exception.Message}");
            }

            if (!Directory.Exists(fixtureDirectory))
            {
                return (null, $"No index fixture: the fixture directory '{fixtureDirectory}' does not exist.");
            }

            var fixturePaths = Directory
                .GetFiles(fixtureDirectory, Fixture_Search_Pattern)
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToArray();

            if (fixturePaths.Length == 0)
            {
                return (null, $"No index fixture: no '{Fixture_Search_Pattern}' file in '{fixtureDirectory}'.");
            }

            var dataDirectory = Environment.GetEnvironmentVariable(Data_Dir_Environment_Variable);

            if (string.IsNullOrWhiteSpace(dataDirectory))
            {
                return (null, $"No real index file: {Data_Dir_Environment_Variable} is not set, so there is " +
                              $"nowhere to look for '{StorageHelper.Cache_File_Relative_Path}'. " +
                              $"Fixtures found in '{fixtureDirectory}': {string.Join(", ", fixturePaths.Select(Path.GetFileName))}.");
            }

            var rejections = new List<string>();

            foreach (var fixturePath in fixturePaths)
            {
                IndexFixtureHeader header;

                try
                {
                    header = IndexFixtureReader.ReadHeader(fixturePath);
                }
                catch (Exception exception) when (exception is InvalidDataException or IOException)
                {
                    rejections.Add($"'{fixturePath}' is not a readable index fixture ({exception.Message})");
                    continue;
                }

                var indexFilePath = ResolveIndexFilePath(dataDirectory, header);

                if (File.Exists(indexFilePath))
                {
                    return (new FixtureInputs(fixturePath, header, dataDirectory, indexFilePath), null);
                }

                rejections.Add($"'{fixturePath}' (device '{header.DeviceId}', {header.StorageType}) has no " +
                               $"matching index file at '{indexFilePath}'");
            }

            return (null, $"No fixture paired with a real index file: {string.Join("; ", rejections)}.");
        }
    }

    /// <summary>
    /// A fact that skips — rather than fails — when the local fixture or the real index file is absent.
    /// Both inputs are personal collection listings and neither is committed, so most machines have neither.
    /// </summary>
    public sealed class FixtureFactAttribute : FactAttribute
    {
        public FixtureFactAttribute()
        {
            if (!FixtureAvailability.HasFixtureAndIndex(out var why))
            {
                Skip = why;
            }
        }
    }
}
