using System.Reactive.Linq;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Device
{
    public record DeviceStateSubscription(string DeviceId, IDisposable EventSubscription);

    public class DeviceConnectionManager : IDeviceConnectionManager
    {
        private List<TeensyRomDevice> _availableDevices = [];
       
        private readonly ICartFinder _finder;

        public DeviceConnectionManager(
            ICartFinder finder,
            ILoggingService log)
        {
            _finder = finder;
        }

        public List<TeensyRomDevice> GetAvailableDevices() => _availableDevices;
        public TeensyRomDevice? GetAvailableDevice(string deviceId) => GetAvailableDevices().FirstOrDefault(d => d.DeviceId == deviceId);       

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
        {
            _availableDevices.ForEach(d => d.CommunicationPort.Dispose());
            _availableDevices.Clear();
            _availableDevices = await _finder.FindDevices(ct, fullScan);
            return _availableDevices;
        }
    }
}
