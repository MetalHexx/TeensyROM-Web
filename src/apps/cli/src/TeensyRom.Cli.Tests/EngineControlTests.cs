using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public class EngineControlTests
{
    private readonly FakeEngineWorld _world = new();
    private readonly EngineControl _sut;

    public EngineControlTests() =>
        _sut = new EngineControl(_world, _world, _world, _world, _world, _world, FakeEngineWorld.OwnVersion, _world.Notices.Add);

    private static EngineProbeResult.Engine OwnEngine => new(FakeEngineWorld.OwnVersion);

    private static readonly EngineLocation Source = new(EngineMode.Source, @"C:\work\tr-web", @"C:\work\tr-web\src\apps\api\src\TeensyRom.Api\TeensyRom.Api.csproj");

    // ---- starting -------------------------------------------------------------------------------------------

    [Fact]
    public async Task EnsureRunning_WhenNothingListensAndNoLockIsHeld_StartsOneEngineAndWaitsForIt()
    {
        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().Equal("launch");
        _world.Notices.Should().ContainSingle().Which.Should().Be("Starting the TeensyROM engine…");
    }

    [Fact]
    public async Task EnsureRunning_WhenNothingListensButTheLockIsHeld_WaitsAndNeverStartsAnother()
    {
        _world.LockHeld = true;
        _world.OnProbe = probes => { if (probes == 5) _world.Answer = OwnEngine; };

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().BeEmpty();
        _world.Notices.Should().ContainSingle().Which.Should().Be("Waiting for the TeensyROM engine to finish starting…");
    }

    [Fact]
    public async Task EnsureRunning_WhenTheHeldLockFreesWhileNothingAnswers_StartsExactlyOneEngine()
    {
        _world.LockHeld = true;
        _world.OnProbe = probes => { if (probes == 4) _world.LockHeld = false; };

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().Equal("launch");
        _world.Notices.Should().Equal("Waiting for the TeensyROM engine to finish starting…", "Starting the TeensyROM engine…");
    }

    [Fact]
    public async Task EnsureRunning_WhenSomethingListensButHasNotAnswered_KeepsWaitingAndNeverStarts()
    {
        _world.Answer = new EngineProbeResult.NotReady();
        _world.OnProbe = probes => { if (probes == 8) _world.Answer = OwnEngine; };

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureRunning_WhenItNeverAnswers_FailsAtTheDeadlineNamingTheLogs()
    {
        _world.Answer = new EngineProbeResult.NotReady();

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("didn't start").And.Contain(TeensyRomHome.EngineLogsPath);
        _world.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(180));
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureRunning_WhenTheStartedEngineNeverAnswersButHoldsItsLock_FailsAfterThreeMinutesNamingTheLogs()
    {
        _world.LaunchBoots = false;

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("didn't start").And.Contain(TeensyRomHome.EngineLogsPath);
        _world.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(180));
        _world.Calls.Should().Equal("launch");
    }

    [Fact]
    public async Task EnsureRunning_WhenTheStartedEngineLeavesNoLockAndNoAnswer_FailsFastNamingTheLogs()
    {
        _world.LaunchBoots = false;
        _world.LaunchHoldsLock = false;

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("exited").And.Contain(TeensyRomHome.EngineLogsPath);
        _world.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(15)).And.BeLessThan(TimeSpan.FromSeconds(30));
        _world.Calls.Should().Equal("launch");
    }

    [Fact]
    public async Task EnsureRunning_WhenItsOwnLaunchDiesButAnotherEngineAnswers_IsReady()
    {
        _world.LaunchBoots = false;
        _world.LaunchHoldsLock = false;
        _world.OnProbe = probes => { if (probes == 6) _world.Answer = OwnEngine; };

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().Equal("launch");
    }

    [Fact]
    public async Task EnsureRunning_WhenAnotherVersionAnswersWhileWaiting_Fails()
    {
        _world.Answer = new EngineProbeResult.NotReady();
        _world.OnProbe = probes => { if (probes == 3) _world.Answer = new EngineProbeResult.Engine("0.0.1"); };

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("0.0.1").And.Contain(TeensyRomHome.EngineLogsPath);
    }

    [Fact]
    public async Task EnsureRunning_CreatesTheLogFoldersBeforeLaunching()
    {
        if (Directory.Exists(TeensyRomHome.EngineLogsPath)) Directory.Delete(TeensyRomHome.EngineLogsPath, recursive: true);

        await _sut.EnsureRunningAsync(default);

        _world.EngineLogsExistedAtLaunch.Should().BeTrue();
        _world.CliLogsExistedAtLaunch.Should().BeTrue();
    }

    [Fact]
    public async Task EnsureRunning_WhenNoEngineIsBesideTheCli_SaysWhereItLooked()
    {
        _world.Location = null;
        _world.Searched = @"C:\apps\teensyrom";

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Be(@"No TeensyROM engine was found beside this CLI (looked in C:\apps\teensyrom).");
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureRunning_WhenTheLaunchFails_FailsNamingTheLogs()
    {
        _world.LaunchResult = EngineStep.Fail("it couldn't be launched");

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("it couldn't be launched").And.Contain(TeensyRomHome.EngineLogsPath);
    }

    // ---- reusing and replacing ------------------------------------------------------------------------------

    [Theory]
    [InlineData("")]
    [InlineData("+abc123")]
    public async Task EnsureRunning_WhenTheSameVersionAnswers_ReusesItWithoutStarting(string buildMetadata)
    {
        _world.Answer = new EngineProbeResult.Engine(FakeEngineWorld.OwnVersion + buildMetadata);

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().BeEmpty();
        _world.Notices.Should().BeEmpty();
        _world.FingerprintReads.Should().Be(0, "a packaged engine is never fingerprinted");
    }

    [Fact]
    public async Task EnsureRunning_WhenAnotherVersionRuns_SaysSoStopsItAndStartsThisOne()
    {
        _world.Answer = new EngineProbeResult.Engine("0.9.0+abc");

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().Equal("stop", "launch");
        _world.Notices.First().Should().Be($"The running TeensyROM engine is version 0.9.0, this CLI is {FakeEngineWorld.OwnVersion} — restarting it.");
    }

    [Theory]
    [InlineData(nameof(EngineStopRequest.NotSupported))]
    [InlineData(nameof(EngineStopRequest.Failed))]
    public async Task EnsureRunning_WhenTheOldEngineCannotBeStopped_FailsAndStartsNothing(string refusal)
    {
        _world.Answer = new EngineProbeResult.Engine("0.9.0");
        _world.StopRequest = Enum.Parse<EngineStopRequest>(refusal);

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Be("The running TeensyROM engine (version 0.9.0) can't be stopped from the CLI. Stop it where it was started, then try again.");
        _world.Calls.Should().Equal("stop");
    }

    [Fact]
    public async Task EnsureRunning_WhenSomethingElseHoldsThePort_FailsNamingTheLogs()
    {
        _world.Answer = new EngineProbeResult.Foreign("it answered HTTP 404");

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().StartWith("Something other than a TeensyROM engine is using port 10213").And.Contain(TeensyRomHome.EngineLogsPath);
        _world.Calls.Should().BeEmpty();
    }

    // ---- from source ----------------------------------------------------------------------------------------

    [Fact]
    public async Task EnsureRunning_FromSource_BuildsBeforeItStartsAndRecordsTheFingerprintTakenBeforeTheBuild()
    {
        _world.Location = Source;
        _world.Fingerprint = "head:before";
        _world.OnBuild = () => _world.Fingerprint = "head:after";

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().Equal("build", "launch", "record:head:before|Release");
        _world.Notices.Should().Equal("Starting the TeensyROM engine…", "Building the TeensyROM engine from source…");
        _world.CliLogsExistedAtBuild.Should().BeTrue();
    }

    [Fact]
    public async Task EnsureRunning_WhenTheSourceBuildFails_FailsNamingTheBuildLogAndStartsNothing()
    {
        _world.Location = Source;
        _world.BuildResult = EngineStep.Fail("the build failed");

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeFalse();
        ready.FailureMessage.Should().Contain("the build failed").And.Contain(TeensyRomHome.EngineBuildLogPath).And.Contain(TeensyRomHome.EngineLogsPath);
        _world.Calls.Should().Equal("build");
    }

    [Fact]
    public async Task EnsureRunning_FromSource_ReusesAnEngineBuiltFromTheCurrentSources()
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = "head:same";
        _world.RecordedFingerprint = "head:same|Release";

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().BeEmpty();
    }

    [Theory]
    [InlineData("head:older")]
    [InlineData(null)]
    public async Task EnsureRunning_FromSource_ReplacesAnEngineOfTheSameVersionBuiltFromOtherSources(string? recorded)
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = "head:now";
        _world.RecordedFingerprint = recorded;

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Notices.First().Should().Be("The running TeensyROM engine is out of date with this source tree — restarting it.");
        _world.Calls.Should().Equal("stop", "build", "launch", "record:head:now|Release");
    }

    [Fact]
    public async Task EnsureRunning_FromSource_ReplacesAnEngineThatWasBuiltInAnotherConfiguration_AndRecordsTheNewOne()
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = "head:same";
        _world.RecordedFingerprint = "head:same|Debug";

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Notices.First().Should().Be("The running TeensyROM engine is out of date with this source tree — restarting it.");
        _world.Calls.Should().Equal("stop", "build", "launch", "record:head:same|Release");
    }

    [Fact]
    public async Task EnsureRunning_FromSource_ReplacesAnEngineRecordedBeforeConfigurationsWereStamped()
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = "head:same";
        _world.RecordedFingerprint = "head:same";

        await _sut.EnsureRunningAsync(default);

        _world.Calls.Should().Equal("stop", "build", "launch", "record:head:same|Release");
    }

    [Fact]
    public async Task EnsureRunning_FromSource_KeepsADebugEngineWhileDebugIsTheConfiguration()
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = "head:same";
        _world.Configuration = "Debug";
        _world.RecordedFingerprint = "head:same|Debug";

        await _sut.EnsureRunningAsync(default);

        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureRunning_FromSource_NeverCountsAnUnknownFingerprintAsStale()
    {
        _world.Location = Source;
        _world.Answer = OwnEngine;
        _world.Fingerprint = SourceFingerprint.Unknown;
        _world.RecordedFingerprint = null;

        var ready = await _sut.EnsureRunningAsync(default);

        ready.Ok.Should().BeTrue();
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureRunning_FromSource_StopsTheOldEngineBeforeBuildingSoNothingIsLocked()
    {
        _world.Location = Source;
        _world.Answer = new EngineProbeResult.Engine("0.9.0");

        await _sut.EnsureRunningAsync(default);

        _world.Calls.Take(3).Should().Equal("stop", "build", "launch");
    }

    [Fact]
    public async Task EnsureRunning_WhenPackaged_NeverFingerprints()
    {
        await _sut.EnsureRunningAsync(default);

        _world.FingerprintReads.Should().Be(0);
        _world.Calls.Should().Equal("launch");
    }

    // ---- stopping -------------------------------------------------------------------------------------------

    [Fact]
    public async Task Stop_OfARunningEngine_WaitsForItsPortAndLockThenReportsStopped()
    {
        _world.Answer = OwnEngine;
        _world.LockHeld = true;
        _world.StopFreesEngine = false;
        _world.OnProbe = probes =>
        {
            if (probes == 3) _world.Answer = new EngineProbeResult.Unreachable();
            if (probes == 5) _world.LockHeld = false;
        };

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Stopped);
        _world.Calls.Should().Equal("stop");
    }

    [Fact]
    public async Task Stop_WhenTheEngineNeverLetsGo_FailsAfterFortyFiveSeconds()
    {
        _world.Answer = OwnEngine;
        _world.StopFreesEngine = false;

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Failed);
        _world.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(45));
        _world.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(60));
    }

    [Fact]
    public async Task Stop_WhenThePortIsFreeButTheLockIsStillHeld_IsNotStoppedYet()
    {
        _world.Answer = OwnEngine;
        _world.LockHeld = true;
        _world.OnProbe = probes => { if (probes == 2) _world.Answer = new EngineProbeResult.Unreachable(); };
        _world.StopFreesEngine = false;

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Failed);
    }

    [Fact]
    public async Task Stop_WhenNothingRuns_IsNotRunningAndAsksNothing()
    {
        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.NotRunning);
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Stop_WhenSomethingElseHoldsThePort_IsForeign()
    {
        _world.Answer = new EngineProbeResult.Foreign("it answered HTTP 404");

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Foreign);
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Stop_WhenTheEngineHasNotAnsweredYet_Fails()
    {
        _world.Answer = new EngineProbeResult.NotReady();

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Failed);
        _world.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Stop_OfAnEngineWithoutTheStopEndpoint_IsNotSupported()
    {
        _world.Answer = OwnEngine;
        _world.StopRequest = EngineStopRequest.NotSupported;

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.NotSupported);
    }

    [Fact]
    public async Task Stop_OfAnEngineThatRefuses_Fails()
    {
        _world.Answer = OwnEngine;
        _world.StopRequest = EngineStopRequest.Failed;

        var outcome = await _sut.StopAsync(default);

        outcome.Should().Be(EngineStopOutcome.Failed);
    }

    [Fact]
    public async Task Stop_NeverStartsAnything()
    {
        await _sut.StopAsync(default);

        _world.Calls.Should().NotContain("launch").And.NotContain("build");
    }

    // ---- status ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Status_OfAnEngineOfThisVersion_IsRunningAndMatching()
    {
        ClearEngineLogs();
        _world.Answer = OwnEngine;

        var status = await _sut.GetStatusAsync(default);

        status.Should().Be(new EngineStatus(
            true, FakeEngineWorld.OwnVersion, FakeEngineWorld.OwnVersion, true, "localhost:10213", null, TeensyRomHome.EngineLogsPath, LogFile: null));
    }

    [Fact]
    public async Task Status_OfARunningEngine_NamesTheLogFolder_AndTheNewestLogFile()
    {
        ClearEngineLogs();
        Directory.CreateDirectory(TeensyRomHome.EngineLogsPath);
        foreach (var name in new[] { "Logs-2026-10-02_09-00-00.txt", "Logs-2026-10-01_10-00-00.txt", "engine-console.log" })
        {
            File.WriteAllText(Path.Combine(TeensyRomHome.EngineLogsPath, name), string.Empty);
        }
        _world.Answer = OwnEngine;

        var status = await _sut.GetStatusAsync(default);

        status.LogFolder.Should().Be(TeensyRomHome.EngineLogsPath);
        status.LogFile.Should().Be(Path.Combine(TeensyRomHome.EngineLogsPath, "Logs-2026-10-02_09-00-00.txt"));
    }

    [Fact]
    public async Task Status_WhenNothingListens_NamesTheLogFolderOnly()
    {
        ClearEngineLogs();
        Directory.CreateDirectory(TeensyRomHome.EngineLogsPath);
        File.WriteAllText(Path.Combine(TeensyRomHome.EngineLogsPath, "Logs-2026-10-02_09-00-00.txt"), string.Empty);

        var status = await _sut.GetStatusAsync(default);

        status.LogFolder.Should().Be(TeensyRomHome.EngineLogsPath);
        status.LogFile.Should().BeNull();
    }

    private static void ClearEngineLogs()
    {
        if (Directory.Exists(TeensyRomHome.EngineLogsPath)) Directory.Delete(TeensyRomHome.EngineLogsPath, recursive: true);
    }

    [Theory]
    [InlineData("1.0.0-alpha.8+abc123", true)]
    [InlineData("1.0.0-alpha.8", true)]
    [InlineData("1.0.0-alpha.7+abc123", false)]
    public async Task Status_ComparesVersionsIgnoringBuildMetadata(string engineVersion, bool matches)
    {
        _world.Answer = new EngineProbeResult.Engine(engineVersion);

        var status = await _sut.GetStatusAsync(default);

        status.Running.Should().BeTrue();
        status.Version.Should().Be(engineVersion);
        status.Matches.Should().Be(matches);
        status.Problem.Should().BeNull();
    }

    [Fact]
    public async Task Status_WhenNothingListens_IsNotRunning_AndSaysHowToStartOne()
    {
        var status = await _sut.GetStatusAsync(default);

        status.Running.Should().BeFalse();
        status.Version.Should().BeNull();
        status.Matches.Should().BeFalse();
        status.CliVersion.Should().Be(FakeEngineWorld.OwnVersion);
        status.Problem.Should().Contain("No TeensyROM engine is running").And.Contain("trom device list");
    }

    [Fact]
    public async Task Status_WhenSomethingListensButHasNotAnswered_IsNotRunning()
    {
        _world.Answer = new EngineProbeResult.NotReady();

        var status = await _sut.GetStatusAsync(default);

        status.Running.Should().BeFalse();
        status.Problem.Should().Contain("isn't answering yet");
    }

    [Fact]
    public async Task Status_WhenAnotherProgramHoldsThePort_IsNotRunning_AndNamesThePort()
    {
        _world.Answer = new EngineProbeResult.Foreign("it answered HTTP 404");

        var status = await _sut.GetStatusAsync(default);

        status.Running.Should().BeFalse();
        status.Problem.Should().Contain("10213").And.Contain("it answered HTTP 404");
    }

    [Fact]
    public async Task Status_NeverStartsOrStopsAnything()
    {
        await _sut.GetStatusAsync(default);
        _world.Answer = OwnEngine;
        await _sut.GetStatusAsync(default);

        _world.Calls.Should().BeEmpty();
        _world.Notices.Should().BeEmpty();
    }
}

