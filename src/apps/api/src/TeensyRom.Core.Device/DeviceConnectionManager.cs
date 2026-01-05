using System.Reactive.Linq;
using System.Reflection.Metadata.Ecma335;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device
{
    public record DeviceStateSubscription(string DeviceId, IDisposable EventSubscription);

    public class DeviceConnectionManager : IDeviceConnectionManager
    {
        private List<TeensyRomDevice> _availableDevices = [];
       
        private readonly ICartFinder _finder;
        private readonly IReconnectionStrategy _serialReconnection;
        private readonly IReconnectionStrategy _tcpReconnection;

        public DeviceConnectionManager(
            ICartFinder finder,
            ILoggingService log,
            IEnumerable<IReconnectionStrategy> reconnectionStrategies)
        {
            _finder = finder;
            _serialReconnection = reconnectionStrategies.OfType<SerialReconnectionStrategy>().Single();
            _tcpReconnection = reconnectionStrategies.OfType<TcpReconnectionStrategy>().Single();
        }

        public List<TeensyRomDevice> GetAvailableDevices() => _availableDevices;
        public TeensyRomDevice? GetAvailableDevice(string deviceId) => GetAvailableDevices().FirstOrDefault(d => d.DeviceId == deviceId);       

        public async Task<bool> ReconnectDevice(string deviceId)
        {
            var device = GetAvailableDevice(deviceId);

            if (device is null)
            {
                throw new TeensyException($"Device with ID {deviceId} not found in connected devices.");
            }

            var strategy = device.Cart.ConnectionType switch
            {
                ConnectionType.Serial => _serialReconnection,
                ConnectionType.Tcp => _tcpReconnection,
                _ => throw new ArgumentException($"Unknown connection type: {device.Cart.ConnectionType}")
            };

            return await strategy.TryReconnect(device, CancellationToken.None);
        }

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
        {
            _availableDevices.ForEach(d => d.CommunicationPort.Dispose());
            _availableDevices.Clear();
            _availableDevices = await _finder.FindDevices(ct, fullScan);
            return _availableDevices;
        }
    }
}
