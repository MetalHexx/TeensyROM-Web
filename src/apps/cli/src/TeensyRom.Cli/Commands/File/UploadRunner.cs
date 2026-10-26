using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Commands.File;

/// <summary>A file tr-web refused when it was uploaded, or that never got the chance.</summary>
internal sealed record UploadRejection(UploadFile File, string Message);

/// <summary>How far a job is: what the live progress line shows.</summary>
/// <param name="Total">The job's file count once tr-web knows it, until then the number of local files.</param>
/// <param name="Failed">The job's failures plus the files tr-web rejected on upload.</param>
internal sealed record UploadProgress(int Sent, int Total, int Failed, string? CurrentFile);

/// <summary>How a job ended: its last snapshot, and the files rejected on upload (which the job never saw).</summary>
internal sealed record UploadRunResult(TransferJobDto Job, IReadOnlyList<UploadRejection> Rejected);

/// <summary>
/// Streams files through one transfer job: creates it, polls it from the moment it exists, uploads, seals, and waits for
/// it to end, including the launch it was asked to make. Whatever happens, the job is cancelled unless it ended on its own, so the device is never left leased.
/// </summary>
internal sealed class UploadRunner(ITransferService transfers, ILastLaunchStore lastLaunches)
{
    /// <summary>How long the job waits between looks at it; also how often the live progress line updates.</summary>
    internal TimeSpan PollInterval { get; init; } = TimeSpan.FromMilliseconds(500);

    /// <summary>
    /// Uploads <paramref name="files"/> in order and returns once the job has ended and tr-web is done launching. A file tr-web refuses (a 400) or that
    /// can't be read is that file's rejection and the rest carry on; anything else ends the run.
    /// </summary>
    /// <param name="launch">Asks tr-web to launch the one file once it lands; the result's job says how that went.</param>
    /// <param name="progress">Told about the job at least every poll; runs on the poll's thread.</param>
    /// <exception cref="CliException"><see cref="CliExitCode.Failed"/> when <paramref name="ct"/> is cancelled; the job is cancelled first.</exception>
    public async Task<UploadRunResult> RunAsync(
        TeensyStorageType storage,
        string deviceFolder,
        IReadOnlyList<UploadFile> files,
        bool launch,
        Action<UploadProgress>? progress,
        CancellationToken ct)
    {
        var rejected = new List<UploadRejection>();
        var rejectedCount = 0;
        TransferJobDto? created = null;
        TransferJobDto? latest = null;
        Task<TransferJobDto>? poll = null;
        using var stopPoll = CancellationTokenSource.CreateLinkedTokenSource(ct);

        try
        {
            created = await transfers.CreateAsync(storage, deviceFolder, files.Count(file => file.IsArchive), launch, ct);
            latest = created;
            poll = PollAsync(created.JobId, stopPoll.Token);

            foreach (var file in files)
            {
                // The job ended while files were still waiting: tr-web would refuse every one of them.
                if (poll.IsCompleted)
                {
                    rejected.Add(new UploadRejection(file, "The transfer ended before this file was sent."));
                    Interlocked.Increment(ref rejectedCount);
                    continue;
                }
                try
                {
                    await transfers.UploadAsync(created.JobId, file.RelativePath, file.LocalPath, ct);
                }
                catch (Exception error) when (!ct.IsCancellationRequested && error is TeensyApiException { StatusCode: 400 } or IOException or UnauthorizedAccessException)
                {
                    rejected.Add(new UploadRejection(file, error.Message));
                    Interlocked.Increment(ref rejectedCount);
                }
            }
            if (!poll.IsCompleted) await transfers.SealAsync(created.JobId, ct);

            return new UploadRunResult(await poll, rejected);
        }
        catch (Exception) when (ct.IsCancellationRequested)
        {
            // Cancelling surfaces as an OperationCanceledException or, through ApiErrors.Call, a TeensyApiException with no status: never a file's failure.
        }
        finally
        {
            await stopPoll.CancelAsync();
            if (poll is not null) await Task.WhenAny(poll);

            if (created is not null) await ReleaseAsync(created.JobId, Volatile.Read(ref latest)!);
        }
        throw new CliException(CliExitCode.Failed, "Cancelled; the TeensyROM was released and nothing more was sent.");

        async Task<TransferJobDto> PollAsync(string jobId, CancellationToken token)
        {
            while (true)
            {
                var job = await transfers.GetAsync(jobId, token);

                Volatile.Write(ref latest, job);
                progress?.Invoke(new UploadProgress(job.FilesSent, job.TotalFiles ?? files.Count, job.FilesFailed + Volatile.Read(ref rejectedCount), job.CurrentFile));

                if (IsFinished(job.State) && job.LaunchState != TransferLaunchState.Pending) return job;

                await Task.Delay(PollInterval, token);
            }
        }
    }

    /// <summary>
    /// Cancels a job that didn't end on its own, best effort: this runs while another failure may be on its way out. The
    /// engine resets the device when the job's first file is admitted, which is after that file has finished staging and
    /// before any send succeeds or fails. So once the last snapshot shows a file sent, failed or received (staged), the
    /// last-launch record must stop saying the device is playing; a first file cancelled mid-send leaves only "received".
    /// The snapshot's current file is not checked: the engine clears it again once a send finishes, so it is null while a file is on the wire.
    /// </summary>
    private async Task ReleaseAsync(string jobId, TransferJobDto last)
    {
        if (!IsFinished(last.State))
        {
            try
            {
                await transfers.CancelAsync(jobId);
            }
            catch (TeensyApiException)
            {
                // The engine's sweeper abandons a job nobody is talking to; there is nothing more to do from here.
            }
        }
        if (last.FilesSent + last.FilesFailed > 0 || last.FilesReceived > 0) lastLaunches.MarkStopped(last.DeviceId);
    }

    private static bool IsFinished(TransferJobState state) =>
        state is TransferJobState.Completed or TransferJobState.Cancelled or TransferJobState.Abandoned or TransferJobState.Aborted;
}
