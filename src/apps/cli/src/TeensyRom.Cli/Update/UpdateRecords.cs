namespace TeensyRom.Cli.Update;

/// <summary>How this trom was installed, which decides whether and how it updates itself.</summary>
internal enum InstallKind { Release, Homebrew, Source, Unknown }

/// <summary>One asset of a GitHub release. <see cref="Digest"/> is GitHub's <c>sha256:&lt;hex&gt;</c> string, when it published one.</summary>
internal sealed record ReleaseAsset(string Name, string DownloadUrl, long Size, string? Digest);

/// <param name="Tag">The release's tag as published, for example <c>v1.0.0-beta.1</c>.</param>
/// <param name="PreRelease">GitHub's own pre-release flag; <see cref="IsPreRelease"/> also honors a pre-release version.</param>
/// <param name="PageUrl">The release's page, when it has one.</param>
internal sealed record ReleaseInfo(string Tag, SemVersion Version, bool PreRelease, string? PageUrl, IReadOnlyList<ReleaseAsset> Assets)
{
    public bool IsPreRelease => PreRelease || Version.IsPreRelease;
}

/// <summary>Bytes received so far; <see cref="Total"/> is null when the server didn't say how many to expect.</summary>
internal readonly record struct DownloadProgress(long Received, long? Total);

/// <summary>What <c>trom</c> knows about the newest release; the shape written under <c>update</c> in JSON output.</summary>
/// <param name="Installed">This trom's version.</param>
/// <param name="Latest">The newest release this install may update to; null when none is known.</param>
/// <param name="Available">The latest release is newer than the installed one.</param>
/// <param name="CheckedAt">When the latest release was looked up; null when it never was.</param>
internal sealed record UpdateStatus(string Installed, string? Latest, bool Available, InstallKind InstallKind, DateTimeOffset? CheckedAt);

/// <summary>What one successful <c>trom update</c> did; the shape written under <c>update</c> in its JSON output.</summary>
/// <param name="EngineWasRunning">Trom API was running when the update began and was stopped for it.</param>
/// <param name="EngineRestarted">Trom API runs again, on the new version.</param>
/// <param name="RestartProblem">Why Trom API did not come back; the update itself stays in place.</param>
internal sealed record UpdateApplied(string From, string To, bool EngineWasRunning, bool EngineRestarted, string? RestartProblem);

/// <summary>
/// A fresh look at the releases: the status to report, and, when an update is available, the release and the package
/// for this platform that <see cref="IUpdateRunner.ApplyAsync"/> installs.
/// </summary>
internal sealed record UpdateCheckResult(UpdateStatus Status, ReleaseInfo? Release, ReleaseAsset? Asset);

/// <summary>Every refusal and failure of the update code ends as a <see cref="Errors.CliException"/> with exit code <see cref="Errors.CliExitCode.Failed"/>; the message is the sentence to show.</summary>
internal static class UpdateFailure
{
    public static Errors.CliException Failed(string message) => new(Errors.CliExitCode.Failed, message);
}
