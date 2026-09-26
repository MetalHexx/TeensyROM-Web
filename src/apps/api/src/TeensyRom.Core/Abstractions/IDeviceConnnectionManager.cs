using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Abstractions
{
    public record DeviceStateChange(string DeviceId);

    /// <summary>
    /// Owns the three discovery occasions and the devices they confirm. An unreachable device's record
    /// is the manager's private knowledge - kept internally so the next occasion can find it again - and
    /// is never surfaced through <see cref="GetAvailableDevices"/> or <see cref="GetAvailableDevice"/>.
    /// </summary>
    public interface IDeviceConnectionManager
    {
        /// <summary>API start (R2): confirm cached endpoints by chip id; any miss or no cache -&gt; full discovery; cache replaced whole.</summary>
        Task<List<TeensyRomDevice>> ConnectAtStartAsync(CancellationToken ct);

        /// <summary>fullScan = true -&gt; full discovery with resets (Discover Devices). fullScan = false -&gt; the listed records, no device contact (page load / refresh).</summary>
        Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false);

        /// <summary>Listed = record reachable (FullIdle | FullBusy | Minimal). Unchanged semantics.</summary>
        List<TeensyRomDevice> GetAvailableDevices();

        /// <summary>A listed device, else null - unchanged semantics; an unreachable record is not returned.</summary>
        TeensyRomDevice? GetAvailableDevice(string deviceId);
    }
}
