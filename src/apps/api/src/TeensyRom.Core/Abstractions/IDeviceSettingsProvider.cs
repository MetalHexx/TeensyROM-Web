using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
    /// <summary>
    /// Provides access to per-device settings.
    /// Enables components to access device-specific configuration (video, connection) 
    /// without coupling to the full settings service.
    /// </summary>
    public interface IDeviceSettingsProvider
    {
        /// <summary>
        /// Observable stream of all known device settings.
        /// Emits when any device's settings change or devices are added/removed.
        /// </summary>
        IObservable<List<DeviceSettings>> KnownDevices { get; }

        /// <summary>
        /// Gets settings for a specific device by ID.
        /// </summary>
        /// <param name="deviceId">The unique device identifier (hash from cart-tag.txt).</param>
        /// <returns>The device settings if found; null otherwise.</returns>
        DeviceSettings? GetDeviceSettings(string deviceId);

        /// <summary>
        /// Gets settings for a device, creating a new entry with defaults if not found.
        /// New devices are created with: EnableVideo=false, AutoConnectEnabled=true.
        /// </summary>
        /// <param name="deviceId">The unique device identifier (hash from cart-tag.txt).</param>
        /// <returns>The existing or newly created device settings.</returns>
        DeviceSettings GetOrCreateDeviceSettings(string deviceId);

        /// <summary>
        /// Updates and persists settings for a specific device.
        /// </summary>
        /// <param name="deviceSettings">The device settings to save.</param>
        void SaveDeviceSettings(DeviceSettings deviceSettings);
    }
}
