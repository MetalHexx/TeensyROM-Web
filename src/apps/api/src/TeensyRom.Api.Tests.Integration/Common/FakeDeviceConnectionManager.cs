using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;

namespace TeensyRom.Api.Tests.Integration.Common
{
    /// <summary>
    /// Bypasses hardware discovery entirely: returns a fixed set of devices, each backed by its own
    /// <see cref="FakeCommunicationPort"/>, so <c>FindDevicesEndpoint</c> and anything built on
    /// <see cref="IDeviceConnectionManager"/> works without a cart attached. Two devices are provisioned
    /// so cross-device concurrency behavior is testable.
    /// </summary>
    public sealed class FakeDeviceConnectionManager : IDeviceConnectionManager
    {
        private readonly List<TeensyRomDevice> _devices;
        private readonly Dictionary<string, FakeCommunicationPort> _portsByDeviceId;

        public FakeDeviceConnectionManager(IStorageFactory storageFactory, int deviceCount = 2)
        {
            _devices = [];
            _portsByDeviceId = [];

            for (var i = 0; i < deviceCount; i++)
            {
                var deviceId = Guid.NewGuid().ToString().GenerateFilenameSafeHash();
                var port = new FakeCommunicationPort();

                var sdStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = deviceId };
                var usbStorage = new CartStorage(TeensyStorageType.USB, available: true) { DeviceId = deviceId };

                var cart = new Cart
                {
                    DeviceId = deviceId,
                    Name = $"Fake TeensyROM {i + 1}",
                    FwVersion = "Fake FW",
                    IsCompatible = true,
                    SdStorage = sdStorage,
                    UsbStorage = usbStorage
                };

                var device = new TeensyRomDevice(
                    cart,
                    port,
                    storageFactory.Create(sdStorage, port),
                    storageFactory.Create(usbStorage, port));

                _devices.Add(device);
                _portsByDeviceId[deviceId] = port;
            }
        }

        public IReadOnlyList<TeensyRomDevice> Devices => _devices;

        public FakeCommunicationPort PortFor(string deviceId) => _portsByDeviceId[deviceId];

        public Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
            => Task.FromResult(_devices);

        public List<TeensyRomDevice> GetAvailableDevices() => _devices;

        public TeensyRomDevice? GetAvailableDevice(string deviceId) => _devices.FirstOrDefault(d => d.DeviceId == deviceId);
    }
}
