using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

public class TransferLinesTests
{
    internal static TransferJobDto Job(
        TransferJobState state = TransferJobState.Receiving,
        string id = "job-1",
        int? totalFiles = null,
        int filesSent = 0,
        int filesFailed = 0,
        bool watchFolder = false,
        TransferLaunchState launch = TransferLaunchState.None,
        string? launchedPath = null,
        string? launchError = null,
        string? error = null) => new()
    {
        JobId = id,
        DeviceId = "dev-1",
        State = state,
        TotalFiles = totalFiles,
        FilesSent = filesSent,
        FilesFailed = filesFailed,
        Origin = watchFolder
            ? new TransferOriginDto { Kind = TransferOriginKind.WatchFolder, WatchFolderId = "w1", WatchFolderPath = @"C:\Games\Incoming\" }
            : new TransferOriginDto { Kind = TransferOriginKind.Upload },
        LaunchState = launch,
        LaunchedPath = launchedPath,
        LaunchError = launchError,
        Error = error
    };

    [Theory]
    [InlineData(false, 1, "Sending 1 file to Alpha")]
    [InlineData(false, 12, "Sending 12 files to Alpha")]
    [InlineData(true, 1, "Sending 1 file from Incoming to Alpha")]
    [InlineData(true, 12, "Sending 12 files from Incoming to Alpha")]
    [InlineData(false, null, "Sending files to Alpha")]
    [InlineData(true, null, "Sending files from Incoming to Alpha")]
    public void Start_NamesTheCountOnlyWhenKnown_AndIsNeverAnError(bool watchFolder, int? total, string expected)
    {
        var (isError, text) = TransferLines.Start(Job(totalFiles: total, watchFolder: watchFolder), "Alpha");

        isError.Should().BeFalse();
        text.Should().Be(expected);
    }

    [Theory]
    [InlineData(1, 0, "Sent 1 file to Alpha")]
    [InlineData(5, 0, "Sent 5 files to Alpha")]
    [InlineData(4, 1, "Sent 4 of 5 files to Alpha \u00B7 1 didn't arrive")]
    [InlineData(1, 2, "Sent 1 of 3 files to Alpha \u00B7 2 didn't arrive")]
    public void End_Completed_CountsWhatArrived(int sent, int failed, string expected)
    {
        var (isError, text) = TransferLines.End(Job(TransferJobState.Completed, filesSent: sent, filesFailed: failed), "Alpha");

        text.Should().Be(expected);
        isError.Should().Be(failed > 0);
    }

    [Theory]
    [InlineData(TransferLaunchState.None, "Sent 2 files to Alpha", false)]
    [InlineData(TransferLaunchState.Launched, "Sent 2 files to Alpha \u00B7 launched game.prg", false)]
    [InlineData(TransferLaunchState.Incompatible, "Sent 2 files to Alpha \u00B7 game.prg can't run on the TeensyROM", true)]
    [InlineData(TransferLaunchState.Failed, "Sent 2 files to Alpha \u00B7 couldn't launch game.prg: no reply", true)]
    public void End_Completed_AppendsTheLaunchOutcome(TransferLaunchState launch, string expected, bool isError)
    {
        var job = Job(TransferJobState.Completed, filesSent: 2, launch: launch, launchedPath: "/games/game.prg", launchError: "no reply");

        var (actualIsError, text) = TransferLines.End(job, "Alpha");

        text.Should().Be(expected);
        actualIsError.Should().Be(isError);
    }

    [Fact]
    public void End_Completed_WhenTheLaunchFailedWithoutAReason_DropsTheReason()
    {
        var job = Job(TransferJobState.Completed, filesSent: 2, launch: TransferLaunchState.Failed, launchedPath: "/games/game.prg");

        TransferLines.End(job, "Alpha").Text.Should().Be("Sent 2 files to Alpha \u00B7 couldn't launch game.prg");
    }

    [Fact]
    public void End_Completed_WithFailuresAndALaunch_AppendsTheLaunchToTheBase()
    {
        var job = Job(TransferJobState.Completed, filesSent: 1, filesFailed: 1, launch: TransferLaunchState.Launched, launchedPath: "/g/a.prg");

        var (isError, text) = TransferLines.End(job, "Alpha");

        text.Should().Be("Sent 1 of 2 files to Alpha \u00B7 1 didn't arrive \u00B7 launched a.prg");
        isError.Should().BeTrue();
    }

    [Theory]
    [InlineData(TransferJobState.Cancelled, 1, null, "Transfer to Alpha cancelled \u00B7 1 file sent")]
    [InlineData(TransferJobState.Cancelled, 3, null, "Transfer to Alpha cancelled \u00B7 3 files sent")]
    [InlineData(TransferJobState.Aborted, 3, "cable pulled", "Transfer to Alpha stopped: cable pulled \u00B7 3 files sent")]
    [InlineData(TransferJobState.Aborted, 0, null, "Transfer to Alpha stopped \u00B7 0 files sent")]
    [InlineData(TransferJobState.Abandoned, 2, null, "Transfer to Alpha stopped: the sender went away \u00B7 2 files sent")]
    public void End_WhenNotCompleted_IsAnError(TransferJobState state, int sent, string? error, string expected)
    {
        var (isError, text) = TransferLines.End(Job(state, filesSent: sent, error: error), "Alpha");

        isError.Should().BeTrue();
        text.Should().Be(expected);
    }
}
