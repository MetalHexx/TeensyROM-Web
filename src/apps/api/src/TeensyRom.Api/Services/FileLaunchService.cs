using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Services
{
    /// <summary>
    /// A singleton, so the mediator is resolved from a fresh scope per call - and only once the device,
    /// storage, lookup and launchable checks have passed.
    /// </summary>
    public sealed class FileLaunchService(IDeviceConnectionManager deviceManager, IDeviceTransferLease lease, IServiceScopeFactory scopeFactory) : IFileLaunchService
    {
        public async Task<FileLaunchOutcome> LaunchAsync(string deviceId, TeensyStorageType storageType, FilePath path, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(deviceId);

            if (device is null)
            {
                return Failure(FileLaunchStatus.DeviceNotFound, $"The device {deviceId} was not found.");
            }

            var storage = device.GetStorage(storageType);

            if (storage is null)
            {
                var message = storageType is TeensyStorageType.USB
                    ? $"The device {deviceId} does not have USB storage."
                    : $"The device {deviceId} does not have an SD card.";
                return Failure(FileLaunchStatus.StorageUnavailable, message);
            }

            var lookup = await storage.LookupFile(path);

            if (lookup.Failure is not null)
            {
                // A cache-miss directory read refused by the lockout surfaces here as a plain lookup failure.
                if (lease.GetActiveJobId(deviceId) is { } holder)
                {
                    return Busy(device.Cart.Name, holder, lookup.Failure);
                }

                return Failure(FileLaunchStatus.LookupFailed, lookup.Failure);
            }

            if (lookup.File is null)
            {
                return Failure(FileLaunchStatus.FileNotFound, $"The file {path.Value} was not found.");
            }

            if (lookup.File is not LaunchableItem launchItem)
            {
                return Failure(FileLaunchStatus.NotLaunchable, $"The file {path.Value} is not launchable.");
            }

            using var scope = scopeFactory.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

            var result = await mediator.Send(new LaunchFileCommand
            {
                StorageType = storageType,
                LaunchItem = launchItem,
                DeviceId = deviceId,
                CommunicationPort = device.CommunicationPort
            }, ct);

            if (result.ActiveTransferJobId is { } activeJobId)
            {
                return Busy(device.Cart.Name, activeJobId, result.Error);
            }

            if (result.IsSuccess || !result.IsCompatible)
            {
                return result.IsCompatible
                    ? new FileLaunchOutcome(FileLaunchStatus.Launched, launchItem, "Success!")
                    : new FileLaunchOutcome(FileLaunchStatus.Incompatible, launchItem, "File launched but is not compatible with TeensyROM hardware.");
            }

            return Failure(FileLaunchStatus.LaunchFailed, result.Error);
        }

        private static FileLaunchOutcome Busy(string deviceName, string activeJobId, string message) =>
            new(FileLaunchStatus.DeviceBusy, null, message, activeJobId, deviceName);

        private static FileLaunchOutcome Failure(FileLaunchStatus status, string message) => new(status, null, message);
    }
}
