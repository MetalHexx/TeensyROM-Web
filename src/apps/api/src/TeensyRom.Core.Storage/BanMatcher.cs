namespace TeensyRom.Core.Storage;

/// <summary>
/// The single rule for deciding whether a file name or directory path is banned. Names and path
/// segments are compared whole, ignoring case; nothing is matched as a substring.
/// </summary>
public static class BanMatcher
{
    /// <summary>
    /// True when <paramref name="fileName"/> equals a banned entry after trimming leading and trailing
    /// slashes from both. Blank entries are ignored.
    /// </summary>
    public static bool IsBannedFile(string fileName, IReadOnlyCollection<string> bannedFiles)
    {
        var name = fileName?.Trim('/');

        if (string.IsNullOrEmpty(name)) return false;

        foreach (var entry in bannedFiles)
        {
            var banned = entry?.Trim('/');

            if (string.IsNullOrEmpty(banned)) continue;

            if (name.Equals(banned, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    /// <summary>
    /// True when <paramref name="directoryPath"/> or any directory above it is banned. An entry with a
    /// leading '/' is anchored at the root: its segments must be a prefix of the path's segments. An
    /// entry without one matches when its segments appear as a contiguous run anywhere in the path.
    /// The root is never banned and blank entries are ignored.
    /// </summary>
    public static bool IsBannedDirectory(string directoryPath, IReadOnlyCollection<string> bannedDirectories)
    {
        if (string.IsNullOrWhiteSpace(directoryPath)) return false;

        var pathSegments = SplitSegments(directoryPath);

        if (pathSegments.Length == 0) return false;

        foreach (var entry in bannedDirectories)
        {
            if (string.IsNullOrWhiteSpace(entry)) continue;

            var entrySegments = SplitSegments(entry);

            if (entrySegments.Length == 0 || entrySegments.Length > pathSegments.Length) continue;

            var lastStart = entry.StartsWith('/') ? 0 : pathSegments.Length - entrySegments.Length;

            for (var start = 0; start <= lastStart; start++)
            {
                if (SegmentsMatchAt(pathSegments, entrySegments, start)) return true;
            }
        }
        return false;
    }

    private static string[] SplitSegments(string path) => path.Split('/', StringSplitOptions.RemoveEmptyEntries);

    private static bool SegmentsMatchAt(string[] pathSegments, string[] entrySegments, int start)
    {
        for (var i = 0; i < entrySegments.Length; i++)
        {
            if (!pathSegments[start + i].Equals(entrySegments[i], StringComparison.OrdinalIgnoreCase)) return false;
        }
        return true;
    }
}