/// <summary>
/// The OS the engine control talks to, played by one object: the port, the lock, the locator, the build and launch,
/// the fingerprint record and the clock. A fake clock turns the control's minutes of polling into instant loops.
/// </summary>
internal sealed class FakeEngineWorld : IEngineProbe, IEngineLock, IEngineLocator, IEngineLauncher, ISourceFreshness, IEngineClock
{
    public const string OwnVersion = "1.0.0-alpha.8";

    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private DateTimeOffset _now = Start;
    private int _bootProbesLeft = -1;

    /// <summary>The order in which the control stopped, built, launched and recorded.</summary>
    public List<string> Calls { get; } = [];

    public List<string> Notices { get; } = [];

    public TimeSpan Elapsed => _now - Start;

    // What the port says and the lock holds.
    public EngineProbeResult Answer { get; set; } = new EngineProbeResult.Unreachable();
    public bool LockHeld { get; set; }
    public int Probes { get; private set; }

    /// <summary>Runs on every probe with the probe's number, so a test can change the world over time.</summary>
    public Action<int>? OnProbe { get; set; }

    // Stopping.
    public EngineStopRequest StopRequest { get; set; } = EngineStopRequest.Accepted;
    public bool StopFreesEngine { get; set; } = true;

    // Locating, building, launching.
    public EngineLocation? Location { get; set; } = new(EngineMode.Packaged, @"C:\apps\teensyrom");
    public string Searched { get; set; } = @"C:\apps\teensyrom";
    public string Configuration { get; set; } = "Release";
    public EngineStep BuildResult { get; set; } = EngineStep.Success;
    public EngineStep LaunchResult { get; set; } = EngineStep.Success;
    public Action? OnBuild { get; set; }
    public bool LaunchBoots { get; set; } = true;
    public bool LaunchHoldsLock { get; set; } = true;
    public int BootProbes { get; set; } = 2;
    public bool EngineLogsExistedAtLaunch { get; private set; }
    public bool CliLogsExistedAtLaunch { get; private set; }
    public bool CliLogsExistedAtBuild { get; private set; }

