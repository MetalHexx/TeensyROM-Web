namespace TeensyRom.Cli.PathSetup;

/// <summary>One folder <c>trom</c> put on the PATH, where it did so, and whether that folder still holds <c>trom</c>.</summary>
internal sealed record PathEntry(string Location, string Folder, bool Stale);

/// <summary>What <c>trom path status</c> reports: whether <c>trom</c> resolves now, and every entry <c>trom</c> manages.</summary>
internal sealed record PathStatus(bool OnPath, IReadOnlyList<PathEntry> Entries);

/// <summary>What <c>trom path add</c> and <c>remove</c> report: whether anything changed, the folder, and where.</summary>
internal sealed record PathChange(bool Changed, string Folder, IReadOnlyList<string> Locations);

internal enum PathPlatform { Windows, MacOS, Linux }

/// <summary>
/// What the PATH setup depends on in its surroundings, so tests substitute all of it.
/// </summary>
/// <param name="InstallFolder">The folder holding <c>trom</c>, without a trailing separator.</param>
/// <param name="Home">The user's home directory.</param>
/// <param name="Shell">The <c>$SHELL</c> value, if any.</param>
/// <param name="PathVariable">The process's <c>PATH</c>.</param>
internal sealed record PathEnvironment(string InstallFolder, string Home, string? Shell, PathPlatform Platform, string? PathVariable)
{
    public string ExecutableName => Platform == PathPlatform.Windows ? "trom.exe" : "trom";

    public char Separator => Platform == PathPlatform.Windows ? ';' : ':';

    /// <summary>The real process: this CLI's own folder, the user's home, <c>$SHELL</c> and <c>PATH</c>.</summary>
    public static PathEnvironment Current() => new(
        TrimSeparators(Path.GetFullPath(AppContext.BaseDirectory)),
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        Environment.GetEnvironmentVariable("SHELL"),
        OperatingSystem.IsWindows() ? PathPlatform.Windows : OperatingSystem.IsMacOS() ? PathPlatform.MacOS : PathPlatform.Linux,
        Environment.GetEnvironmentVariable("PATH"));

    /// <summary>True when <paramref name="folder"/> holds <c>trom</c>.</summary>
    public bool HoldsTrom(string folder)
    {
        try { return File.Exists(Path.Combine(folder, ExecutableName)); }
        catch (ArgumentException) { return false; }
    }

    /// <summary>True when some directory of <see cref="PathVariable"/> holds <c>trom</c>.</summary>
    public bool TromIsOnPath() =>
        (PathVariable ?? string.Empty)
            .Split(Separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(entry => entry.Trim('"'))
            .Any(HoldsTrom);

    /// <summary>The path without trailing separators, unless it is a root.</summary>
    public static string TrimSeparators(string path)
    {
        var trimmed = path.TrimEnd('\\', '/');

        return trimmed.Length == 0 || Path.GetPathRoot(path)?.Length >= path.Length ? path : trimmed;
    }
}
