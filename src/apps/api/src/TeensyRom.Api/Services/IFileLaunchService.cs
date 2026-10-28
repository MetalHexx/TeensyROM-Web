using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Services
{
    public enum FileLaunchStatus
    {
        Launched,
        Incompatible,
        DeviceNotFound,
        StorageUnavailable,
        FileNotFound,
        NotLaunchable,
        LookupFailed,
        LaunchFailed,
        DeviceBusy
    }

    /// <summary>
    /// <see cref="Item"/> is set for <see cref="FileLaunchStatus.Launched"/> and <see cref="FileLaunchStatus.Incompatible"/>;
    /// <see cref="Message"/> describes the outcome in every case. <see cref="ActiveJobId"/> and
    /// <see cref="DeviceName"/> are set for <see cref="FileLaunchStatus.DeviceBusy"/>: the device is held by that transfer.
    /// </summary>
    public sealed record FileLaunchOutcome(FileLaunchStatus Status, LaunchableItem? Item, string Message, string? ActiveJobId = null, string? DeviceName = null);

    /// <summary>
    /// Looks up a file already on a device's storage and launches it - shared by the launch endpoint and
    /// the transfer engine's launch-after-transfer.
    /// </summary>
    public interface IFileLaunchService
    {
        Task<FileLaunchOutcome> LaunchAsync(string deviceId, TeensyStorageType storageType, FilePath path, CancellationToken ct);
    }
}
