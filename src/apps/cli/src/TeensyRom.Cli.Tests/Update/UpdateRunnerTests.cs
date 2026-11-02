using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>
/// Everything the update runner touches, as one scriptable world, the way <see cref="FakeEngineWorld"/> stands in for the
/// engine's. The install folder is real, because the runner owns its update lock and its update folder.
/// </summary>
internal sealed class FakeUpdateWorld : IInstallInspector, IReleaseClient, IPackageStager, IPackageSwapper, IBrewUpdater, ISuiteStarter, IEngineControl, IDisposable
{
    public const string Digest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private readonly Scratch _scratch = new();

    public FakeUpdateWorld()
    {
        Install = new InstallInfo(InstallKind.Release, CliFolder, Root, null);
        DeletesWithRetry = new RecordingDeletes(new PhysicalFileOps(), UpdateFolder);
        DeletesWithoutRetry = new RecordingDeletes(new PhysicalFileOps(), UpdateFolder);
        Files = new ScriptedFileOps(DeletesWithRetry);
        Files.CurrentDirectory = _scratch.Folder;
    }

    public string Root => _scratch.At("install");

    public string CliFolder => _scratch.At("install/cli");

    public string UpdateFolder => _scratch.At("install/.trom-update");

    public string TromExe => Path.Combine(CliFolder, "trom.exe");

    /// <summary>What the runner changes the disk through up to the end of the swap, the way the real one retries.</summary>
    public ScriptedFileOps Files { get; }

    public RecordingDeletes DeletesWithRetry { get; }

    /// <summary>What the runner clears the update folder through once the new version is in.</summary>
    public RecordingDeletes DeletesWithoutRetry { get; }

    public FakeReleaseCheck Check { get; } = new();

    public FakeTimeProvider Time { get; } = new();

    /// <summary>The order in which the runner stopped, staged, swapped, started and so on.</summary>
    public List<string> Calls { get; } = [];

    public List<string> Notices { get; } = [];

    // What the runner left in the update folder, and handed on, by the time it staged.
    public bool BackupExistedAtStage { get; private set; }
    public bool JournalExistedAtStage { get; private set; }
    public IProgress<DownloadProgress>? ProgressSeenByStager { get; private set; }

    // What was true when the new engine was started.
    public bool UpdateFolderExistedAtStart { get; private set; }
    public bool LockHeldAtStart { get; private set; }
    public bool StartWasCancelled { get; private set; }

    // What the world answers.
    public InstallInfo Install { get; set; }
    public List<ReleaseInfo> Releases { get; set; } = [ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64", "linux-x64")];
    public Exception? ReleasesFailure { get; set; }
    public Exception? StageFailure { get; set; }
    public Action? OnStage { get; set; }
    public Action? OnStop { get; set; }
    public Action? OnSwap { get; set; }
    public Action? OnBrew { get; set; }
    public SwapFailedException? SwapFailure { get; set; }
    public SwapFailedException? RecoverFailure { get; set; }
    public bool EngineRunning { get; set; } = true;
    public EngineStopOutcome StopOutcome { get; set; } = EngineStopOutcome.Stopped;
    public EngineReady EnsureResult { get; set; } = EngineReady.Ready;
    public SuiteStart StartResult { get; set; } = new(true, null);
    public BrewResult BrewResult { get; set; } = new(true, null);
    public SemVersion? BrewInstalled { get; set; } = SemVersionTests.V("1.0.0-beta.2");
    public List<string> BrewOutput { get; set; } = ["==> Upgrading teensyrom-suite"];

    public UpdateRunner Runner(string installed = "1.0.0-beta.1", string? rid = "win-x64") =>
        new(this, this, Check, this, this, this, this, this, Files, DeletesWithoutRetry, Time, installed, rid, TromExe);

    public async Task<UpdateApplied> Apply(string installed = "1.0.0-beta.1", string? rid = "win-x64", IProgress<DownloadProgress>? progress = null, CancellationToken ct = default)
    {
        var runner = Runner(installed, rid);
        var check = await runner.CheckAsync(ct);

        return await runner.ApplyAsync(check, Notices.Add, progress, ct);
    }

    public bool UpdateFolderExists => Directory.Exists(UpdateFolder);

    // ---- IInstallInspector, IReleaseClient ------------------------------------------------------------------

    public InstallInfo Inspect() => Install;

    public Task<IReadOnlyList<ReleaseInfo>> GetReleasesAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        Calls.Add("releases");

        return ReleasesFailure is null ? Task.FromResult<IReadOnlyList<ReleaseInfo>>(Releases) : throw ReleasesFailure;
    }

