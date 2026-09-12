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
        private readonly ITcpDeviceConnector _tcpDeviceConnector;

        public DeviceConnectionManager(
            ICartFinder finder,
            ITcpDeviceConnector tcpDeviceConnector,
            ILoggingService log)
        {
            _finder = finder;
            _tcpDeviceConnector = tcpDeviceConnector;
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

        public async Task<TeensyRomDevice?> ConnectTcpDevice(string ipAddress, int port, CancellationToken ct)
        {
            var endpoint = await _tcpDeviceConnector.ConnectAsync(ipAddress, port, ct);
            if (endpoint is null)
            {
                return null;
            }

            var device = await _finder.CreateDevice(endpoint, ct);
            if (device is null)
            {
                endpoint.CommunicationPort?.Dispose();
                return null;
            }

            foreach (var duplicate in _availableDevices.Where(d => d.DeviceId == device.DeviceId).ToList())
            {
                duplicate.CommunicationPort.Dispose();
                _availableDevices.Remove(duplicate);
            }

            _availableDevices.Add(device);
            return device;
        }
    }
}
