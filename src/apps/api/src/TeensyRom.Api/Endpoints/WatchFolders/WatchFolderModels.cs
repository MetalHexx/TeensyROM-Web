using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.WatchFolders
{
    /// <summary>
    /// A watch folder: a folder on the engine's machine whose new files are sent to its destinations.
    /// </summary>
    public class WatchFolderDto
    {
        /// <summary>The watch folder's id.</summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>The absolute path of the folder on the engine's machine.</summary>
        [Required] public string Path { get; set; } = string.Empty;

        /// <summary>Whether the folder is turned on.</summary>
        [Required] public bool Enabled { get; set; }

        /// <summary>What the folder is doing right now.</summary>
        [Required] public WatchFolderState State { get; set; }

        /// <summary>The device storages the folder's files are sent to.</summary>
        [Required] public List<WatchFolderDestinationDto> Destinations { get; set; } = [];

        public static WatchFolderDto From(WatchFolder folder, IWatchFolderStatus status, IDeviceConnectionManager devices) => new()
        {
            Id = folder.Id,
            Path = folder.Path,
            Enabled = folder.Enabled,
            State = status.GetState(folder),
            Destinations = folder.Destinations.Select(d => WatchFolderDestinationDto.From(d, devices)).ToList()
        };
    }

    /// <summary>
    /// Where a watch folder's files go: a directory on one storage of one device.
    /// </summary>
    public class WatchFolderDestinationDto
    {
        /// <summary>The destination's id.</summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>The chip id of the receiving device.</summary>
        [Required] public string DeviceId { get; set; } = string.Empty;

        /// <summary>The device's name, or null when the engine does not know the device.</summary>
        public string? DeviceName { get; set; }

        /// <summary>The storage that receives the files.</summary>
        [Required] public TeensyStorageType StorageType { get; set; }

        /// <summary>The directory on the device storage that receives the files.</summary>
        [Required] public string Path { get; set; } = string.Empty;

        /// <summary>Whether a file is launched after each completed transfer.</summary>
        [Required] public bool Launch { get; set; }

        public static WatchFolderDestinationDto From(WatchFolderDestination destination, IDeviceConnectionManager devices) => new()
        {
            Id = destination.Id,
            DeviceId = destination.DeviceId,
            DeviceName = devices.GetAvailableDevice(destination.DeviceId)?.Cart.Name
                ?? devices.GetOfflineDevices().FirstOrDefault(d => d.ChipId == destination.DeviceId)?.Name,
            StorageType = destination.StorageType,
            Path = destination.Path,
            Launch = destination.Launch
        };
    }
}
