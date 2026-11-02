using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Update;

/// <summary>Looks for a newer release and installs it.</summary>
internal interface IUpdateRunner
{
    /// <summary>Looks up the releases now, records what was found for the daily check and says whether this install can update.</summary>
    /// <exception cref="Errors.CliException">When the lookup fails or this platform has no package.</exception>
    Task<UpdateCheckResult> CheckAsync(CancellationToken ct = default);

    /// <summary>
    /// Installs the release <paramref name="check"/> found: stops Trom API, swaps the package in (or has Homebrew do it),
    /// and starts Trom API again when it was running. <paramref name="notify"/> receives each step as a sentence.
    /// For a release install, cancelling works while the package downloads and unpacks; once it is staged (and
    /// <paramref name="notify"/> says so) the update runs to its end, and a cancelled start of Trom API is reported in the
    /// result. For Homebrew, cancelling stops brew, and Trom API is started again if it was running.
    /// </summary>
    /// <exception cref="Errors.CliException">When the update is refused or fails; a failed swap leaves the previous version in place.</exception>
    Task<UpdateApplied> ApplyAsync(UpdateCheckResult check, Action<string> notify, IProgress<DownloadProgress>? progress = null, CancellationToken ct = default);
}

/// <param name="files">Retries what another process briefly holds; used up to and including the swap.</param>
/// <param name="quickFiles">Does not retry; clears the update folder once the new version is in and Trom API is starting again, when waiting would only delay it.</param>
/// <param name="installedVersion">This trom's version.</param>
/// <param name="rid">This platform's runtime identifier; null when the suite has no package for it.</param>
/// <param name="runningExecutable">The running trom, which a swap renames aside instead of moving.</param>
internal sealed class UpdateRunner(
    IInstallInspector inspector,
    IReleaseClient client,
    IReleaseCheck releaseCheck,
    IPackageStager stager,
    IPackageSwapper swapper,
    IBrewUpdater brew,
    ISuiteStarter starter,
    IEngineControl engine,
    IFileOps files,
    IFileOps quickFiles,
    TimeProvider time,
    string installedVersion,
    string? rid,
    string? runningExecutable) : IUpdateRunner
{
    public static readonly TimeSpan LookupTimeout = TimeSpan.FromSeconds(15);

    internal const string ReleasesPage = "https://github.com/MetalHexx/TeensyROM-Suite/releases";

    private const string NoPackage = "There is no TeensyROM Suite package for this platform.";

    /// <summary>Said once the package is staged, so a Ctrl+C that no longer stops anything is explained.</summary>
    internal const string NotCancellable = "The package is staged; from here the update can't be cancelled.";

    public async Task<UpdateCheckResult> CheckAsync(CancellationToken ct = default)
    {
        var installed = Installed();
        var platform = rid ?? throw UpdateFailure.Failed(NoPackage);

        var kind = inspector.Inspect().Kind;
        var releases = await client.GetReleasesAsync(LookupTimeout, ct);

        releaseCheck.Record(releases);

        var newest = ReleaseSelector.Newest(releases, installed, platform);
        var available = newest is not null && newest.Version > installed;
        var status = new UpdateStatus(installed.ToString(), newest?.Version.ToString(), available, kind, time.GetUtcNow());

        return available
            ? new UpdateCheckResult(status, newest, ReleaseSelector.PackageFor(newest!, platform))
            : new UpdateCheckResult(status, null, null);
    }

    public async Task<UpdateApplied> ApplyAsync(UpdateCheckResult check, Action<string> notify, IProgress<DownloadProgress>? progress = null, CancellationToken ct = default)
    {
        var install = inspector.Inspect();

        switch (install.Kind)
        {
            case InstallKind.Source:
                throw UpdateFailure.Failed("This trom was built from source, so it doesn't update itself — pull and rebuild with git (see docs/contributing.md).");
            case InstallKind.Unknown:
                throw UpdateFailure.Failed($"trom can't tell how it was installed, so it won't update itself — download the latest release from {ReleasesPage}.");
        }

        var platform = rid ?? throw UpdateFailure.Failed(NoPackage);

        if (!check.Status.Available || check.Release is not { } release || check.Asset is not { } asset)
        {
            throw UpdateFailure.Failed("There is no newer release to install.");
        }

        var installed = Installed();

        return install.Kind == InstallKind.Homebrew
            ? await ApplyHomebrewAsync(install, installed, release, notify, ct)
            : await ApplyReleaseAsync(install, installed, release, asset, platform, notify, progress, ct);
    }

    private async Task<UpdateApplied> ApplyReleaseAsync(
        InstallInfo install, SemVersion installed, ReleaseInfo release, ReleaseAsset asset, string platform,
        Action<string> notify, IProgress<DownloadProgress>? progress, CancellationToken ct)
    {
        if (ReleaseClient.ExpectedDigest(asset) is null)
        {
            throw UpdateFailure.Failed($"The release publishes no checksum for {asset.Name}, so trom won't install it.");
        }

        var root = install.Root!;
        var updateFolder = UpdateFolder.For(root);
        var held = TakeLock(updateFolder, root);
        var wasRunning = false;
        var keepUpdateFolder = false;
        var swapped = false;
        SuiteStart start;

        try
        {
            // Until an earlier update's leftovers are cleared, the folder may hold the only copy of the previous install.
            keepUpdateFolder = true;
            PrepareUpdateFolder(updateFolder, root);
            keepUpdateFolder = false;

            notify($"Downloading TeensyROM Suite {release.Version}…");
            await stager.StageAsync(root, release, asset, platform, progress, ct);

            // The package is ready: from here the update runs to its end, so the stop is not cancellable (the swap takes no token).
            notify(NotCancellable);
            wasRunning = await StopEngineAsync(notify, CancellationToken.None);
            LeaveApiFolder(root);

            notify("Installing…");

            try
            {
                swapper.Swap(root, install.CliFolder, runningExecutable);
            }
            catch (SwapFailedException ex)
            {
                keepUpdateFolder = !ex.RolledBack;

                if (wasRunning && ex.RolledBack) await RestartPreviousAsync(notify);

                throw UpdateFailure.Failed(ex.Message);
            }

            swapped = true;

            // The lock stays held through the restart, so a trom the restart runs doesn't tidy up under this one.
            start = wasRunning ? await RestartAsync(Path.Combine(install.CliFolder, PlatformRid.TromExecutable(platform)), notify, ct) : new SuiteStart(true, null);
        }
        finally
        {
            if (keepUpdateFolder) held.Dispose();
            else held.ClearAndRelease(swapped ? quickFiles : files);
        }

        return new UpdateApplied(installed.ToString(), release.Version.ToString(), wasRunning, wasRunning && start.Ok, wasRunning ? start.Problem : null);
    }

    private async Task<UpdateApplied> ApplyHomebrewAsync(InstallInfo install, SemVersion installed, ReleaseInfo release, Action<string> notify, CancellationToken ct)
    {
        var prefix = install.BrewPrefix!;

        // Stopping Trom API is the point of no return, so like the swap of a release it is not cancellable.
        var wasRunning = await StopEngineAsync(notify, CancellationToken.None);
        var start = new SuiteStart(true, null);
        var finished = false;
        BrewResult upgrade;
        SemVersion? now;

        try
        {
            notify("Updating with Homebrew…");

            upgrade = await brew.UpgradeAsync(prefix, notify, ct);
            now = upgrade.Ok ? await brew.InstalledVersionAsync(prefix, ct) : null;
            finished = true;
        }
        finally
        {
            // Homebrew has linked whatever it left installed, so that trom starts Trom API again whatever happened, and
            // when brew was cancelled or threw, that is a restart of what was running, not something to cancel in turn.
            if (wasRunning)
            {
                start = await RestartAsync(Path.Combine(prefix, "bin", "trom"), notify, ct.IsCancellationRequested ? CancellationToken.None : ct);

                if (!finished && !start.Ok) notify($"Trom API didn't start again: {start.Problem}");
            }
        }

        if (!upgrade.Ok) throw UpdateFailure.Failed(WithRestartProblem(upgrade.Problem!, wasRunning, start));

        if (now is not { } updated)
        {
            throw UpdateFailure.Failed(WithRestartProblem("Homebrew finished, but trom couldn't read the version it installed.", wasRunning, start));
        }

        if (updated <= installed)
        {
            throw UpdateFailure.Failed(WithRestartProblem(
                $"Homebrew doesn't offer TeensyROM Suite {release.Version} yet (it has {updated}) — try again later.", wasRunning, start));
        }

        return new UpdateApplied(installed.ToString(), updated.ToString(), wasRunning, wasRunning && start.Ok, wasRunning ? start.Problem : null);
    }

    private SemVersion Installed() =>
        SemVersion.TryParse(installedVersion, out var installed)
            ? installed
            : throw UpdateFailure.Failed($"This trom's version ({installedVersion}) isn't one trom can compare, so it can't look for updates.");

    private static UpdateLock TakeLock(string updateFolder, string root)
    {
        try
        {
            return UpdateLock.TryAcquire(updateFolder) ?? throw UpdateFailure.Failed("Another trom update is already running.");
        }
        catch (UnauthorizedAccessException)
        {
            throw UpdateFailure.Failed($"trom can't write to {root}, so it can't update there. Run it with the rights to change that folder.");
        }
    }

    // An update that died half-way is undone before anything new is written over its backups.
    private void PrepareUpdateFolder(string updateFolder, string root)
    {
        try
        {
            swapper.Recover(updateFolder, root);

            files.DeleteDirectory(UpdateFolder.Download(updateFolder));
            files.DeleteDirectory(UpdateFolder.Staging(updateFolder));
            files.DeleteDirectory(UpdateFolder.Backup(updateFolder));
            files.DeleteFile(UpdateFolder.Journal(updateFolder));
        }
        catch (SwapFailedException ex)
        {
            throw UpdateFailure.Failed(ex.Message);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw UpdateFailure.Failed($"Couldn't clear the files of an earlier update from {updateFolder}: {ex.Message.TrimEnd('.')}.");
        }
    }

    /// <summary>Stops Trom API and returns whether it was running. Refuses when it is running and can't be stopped from here.</summary>
    private async Task<bool> StopEngineAsync(Action<string> notify, CancellationToken ct)
    {
        var wasRunning = (await engine.GetStatusAsync(ct)).Running;

        if (wasRunning) notify("Stopping Trom API…");

        if (await engine.StopAsync(ct) is EngineStopOutcome.NotSupported or EngineStopOutcome.Failed)
        {
            throw UpdateFailure.Failed("Trom API is running and can't be stopped from trom. Stop it where it was started, then run `trom update` again.");
        }
        return wasRunning;
    }

    // A folder the swap is about to rename can't be a process's working directory on Windows.
    private void LeaveApiFolder(string root)
    {
        var api = Path.Combine(root, "api");

        if (IsInside(files.CurrentDirectory, api)) files.CurrentDirectory = root;
    }

    private static bool IsInside(string path, string folder)
    {
        var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        var parent = Path.TrimEndingDirectorySeparator(Path.GetFullPath(folder));

        return string.Equals(full, parent, PackageSwapper.PathComparison)
            || full.StartsWith(parent + Path.DirectorySeparatorChar, PackageSwapper.PathComparison);
    }

    // Not cancellable: it brings back what was running, and a Ctrl+C here would hide the failure that led to it.
    private async Task RestartPreviousAsync(Action<string> notify)
    {
        notify("Restarting Trom API…");

        var ready = await engine.EnsureRunningAsync(CancellationToken.None);

        if (!ready.Ok) notify($"Trom API didn't start again: {ready.FailureMessage}");
    }

    private async Task<SuiteStart> RestartAsync(string trom, Action<string> notify, CancellationToken ct)
    {
        notify("Starting Trom API…");

        try
        {
            return await starter.StartEngineAsync(trom, ct);
        }
        catch (OperationCanceledException)
        {
            // The new version is installed by now; the cancelled start is part of the result, not a reason to say nothing changed.
            return new SuiteStart(false, "the start was cancelled.");
        }
    }

    private static string WithRestartProblem(string message, bool wasRunning, SuiteStart start) =>
        wasRunning && !start.Ok ? $"{message} Trom API didn't start again: {start.Problem}" : message;
}