    public Task DownloadVerifiedAsync(ReleaseAsset asset, string destination, IProgress<DownloadProgress>? progress, CancellationToken ct = default) =>
        throw new NotSupportedException();

    // ---- IPackageStager, IPackageSwapper --------------------------------------------------------------------

    public Task<string> StageAsync(string root, ReleaseInfo release, ReleaseAsset asset, string rid, IProgress<DownloadProgress>? progress, CancellationToken ct)
    {
        Calls.Add("stage");
        BackupExistedAtStage = Directory.Exists(Path.Combine(UpdateFolder, "backup"));
        JournalExistedAtStage = File.Exists(Path.Combine(UpdateFolder, "journal.json"));
        ProgressSeenByStager = progress;
        OnStage?.Invoke();
        ct.ThrowIfCancellationRequested();

        if (StageFailure is not null) throw StageFailure;

        var staging = UpdateFolder + Path.DirectorySeparatorChar + "staging";
        Directory.CreateDirectory(staging);
        File.WriteAllText(Path.Combine(staging, "README.txt"), "new");

        return Task.FromResult(staging);
    }

    public void Swap(string root, string cliFolder, string? runningExecutable)
    {
        Calls.Add("swap");
        OnSwap?.Invoke();

        if (SwapFailure is not null) throw SwapFailure;
    }

    public bool Recover(string updateFolder, string root)
    {
        Calls.Add("recover");

        return RecoverFailure is null ? false : throw RecoverFailure;
    }

    // ---- IBrewUpdater, ISuiteStarter ------------------------------------------------------------------------

    public Task<BrewResult> UpgradeAsync(string prefix, Action<string> onLine, CancellationToken ct = default)
    {
        Calls.Add($"brew:{prefix}");
        OnBrew?.Invoke();

        foreach (var line in BrewOutput) onLine(line);

        ct.ThrowIfCancellationRequested();
        return Task.FromResult(BrewResult);
    }

    public Task<SemVersion?> InstalledVersionAsync(string prefix, CancellationToken ct = default)
    {
        Calls.Add("brew-version");
        return Task.FromResult(BrewInstalled);
    }

    public Task<SuiteStart> StartEngineAsync(string tromPath, CancellationToken ct = default)
    {
        Calls.Add($"start:{tromPath}");
        UpdateFolderExistedAtStart = Directory.Exists(UpdateFolder);

        // Probing a folder that isn't there would create it.
        if (UpdateFolderExistedAtStart)
        {
            using var other = UpdateLock.TryAcquire(UpdateFolder);
            LockHeldAtStart = other is null;
        }
        StartWasCancelled = ct.IsCancellationRequested;
        ct.ThrowIfCancellationRequested();
        return Task.FromResult(StartResult);
    }

    // ---- IEngineControl -------------------------------------------------------------------------------------

    public Task<EngineReady> EnsureRunningAsync(CancellationToken ct)
    {
        Calls.Add("ensure-running");
        ct.ThrowIfCancellationRequested();
        return Task.FromResult(EnsureResult);
    }

    public Task<EngineStopOutcome> StopAsync(CancellationToken ct)
    {
        Calls.Add("stop");
        OnStop?.Invoke();
        ct.ThrowIfCancellationRequested();
        return Task.FromResult(StopOutcome);
    }

    public Task<EngineStatus> GetStatusAsync(CancellationToken ct)
    {
        Calls.Add("status");
        return Task.FromResult(new EngineStatus(EngineRunning, EngineRunning ? "1.0.0-beta.1" : null, "1.0.0-beta.1", EngineRunning, "http://localhost:10213", null));
    }

    public void Dispose() => _scratch.Dispose();
}

public sealed class UpdateRunnerTests : IDisposable
{
    private readonly FakeUpdateWorld _world = new();

    public void Dispose() => _world.Dispose();