    // Source freshness.
    public string Fingerprint { get; set; } = "head:fingerprint";
    public string? RecordedFingerprint { get; set; }
    public int FingerprintReads { get; private set; }

    public Task<EngineProbeResult> ProbeAsync(CancellationToken ct)
    {
        Probes++;
        OnProbe?.Invoke(Probes);

        if (_bootProbesLeft > 0 && --_bootProbesLeft == 0) Answer = new EngineProbeResult.Engine(OwnVersion);

        return Task.FromResult(Answer);
    }

    public Task<EngineStopRequest> RequestStopAsync(CancellationToken ct)
    {
        Calls.Add("stop");

        if (StopRequest == EngineStopRequest.Accepted && StopFreesEngine)
        {
            Answer = new EngineProbeResult.Unreachable();
            LockHeld = false;
        }
        return Task.FromResult(StopRequest);
    }

    public bool IsHeld() => LockHeld;

    public EngineLookup Locate() => new(Location, Searched);

    public Task<EngineStep> BuildAsync(EngineLocation location, CancellationToken ct)
    {
        Calls.Add("build");
        CliLogsExistedAtBuild = Directory.Exists(TeensyRomHome.CliLogsPath);
        OnBuild?.Invoke();
        return Task.FromResult(BuildResult);
    }

    public EngineStep Launch(EngineLocation location)
    {
        Calls.Add("launch");
        EngineLogsExistedAtLaunch = Directory.Exists(TeensyRomHome.EngineLogsPath);
        CliLogsExistedAtLaunch = Directory.Exists(TeensyRomHome.CliLogsPath);

        if (LaunchResult.Ok)
        {
            LockHeld = LaunchHoldsLock;
            _bootProbesLeft = LaunchBoots ? BootProbes : -1;
        }
        return LaunchResult;
    }

    public string Current(string repoRoot)
    {
        FingerprintReads++;
        return Fingerprint;
    }

    public string? Recorded() => RecordedFingerprint;

    public void Record(string fingerprint)
    {
        Calls.Add($"record:{fingerprint}");
        RecordedFingerprint = fingerprint;
    }

    public DateTimeOffset UtcNow => _now;

    public Task DelayAsync(TimeSpan delay, CancellationToken ct)
    {
        _now += delay;

        if (Elapsed > TimeSpan.FromHours(1)) throw new InvalidOperationException("The engine control kept polling past any deadline.");

        return Task.CompletedTask;
    }
}
