using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Commands.Update;

/// <summary>
/// The lookup and the install that <c>trom update</c> and the menu's "Update to …" entry share: a live status line while
/// they run, Ctrl+C, and the sentences they report with.
/// </summary>
internal static class UpdateWork
{
    private const string Cancelled = "Cancelled.";

    /// <summary>Looks up the newest release. Ctrl+C ends it with <see cref="CliExitCode.Failed"/>.</summary>
    public static Task<UpdateCheckResult> CheckAsync(ICliOutput output, IUpdateRunner updates) =>
        CancellableAsync(token => CommandRun.WithStatusAsync<string, UpdateCheckResult>(
            output, "Looking up the latest release…", text => text, _ => updates.CheckAsync(token)));

    /// <summary>
    /// Installs the release <paramref name="check"/> found. Each step is a status line when a person is watching, and a
    /// line on stderr otherwise. Ctrl+C ends a download with <see cref="CliExitCode.Failed"/>; once the package is
    /// staged the runner finishes the update.
    /// </summary>
    public static Task<UpdateApplied> ApplyAsync(ICliOutput output, IUpdateRunner updates, UpdateCheckResult check) =>
        CancellableAsync(token => CommandRun.WithStatusAsync<string, UpdateApplied>(
            output, $"Updating to {check.Status.Latest}…", text => text, report =>
            {
                var version = check.Status.Latest ?? string.Empty;
                var last = string.Empty;
                IProgress<DownloadProgress>? progress = report is null ? null : new InlineProgress(download =>
                {
                    var text = Downloading(version, download);

                    if (text == last) return;

                    last = text;
                    report(text);
                });

                return updates.ApplyAsync(check, report ?? output.Notice, progress, token);
            }));

    /// <summary>"Updated TeensyROM Suite from A to B.", with the news that Trom API runs again when it does.</summary>
    public static string Result(UpdateApplied applied) =>
        $"Updated TeensyROM Suite from {applied.From} to {applied.To}." + (applied.EngineRestarted ? " Trom API is running again." : string.Empty);

    /// <summary>The notice for Trom API not coming back after the update; null when it did, or was not running.</summary>
    public static CliNotice? RestartNotice(UpdateApplied applied)
    {
        if (applied is not { EngineWasRunning: true, EngineRestarted: false }) return null;

        var reason = string.IsNullOrWhiteSpace(applied.RestartProblem) ? string.Empty : $": {applied.RestartProblem.TrimEnd('.', ' ')}";

        return new CliNotice("engineNotRestarted", $"Trom API didn't start again{reason} — run `trom api start`.", Fix: "trom api start");
    }

    /// <summary>The sentence that says what a lookup found: the update's name, or that the installed release is the newest.</summary>
    public static string Describe(UpdateStatus status)
    {
        if (status is not { Available: true, Latest: { } latest }) return $"TeensyROM Suite {status.Installed} is the newest release.";

        return status.InstallKind switch
        {
            InstallKind.Source => $"TeensyROM Suite {latest} is out (you have {status.Installed}). This trom was built from source, so it updates through git — see docs/contributing.md.",
            InstallKind.Unknown => $"TeensyROM Suite {latest} is out (you have {status.Installed}). Download it from {UpdateRunner.ReleasesPage}.",
            _ => UpdateNotifier.Sentence(latest, status.Installed)
        };
    }

    private static string Downloading(string version, DownloadProgress progress) =>
        progress.Total is { } total and > 0
            ?$"Downloading TeensyROM Suite {version}… {progress.Received * 100 / total}%"
            : $"Downloading TeensyROM Suite {version}… {progress.Received / (1024 * 1024)} MB";

    private static async Task<T> CancellableAsync<T>(Func<CancellationToken, Task<T>> work)
    {
        try
        {
            return await CommandRun.CancellableAsync(work);
        }
        catch (OperationCanceledException)
        {
            throw new CliException(CliExitCode.Failed, Cancelled);
        }
    }

    /// <summary>Reports on the caller's thread, so a late report can't overwrite the step that follows the download.</summary>
    private sealed class InlineProgress(Action<DownloadProgress> handle) : IProgress<DownloadProgress>
    {
        public void Report(DownloadProgress value) => handle(value);
    }
}
