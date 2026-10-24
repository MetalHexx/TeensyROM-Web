namespace TeensyRom.Cli.Common;

/// <summary>
/// Turns names that came from the TeensyROM into a path on this computer, refusing any that would land outside the
/// chosen folder or that this computer can't hold under that name. Nothing is ever renamed to make it fit.
/// </summary>
internal static class LocalTargetPath
{
    private static readonly HashSet<string> WindowsReservedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    };

    private static readonly char[] InvalidChars = [.. Path.GetInvalidFileNameChars(), ':', '\\', '/'];

    /// <summary>The path <paramref name="segments"/> name under <paramref name="root"/>, or the reason they can't be saved there.</summary>
    /// <param name="segments">Folder names then the file name, as the device reports them.</param>
    /// <returns>Exactly one of <c>FullPath</c> and <c>Problem</c> is set; <c>Problem</c> is a sentence naming the offending segment.</returns>
    public static (string? FullPath, string? Problem) Resolve(string root, IReadOnlyList<string> segments)
    {
        if (segments.Count == 0) return (null, "Nothing to save.");

        foreach (var segment in segments)
        {
            if (!IsSafeName(segment)) return (null, Unsavable(segment));
        }
        var fullRoot = Path.GetFullPath(root);
        var prefix = Path.TrimEndingDirectorySeparator(fullRoot) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine([fullRoot, .. segments]));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        return full.StartsWith(prefix, comparison) ? (full, null) : (null, Unsavable(segments[^1]));
    }

    private static string Unsavable(string name) =>
        $"{(name.Length == 0 ? "A file with no name" : name)} can't be saved on this computer under that name.";

    private static bool IsSafeName(string segment)
    {
        if (segment.Length == 0 || segment is "." or "..") return false;
        if (segment.IndexOfAny(InvalidChars) >= 0) return false;
        if (!OperatingSystem.IsWindows()) return true;

        // Windows drops a trailing dot or space, which would quietly save the file under another name.
        if (segment[^1] is '.' or ' ') return false;

        var stem = segment.Split('.')[0].TrimEnd(' ');

        return !WindowsReservedNames.Contains(stem);
    }
}
