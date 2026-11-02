using System.Text.Json;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Update;

/// <summary>What the last release lookup found, kept in <see cref="TeensyRomHome.ReleaseCheckPath"/>.</summary>
/// <param name="CheckedAt">When a lookup last succeeded.</param>
/// <param name="Latest">The newest version with a package for this platform, pre-releases included.</param>
/// <param name="LatestStable">The newest stable version with a package for this platform.</param>
/// <param name="AttemptedAt">When the lookup now under way, or the last one that failed, began; cleared by a success.</param>
/// <param name="NotifiedAt">When the notice about an update was last printed.</param>
internal sealed record ReleaseCheckRecord(DateTimeOffset? CheckedAt, string? Latest, string? LatestStable, DateTimeOffset? AttemptedAt, DateTimeOffset? NotifiedAt);

/// <summary>The daily, cached look at whether a newer release is out.</summary>
internal interface IReleaseCheck
{
    /// <summary>
    /// What the last lookup found, without touching the network. Null when no lookup has succeeded, or when checking is
    /// off, which it is for a source build, an unknown install, a platform without a package and the <c>update-check</c> setting.
    /// </summary>
    UpdateStatus? Cached();

    /// <summary>When the update notice was last printed; null when it never was.</summary>
    DateTimeOffset? NotifiedAt();

    /// <summary>Looks up the releases when the last lookup is over a day old, and again after an hour when one failed. Never throws.</summary>
    Task RefreshAsync(TimeSpan timeout, CancellationToken ct = default);

    /// <summary><see cref="RefreshAsync"/> then <see cref="Cached"/>; a status with nothing known when checking is off or failed.</summary>
    Task<UpdateStatus> CurrentAsync(TimeSpan timeout, CancellationToken ct = default);

    /// <summary>Remembers the newest releases of a lookup that has just been made. Never throws.</summary>
    void Record(IReadOnlyList<ReleaseInfo> releases);

    /// <summary>Remembers that the update notice was just printed. Never throws.</summary>
    void MarkNotified();
}

/// <param name="installedVersion">This trom's version.</param>
/// <param name="rid">This platform's runtime identifier; null when the suite has no package for it.</param>
/// <param name="cachePath">Where the record lives; defaults to <see cref="TeensyRomHome.ReleaseCheckPath"/>.</param>
internal sealed class ReleaseCheck(
    IInstallInspector inspector,
    IReleaseClient client,
    ISettingsService settings,
    TimeProvider time,
    string installedVersion,
    string? rid,
    string? cachePath = null) : IReleaseCheck
{
    public static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    public static readonly TimeSpan RetryInterval = TimeSpan.FromHours(1);

    public UpdateStatus? Cached()
    {
        if (Subject() is not { } subject || Read() is not { CheckedAt: { } checkedAt } record) return null;

        var latest = Parse(subject.Installed.IsPreRelease ? record.Latest : record.LatestStable);

        return new UpdateStatus(
            subject.Installed.ToString(), latest?.ToString(), latest is { } newest && newest > subject.Installed, subject.Kind, checkedAt);
    }

    public DateTimeOffset? NotifiedAt() => Read()?.NotifiedAt;

    public async Task RefreshAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        try
        {
            if (Subject() is null) return;

            var now = time.GetUtcNow();
            var record = Read();

            if (!Due(record, now)) return;

            // Recorded before the lookup, so a command that ends before it does doesn't start another on every run.
            Write((record ?? new ReleaseCheckRecord(null, null, null, null, null)) with { AttemptedAt = now });

            Record(await client.GetReleasesAsync(timeout, ct));
        }
        catch (Exception)
        {
            // A failed lookup is never the user's problem; the attempt is on record and is retried in an hour.
        }
    }

    public async Task<UpdateStatus> CurrentAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        await RefreshAsync(timeout, ct);

        if (Cached() is { } status) return status;

        var installed = SemVersion.TryParse(installedVersion, out var version) ? version.ToString() : installedVersion;

        return new UpdateStatus(installed, null, false, inspector.Inspect().Kind, null);
    }

    public void Record(IReadOnlyList<ReleaseInfo> releases)
    {
        if (rid is null) return;

        var latest = ReleaseSelector.Newest(releases, rid, includePreReleases: true);
        var stable = ReleaseSelector.Newest(releases, rid, includePreReleases: false);

        Write(new ReleaseCheckRecord(time.GetUtcNow(), latest?.Version.ToString(), stable?.Version.ToString(), null, Read()?.NotifiedAt));
    }

    public void MarkNotified()
    {
        if (Read() is { } record) Write(record with { NotifiedAt = time.GetUtcNow() });
    }

    /// <summary>What to check for, or null when checking is off.</summary>
    private (SemVersion Installed, InstallKind Kind)? Subject()
    {
        if (rid is null || !settings.GetSettings().UpdateCheck || !SemVersion.TryParse(installedVersion, out var installed)) return null;

        var kind = inspector.Inspect().Kind;

        return kind is InstallKind.Release or InstallKind.Homebrew ? (installed, kind) : null;
    }

    private static bool Due(ReleaseCheckRecord? record, DateTimeOffset now) =>
        (record?.CheckedAt is not { } checkedAt || Age(checkedAt, now) >= Interval)
        && (record?.AttemptedAt is not { } attemptedAt || Age(attemptedAt, now) >= RetryInterval);

    // A time in the future, from a clock that was set back, counts as long ago rather than as fresh for years.
    private static TimeSpan Age(DateTimeOffset then, DateTimeOffset now) => then > now ? TimeSpan.MaxValue : now - then;

    private static SemVersion? Parse(string? text) => SemVersion.TryParse(text, out var version) ? version : null;

    private string CacheFile => cachePath ?? TeensyRomHome.ReleaseCheckPath;

    private ReleaseCheckRecord? Read()
    {
        try
        {
            return JsonSerializer.Deserialize<ReleaseCheckRecord>(File.ReadAllText(CacheFile), CliJson.Indented);
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    /// <summary>Writes the record whole through a temp file, so a reader or a crash never sees half of it.</summary>
    private void Write(ReleaseCheckRecord record)
    {
        var temp = $"{CacheFile}.{Guid.NewGuid():N}.tmp";

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(CacheFile)!);
            File.WriteAllText(temp, JsonSerializer.Serialize(record, CliJson.Indented));
            File.Move(temp, CacheFile, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            try { File.Delete(temp); }
            catch (Exception cleanup) when (cleanup is IOException or UnauthorizedAccessException) { }
        }
    }
}
