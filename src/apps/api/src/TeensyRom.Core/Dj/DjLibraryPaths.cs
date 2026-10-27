using System.Text.RegularExpressions;

namespace TeensyRom.Core.Dj
{
    /// <summary>
    /// Folder and file names of the DJ library, which sits under the engine's home beside Assets.
    /// </summary>
    public static class DjLibraryPaths
    {
        public const string RootFolder = "dj";
        public const string SetsFolder = "sets";
        public const string TunesFolder = "tunes";
        public const string LibraryFile = "library.json";
        public const string Extension = ".json";
    }

    /// <summary>
    /// The only shapes an id may take before it is used to build a path.
    /// </summary>
    public static partial class DjLibraryIds
    {
        [GeneratedRegex(@"^[0-9a-f]{32}\z")]
        private static partial Regex SidHashPattern();

        /// <summary>
        /// A lowercase GUID in the hyphenated "D" format.
        /// </summary>
        public static bool IsSetId(string? id) =>
            id is not null && Guid.TryParseExact(id, "D", out _) && string.Equals(id, id.ToLowerInvariant(), StringComparison.Ordinal);

        /// <summary>
        /// Thirty-two lowercase hexadecimal characters.
        /// </summary>
        public static bool IsSidHash(string? hash) => hash is not null && SidHashPattern().IsMatch(hash);
    }
}
