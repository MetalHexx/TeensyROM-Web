namespace TeensyRom.Cli.Services;

/// <summary>
/// The TeensyROM units tr-web knows, and the one this CLI session works with.
/// </summary>
internal interface IDeviceService
{
    DeviceSummary? SelectedDevice { get; }

    /// <summary>Lists the devices tr-web already knows, online first, without scanning for new ones.</summary>
    /// <exception cref="TeensyApiException">tr-web could not list its devices.</exception>
    Task<IReadOnlyList<DeviceSummary>> GetDevicesAsync(CancellationToken ct = default);

    /// <summary>
    /// Lists the devices tr-web knows; with <paramref name="fullScan"/> it first scans for ones it doesn't know yet.
    /// <c>GetDevicesAsync</c> is <c>FindAsync(fullScan: false)</c>. tr-web answers one lookup per 5 seconds.
    /// </summary>
    /// <exception cref="TeensyApiException">tr-web could not list its devices.</exception>
    Task<IReadOnlyList<DeviceSummary>> FindAsync(bool fullScan, CancellationToken ct = default);

    void Select(DeviceSummary device);

    /// <summary>The selected device's id.</summary>
    /// <exception cref="TeensyApiException">No device has been selected.</exception>
    string RequireDeviceId();

    /// <summary>Pauses or resumes the music playing on the selected device.</summary>
    /// <exception cref="TeensyApiException">No device is selected, or tr-web couldn't toggle the music.</exception>
    Task ToggleMusicAsync();

    /// <summary>Resets the selected device, which stops whatever it is running.</summary>
    /// <exception cref="TeensyApiException">No device is selected, or tr-web couldn't reset it.</exception>
    Task ResetAsync();

    /// <summary>Reconnects the device, whether or not it is online now, and returns it as it is afterwards.</summary>
    /// <exception cref="TeensyApiException">tr-web doesn't know the device or couldn't reconnect it.</exception>
    Task<DeviceSummary> ReconnectDeviceAsync(string deviceId, CancellationToken ct = default);

    /// <summary>Renames the device and returns it under its new name.</summary>
    /// <exception cref="TeensyApiException">tr-web doesn't know the device or refused the name.</exception>
    Task<DeviceSummary> RenameDeviceAsync(string deviceId, string name, CancellationToken ct = default);

    /// <summary>Makes tr-web forget the device, whether or not it is online now, and returns tr-web's message.</summary>
    /// <exception cref="TeensyApiException">tr-web doesn't know the device or couldn't forget it.</exception>
    Task<string> ForgetDeviceAsync(string deviceId, CancellationToken ct = default);

    /// <summary>Pings the device and returns tr-web's message.</summary>
    /// <exception cref="TeensyApiException">tr-web doesn't know the device or the device didn't answer.</exception>
    Task<string> PingDeviceAsync(string deviceId, CancellationToken ct = default);

    /// <summary>Resets the device, which stops whatever it is running, and returns tr-web's message.</summary>
    /// <exception cref="TeensyApiException">tr-web doesn't know the device or couldn't reset it.</exception>
    Task<string> ResetDeviceAsync(string deviceId, CancellationToken ct = default);
}

internal sealed record DeviceSummary(string Id, string Name, bool IsOnline, string Connection, string State, bool SdAvailable = false, bool UsbAvailable = false);
