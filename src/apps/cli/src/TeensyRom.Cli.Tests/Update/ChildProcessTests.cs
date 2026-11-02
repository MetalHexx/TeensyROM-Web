using System.Diagnostics;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>The three things the update runs as child processes: the new trom, Homebrew and, for real, the process runner itself.</summary>
public sealed class ChildProcessTests
{
    // ---- starting Trom API through the new trom ---------------------------------------------------------------

    [Fact]
    public async Task SuiteStarter_RunsEngineStartAsJsonThroughTheGivenTromWithRoomToFinish()
    {
        var runner = new FakeProcessRunner((_, _) => FakeProcessRunner.Ok("{}"));

        var start = await new SuiteStarter(runner).StartEngineAsync("/install/cli/trom");

        start.Should().Be(new SuiteStart(true, null));
        runner.Calls.Should().ContainSingle().Which.Should().Match<(string File, string[] Args, TimeSpan Timeout)>(
            call => call.File == "/install/cli/trom" && call.Args.SequenceEqual(new[] { "engine", "start", "--json" }) && call.Timeout == TimeSpan.FromSeconds(210));
    }

    [Fact]
    public async Task SuiteStarter_WhenItFails_ReportsTheMessageOfTheJsonErrorObject()
    {
        const string stderr = "Starting the TeensyROM engine…\nThe TeensyROM engine didn't start (it exited while starting).\n"
            + """{"error":{"code":"engineUnavailable","exitCode":3,"message":"The TeensyROM engine didn't start (it exited while starting)."}}""" + "\n";
        var runner = new FakeProcessRunner((_, _) => new ProcessResult(3, "", stderr));

        var start = await new SuiteStarter(runner).StartEngineAsync("trom");

        start.Ok.Should().BeFalse();
        start.Problem.Should().Be("The TeensyROM engine didn't start (it exited while starting).");
    }

    [Fact]
    public async Task SuiteStarter_WhenThereIsNoJsonError_ReportsTheLastLineOfStderr()
    {
        var runner = new FakeProcessRunner((_, _) => new ProcessResult(1, "", "one\ntwo\n"));

        (await new SuiteStarter(runner).StartEngineAsync("trom")).Problem.Should().Be("two");
    }

    [Theory]
    [InlineData("timeout", "it took too long")]
    [InlineData("start", "access denied")]
    [InlineData("silent", "exited with code 1")]
    public async Task SuiteStarter_WhenItCantRunOrSaysNothing_SaysWhatHappened(string how, string expected)
    {
        var runner = new FakeProcessRunner((_, _) => how switch
        {
            "timeout" => new ProcessResult(-1, "", "", TimedOut: true),
            "start" => new ProcessResult(-1, "", "", StartFailure: "access denied"),
            _ => new ProcessResult(1, "", "")
        });

        var start = await new SuiteStarter(runner).StartEngineAsync("trom");

        start.Ok.Should().BeFalse();
        start.Problem.Should().StartWith("Trom API didn't start").And.Contain(expected);
    }

    // ---- Homebrew --------------------------------------------------------------------------------------------

    [Fact]
    public async Task BrewUpdater_UpdatesThenUpgradesTheFormula_ShowingWhatBrewSays()
    {
        var runner = new FakeProcessRunner((_, args) => FakeProcessRunner.Ok($"==> brew {args[0]}\n"));
        var lines = new List<string>();

        var result = await new BrewUpdater(runner).UpgradeAsync("/opt/homebrew", lines.Add);

        result.Should().Be(new BrewResult(true, null));
        runner.Calls.Select(call => (call.File, string.Join(' ', call.Args))).Should().Equal(
            (Path.Combine("/opt/homebrew", "bin", "brew"), "update"),
            (Path.Combine("/opt/homebrew", "bin", "brew"), "upgrade teensyrom-suite"));
        lines.Should().Equal("==> brew update", "==> brew upgrade");
    }

    [Fact]
    public async Task BrewUpdater_WhenTheUpdateFails_DoesNotUpgrade()
    {
        var runner = new FakeProcessRunner((_, _) => new ProcessResult(1, "", "no network"));

        var result = await new BrewUpdater(runner).UpgradeAsync("/opt/homebrew", _ => { });

        result.Ok.Should().BeFalse();
        result.Problem.Should().Contain("`brew update` failed");
        runner.Calls.Should().ContainSingle();
    }

    [Fact]
    public async Task BrewUpdater_WhenTheUpgradeFails_SaysWhich()
    {
        var runner = new FakeProcessRunner((_, args) => args[0] == "update" ? FakeProcessRunner.Ok() : new ProcessResult(1, "", ""));

        var result = await new BrewUpdater(runner).UpgradeAsync("/opt/homebrew", _ => { });

        result.Problem.Should().Contain("`brew upgrade teensyrom-suite` failed");
    }

