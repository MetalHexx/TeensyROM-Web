using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Routines;
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
		IDeviceInterrogator interrogator,
		IAlertService alert,
		IMediator mediator,
		IEnumerable<IDiscoveryStrategy> discoveryStrategies,
		IDeviceSettingsProvider settingsProvider) : ICartFinder
	{
		private const string _unknownDeviceIdBase = "Unknown";
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
						if (device.Cart.DeviceId is null)
						{
							var standInCount = foundDevices.Count(d => IsStandInDeviceId(d.Cart.DeviceId));
							var deviceId = standInCount == 0
								? _unknownDeviceIdBase
								: $"{_unknownDeviceIdBase}-{standInCount + 1}";

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
					if (device.Cart?.DeviceId is not null && device.Cart.IsCompatible)
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
			var tasks = _discoveryStrategies.Select(s => s.FindEndpoints(ct));
			var results = await Task.WhenAll(tasks);
			var allEndpoints = results.SelectMany(r => r).ToList();

			log.Internal($"CartFinder.DiscoverAllEndpoints: Discovered {allEndpoints.Count} endpoint(s) across {_discoveryStrategies.Count()} strategy(ies)");

			return allEndpoints;
		}

		/// <summary>
		/// Validates a discovered endpoint as a TeensyROM device and creates a device instance.
		/// This unified pipeline works for both Serial and TCP endpoints.
		/// Identity and hardware facts come from the device's version reply; storage availability
		/// comes from a read-only root probe of each storage type.
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
				if (!endpoint.Version.IsTeensyRom)
				{
					log.ExternalError($"{methodName} Version check failed for {endpoint.Display}.  No TeensyROM version reply.");
					return null;
				}

				log.Internal($"{methodName} Reading version from port: {endpoint.Address}");
				var reply = interrogator.ReadVersion(communicationPort);

				var cart = new Cart
				{
					Name = "Unnamed",
					DeviceId = reply.ChipId,
					FwVersion = reply.FirmwareVersion?.ToString() ?? "",
					IsCompatible = VersionReplyParser.IsCompatible(reply) && !reply.IsMinimalFirmware,
					HardwareVariant = reply.HardwareVariant,
					IsMinimalFirmware = reply.IsMinimalFirmware,
					BuildTimestamp = reply.BuildTimestamp,
					CpuMhz = reply.CpuMhz,
					TemperatureC = reply.TemperatureC,
					Machine = reply.Machine,
					VideoStandard = reply.VideoStandard,
					TodClockHz = reply.TodClockHz,
					SdStorage = new CartStorage(TeensyStorageType.SD, available: false) { DeviceId = reply.ChipId ?? "" },
					UsbStorage = new CartStorage(TeensyStorageType.USB, available: false) { DeviceId = reply.ChipId ?? "" }
				};

				if (reply.IsMinimalFirmware)
				{
					log.InternalWarning($"{methodName} device is in minimal firmware; not ready");
					return null;
				}

				if (!cart.IsCompatible)
				{
					ReportIncompatibleFirmware(reply);
				}
				else
				{
					var sd = interrogator.ProbeStorage(communicationPort, TeensyStorageType.SD);
					var usb = interrogator.ProbeStorage(communicationPort, TeensyStorageType.USB);

					cart.SdStorage.Available = sd == StoragePresence.Present;
					cart.UsbStorage.Available = usb == StoragePresence.Present;

					log.Internal($"{methodName} SD probe {sd}, USB probe {usb}");
				}

				var device = new TeensyRomDevice(
					cart,
					communicationPort,
					storageFactory.Create(cart.SdStorage, communicationPort),
					storageFactory.Create(cart.UsbStorage, communicationPort)
				);

				log.InternalSuccess($"{methodName} {reply.HardwareVariant} fw {cart.FwVersion} chip {reply.ChipId ?? "none"} on {reply.Machine} {reply.VideoStandard} {reply.TodClockHz?.ToString() ?? "unknown"} Hz");

				return device;
			}
			catch (Exception ex)
			{
				log.ExternalError($"{methodName} Error creating device: {ex.Message}");
				return null;
			}
		}

		/// <summary>
		/// Publishes the user-facing alert and log trail for a device whose firmware is below the
		/// supported floor. The device is still created and listed so the UI can report it.
		/// </summary>
		private void ReportIncompatibleFirmware(VersionReply reply)
		{
			alert.Publish($"TeensyROM firmware check failed. v{VersionReplyParser.FullFirmwareFloor}+ is required. (See: Terminal Logs)");
			log.InternalError($"TeensyROM firmware check failed. v{VersionReplyParser.FullFirmwareFloor}+ is required.");

			if (reply.FirmwareVersion is null)
			{
				alert.Publish("Unable to determine the version of TeensyROM. (See: Terminal Logs)");
				log.InternalError("Unable to determine the version of TeensyROM.");
			}
			else
			{
				log.InternalError($"v{reply.FirmwareVersion} is not supported by this app and may lead to unexpected results.");
			}
			log.InternalError("FW Download: https://github.com/SensoriumEmbedded/TeensyROM/tree/main/bin/TeensyROM");
			log.InternalError("FW Instructions: https://github.com/SensoriumEmbedded/TeensyROM/blob/main/docs/General_Usage.md#firmware-updates");
		}

		/// <summary>
		/// True when the id is a per-run stand-in rather than a chip id read from the device.
		/// </summary>
		private static bool IsStandInDeviceId(string? deviceId) =>
			deviceId == _unknownDeviceIdBase || (deviceId?.StartsWith($"{_unknownDeviceIdBase}-") ?? false);

		/// <summary>
		/// Ensures a discovered device is saved to settings.
		/// Skips devices without a chip id (no stable DeviceId to key on).
		/// </summary>
		private void EnsureDeviceInSettings(string deviceId)
		{
			if (string.IsNullOrWhiteSpace(deviceId) || IsStandInDeviceId(deviceId))
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
