using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
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
		IEnumerable<IDiscoveryStrategy> discoveryStrategies,
		IDeviceSettingsProvider settingsProvider) : ICartFinder
	{
		private const string _undefinedDeviceIdBase = "Unidentified";
		private readonly IEnumerable<IDiscoveryStrategy> _discoveryStrategies = discoveryStrategies;
		private readonly IDeviceSettingsProvider _settingsProvider = settingsProvider;

		public async Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct, bool fullScan = false)
		{
			string methodName = "CartFinder.FindDevices:";
			List<TeensyRomDevice> foundDevices = [];

			try
			{
				log.Internal($"{methodName} Starting device discovery using {_discoveryStrategies.Count()} {(_discoveryStrategies.Count() == 1 ? "strategy" : "strategies")} (fullScan={fullScan})");

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
				foundDevices = DeduplicateByDeviceId(foundDevices);

				foreach (var device in foundDevices)
				{
					if (device.Cart?.DeviceId is not null)
					{
						EnsureDeviceInSettings(device.Cart.DeviceId);
					}
				}
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
				log.Internal($"Performing Version Check on port: {endpoint.Address}");
				var (isCompatible, version) = versionChecker.VersionCheck(endpoint.PingResponse);

				var cart = new Cart
				{
					Name = "Unnamed",
					FwVersion = version?.ToString() ?? "",
					IsCompatible = isCompatible
				};

				if (endpoint.PingResponse.Contains("busy"))
				{
					log.Internal($"{methodName}  TR is Busy, restarting");
					await mediator.Send(new ResetCommand
					{
						CommunicationPort = communicationPort
					});
				}

			log.Internal($"Checking storage tags for device on Port {endpoint.Address}");
			var tagResult = await tagger.EnsureTagsForDevice(communicationPort);
			var sdStorage = tagResult.SdStorage;
			var usbStorage = tagResult.UsbStorage;

			log.Internal($"SD storage {(sdStorage.Available ? "available" : "unavailable")}");
			log.Internal($"USB storage {(usbStorage.Available ? "available" : "unavailable")}");
			log.Internal($"Device ID: {tagResult.DeviceId}");

			cart.DeviceId = tagResult.DeviceId;
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

/// <summary>
/// Ensures a discovered device is saved to settings.
/// Skips unidentified devices (no stable DeviceId).
/// </summary>
private void EnsureDeviceInSettings(string deviceId)
{
	if (string.IsNullOrWhiteSpace(deviceId) || deviceId.StartsWith(_undefinedDeviceIdBase))
	{
		log.Internal($"CartFinder.EnsureDeviceInSettings: Skipping unidentified device {deviceId}");
		return;
	}

	try
	{
		_settingsProvider.GetOrCreateDeviceSettings(deviceId);
		log.Internal($"CartFinder.EnsureDeviceInSettings: Ensured device {deviceId} exists in settings");
			}
			catch (Exception ex)
			{
				log.InternalError($"CartFinder.EnsureDeviceInSettings: Failed to save device {deviceId}: {ex.Message}");
			}
		}

		/// <summary>
		/// Deduplicates devices discovered on multiple transports.
		/// When same device found via Serial + TCP, prefers TCP.
		/// Disposes communication ports for non-preferred transports.
		/// </summary>
		private List<TeensyRomDevice> DeduplicateByDeviceId(List<TeensyRomDevice> devices)
		{
			var grouped = devices.GroupBy(d => d.Cart.DeviceId);
			var result = new List<TeensyRomDevice>();

			foreach (var group in grouped)
			{
				if (group.Count() == 1)
				{
					// Only one transport found - use it
					result.Add(group.First());
					continue;
				}

				// Multiple transports for same device - prefer TCP over Serial
				var tcp = group.FirstOrDefault(d => d.ConnectionType == ConnectionType.Tcp);
				var preferred = tcp ?? group.First();

				result.Add(preferred);

				log.Internal($"CartFinder.DeduplicateByDeviceId: Device {group.Key} found on {group.Count()} transport(s), keeping {preferred.ConnectionType}");

				// Dispose non-preferred transports
				foreach (var device in group.Where(d => d != preferred))
				{
					log.Internal($"CartFinder.DeduplicateByDeviceId: Disposing duplicate {device.ConnectionType} connection for {device.Cart.DeviceId}");
					device.CommunicationPort.Dispose();
				}
			}

			return result;
		}
	}
}