    // ---- looking ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Check_FindsTheNewestReleaseWithAPackageForThisPlatform_AndRecordsTheLookup()
    {
        _world.Releases =
        [
            ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64"),
            ReleaseSelectorTests.Release("v1.0.0-beta.3", true, "linux-x64"),
            ReleaseSelectorTests.Release("v1.0.0-alpha.8", true, "win-x64")
        ];

        var check = await _world.Runner().CheckAsync();

        check.Status.Should().Be(new UpdateStatus("1.0.0-beta.1", "1.0.0-beta.2", true, InstallKind.Release, _world.Time.GetUtcNow()));
        check.Release!.Tag.Should().Be("v1.0.0-beta.2");
        check.Asset!.Name.Should().Be("TeensyROM-Suite-1.0.0-beta.2-win-x64.zip");
        _world.Check.Recorded.Should().ContainSingle().Which.Should().BeSameAs(_world.Releases);
    }

    [Fact]
    public async Task Check_WhenTheInstalledVersionIsTheNewest_SaysNothingIsAvailable()
    {
        var check = await _world.Runner(installed: "1.0.0-beta.2").CheckAsync();

        check.Status.Available.Should().BeFalse();
        check.Status.Latest.Should().Be("1.0.0-beta.2");
        check.Release.Should().BeNull();
        check.Asset.Should().BeNull();
    }

    [Fact]
    public async Task Check_ForAStableInstall_LeavesPreReleasesOut()
    {
        var check = await _world.Runner(installed: "0.9.0").CheckAsync();

        check.Status.Latest.Should().BeNull();
        check.Status.Available.Should().BeFalse();
    }

    [Theory]
    [InlineData(nameof(InstallKind.Source))]
    [InlineData(nameof(InstallKind.Homebrew))]
    public async Task Check_ReportsTheInstallKindAndStillLooksUp(string kindName)
    {
        var kind = Enum.Parse<InstallKind>(kindName);
        _world.Install = _world.Install with { Kind = kind };

        var check = await _world.Runner().CheckAsync();

        check.Status.InstallKind.Should().Be(kind);
        check.Status.Available.Should().BeTrue();
    }

