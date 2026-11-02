using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Text.Json;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Tests.Update;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom update</c> over a substituted updater: what it asks, what it writes, and the exit codes. It reaches for
/// neither the engine nor a device.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class UpdateCommandTests : IDisposable
{
    private static readonly DateTimeOffset CheckedAt = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    private readonly TestHost _host;

    public UpdateCommandTests() => _host = Host();

    public void Dispose() => _host.Dispose();

    private static TestHost Host(bool terminal = false) => new(terminal);

    private string StdOut => _host.Consoles.StdOut;

    private string StdErr => _host.Consoles.StdErr;

    private JsonElement Document => JsonDocument.Parse(StdOut).RootElement;

    private static UpdateStatus Status(bool available = true, InstallKind kind = InstallKind.Release) =>
        new("1.0.0-beta.1", available ? "1.0.0-beta.2" : "1.0.0-beta.1", available, kind, CheckedAt);

    private static UpdateCheckResult Found(UpdateStatus status) =>
        status.Available
            ? new UpdateCheckResult(status, ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64"), new ReleaseAsset("TeensyROM-Suite-1.0.0-beta.2-win-x64.zip", "https://example.test/a.zip", 1000, "sha256:" + new string('a', 64)))
            : new UpdateCheckResult(status, null, null);

    private static UpdateApplied Applied(bool wasRunning = true, bool restarted = true, string? problem = null) =>
        new("1.0.0-beta.1", "1.0.0-beta.2", wasRunning, restarted, problem);

    private UpdateCheckResult LookupFinds(UpdateStatus status)
    {
        var found = Found(status);

        _host.Updates.CheckAsync(Arg.Any<CancellationToken>()).Returns(found);
        return found;
    }

    private void InstallingAnswers(UpdateApplied applied) =>
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .Returns(applied);

    private Task NothingInstalled() =>
        _host.Updates.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default, default);

    // ---- --check ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Check_Json_IsTheStatusAndNothingElse_AndInstallsNothing()
    {
        LookupFinds(Status());

        var exitCode = await _host.RunAsync("update", "--check", "--json");

        exitCode.Should().Be(0, StdErr);
        Document.EnumerateObject().Select(p => p.Name).Should().Equal("installed", "latest", "available", "installKind", "checkedAt");
        Document.GetProperty("installed").GetString().Should().Be("1.0.0-beta.1");
        Document.GetProperty("latest").GetString().Should().Be("1.0.0-beta.2");
        Document.GetProperty("available").GetBoolean().Should().BeTrue();
        Document.GetProperty("installKind").GetString().Should().Be("release");
        Document.GetProperty("checkedAt").GetDateTimeOffset().Should().Be(CheckedAt);
        await NothingInstalled();
    }

    [Fact]
    public async Task Check_WhenNothingIsNewer_ExitsZeroWithAvailableFalse()
    {
        LookupFinds(Status(available: false));

        var exitCode = await _host.RunAsync("update", "--check", "--json");

        exitCode.Should().Be(0, StdErr);
        Document.GetProperty("available").GetBoolean().Should().BeFalse();
        Document.TryGetProperty("updated", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Check_Human_NamesTheNewReleaseAndTheCommandToRun()
    {
        LookupFinds(Status());

        var exitCode = await _host.RunAsync("update", "--check");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("TeensyROM Suite 1.0.0-beta.2 is out (you have 1.0.0-beta.1). Run `trom update`.");
        StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task Check_ForASourceBuild_PointsAtGitInsteadOfTheCommand()
    {
        LookupFinds(Status(kind: InstallKind.Source));

        var exitCode = await _host.RunAsync("update", "--check");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("1.0.0-beta.2 is out").And.Contain("git").And.NotContain("Run `trom update`");
    }

    [Fact]
    public async Task Check_WhenTheLookupFails_ExitsOneWithTheReason()
    {
        _host.Updates.CheckAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.Failed, "Couldn't look up the latest release: no route to host."));

        var exitCode = await _host.RunAsync("update", "--check", "--json");

        exitCode.Should().Be(1);
        StdOut.Should().BeEmpty();
        StdErr.Should().Contain("Couldn't look up the latest release: no route to host.");
    }

    [Fact]
    public async Task Check_CancelledWithCtrlC_ExitsOneSayingSo()
    {
        _host.Updates.CheckAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new OperationCanceledException());

        var exitCode = await _host.RunAsync("update", "--check");

        exitCode.Should().Be(1);
        StdErr.Should().Contain("Cancelled.").And.NotContain("unexpected");
    }

    // ---- installing ------------------------------------------------------------------------------------------

    [Fact]
    public async Task Yes_Json_InstallsAndReportsTheStatusAfterwards_WithWhatChanged()
    {
        var found = LookupFinds(Status());
        InstallingAnswers(Applied());

        var exitCode = await _host.RunAsync("update", "--yes", "--json");

        exitCode.Should().Be(0, StdErr);
        Document.EnumerateObject().Select(p => p.Name).Should().Equal(
            "installed", "latest", "available", "installKind", "checkedAt", "updated", "from", "to", "engineWasRunning", "engineRestarted");
        Document.GetProperty("installed").GetString().Should().Be("1.0.0-beta.2");
        Document.GetProperty("latest").GetString().Should().Be("1.0.0-beta.2");
        Document.GetProperty("available").GetBoolean().Should().BeFalse();
        Document.GetProperty("updated").GetBoolean().Should().BeTrue();
        Document.GetProperty("from").GetString().Should().Be("1.0.0-beta.1");
        Document.GetProperty("to").GetString().Should().Be("1.0.0-beta.2");
        Document.GetProperty("engineWasRunning").GetBoolean().Should().BeTrue();
        Document.GetProperty("engineRestarted").GetBoolean().Should().BeTrue();
        await _host.Updates.Received(1).ApplyAsync(found, Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Yes_WhenAHomebrewInstallLandsBehindTheLatestRelease_StillReportsOneAvailable()
    {
        LookupFinds(new UpdateStatus("1.0.0-alpha.9", "1.0.0-beta.2", true, InstallKind.Homebrew, CheckedAt));
        InstallingAnswers(new UpdateApplied("1.0.0-alpha.9", "1.0.0-beta.1", false, false, null));

        var exitCode = await _host.RunAsync("update", "--yes", "--json");

        exitCode.Should().Be(0, StdErr);
        Document.GetProperty("installed").GetString().Should().Be("1.0.0-beta.1");
        Document.GetProperty("latest").GetString().Should().Be("1.0.0-beta.2");
        Document.GetProperty("available").GetBoolean().Should().BeTrue();
        Document.GetProperty("installKind").GetString().Should().Be("homebrew");
    }

    [Fact]
    public async Task Yes_WhenNothingIsNewer_ReportsUpdatedFalse_AndInstallsNothing()
    {
        LookupFinds(Status(available: false));

        var exitCode = await _host.RunAsync("update", "--yes", "--json");

        exitCode.Should().Be(0, StdErr);
        Document.GetProperty("updated").GetBoolean().Should().BeFalse();
        Document.GetProperty("available").GetBoolean().Should().BeFalse();
        Document.TryGetProperty("from", out _).Should().BeFalse();
        await NothingInstalled();
    }

    [Fact]
    public async Task Yes_WhenNothingIsNewer_SaysTheInstalledReleaseIsTheNewest()
    {
        LookupFinds(Status(available: false));

        var exitCode = await _host.RunAsync("update", "--yes");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("TeensyROM Suite 1.0.0-beta.1 is the newest release.");
    }

    [Fact]
    public async Task Yes_Human_ReportsTheUpdate_AndEachStepOnStderr()
    {
        LookupFinds(Status());
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                call.ArgAt<Action<string>>(1)("Installing…");
                return Applied();
            });

        var exitCode = await _host.RunAsync("update", "--yes");

        exitCode.Should().Be(0, StdErr);
        StdErr.Should().Contain("Installing…").And.Contain("Updated TeensyROM Suite from 1.0.0-beta.1 to 1.0.0-beta.2. Trom API is running again.");
        StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task Yes_WhenTheEngineDidNotComeBack_ExitsZeroButReportsItInTheJsonAndAsANotice()
    {
        LookupFinds(Status());
        InstallingAnswers(Applied(restarted: false, problem: "Trom API didn't start (it exited while starting)."));

        var exitCode = await _host.RunAsync("update", "--yes", "--json");

        exitCode.Should().Be(0);
        Document.GetProperty("updated").GetBoolean().Should().BeTrue();
        Document.GetProperty("engineRestarted").GetBoolean().Should().BeFalse();
        Document.GetProperty("restartProblem").GetString().Should().Be("Trom API didn't start (it exited while starting).");
        var notice = JsonDocument.Parse(StdErr.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Last())
            .RootElement.GetProperty("notice");
        notice.GetProperty("code").GetString().Should().Be("engineNotRestarted");
        notice.GetProperty("fix").GetString().Should().Be("trom api start");
        notice.TryGetProperty("device", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Yes_WhenTheEngineWasNotRunning_SaysNothingAboutIt()
    {
        LookupFinds(Status());
        InstallingAnswers(Applied(wasRunning: false, restarted: false));

        var exitCode = await _host.RunAsync("update", "--yes");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("Updated TeensyROM Suite").And.NotContain("Trom API");
    }

    [Fact]
    public async Task WhenTheUpdateFails_ExitsOneWithTheReason_AndWritesNoDocument()
    {
        LookupFinds(Status());
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.Failed, "trom can't write to C:\\TeensyROM, so it can't update there."));

        var exitCode = await _host.RunAsync("update", "--yes", "--json");

        exitCode.Should().Be(1);
        StdOut.Should().BeEmpty();
        StdErr.Should().Contain("can't update there");
    }

    [Fact]
    public async Task WhenCancelledWithCtrlC_ExitsOneSayingSo_NotWithAnUnexpectedError()
    {
        LookupFinds(Status());
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var exitCode = await _host.RunAsync("update", "--yes");

        exitCode.Should().Be(1);
        StdErr.Should().Contain("Cancelled.").And.NotContain("unexpected");
    }

    [Fact]
    public async Task ASourceBuild_IsRefusedByTheUpdateWithoutBeingAskedFirst()
    {
        LookupFinds(Status(kind: InstallKind.Source));
        _host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CliException(CliExitCode.Failed, "This trom was built from source, so it doesn't update itself."));

        var exitCode = await _host.RunAsync("update");

        exitCode.Should().Be(1);
        StdErr.Should().Contain("built from source").And.NotContain("--yes");
    }

    // ---- asking ----------------------------------------------------------------------------------------------

    [Fact]
    public async Task WithoutYes_AndNoTerminal_IsAUsageError_AndInstallsNothing()
    {
        LookupFinds(Status());

        var exitCode = await _host.RunAsync("update", "--json");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("Pass --yes to update without a terminal to confirm it.");
        StdOut.Should().BeEmpty();
        await NothingInstalled();
    }

    [Fact]
    public async Task InATerminal_AsksFirst_AndDecliningChangesNothing()
    {
        using var host = Host(terminal: true);
        host.Updates.CheckAsync(Arg.Any<CancellationToken>()).Returns(Found(Status()));
        host.Consoles.Err.Input.PushTextWithEnter("n");

        var exitCode = await host.RunAsync("update");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("Update TeensyROM Suite from 1.0.0-beta.1 to 1.0.0-beta.2?").And.Contain("Cancelled; nothing was changed.");
        await host.Updates.DidNotReceiveWithAnyArgs().ApplyAsync(default!, default!, default, default);
    }

    [Fact]
    public async Task InATerminal_InstallsWhenConfirmed_ShowingProgressWhileItRuns()
    {
        using var host = Host(terminal: true);
        host.Updates.CheckAsync(Arg.Any<CancellationToken>()).Returns(Found(Status()));
        host.Updates.ApplyAsync(Arg.Any<UpdateCheckResult>(), Arg.Any<Action<string>>(), Arg.Any<IProgress<DownloadProgress>?>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                call.ArgAt<Action<string>>(1)("Installing…");
                call.ArgAt<IProgress<DownloadProgress>?>(2)!.Report(new DownloadProgress(50, 100));
                return Applied();
            });
        host.Consoles.Err.Input.PushTextWithEnter("y");

        var exitCode = await host.RunAsync("update");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdErr.Should().Contain("Updated TeensyROM Suite from 1.0.0-beta.1 to 1.0.0-beta.2.");
    }

    [Fact]
    public async Task Update_NeedsNeitherTheEngineNorADevice()
    {
        LookupFinds(Status());
        InstallingAnswers(Applied());

        await _host.RunAsync("update", "--yes");

        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
        await _host.Engine.DidNotReceiveWithAnyArgs().StopAsync(default);
        await _host.Devices.DidNotReceiveWithAnyArgs().GetDevicesAsync(default);
    }
}
