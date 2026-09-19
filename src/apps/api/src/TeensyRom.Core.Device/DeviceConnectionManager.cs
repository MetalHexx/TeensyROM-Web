using System.Diagnostics;
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
        private readonly ILoggingService _log;

        public DeviceConnectionManager(
            ICartFinder finder,
            ILoggingService log)
        {
            _finder = finder;
            _log = log;
        }

        public List<TeensyRomDevice> GetAvailableDevices() => _availableDevices;
        public TeensyRomDevice? GetAvailableDevice(string deviceId) => GetAvailableDevices().FirstOrDefault(d => d.DeviceId == deviceId);       

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
        {
            var stopwatch = Stopwatch.StartNew();
            _availableDevices.ForEach(d => d.CommunicationPort.Dispose());
            _availableDevices.Clear();
            _availableDevices = await _finder.FindDevices(ct, fullScan);
            stopwatch.Stop();
            _log.InternalSuccess($"DeviceConnectionManager.FindDevices: {_availableDevices.Count} device(s) ready in {stopwatch.ElapsedMilliseconds} ms");
            return _availableDevices;
        }
    }
}
