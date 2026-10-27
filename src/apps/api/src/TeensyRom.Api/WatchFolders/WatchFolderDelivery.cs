using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Sends one arrival set to each destination its watch folder has right now, one transfer job per destination.
    /// Reads watched files only: they are copied to staging through <see cref="ITransferJobService.AddFileAsync"/>, and
    /// never handed to anything that deletes its input.
    /// </summary>
    public sealed class WatchFolderDelivery(
        ITransferJobService jobs,
        IWatchFolderStore store,
        IWatchedFileSystem fileSystem,
        IDeviceConnectionManager devices,
        ILoggingService log)
    {
        /// <summary>
        /// Destinations run concurrently and independently: one that cannot start is logged and skipped, and never
        /// holds up or fails another. Nothing is retried or kept for later.
        /// </summary>
        public async Task DeliverAsync(WatchFolder folder, ArrivalSet set, CancellationToken ct)
        {
            var current = store.Get(folder.Id);
            if (current is not { Enabled: true } || set.Files.Count == 0) return;

            var files = set.Files.OrderByDescending(f => f.IsArchive).ToList();
            var archiveCount = files.Count(f => f.IsArchive);

            await Task.WhenAll(current.Destinations.Select(destination =>
                DeliverToAsync(current, destination, files, archiveCount, ct)));
        }

        private async Task DeliverToAsync(
            WatchFolder folder, WatchFolderDestination destination, List<ArrivedFile> files, int archiveCount, CancellationToken ct)
        {
            try
            {
                var started = jobs.Start(new TransferJobStart(
                    destination.DeviceId,
                    destination.StorageType,
                    destination.Path,
                    archiveCount,
                    TransferOrigin.FromWatchFolder(folder.Id, folder.Path),
                    destination.Launch));

                if (!started.Started)
                {
                    LogSkip(folder, destination, files, started.Error);
                    return;
                }

                var job = started.Job!;

                try
                {
                    foreach (var file in files)
                    {
                        await AddFileAsync(job, folder, destination, file, ct);
                    }
                }
                finally
                {
                    var sealResult = jobs.Seal(job);
                    if (!sealResult.Sealed)
                    {
                        log.InternalWarning($"Watch folder {folder.Path}: could not seal its transfer to {DeviceLabel(destination.DeviceId)}: {sealResult.Error}", destination.DeviceId);
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                log.InternalError($"Watch folder {folder.Path}: delivery to {DeviceLabel(destination.DeviceId)} failed: {ex.Message}", destination.DeviceId);
            }
        }

        private async Task AddFileAsync(
            TransferJob job, WatchFolder folder, WatchFolderDestination destination, ArrivedFile file, CancellationToken ct)
        {
            try
            {
                await using var stream = fileSystem.OpenRead(file.FullPath);
                var result = await jobs.AddFileAsync(job, stream, file.RelativePath, file.SizeBytes, ct);

                if (!result.Accepted)
                {
                    log.InternalWarning($"Watch folder {folder.Path}: {file.RelativePath} was not sent to {DeviceLabel(destination.DeviceId)}: {result.Error}", destination.DeviceId);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.InternalWarning($"Watch folder {folder.Path}: {file.RelativePath} could not be sent to {DeviceLabel(destination.DeviceId)}: {ex.Message}", destination.DeviceId);
            }
        }

        private void LogSkip(WatchFolder folder, WatchFolderDestination destination, List<ArrivedFile> files, TransferStartError? error)
        {
            var reason = error switch
            {
                TransferStartError.DeviceNotFound => "not connected",
                TransferStartError.StorageUnavailable => "storage missing",
                TransferStartError.DeviceBusy => "already transferring",
                TransferStartError.InvalidDestination => "invalid destination path",
                _ => "could not start"
            };

            var what = files.Count == 1 ? Path.GetFileName(files[0].RelativePath) : $"{files.Count} files";

            log.InternalWarning(
                $"Watch folder skipped {what} from {folder.Path} for {DeviceLabel(destination.DeviceId)} ({destination.StorageType} {destination.Path}): {reason}.",
                destination.DeviceId);
        }

        private string DeviceLabel(string deviceId) =>
            devices.GetAvailableDevice(deviceId)?.Cart.Name
            ?? devices.GetOfflineDevices().FirstOrDefault(d => d.ChipId == deviceId)?.Name
            ?? deviceId;
    }
}
