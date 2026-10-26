namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Path rules for watch folders: one normal form, and comparisons that follow the engine's filesystem.
    /// </summary>
    public static class WatchFolderPaths
    {
        /// <summary>Case-insensitive on Windows, case-sensitive elsewhere.</summary>
        public static StringComparison Comparison =>
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        /// <summary>
        /// The absolute form of <paramref name="path"/> without a trailing separator. A drive or filesystem root keeps its separator.
        /// </summary>
        public static string Normalize(string path) =>
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));

        /// <summary>Whether two normalized paths name the same folder.</summary>
        public static bool AreSame(string a, string b) => string.Equals(a, b, Comparison);

        /// <summary>Whether the normalized <paramref name="child"/> lies strictly inside the normalized <paramref name="parent"/>.</summary>
        public static bool IsNestedIn(string child, string parent)
        {
            var prefix = Path.EndsInDirectorySeparator(parent) ? parent : parent + Path.DirectorySeparatorChar;
            return child.StartsWith(prefix, Comparison);
        }
    }
}
