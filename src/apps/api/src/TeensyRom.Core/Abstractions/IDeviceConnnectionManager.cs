using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Abstractions
{
    public record DeviceStateChange(string DeviceId);
    public interface IDeviceConnectionManager
    {   
        Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false);
        Task<TeensyRomDevice?> ConnectTcpDevice(string ipAddress, int port, CancellationToken ct);
        List<TeensyRomDevice> GetAvailableDevices();
        TeensyRomDevice? GetAvailableDevice(string deviceId);
    }
}
