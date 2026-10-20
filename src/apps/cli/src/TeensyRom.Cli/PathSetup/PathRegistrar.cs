using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.PathSetup;

/// <summary>
/// Puts the folder holding <c>trom</c> on the user's PATH and takes it off again: the Windows user PATH, or the
/// shell startup files on Mac and Linux. The machine PATH is never touched.
/// </summary>
internal sealed class PathRegistrar(PathEnvironment env, IUserPathStore? userPath, ISettingsService settingsService)
{
    public const string WindowsLocation = "the Windows user PATH";

    private readonly ShellProfileStore _shell = new(env);

    /// <summary>The registrar over the real process, registry and home.</summary>
    public static PathRegistrar CreateDefault(ISettingsService settingsService) => new(
        PathEnvironment.Current(),
        OperatingSystem.IsWindows() ? new WindowsUserPathStore() : null,
        settingsService);

    public string InstallFolder => env.InstallFolder;

    /// <summary>True when some directory of the process's PATH holds <c>trom</c>.</summary>
    public bool IsOnPath() => env.TromIsOnPath();

    /// <summary>Whether <c>trom</c> resolves now, and every PATH entry <c>trom</c> manages.</summary>
    public PathStatus Status() => new(IsOnPath(), UsesWindowsStore ? WindowsEntries() : _shell.Entries());

    /// <summary>Puts <see cref="InstallFolder"/> on the PATH; doing it again changes nothing.</summary>
    public PathChange Add() => UsesWindowsStore ? AddToWindows() : _shell.Add(env.InstallFolder);

    /// <summary>Takes off exactly what <see cref="Add"/> put on.</summary>
    public PathChange Remove() => UsesWindowsStore ? RemoveFromWindows() : _shell.Remove(env.InstallFolder);

    private bool UsesWindowsStore => env.Platform == PathPlatform.Windows && userPath is not null;

    private PathChange AddToWindows()
    {
        var folder = env.InstallFolder;
        var before = Split(userPath!.Read());
        var recorded = settingsService.GetSettings().PathEntriesAdded;
        var stale = recorded.Where(entry => !Same(entry, folder) && !env.HoldsTrom(entry)).ToList();

        var entries = before.Where(entry => !stale.Any(old => Same(old, entry))).ToList();
        var kept = recorded.Where(entry => !stale.Contains(entry)).ToList();

        if (!entries.Any(entry => Same(entry, folder)))
        {
            entries.Add(folder);
            if (!kept.Any(entry => Same(entry, folder))) kept.Add(folder);
        }

        var changed = !entries.SequenceEqual(before);

        if (changed) userPath.Write(string.Join(';', entries));
        if (!kept.SequenceEqual(recorded)) Record(kept);

        return new PathChange(changed, folder, [WindowsLocation]);
    }

    private PathChange RemoveFromWindows()
    {
        var recorded = settingsService.GetSettings().PathEntriesAdded;
        var before = Split(userPath!.Read());
        var entries = before.Where(entry => !recorded.Any(added => Same(added, entry))).ToList();
        var changed = entries.Count != before.Count;

        if (changed) userPath.Write(string.Join(';', entries));
        if (recorded.Count > 0) Record([]);

        return new PathChange(changed, env.InstallFolder, changed ? [WindowsLocation] : []);
    }

    private List<PathEntry> WindowsEntries()
    {
        var present = Split(userPath!.Read());

        return settingsService.GetSettings().PathEntriesAdded
            .Where(added => present.Any(entry => Same(entry, added)))
            .Select(added => new PathEntry(WindowsLocation, added, !env.HoldsTrom(added)))
            .ToList();
    }

    private void Record(List<string> entries)
    {
        var settings = settingsService.GetSettings();
        settings.PathEntriesAdded = entries;
        settingsService.SaveSettings(settings);
    }

    private static List<string> Split(string? value) =>
        (value ?? string.Empty).Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    /// <summary>Windows folder equality: case-insensitive, ignoring a trailing separator.</summary>
    private static bool Same(string a, string b) =>
        string.Equals(a.TrimEnd('\\', '/'), b.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase);
}
