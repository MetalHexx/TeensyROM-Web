using Microsoft.Extensions.Hosting;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Drains <see cref="IArchiveExpansionQueue"/> one request at a time, calling
    /// <see cref="ArchiveExpansionService.ExpandAsync"/> for each. Its own background pump - separate from
    /// <see cref="TransferPump"/> - so the upload request that enqueued an archive returns immediately, and
    /// expansion (disk-bound, potentially slow) never runs inside the device-write loop. Catches and logs
    /// per request so one bad archive cannot kill the pump.
    /// </summary>
    public sealed class ArchiveExpansionPump(
        IArchiveExpansionQueue queue,
        ArchiveExpansionService service,
        ILoggingService log) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await foreach (var request in queue.ReadAllAsync(stoppingToken))
                {
                    try
                    {
                        await service.ExpandAsync(request, stoppingToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        log.InternalError($"ArchiveExpansionPump: unhandled error expanding archive for job '{request.JobId}': {ex.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
        }
    }
}
