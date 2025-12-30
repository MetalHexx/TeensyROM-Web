using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Commands.FwVersionCheck;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device
{
    public interface ICartFinder
    {
        Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct);
    }

    public class CartFinder(
        ILoggingService log,
        IDeviceTransportFactory transportFactory,
        IStorageFactory storageFactory,
        ICartTagger tagger,
        IFwVersionChecker versionChecker,
        IMediator mediator,
        IEnumerable<IDiscoveryStrategy> discoveryStrategies) : ICartFinder
    {
        private const string _undefinedDeviceIdBase = "Unidentified";
        private readonly IEnumerable<IDiscoveryStrategy> _discoveryStrategies = discoveryStrategies;

        public async Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct)
        {
            string methodName = "CartFinder.FindDevices:";
            List<TeensyRomDevice> foundDevices = [];

            try
            {
                log.Internal($"{methodName} Starting device discovery using {_discoveryStrategies.Count()} strategy(ies)");

                // Discover all endpoints from all strategies in parallel
                var endpoints = await DiscoverAllEndpoints(ct);

                if (endpoints.Count == 0)
                {
                    log.Internal($"{methodName} No endpoints discovered");
                    return foundDevices;
                }

                log.Internal($"{methodName} Found {endpoints.Count} endpoint(s), validating each as TeensyROM device");

                // Validate each endpoint and create devices
                foreach (var endpoint in endpoints)
                {
                    ct.ThrowIfCancellationRequested();

                    var device = await ValidateAndCreateDevice(endpoint, ct);
                    if (device != null)
                    {
                        // Handle device ID generation for unidentified devices
                        if (string.IsNullOrWhiteSpace(device.Cart.DeviceId))
                        {
                            var unknownCartId = foundDevices
                                .Where(d => d.Cart.DeviceId!.Contains(_undefinedDeviceIdBase))
                                .ToList()
                                .Count();

                            var deviceId = $"{_undefinedDeviceIdBase}[{unknownCartId}]";

                            device.Cart.DeviceId = deviceId;
                            device.Cart.SdStorage.DeviceId = deviceId;
                            device.Cart.UsbStorage.DeviceId = deviceId;
                            device.SerialState.SetDeviceId(deviceId);
                        }

                        foundDevices.Add(device);
                    }
                }

                log.InternalSuccess($"{methodName} Discovery complete. Found {foundDevices.Count} TeensyROM device(s)");
            }
            catch (OperationCanceledException)
            {
                foreach (var device in foundDevices)
                {
                    device.SerialState.Dispose();
                }
                throw;
            }

            return foundDevices;
        }

        /// <summary>
        /// Runs all discovery strategies in parallel and merges the results.
        /// </summary>
        private async Task<List<DiscoveredEndpoint>> DiscoverAllEndpoints(CancellationToken ct)
        {
            if (!_discoveryStrategies.Any())
            {
                log.Internal("CartFinder.DiscoverAllEndpoints: No discovery strategies registered");
                return [];
            }

            // Run all strategies in parallel for fastest results
            var tasks = _discoveryStrategies.Select(s => s.FindEndpoints(ct));
            var results = await Task.WhenAll(tasks);

            // Merge all endpoint lists into a single result
            var allEndpoints = results.SelectMany(r => r).ToList();

            log.Internal($"CartFinder.DiscoverAllEndpoints: Discovered {allEndpoints.Count} endpoint(s) across {_discoveryStrategies.Count()} strategy(ies)");

            return allEndpoints;
        }

        /// <summary>
        /// Validates a discovered endpoint as a TeensyROM device and creates a device instance.
        /// This unified pipeline works for both Serial and TCP endpoints.
        /// </summary>
        private async Task<TeensyRomDevice?> ValidateAndCreateDevice(
            DiscoveredEndpoint endpoint, CancellationToken ct)
        {
            string methodName = $"CartFinder.ValidateAndCreateDevice({endpoint.Display}):";

            // 1. Create transport based on ConnectionType
            ISerialStateContext transport = endpoint.ConnectionType switch
            {
                ConnectionType.Serial => transportFactory.CreateSerial(endpoint.Address),
                ConnectionType.Tcp => transportFactory.CreateTcp($"{endpoint.Address}:{endpoint.Port ?? 80}"),
                _ => throw new ArgumentException($"Unknown ConnectionType: {endpoint.ConnectionType}")
            };

            // 2. Open port/connection
            try
            {
                transport.OpenPort();
                ct.ThrowIfCancellationRequested();
            }
            catch (Exception ex)
            {
                log.ExternalError($"{methodName} Unable to connect to {endpoint.Display}: {ex.Message}");
                transport.Dispose();
                return null;
            }

            // 3. Version check (transport-agnostic)
            var versionCheckCommand = new FwVersionCheckCommand
            {
                Serial = transport
            };
            var versionResult = await mediator.Send(versionCheckCommand);

            if (versionResult.IsSuccess is false)
            {
                log.ExternalError($"{methodName} Version check failed for {endpoint.Display}");
                transport.Dispose();
                return null;
            }

            // 4. If not TeensyROM, dispose and return null
            if (!versionResult.IsTeensyRom)
            {
                log.Internal($"{methodName} Device at {endpoint.Display} is not a TeensyROM device");
                transport.Dispose();
                return null;
            }

            // 5. Create Cart with ConnectionType, ComPort/IpAddress, TcpPort
            var cart = new Cart
            {
                ConnectionType = endpoint.ConnectionType,
                ComPort = endpoint.ConnectionType == ConnectionType.Serial ? endpoint.Address : string.Empty,
                IpAddress = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Address : string.Empty,
                TcpPort = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Port ?? 80 : 80,
                Name = "Unnamed",
                FwVersion = versionResult.Version?.ToString() ?? "",
                IsCompatible = versionResult.IsCompatible
            };

            // 6. Ensure tags (transport-agnostic)
            var sdStorage = await tagger.EnsureTag(transport, TeensyStorageType.SD);
            var usbStorage = await tagger.EnsureTag(transport, TeensyStorageType.USB);

            // 7. Resolve DeviceId (preserve existing logic)
            var deviceId = string.IsNullOrWhiteSpace(sdStorage.DeviceId)
                ? usbStorage.DeviceId
                : sdStorage.DeviceId;

            // Set device ID properties (will be generated by caller if empty)
            cart.DeviceId = deviceId ?? string.Empty;
            sdStorage.DeviceId = deviceId ?? string.Empty;
            usbStorage.DeviceId = deviceId ?? string.Empty;

            // Only set device ID on transport if we have one
            // Otherwise, caller will generate a unique ID and set it
            if (!string.IsNullOrWhiteSpace(deviceId))
            {
                transport.SetDeviceId(deviceId);
            }

            cart.SdStorage = sdStorage;
            cart.UsbStorage = usbStorage;

            // 8. Create TeensyRomDevice
            var device = new TeensyRomDevice(
                cart,
                transport,
                storageFactory.Create(sdStorage, transport),
                storageFactory.Create(usbStorage, transport)
            );

            log.InternalSuccess($"{methodName} Validated and created device {cart.DeviceId} at {endpoint.Display}");

            return device;
        }
    }
}
