using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Abstractions
{
    public record DeviceStateChange(string DeviceId);
    public interface IDeviceConnectionManager
    {   
        Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false);
        List<TeensyRomDevice> GetAvailableDevices();
        TeensyRomDevice? GetAvailableDevice(string deviceId);
    }
}