    [Fact]
    public async Task Check_WithNoPackageForThisPlatform_Fails()
    {
        var check = () => _world.Runner(rid: null).CheckAsync();

        (await check.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("no TeensyROM Suite package for this platform");
    }

    [Fact]
    public async Task Check_WhenTheVersionCantBeCompared_Fails()
    {
        var check = () => _world.Runner(installed: "Unknown version").CheckAsync();

        await check.Should().ThrowAsync<CliException>();
    }

    [Fact]
    public async Task Check_WhenTheLookupFails_PassesTheFailureOnAndRecordsNothing()
    {
        _world.ReleasesFailure = new CliException(CliExitCode.Failed, "GitHub refused the release lookup (rate limit) — try again later.");

        var check = () => _world.Runner().CheckAsync();

        await check.Should().ThrowAsync<CliException>().WithMessage("*rate limit*");
        _world.Check.Recorded.Should().BeEmpty();
    }

    // ---- refusals --------------------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_ForASourceBuild_RefusesAndPointsToGit()
    {
        _world.Install = _world.Install with { Kind = InstallKind.Source };

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("built from source").And.Contain("docs/contributing.md");
        _world.Calls.Should().NotContain(["stage", "stop", "swap"]);
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_ForAnUnknownInstall_Refuses()
    {
        _world.Install = _world.Install with { Kind = InstallKind.Unknown };

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("can't tell how it was installed");
        _world.Calls.Should().NotContain(["stage", "stop", "swap"]);
    }

    [Fact]
    public async Task Apply_WhenNothingIsNewer_Refuses()
    {
        var runner = _world.Runner(installed: "1.0.0-beta.2");
        var check = await runner.CheckAsync();

        var apply = () => runner.ApplyAsync(check, _world.Notices.Add);

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("no newer release");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("sha1:da39a3ee5e6b4b0d3255bfef95601890afd80709")]
    public async Task Apply_WithoutADigest_RefusesBeforeAnythingIsStoppedOrWritten(string? digest)
    {
        var release = ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64");
        _world.Releases = [release with { Assets = [release.Assets[0] with { Digest = digest }] }];

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("no checksum");
        _world.Calls.Should().NotContain(["status", "stop", "stage", "swap"]);
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhileAnotherUpdateIsRunning_Refuses()
    {
        using var other = UpdateLock.TryAcquire(_world.UpdateFolder);

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("already running");
        _world.Calls.Should().NotContain(["stage", "stop", "swap"]);
    }

    // ---- a release install -----------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_StopsTheEngine_SwapsAndStartsTheNewEngineThroughTheNewTrom()
    {
        var applied = await _world.Apply();

        _world.Calls.Should().Equal("releases", "recover", "stage", "status", "stop", "swap", $"start:{_world.TromExe}");
        applied.Should().Be(new UpdateApplied("1.0.0-beta.1", "1.0.0-beta.2", EngineWasRunning: true, EngineRestarted: true, RestartProblem: null));
        _world.Notices.Should().Equal("Downloading TeensyROM Suite 1.0.0-beta.2…", UpdateRunner.NotCancellable, "Stopping Trom API…", "Installing…", "Starting Trom API…");
    }

    [Fact]
    public async Task Apply_WhenStagingFails_NeverSaysTheUpdateCantBeCancelled()
    {
        _world.StageFailure = new CliException(CliExitCode.Failed, "doesn't match the checksum");

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>();
        _world.Notices.Should().NotContain(UpdateRunner.NotCancellable);
    }

    [Fact]
    public async Task Apply_StartsTheNewEngineBeforeClearingTheUpdateFolder_ThenClearsItWithoutRetrying()
    {
        await _world.Apply();

        _world.UpdateFolderExistedAtStart.Should().BeTrue();
        _world.LockHeldAtStart.Should().BeTrue("a trom the restart runs must not tidy up under the update");
        _world.DeletesWithoutRetry.DeletedDirectories.Should().Contain(Path.Combine(_world.UpdateFolder, "staging"));
        _world.DeletesWithoutRetry.DeletedEmptyDirectories.Should().Contain(_world.UpdateFolder);
        _world.DeletesWithRetry.DeletedEmptyDirectories.Should().BeEmpty();
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_ClearsTheUpdateFolderWhileHoldingTheLock_AndRemovesTheFolderOnlyAfterLettingGo()
    {
        await _world.Apply();

        var deletes = _world.DeletesWithoutRetry.Deletes;
        deletes.Should().Contain(delete => delete.Path.EndsWith("staging", StringComparison.Ordinal));
        deletes.Where(delete => delete.Path != _world.UpdateFolder).Should().OnlyContain(delete => delete.LockHeld);
        deletes.Should().ContainSingle(delete => delete.Path == _world.UpdateFolder).Which.LockHeld.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhenStagingFails_ClearsTheUpdateFolderWithRetriesAndWhileHoldingTheLock()
    {
        _world.StageFailure = new CliException(CliExitCode.Failed, "doesn't match the checksum");

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>();
        _world.DeletesWithoutRetry.Deletes.Should().BeEmpty();
        _world.DeletesWithRetry.DeletedEmptyDirectories.Should().Contain(_world.UpdateFolder);
        _world.DeletesWithRetry.Deletes.Where(delete => delete.Path != _world.UpdateFolder).Should().OnlyContain(delete => delete.LockHeld);
    }

    [Fact]
    public async Task Apply_LeavesNothingBehind_AndFreesTheLock()
    {
        await _world.Apply();

        _world.UpdateFolderExists.Should().BeFalse();
        using var lockAgain = UpdateLock.TryAcquire(_world.UpdateFolder);
        lockAgain.Should().NotBeNull();
    }

    [Fact]
    public async Task Apply_WhenTheEngineWasNotRunning_StartsNothing()
    {
        _world.EngineRunning = false;
        _world.StopOutcome = EngineStopOutcome.NotRunning;

        var applied = await _world.Apply();

        _world.Calls.Should().NotContain(call => call.StartsWith("start:"));
        applied.Should().Be(new UpdateApplied("1.0.0-beta.1", "1.0.0-beta.2", false, false, null));
    }

    [Theory]
    [InlineData(nameof(EngineStopOutcome.Stopped))]
    [InlineData(nameof(EngineStopOutcome.NotRunning))]
    [InlineData(nameof(EngineStopOutcome.Foreign))]
    public async Task Apply_GoesAheadWheneverNothingOfOursIsLeftRunning(string outcomeName)
    {
        _world.StopOutcome = Enum.Parse<EngineStopOutcome>(outcomeName);

        await _world.Apply();

        _world.Calls.Should().Contain("swap");
    }

    [Theory]
    [InlineData(nameof(EngineStopOutcome.NotSupported))]
    [InlineData(nameof(EngineStopOutcome.Failed))]
    public async Task Apply_WhenTheEngineCantBeStopped_RefusesAndCleansUp(string outcomeName)
    {
        _world.StopOutcome = Enum.Parse<EngineStopOutcome>(outcomeName);

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("Stop it where it was started");
        _world.Calls.Should().NotContain("swap");
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhenTheWorkingDirectoryIsInsideApi_MovesItToTheRootFirst()
    {
        _world.Files.CurrentDirectory = Path.Combine(_world.Root, "api", "Assets");

        await _world.Apply();

        _world.Files.CurrentDirectory.Should().Be(_world.Root);
    }

    [Fact]
    public async Task Apply_LeavesAWorkingDirectoryElsewhereAlone()
    {
        var elsewhere = Path.Combine(_world.Root, "apiary");
        _world.Files.CurrentDirectory = elsewhere;

        await _world.Apply();

        _world.Files.CurrentDirectory.Should().Be(elsewhere);
    }

    [Fact]
    public async Task Apply_WhenTheSwapRollsBack_RestartsTheOldEngineInProcessAndSaysSo()
    {
        _world.SwapFailure = new SwapFailedException("The update failed (in use); the previous version is back in place.", rolledBack: true);

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Be(_world.SwapFailure.Message);
        _world.Calls.Should().EndWith(new[] { "swap", "ensure-running" });
        _world.Calls.Should().NotContain(call => call.StartsWith("start:"));
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhenCancelledDuringASwapThatRollsBack_StillRestartsTheOldEngineAndReportsTheRealFailure()
    {
        using var cts = new CancellationTokenSource();
        _world.OnSwap = cts.Cancel;
        _world.SwapFailure = new SwapFailedException("The update failed (in use); the previous version is back in place.", rolledBack: true);

        var apply = () => _world.Apply(ct: cts.Token);

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Be(_world.SwapFailure.Message);
        _world.Calls.Should().EndWith(new[] { "swap", "ensure-running" });
    }

    [Fact]
    public async Task Apply_WhenTheSwapRollsBackAndTheEngineWasNotRunning_StartsNothing()
    {
        _world.EngineRunning = false;
        _world.SwapFailure = new SwapFailedException("rolled back", rolledBack: true);

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>();
        _world.Calls.Should().NotContain("ensure-running");
    }

    [Fact]
    public async Task Apply_WhenTheOldEngineWontComeBackEither_SaysSoWithoutHidingTheFailure()
    {
        _world.SwapFailure = new SwapFailedException("rolled back", rolledBack: true);
        _world.EnsureResult = EngineReady.Failed("port busy");

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Be("rolled back");
        _world.Notices.Should().Contain("Trom API didn't start again: port busy");
    }

    [Fact]
    public async Task Apply_WhenTheSwapCouldNotBeUndone_KeepsTheUpdateFolderForTheNextRunToRecover()
    {
        _world.SwapFailure = new SwapFailedException("couldn't be fully restored", rolledBack: false);

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>().WithMessage("couldn't be fully restored");
        _world.UpdateFolderExists.Should().BeTrue();
        _world.Calls.Should().NotContain("ensure-running");
    }

    [Fact]
    public async Task Apply_WhenTheNewEngineWontStart_ReportsItWithoutUndoingTheUpdate()
    {
        _world.StartResult = new SuiteStart(false, "The TeensyROM engine didn't start (it didn't answer within 180 seconds).");

        var applied = await _world.Apply();

        applied.EngineWasRunning.Should().BeTrue();
        applied.EngineRestarted.Should().BeFalse();
        applied.RestartProblem.Should().Contain("didn't start");
        applied.To.Should().Be("1.0.0-beta.2");
        _world.UpdateFolderExists.Should().BeFalse();
        _world.Calls.Should().NotContain("ensure-running");
    }

    [Fact]
    public async Task Apply_WhenStagingFails_StopsNothingAndCleansUp()
    {
        _world.StageFailure = new CliException(CliExitCode.Failed, "doesn't match the checksum");

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>().WithMessage("*checksum*");
        _world.Calls.Should().NotContain(["stop", "swap"]);
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhenCancelledWhileStaging_CleansUpAndStopsNothing()
    {
        using var cts = new CancellationTokenSource();
        _world.OnStage = cts.Cancel;

        var apply = () => _world.Apply(ct: cts.Token);

        await apply.Should().ThrowAsync<OperationCanceledException>();
        _world.Calls.Should().NotContain(["stop", "swap"]);
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Theory]
    [InlineData("stop")]
    [InlineData("swap")]
    public async Task Apply_WhenCancelledOnceThePackageIsStaged_FinishesTheSwap_AndReportsTheEngineNotStarted(string cancelledDuring)
    {
        using var cts = new CancellationTokenSource();
        if (cancelledDuring == "stop") _world.OnStop = cts.Cancel;
        else _world.OnSwap = cts.Cancel;

        var applied = await _world.Apply(ct: cts.Token);

        _world.Calls.Should().ContainInOrder("stage", "stop", "swap");
        applied.To.Should().Be("1.0.0-beta.2");
        applied.EngineWasRunning.Should().BeTrue();
        applied.EngineRestarted.Should().BeFalse();
        applied.RestartProblem.Should().Contain("cancelled");
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_WhenAnEarlierUpdateCantBeUndone_RefusesAndLeavesItsFilesAlone()
    {
        Directory.CreateDirectory(Path.Combine(_world.UpdateFolder, "backup", "api"));
        _world.RecoverFailure = new SwapFailedException("A previous update didn't finish and couldn't be undone.", rolledBack: false);

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>().WithMessage("*couldn't be undone*");
        _world.Calls.Should().NotContain(["stage", "stop", "swap"]);
        Directory.Exists(Path.Combine(_world.UpdateFolder, "backup", "api")).Should().BeTrue();
    }

    [Fact]
    public async Task Apply_ClearsTheLeftoversOfAnEarlierFinishedUpdateBeforeStaging()
    {
        Directory.CreateDirectory(Path.Combine(_world.UpdateFolder, "backup", "api"));
        File.WriteAllText(Path.Combine(_world.UpdateFolder, "backup", "api", "old.txt"), "old");
        File.WriteAllText(Path.Combine(_world.UpdateFolder, "journal.json"), "{}");

        await _world.Apply();

        _world.BackupExistedAtStage.Should().BeFalse();
        _world.JournalExistedAtStage.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_PassesTheProgressSinkToTheStager()
    {
        var progress = new Progress<DownloadProgress>();

        await _world.Apply(progress: progress);

        _world.ProgressSeenByStager.Should().BeSameAs(progress);
    }

    // ---- a Homebrew install ----------------------------------------------------------------------------------

    private void UseHomebrew()
    {
        _world.Install = new InstallInfo(InstallKind.Homebrew, "/opt/homebrew/Cellar/teensyrom-suite/1.0.0-beta.1/libexec/cli", "/opt/homebrew/Cellar/teensyrom-suite/1.0.0-beta.1/libexec", "/opt/homebrew");
    }

    private static string Brewed(string path) => Path.Combine("/opt/homebrew", "bin", path);

    [Fact]
    public async Task Homebrew_StopsTheEngine_UpgradesAndStartsItThroughThePrefixsTrom()
    {
        UseHomebrew();

        var applied = await _world.Apply();

        _world.Calls.Should().Equal("releases", "status", "stop", "brew:/opt/homebrew", "brew-version", $"start:{Brewed("trom")}");
        applied.Should().Be(new UpdateApplied("1.0.0-beta.1", "1.0.0-beta.2", true, true, null));
        _world.Notices.Should().Contain("==> Upgrading teensyrom-suite", "Homebrew's output is shown as it arrives");
    }

    [Fact]
    public async Task Homebrew_NeverStagesOrSwapsAPackage()
    {
        UseHomebrew();

        await _world.Apply();

        _world.Calls.Should().NotContain(["stage", "swap", "recover"]);
        _world.UpdateFolderExists.Should().BeFalse();
    }

    [Fact]
    public async Task Homebrew_WhenItDoesNotOfferTheNewVersionYet_SaysSoAndStartsTheEngineAgain()
    {
        UseHomebrew();
        _world.BrewInstalled = SemVersionTests.V("1.0.0-beta.1");

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("doesn't offer TeensyROM Suite 1.0.0-beta.2 yet");
        _world.Calls.Should().EndWith($"start:{Brewed("trom")}");
    }

    [Fact]
    public async Task Homebrew_WhenTheNewVersionCantBeRead_Fails()
    {
        UseHomebrew();
        _world.BrewInstalled = null;

        var apply = () => _world.Apply();

        (await apply.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("couldn't read the version");
    }

    [Fact]
    public async Task Homebrew_WhenBrewFails_SaysWhyAndStartsTheEngineAgain()
    {
        UseHomebrew();
        _world.BrewResult = new BrewResult(false, "`brew upgrade teensyrom-suite` failed: it exited with code 1.");
        _world.StartResult = new SuiteStart(false, "the engine didn't start");

        var apply = () => _world.Apply();

        var message = (await apply.Should().ThrowAsync<CliException>()).Which.Message;
        message.Should().Contain("`brew upgrade teensyrom-suite` failed").And.Contain("Trom API didn't start again: the engine didn't start");
        _world.Calls.Should().NotContain("brew-version");
        _world.Calls.Should().EndWith($"start:{Brewed("trom")}");
    }

    [Theory]
    [InlineData("stop")]
    [InlineData("brew")]
    public async Task Homebrew_WhenCancelled_StillStartsTheEngineAgainWhichWasRunning(string cancelledDuring)
    {
        UseHomebrew();
        using var cts = new CancellationTokenSource();
        if (cancelledDuring == "stop") _world.OnStop = cts.Cancel;
        else _world.OnBrew = cts.Cancel;

        var apply = () => _world.Apply(ct: cts.Token);

        await apply.Should().ThrowAsync<OperationCanceledException>();
        _world.Calls.Should().EndWith($"start:{Brewed("trom")}");
        _world.StartWasCancelled.Should().BeFalse("it brings back what was running, whatever Ctrl+C was pressed");
        _world.Calls.Should().NotContain("brew-version");
    }

    [Fact]
    public async Task Homebrew_WhenCancelledAndTheEngineWontStartAgain_SaysSo()
    {
        UseHomebrew();
        using var cts = new CancellationTokenSource();
        _world.OnBrew = cts.Cancel;
        _world.StartResult = new SuiteStart(false, "the engine didn't start");

        var apply = () => _world.Apply(ct: cts.Token);

        await apply.Should().ThrowAsync<OperationCanceledException>();
        _world.Notices.Should().Contain("Trom API didn't start again: the engine didn't start");
    }

    [Fact]
    public async Task Homebrew_WhenCancelledAndTheEngineWasNotRunning_StartsNothing()
    {
        UseHomebrew();
        _world.EngineRunning = false;
        _world.StopOutcome = EngineStopOutcome.NotRunning;
        using var cts = new CancellationTokenSource();
        _world.OnBrew = cts.Cancel;

        var apply = () => _world.Apply(ct: cts.Token);

        await apply.Should().ThrowAsync<OperationCanceledException>();
        _world.Calls.Should().NotContain(call => call.StartsWith("start:"));
    }

    [Fact]
    public async Task Homebrew_WhenTheEngineWasNotRunning_StartsNothing()
    {
        UseHomebrew();
        _world.EngineRunning = false;
        _world.StopOutcome = EngineStopOutcome.NotRunning;

        var applied = await _world.Apply();

        _world.Calls.Should().NotContain(call => call.StartsWith("start:"));
        applied.EngineWasRunning.Should().BeFalse();
    }

    [Fact]
    public async Task Homebrew_ReportsTheVersionHomebrewActuallyInstalled()
    {
        UseHomebrew();
        _world.BrewInstalled = SemVersionTests.V("1.0.0-beta.3");

        var applied = await _world.Apply();

        applied.To.Should().Be("1.0.0-beta.3");
    }

    [Fact]
    public async Task Homebrew_WhenTheEngineCantBeStopped_RefusesBeforeRunningBrew()
    {
        UseHomebrew();
        _world.StopOutcome = EngineStopOutcome.NotSupported;

        var apply = () => _world.Apply();

        await apply.Should().ThrowAsync<CliException>();
        _world.Calls.Should().NotContain(call => call.StartsWith("brew:"));
    }
}
