using TeensyRom.Api.Services;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferAutoLauncherTests
{
    private const string DeviceId = "device-1";
    private readonly ISettingsService _settings = Substitute.For<ISettingsService>();
    private readonly IFileLaunchService _launcher = Substitute.For<IFileLaunchService>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private TransferAutoLauncher NewLauncher(bool autoLaunchSetting = true)
    {
        var teensySettings = new TeensySettings();
        teensySettings.FileTransferSettings.AutoLaunchOnCopyEnabled = autoLaunchSetting;
        _settings.GetSettings().Returns(teensySettings);
        return new TransferAutoLauncher(_settings, _launcher, _notifier, _log);
    }

    private static TransferJob NewJob(bool launchRequested = false, TransferOrigin? origin = null) =>
        new(DeviceId, TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions(),
            origin: origin, launchRequested: launchRequested);

    private static TransferOrigin WatchFolder => TransferOrigin.FromWatchFolder("w1", "C:/watch");

    private static TransferJob PendingJob(string path = "/transfers/a.prg")
    {
        var job = NewJob();
        job.TryTransitionTo(TransferJobState.Receiving);
        job.OnFileReceived(1);
        job.OnFileSent(new TransferFileCompleted(job.JobId, "a", path, true, null, 1));
        job.TryTransitionTo(TransferJobState.Sealed);
        job.TryComplete(launchDue: true).Should().BeTrue();
        return job;
    }

    [Theory]
    [InlineData(false, false, false, false)]
    [InlineData(true, false, false, true)]
    [InlineData(false, true, false, true)]
    [InlineData(true, true, false, true)]
    [InlineData(false, false, true, false)]
    [InlineData(true, false, true, false)]
    [InlineData(false, true, true, false)]
    [InlineData(true, true, true, true)]
    public void ShouldLaunch_DecisionTable(bool setting, bool requested, bool watchFolder, bool expected)
    {
        var launcher = NewLauncher(setting);
        var job = NewJob(requested, watchFolder ? WatchFolder : null);

        launcher.ShouldLaunch(job).Should().Be(expected);
    }

    [Fact]
    public async Task StartLaunch_JobWithoutCandidate_DoesNothing()
    {
        var launcher = NewLauncher();
        var job = NewJob();
        job.TryTransitionTo(TransferJobState.Receiving);
        job.TryTransitionTo(TransferJobState.Sealed);
        job.TryComplete(launchDue: true);

        launcher.StartLaunch(job);
        await Task.Delay(50);

        job.ToSnapshot().LaunchState.Should().Be(TransferLaunchState.None);
        await _launcher.DidNotReceiveWithAnyArgs().LaunchAsync(default!, default, default!, default);
    }

    [Theory]
    [InlineData(FileLaunchStatus.Launched, TransferLaunchState.Launched, false)]
    [InlineData(FileLaunchStatus.Incompatible, TransferLaunchState.Incompatible, false)]
    [InlineData(FileLaunchStatus.FileNotFound, TransferLaunchState.Failed, true)]
    [InlineData(FileLaunchStatus.LookupFailed, TransferLaunchState.Failed, true)]
    [InlineData(FileLaunchStatus.LaunchFailed, TransferLaunchState.Failed, true)]
    public async Task StartLaunch_MapsTheOutcomeOntoTheJobAndNotifies(FileLaunchStatus status, TransferLaunchState expected, bool carriesError)
    {
        var launcher = NewLauncher();
        var job = PendingJob("/transfers/game.prg");
        _launcher.LaunchAsync(DeviceId, TeensyStorageType.SD, Arg.Any<FilePath>(), CancellationToken.None)
            .Returns(new FileLaunchOutcome(status, null, "outcome message"));

        launcher.StartLaunch(job);
        await WaitForLaunchToSettle(job);

        var snapshot = job.ToSnapshot();
        snapshot.LaunchState.Should().Be(expected);
        snapshot.LaunchedPath.Should().Be("/transfers/game.prg");
        snapshot.LaunchError.Should().Be(carriesError ? "outcome message" : null);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public async Task StartLaunch_ThrowingLaunchService_EndsFailedAndLogs()
    {
        var launcher = NewLauncher();
        var job = PendingJob();
        _launcher.LaunchAsync(default!, default, default!, default)
            .ReturnsForAnyArgs<Task<FileLaunchOutcome>>(_ => throw new InvalidOperationException("port exploded"));

        launcher.StartLaunch(job);
        await WaitForLaunchToSettle(job);

        var snapshot = job.ToSnapshot();
        snapshot.LaunchState.Should().Be(TransferLaunchState.Failed);
        snapshot.LaunchError.Should().Be("port exploded");
        _log.ReceivedWithAnyArgs().InternalWarning(default!, default);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public async Task StartLaunch_ReturnsBeforeALaunchThatHasNotFinished()
    {
        var launcher = NewLauncher();
        var job = PendingJob();
        var gate = new TaskCompletionSource<FileLaunchOutcome>();
        _launcher.LaunchAsync(default!, default, default!, default).ReturnsForAnyArgs(gate.Task);

        launcher.StartLaunch(job);

        job.ToSnapshot().LaunchState.Should().Be(TransferLaunchState.Pending);

        gate.SetResult(new FileLaunchOutcome(FileLaunchStatus.Launched, null, "Success!"));
        await WaitForLaunchToSettle(job);
        job.ToSnapshot().LaunchState.Should().Be(TransferLaunchState.Launched);
    }

    private static async Task WaitForLaunchToSettle(TransferJob job)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);

        while (job.ToSnapshot().LaunchState is TransferLaunchState.Pending)
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException("Launch stayed Pending.");
            await Task.Delay(10);
        }
    }
}
