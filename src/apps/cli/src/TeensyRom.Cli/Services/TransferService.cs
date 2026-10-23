using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Services;

internal sealed class TransferService(ITeensyRomApiClient api, IDeviceService devices) : ITransferService
{
    private const int FileBufferSize = 81_920;

    // Cancelling is what frees the device, so it is tried even after Ctrl+C, but it must not hang if tr-web has gone.
    private static readonly TimeSpan CancelTimeout = TimeSpan.FromSeconds(15);

    public async Task<TransferJobDto> CreateAsync(TeensyStorageType storage, string deviceFolder, int expectedArchiveCount, CancellationToken ct)
    {
        var deviceId = devices.RequireDeviceId();
        var body = new CreateJobBody { DestinationDirectory = deviceFolder, ExpectedArchiveCount = expectedArchiveCount };

        try
        {
            var created = await ApiErrors.Call(() => api.CreateTransferJobAsync(deviceId, storage.ToApi(), body, ct));

            return created.Job;
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 409)
        {
            var device = devices.SelectedDevice?.Name ?? deviceId;

            throw new CliException(CliExitCode.Failed, $"{device} is busy with another transfer — try again when it finishes.");
        }
    }

    public async Task UploadAsync(string jobId, string relativePath, string localFile, CancellationToken ct)
    {
        RequireSafe(relativePath);

        await using var stream = new FileStream(localFile, FileMode.Open, FileAccess.Read, FileShare.Read, FileBufferSize, FileOptions.Asynchronous | FileOptions.SequentialScan);

        await ApiErrors.Call(() => api.UploadTransferFileContentAsync(jobId, relativePath, stream, stream.Length, ct));
    }

    public async Task SealAsync(string jobId, CancellationToken ct) =>
        await ApiErrors.Call(() => api.SealTransferJobAsync(jobId, ct));

    public async Task<TransferJobDto> GetAsync(string jobId, CancellationToken ct) =>
        (await ApiErrors.Call(() => api.GetTransferJobAsync(jobId, ct))).Job;

    public async Task DownloadAsync(TeensyStorageType storage, string devicePath, Stream destination, CancellationToken ct)
    {
        var deviceId = devices.RequireDeviceId();

        using var response = await ApiErrors.Call(() => api.GetFileContentAsync(deviceId, storage.ToApi(), devicePath, ct));

        await ApiErrors.Call(() => response.Stream.CopyToAsync(destination, FileBufferSize, ct));
    }

    public async Task CancelAsync(string jobId)
    {
        using var timeout = new CancellationTokenSource(CancelTimeout);

        try
        {
            await ApiErrors.Call(() => api.CancelTransferJobAsync(jobId, timeout.Token));
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 404)
        {
            // tr-web no longer knows the job, so it holds nothing.
        }
    }

    private static void RequireSafe(string relativePath)
    {
        // tr-web reads a backslash as a separator too, so it counts as one here.
        var segments = relativePath.Replace('\\', '/').Split('/');

        if (segments.Any(segment => segment is "" or "." or ".."))
        {
            throw new ArgumentException($"'{relativePath}' isn't a path inside the destination folder.", nameof(relativePath));
        }
    }
}
