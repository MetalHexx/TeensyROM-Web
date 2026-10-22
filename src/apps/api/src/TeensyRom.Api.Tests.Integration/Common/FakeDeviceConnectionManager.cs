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
        private readonly HashSet<string> _lostDeviceIds = [];

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

        public Task<List<TeensyRomDevice>> ConnectAtStartAsync(CancellationToken ct)
            => Task.FromResult(_devices);

        /// <summary>The fake reads no record cache, so a start never begins from saved records and the startup orphan cleanup stays off.</summary>
        public bool StartedFromSavedRecords => false;

        public Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false)
            => Task.FromResult(_devices);

        public List<TeensyRomDevice> GetAvailableDevices() => _devices.Where(d => !_lostDeviceIds.Contains(d.DeviceId)).ToList();

        public TeensyRomDevice? GetAvailableDevice(string deviceId)
            => _lostDeviceIds.Contains(deviceId) ? null : _devices.FirstOrDefault(d => d.DeviceId == deviceId);

        public IReadOnlyList<OfflineDevice> GetOfflineDevices() => [];

        public Task<ReconnectOutcome> ReconnectAsync(string deviceId, CancellationToken ct)
        {
            var device = _devices.FirstOrDefault(d => d.DeviceId == deviceId);
            var outcome = device is not null
                ? new ReconnectOutcome(ReconnectResult.AlreadyAvailable, device)
                : new ReconnectOutcome(ReconnectResult.UnknownDevice, null);
            return Task.FromResult(outcome);
        }

        public Task<ForgetResult> ForgetAsync(string deviceId, CancellationToken ct)
        {
            var result = _devices.Any(d => d.DeviceId == deviceId) ? ForgetResult.StillAvailable : ForgetResult.UnknownDevice;
            return Task.FromResult(result);
        }

        public Task<TeensyRomDevice?> FallBackToSerialAsync(string deviceId, CancellationToken ct)
            => Task.FromResult<TeensyRomDevice?>(null);

        public Task<RenameOutcome> RenameAsync(string deviceId, string name, CancellationToken ct)
        {
            if (!DeviceNameRules.TryNormalize(name, out var normalized))
            {
                return Task.FromResult(new RenameOutcome(RenameResult.InvalidName, null, null));
            }

            var device = _devices.FirstOrDefault(d => d.DeviceId == deviceId);

            if (device is null)
            {
                return Task.FromResult(new RenameOutcome(RenameResult.UnknownDevice, null, null));
            }

            device.Cart.Name = normalized;
            return Task.FromResult(new RenameOutcome(RenameResult.Renamed, device, null));
        }

        /// <summary>
        /// Makes <see cref="GetAvailableDevice"/> return null for this device, as if it vanished from the
        /// connection manager mid-transfer - the only way the pump's device-null branch is reachable,
        /// since <c>ExceptionBehavior</c> converts every communication-port exception into an ordinary
        /// failed <c>SaveFileResult</c> before it ever reaches <see cref="TeensyRom.Api.Transfers.TransferPump"/>.
        /// Reversible via <see cref="RestoreDevice"/> since the fixture is shared across a test collection.
        /// </summary>
        public void SimulateDeviceLoss(string deviceId) => _lostDeviceIds.Add(deviceId);

        public void RestoreDevice(string deviceId) => _lostDeviceIds.Remove(deviceId);
    }
}