    [Fact]
    public async Task BrewUpdater_ReadsTheInstalledVersionFromTheTromOnThePrefix()
    {
        var runner = new FakeProcessRunner((_, _) => FakeProcessRunner.Ok("trom 1.0.0-beta.2\nOS: Darwin\nArchitecture: Arm64\n"));

        var version = await new BrewUpdater(runner).InstalledVersionAsync("/opt/homebrew");

        version.Should().Be(SemVersionTests.V("1.0.0-beta.2"));
        runner.Calls.Single().File.Should().Be(Path.Combine("/opt/homebrew", "bin", "trom"));
    }

    [Theory]
    [InlineData("hello")]
    [InlineData("")]
    public async Task BrewUpdater_WhenTromDoesNotReportAVersion_ReturnsNull(string stdout)
    {
        var runner = new FakeProcessRunner((_, _) => FakeProcessRunner.Ok(stdout));

        (await new BrewUpdater(runner).InstalledVersionAsync("/opt/homebrew")).Should().BeNull();
    }

    [Fact]
    public async Task BrewUpdater_WhenTromWontRun_ReturnsNull()
    {
        var runner = new FakeProcessRunner((_, _) => new ProcessResult(-1, "", "", StartFailure: "no such file"));

        (await new BrewUpdater(runner).InstalledVersionAsync("/opt/homebrew")).Should().BeNull();
    }

    // ---- the real runner -------------------------------------------------------------------------------------

    [Fact]
    public async Task ProcessRunner_RunsAProgramAndCapturesItsOutputLineByLine()
    {
        var lines = new List<string>();

        var result = await new ProcessRunner().RunAsync("dotnet", ["--version"], TimeSpan.FromSeconds(60), lines.Add);

        result.Succeeded.Should().BeTrue();
        result.FirstLine.Should().NotBeNullOrWhiteSpace();
        result.FirstLine.Should().Be(lines.First());
    }

    [Fact]
    public async Task ProcessRunner_ReportsTheExitCodeAndStandardError()
    {
        var result = await new ProcessRunner().RunAsync("dotnet", ["this-command-does-not-exist"], TimeSpan.FromSeconds(60), null);

        result.Succeeded.Should().BeFalse();
        result.ExitCode.Should().NotBe(0);
        result.StartFailure.Should().BeNull();
        (result.StdOut + result.StdErr).Should().NotBeNullOrWhiteSpace();
        result.Describe().Should().Contain("exited with code");
    }

    [Fact]
    public async Task ProcessRunner_WhenTheProgramDoesNotExist_SaysItCouldNotStart()
    {
        var result = await new ProcessRunner().RunAsync(Path.Combine(Path.GetTempPath(), "no-such-program-" + Guid.NewGuid().ToString("N")), [], TimeSpan.FromSeconds(5), null);

        result.Succeeded.Should().BeFalse();
        result.StartFailure.Should().NotBeNullOrWhiteSpace();
        result.Describe().Should().Be(result.StartFailure);
    }

    [Fact]
    public async Task ProcessRunner_KillsAProgramThatRunsPastTheTimeout()
    {
        var (file, args) = OperatingSystem.IsWindows() ? ("ping", new[] { "-n", "30", "127.0.0.1" }) : ("sleep", new[] { "30" });
        var clock = Stopwatch.StartNew();

        var result = await new ProcessRunner().RunAsync(file, args, TimeSpan.FromMilliseconds(500), null);

        result.TimedOut.Should().BeTrue();
        result.Succeeded.Should().BeFalse();
        clock.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(20));
    }

    [Fact]
    public async Task ProcessRunner_WhenTheCallerCancels_KillsTheProgramAndRethrows()
    {
        var (file, args) = OperatingSystem.IsWindows() ? ("ping", new[] { "-n", "30", "127.0.0.1" }) : ("sleep", new[] { "30" });
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));

        var run = () => new ProcessRunner().RunAsync(file, args, TimeSpan.FromMinutes(5), null, cts.Token);

        await run.Should().ThrowAsync<OperationCanceledException>();
    }

    [Theory]
    [InlineData("trom 1.0.0-beta.2\nOS: x", "1.0.0-beta.2")]
    [InlineData("\n  trom v1.0.0  \n", "1.0.0")]
    [InlineData("trom nonsense", null)]
    [InlineData("Usage: trom", null)]
    [InlineData("", null)]
    public void ProcessResult_ReadsTheVersionFromTheFirstLineOfTromVersion(string stdout, string? expected)
    {
        var version = new ProcessResult(0, stdout, "").ReportedTromVersion;

        version.Should().Be(expected is null ? null : SemVersionTests.V(expected));
    }
}
