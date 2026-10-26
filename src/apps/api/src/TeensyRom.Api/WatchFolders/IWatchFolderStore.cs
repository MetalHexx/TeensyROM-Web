using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// The only writer of watch folders. Every change goes through <see cref="ISettingsService.UpdateSettings"/>,
    /// so concurrent writers never save over each other.
    /// </summary>
    public interface IWatchFolderStore
    {
        IReadOnlyList<WatchFolder> GetAll();

        /// <summary>The folder with this id, or null.</summary>
        WatchFolder? Get(string watchFolderId);

        /// <summary>
        /// Adds a destination to the folder at <see cref="WatchFolderAdd.FolderPath"/>, creating the folder when it is not watched yet.
        /// </summary>
        WatchFolderAddResult Add(WatchFolderAdd request);

        /// <summary>Removes a folder and all its destinations. False when there is no such folder.</summary>
        bool RemoveFolder(string watchFolderId);

        /// <summary>
        /// Removes every destination of the device on the folder; removing the last one removes the folder.
        /// </summary>
        WatchFolderRemoveDeviceResult RemoveDevice(string watchFolderId, string deviceId);

        /// <summary>The updated folder, or null when there is no such folder.</summary>
        WatchFolder? SetEnabled(string watchFolderId, bool enabled);

        /// <summary>
        /// Emits the list after any change, including one made by a whole-settings save, and the current list on subscribe.
        /// </summary>
        IObservable<IReadOnlyList<WatchFolder>> Changed { get; }
    }

    /// <param name="DevicePath">Directory on the device storage; null means <c>/auto-transfer</c>.</param>
    public sealed record WatchFolderAdd(string FolderPath, string DeviceId, TeensyStorageType StorageType, string? DevicePath, bool Launch);

    public enum WatchFolderAddError
    {
        FolderNotFound,
        Nested,
        InvalidDevicePath,
        DeviceNotFound,
        StandInDevice,
        StorageUnavailable,
        DeviceAlreadyOnFolder
    }

    /// <param name="Folder">The folder after the add; null on failure.</param>
    /// <param name="Created">True when a new folder was created, false when a destination joined an existing one.</param>
    public sealed record WatchFolderAddResult(WatchFolder? Folder, bool Created, WatchFolderAddError? Error, string? Message);

    /// <param name="Found">False when the folder does not exist or has no destination for the device.</param>
    /// <param name="FolderRemoved">True when that was the folder's last destination and the folder was removed too.</param>
    /// <param name="Folder">The folder as it remains; null when it was removed or not found.</param>
    public sealed record WatchFolderRemoveDeviceResult(bool Found, bool FolderRemoved, WatchFolder? Folder);
}
