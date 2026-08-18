using TeensyRom.Core.Music;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// The local metadata source a real projection needs: the HVSC CSV, which is what puts a real creator,
    /// title, and STIL commentary in front of <see cref="Core.Storage.Index.MetadataProjection"/>.
    /// </summary>
    public sealed record MetadataSources(string HvscCsvPath);

    /// <summary>
    /// Resolves the HVSC CSV beside the same data directory the real index file is read from, or explains
    /// where it was looked for. Resolution happens once per process: it touches the file system.
    /// </summary>
    /// <remarks>
    /// DeepSID is deliberately not resolved here. Its enrichment adds links, tags, ratings, videos, and
    /// competitions (<see cref="SidMetadataService"/>), none of which reach <c>content_metadata</c> or
    /// <c>content_search</c> — the projection persists title, creator, and description — so it cannot change
    /// a search result, and its export is a ~95&#160;MB JSON load per run.
    /// </remarks>
    public static class MetadataSourceAvailability
    {
        private const string Data_Dir_Environment_Variable = "TEENSYROM_DATA_DIR";

        private static readonly Lazy<(MetadataSources? Sources, string? Reason)> Resolution =
            new(Resolve, LazyThreadSafetyMode.ExecutionAndPublication);

        /// <summary>
        /// Reports whether the HVSC CSV is present. <paramref name="why"/> names what is missing and where it
        /// was searched, and is <see langword="null"/> only when the source resolved.
        /// </summary>
        public static bool HasHvsc(out string? why)
        {
            why = Resolution.Value.Reason;

            return why is null;
        }

        /// <summary>The resolved sources, or <see langword="null"/> when the HVSC CSV is absent.</summary>
        public static MetadataSources? TryResolve() => Resolution.Value.Sources;

        private static (MetadataSources?, string?) Resolve()
        {
            var dataDirectory = Environment.GetEnvironmentVariable(Data_Dir_Environment_Variable);

            if (string.IsNullOrWhiteSpace(dataDirectory))
            {
                return (null, $"No HVSC database: {Data_Dir_Environment_Variable} is not set, so there is " +
                              $"nowhere to look for '{MusicConstants.SidList_Local_Path}'.");
            }

            var sidListDirectory = Path.Combine(dataDirectory, MusicConstants.SidList_Local_Path);

            if (!Directory.Exists(sidListDirectory))
            {
                return (null, $"No HVSC database: '{sidListDirectory}' does not exist.");
            }

            // HvscDatabase's own rule when it resolves the CSV itself: newest export wins.
            var csvPath = Directory
                .GetFiles(sidListDirectory, "*.csv")
                .Select(path => new FileInfo(path))
                .OrderByDescending(file => file.LastWriteTime)
                .FirstOrDefault();

            return csvPath is null
                ? (null, $"No HVSC database: no '*.csv' file in '{sidListDirectory}'.")
                : (new MetadataSources(csvPath.FullName), null);
        }
    }
}
