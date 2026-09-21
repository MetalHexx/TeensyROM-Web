using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device
{
	public interface ICartFinder
	{
		/// <summary>Runs every discovery strategy, builds a device per confirmed endpoint, dedupes by chip, and ensures settings.</summary>
		Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct);

		/// <summary>
		/// Turns one confirmed endpoint (from a discovery strategy or a re-confirmed cache row) into a
		/// listed device: minimal firmware rebooted through recovery, a busy storage probe reset once,
		/// Ethernet vs Serial left to the caller. Null when the endpoint cannot be listed.
		/// </summary>
		Task<TeensyRomDevice?> BuildDevice(DiscoveredEndpoint endpoint, CancellationToken ct);
	}

	public class CartFinder(
		ILoggingService log,
		IStorageFactory storageFactory,
		IDeviceInterrogator interrogator,
		IAlertService alert,
		IDeviceRecovery recovery,
		IEnumerable<IDiscoveryStrategy> discoveryStrategies,
		IDeviceSettingsProvider settingsProvider) : ICartFinder
	{
		private const string _unknownDeviceIdBase = "Unknown";
		private readonly IEnumerable<IDiscoveryStrategy> _discoveryStrategies = discoveryStrategies;
		private readonly IDeviceSettingsProvider _settingsProvider = settingsProvider;

		/// <summary>Reset at the top of every <see cref="FindDevices"/> run; a re-confirmed cache row never needs it since only a real chip id is ever cached.</summary>
		private int _standInCount;

		public async Task<List<TeensyRomDevice>> FindDevices(CancellationToken ct)
		{
			string methodName = "CartFinder.FindDevices:";
			List<TeensyRomDevice> foundDevices = [];
			_standInCount = 0;

			try
			{
				log.Internal($"{methodName} Starting device discovery using {_discoveryStrategies.Count()} {(_discoveryStrategies.Count() == 1 ? "strategy" : "strategies")}");

				var endpoints = await DiscoverAllEndpoints(ct);

				if (endpoints.Count == 0)
				{
					log.Internal($"{methodName} No endpoints discovered");
					return foundDevices;
				}

				log.Internal($"{methodName} Found {endpoints.Count} endpoint(s), validating each as TeensyROM device");

				foreach (var endpoint in endpoints)
				{
					ct.ThrowIfCancellationRequested();

					var device = await BuildDevice(endpoint, ct);
					if (device != null)
					{
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
		private async Task<List<DiscoveredEndpoint>> DiscoverAllEndpoints(CancellationToken ct)
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
		/// Builds a device from one confirmed endpoint. Identity and hardware facts come from the
		/// endpoint's version reply; storage availability comes from a read-only root probe of each
		/// storage type. Minimal firmware is reset and carried through recovery before being listed;
		/// a busy storage probe is reset and re-probed once.
		/// </summary>
		public async Task<TeensyRomDevice?> BuildDevice(DiscoveredEndpoint endpoint, CancellationToken ct)
		{
			string methodName = $"CartFinder.BuildDevice({endpoint.Display}):";
			var port = endpoint.CommunicationPort;
			var reply = endpoint.Version;

			try
			{
				var cart = new Cart();
				VersionReplyMapper.Apply(reply, cart);

				cart.DeviceId ??= NextStandInDeviceId();
				cart.SdStorage.DeviceId = cart.DeviceId;
				cart.UsbStorage.DeviceId = cart.DeviceId;

				var connection = new DeviceConnectionRecord(cart.DeviceId);
				var device = new TeensyRomDevice(
					cart,
					port,
					storageFactory.Create(cart.SdStorage, port),
					storageFactory.Create(cart.UsbStorage, port),
					connection);

				device.Confirm(endpoint.ConnectionType, endpoint.Display, reply.IsMinimalFirmware ? DeviceMode.Minimal : DeviceMode.FullIdle);

				if (reply.IsMinimalFirmware)
				{
					log.Internal($"{methodName} device is in minimal firmware; resetting and waiting for it to leave");
					port.ResetDevice(log);
					var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, ct);

					if (outcome.Mode is not (DeviceMode.FullIdle or DeviceMode.FullBusy))
					{
						log.InternalWarning($"{methodName} device did not leave minimal firmware ({outcome.Mode}); not listed");
						return null;
					}

					return device;
				}

				if (!cart.IsCompatible)
				{
					ReportIncompatibleFirmware(reply);
					return device;
				}

				var sd = interrogator.ProbeStorage(port, TeensyStorageType.SD);
				var usb = interrogator.ProbeStorage(port, TeensyStorageType.USB);

				if (sd == StoragePresence.Busy || usb == StoragePresence.Busy)
				{
					log.Internal($"{methodName} storage busy (SD {sd}, USB {usb}); resetting and re-probing once");
					port.ResetDevice(log);
					sd = interrogator.ProbeStorage(port, TeensyStorageType.SD);
					usb = interrogator.ProbeStorage(port, TeensyStorageType.USB);

					if (sd == StoragePresence.Busy || usb == StoragePresence.Busy)
					{
						log.InternalWarning($"{methodName} storage still busy after reset; listing as busy with storage unknown");
						device.MarkBusy();
						return device;
					}
				}

				cart.SdStorage.Available = sd == StoragePresence.Present;
				cart.UsbStorage.Available = usb == StoragePresence.Present;

				log.Internal($"{methodName} SD probe {sd}, USB probe {usb}");
				log.InternalSuccess($"{methodName} {reply.HardwareVariant} fw {cart.FwVersion} chip {cart.DeviceId} on {reply.Machine} {reply.VideoStandard} {reply.TodClockHz?.ToString() ?? "unknown"} Hz");

				return device;
			}
			catch (Exception ex)
			{
				log.ExternalError($"{methodName} Error creating device: {ex.Message}");
				return null;
			}
		}

		/// <summary>True when the reply carried no chip id: assigns the next per-run stand-in ("Unknown", "Unknown-2", ...).</summary>
		private string NextStandInDeviceId()
		{
			_standInCount++;
			return _standInCount == 1 ? _unknownDeviceIdBase : $"{_unknownDeviceIdBase}-{_standInCount}";
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
		/// Deduplicates devices discovered on multiple transports. When the same chip is found via Serial
		/// and TCP, TCP wins: the serial port is disposed and its port name is written onto the surviving
		/// device's record, so the one record carries both endpoints while <c>TransportInUse</c> ends as
		/// TCP. <see cref="DeviceConnectionRecord.Confirm"/> rejects <see cref="DeviceMode.FullBusy"/>, so
		/// a busy survivor is confirmed as idle and then re-marked busy to preserve its actual state.
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
					if (tcp is not null && device.ConnectionType == ConnectionType.Serial && device.Connection.SerialPortName is { } serialPortName)
					{
						var wasBusy = preferred.Connection.Mode == DeviceMode.FullBusy;
						var confirmMode = wasBusy ? DeviceMode.FullIdle : preferred.Connection.Mode;
						var tcpEndpoint = preferred.Connection.TcpEndpoint ?? preferred.ComPort;

						preferred.Confirm(ConnectionType.Serial, serialPortName, confirmMode);
						preferred.Confirm(ConnectionType.Tcp, tcpEndpoint, confirmMode);

						if (wasBusy)
						{
							preferred.MarkBusy();
						}
					}

					log.Internal($"CartFinder.DeduplicateByDeviceId: Disposing duplicate {device.ConnectionType} connection for {device.Cart.DeviceId}");
					device.CommunicationPort.Dispose();
				}
			}

			return result;
		}
	}
}
