using MediatR;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device
{
  public interface ICartFinder
  {
    Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct, bool fullScan = false);
  }

  public class CartFinder(
      ILoggingService log,
      IStorageFactory storageFactory,
      ICartTagger tagger,
      IFwVersionChecker versionChecker,
      IMediator mediator,
      IEnumerable<IDiscoveryStrategy> discoveryStrategies) : ICartFinder
  {
    private const string _undefinedDeviceIdBase = "Unidentified";
    private readonly IEnumerable<IDiscoveryStrategy> _discoveryStrategies = discoveryStrategies;

    public async Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct, bool fullScan = false)
    {
      string methodName = "CartFinder.FindDevices:";
      List<TeensyRomDevice> foundDevices = [];

      try
      {
        log.Internal($"{methodName} Starting device discovery using {_discoveryStrategies.Count()} strategy(ies) (fullScan={fullScan})");

        var endpoints = await DiscoverAllEndpoints(ct, fullScan);

        if (endpoints.Count == 0)
        {
          log.Internal($"{methodName} No endpoints discovered");
          return foundDevices;
        }

        log.Internal($"{methodName} Found {endpoints.Count} endpoint(s), validating each as TeensyROM device");

        foreach (var endpoint in endpoints)
        {
          ct.ThrowIfCancellationRequested();

          var device = await ValidateAndCreateDevice(endpoint, ct);
          if (device != null)
          {
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
          device.CommunicationPort.Dispose();
        }
        throw;
      }
      return foundDevices;
    }

    /// <summary>
    /// Runs all discovery strategies in parallel and merges the results.
    /// </summary>
    private async Task<List<DiscoveredEndpoint>> DiscoverAllEndpoints(CancellationToken ct, bool fullScan)
    {
      if (!_discoveryStrategies.Any())
      {
        log.Internal("CartFinder.DiscoverAllEndpoints: No discovery strategies registered");
        return [];
      }
      var tasks = _discoveryStrategies.Select(s => s.FindEndpoints(ct, fullScan));
      var results = await Task.WhenAll(tasks);
      var allEndpoints = results.SelectMany(r => r).ToList();

      log.Internal($"CartFinder.DiscoverAllEndpoints: Discovered {allEndpoints.Count} endpoint(s) across {_discoveryStrategies.Count()} strategy(ies)");

      return allEndpoints;
    }

    /// <summary>
    /// Validates a discovered endpoint as a TeensyROM device and creates a device instance.
    /// This unified pipeline works for both Serial and TCP endpoints.
    /// Expects discovery strategies to always provide an open ICommunicationPort.
    /// </summary>
    private async Task<TeensyRomDevice?> ValidateAndCreateDevice(
        DiscoveredEndpoint endpoint, CancellationToken ct)
    {
      string methodName = $"CartFinder.ValidateAndCreateDevice({endpoint.Display}):";

      var communicationPort = endpoint.CommunicationPort
          ?? throw new ArgumentException($"Discovered endpoint must provide a communication port: {endpoint.Display}", nameof(endpoint));

      log.Internal($"{methodName} Using pre-validated port from discovery for {endpoint.Display}");

      try
      {
        if (endpoint.PingResponse is null)
        {
          log.ExternalError($"{methodName} Version check failed for {endpoint.Display}.  PingResponse was null.");
          return null;
        }
        var (isCompatible, version) = versionChecker.VersionCheck(endpoint.PingResponse);
        
        var cart = new Cart
        {
          ConnectionType = endpoint.ConnectionType,
          ComPort = endpoint.ConnectionType == ConnectionType.Serial ? endpoint.Address : string.Empty,
          IpAddress = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Address : string.Empty,
          TcpPort = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Port ?? 80 : 80,
          Name = "Unnamed",
          FwVersion = version?.ToString() ?? "",
          IsCompatible = isCompatible
        };

        var sdStorage = await tagger.EnsureTag(communicationPort, TeensyStorageType.SD);
        var usbStorage = await tagger.EnsureTag(communicationPort, TeensyStorageType.USB);

        var deviceId = string.IsNullOrWhiteSpace(sdStorage.DeviceId)
            ? usbStorage.DeviceId
            : sdStorage.DeviceId;

        cart.DeviceId = deviceId ?? string.Empty;
        sdStorage.DeviceId = deviceId ?? string.Empty;
        usbStorage.DeviceId = deviceId ?? string.Empty;

        cart.SdStorage = sdStorage;
        cart.UsbStorage = usbStorage;

        var device = new TeensyRomDevice(
            cart,
            communicationPort,
            storageFactory.Create(sdStorage, communicationPort),
            storageFactory.Create(usbStorage, communicationPort)
        );

        log.InternalSuccess($"{methodName} Validated and created device {cart.DeviceId} at {endpoint.Display}");

        return device;
      }
      catch (Exception ex)
      {
        log.ExternalError($"{methodName} Error creating device: {ex.Message}");
        return null;
      }
    }
  }
}
