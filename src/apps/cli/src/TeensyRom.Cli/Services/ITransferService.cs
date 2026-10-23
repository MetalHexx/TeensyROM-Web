using TeensyRom.Cli.Api.Generated;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Services;

/// <summary>
/// tr-web's transfer jobs on the selected TeensyROM: one job holds the device's lease while files stream through it.
/// </summary>
/// <remarks>Every failure arrives as a <see cref="Api.TeensyApiException"/> carrying tr-web's own wording.</remarks>
internal interface ITransferService
{
    /// <summary>Starts a job on the selected device, whose files land in <paramref name="deviceFolder"/>.</summary>
    /// <param name="expectedArchiveCount">How many of the files that will be uploaded are archives for tr-web to expand.</param>
    /// <exception cref="Errors.CliException"><see cref="Errors.CliExitCode.Failed"/> when the device is already transferring.</exception>
    Task<TransferJobDto> CreateAsync(TeensyStorageType storage, string deviceFolder, int expectedArchiveCount, CancellationToken ct);

    /// <summary>Opens <paramref name="localFile"/> for async read and streams it into the job at <paramref name="relativePath"/>.</summary>
    /// <param name="relativePath">Relative to the job's folder and '/'-separated; never holds <c>..</c> or a root.</param>
    /// <exception cref="ArgumentException"><paramref name="relativePath"/> is empty, rooted or holds a <c>.</c> or <c>..</c> segment.</exception>
    /// <exception cref="IOException"><paramref name="localFile"/> couldn't be opened or read.</exception>
    Task UploadAsync(string jobId, string relativePath, string localFile, CancellationToken ct);

    /// <summary>Tells tr-web no more files are coming, so the job can finish once everything is sent.</summary>
    Task SealAsync(string jobId, CancellationToken ct);

    Task<TransferJobDto> GetAsync(string jobId, CancellationToken ct);

    /// <summary>Cancels the job and releases the device. Idempotent: a finished or forgotten job is left as it is.</summary>
    Task CancelAsync(string jobId);
}
