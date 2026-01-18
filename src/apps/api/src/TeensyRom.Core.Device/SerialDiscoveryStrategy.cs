using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device;

/// <summary>
/// Cache structure for storing discovered Serial COM ports.
/// </summary>
public record SerialPortCache
{
	public DateTime LastUpdated { get; init; } = DateTime.UtcNow;
	public List<CachedSerialPort> KnownPorts { get; init; } = new();
}

/// <summary>
/// Represents a cached COM port with metadata.
/// </summary>
public record CachedSerialPort
{
	public required string PortName { get; init; }
	public DateTime LastSeen { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Discovery strategy for Serial (COM) ports.
/// Validates each COM port by connecting and sending a TeensyROM ping.
/// Only returns endpoints for valid TeensyROM devices.
/// </summary>
public class SerialDiscoveryStrategy(
	ILoggingService log,
	IDeviceTransportFactory transportFactory) : IDiscoveryStrategy
{
	private readonly string _cacheFilePath = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), "Assets/System/Config/SerialPorts.json");
	private readonly object _lock = new();

    /// <summary>
    /// Finds all available Serial COM ports on the system and validates them as TeensyROM devices.
	/// If fullScan is false, tries cached ports first and falls back to full scan if cache is empty.
	/// If fullScan is true, performs complete COM port scan (ignoring cache).
	/// </summary>
	/// <param name="ct">Cancellation token to abort COM port scanning.</param>
	/// <param name="fullScan">If true, skips cache and performs full COM port scan. If false, tries cache first with fallback to full scan. Defaults to false.</param>
	/// <returns>List of Serial endpoints (COM ports) with valid TeensyROM devices.</returns>
	public async Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct, bool fullScan = false)
	{
		if (fullScan)
		{
			log.Internal("SerialDiscoveryStrategy: fullScan=true, performing full COM port scan");
			return await PerformFullScan(ct);
		}

		log.Internal("SerialDiscoveryStrategy: Attempting fast discovery using cached ports");

		var knownEndpoints = await FindKnownEndpoints(ct);

		if (knownEndpoints.Count > 0)
		{
			log.InternalSuccess($"SerialDiscoveryStrategy: Fast discovery successful - found {knownEndpoints.Count} cached device(s)");
			return knownEndpoints;
		}

		log.Internal("SerialDiscoveryStrategy: No cached devices found, falling back to full scan");
		return await PerformFullScan(ct);
	}

	/// <summary>
	/// Performs a full COM port scan and caches discovered devices.
	/// </summary>
	private async Task<List<DiscoveredEndpoint>> PerformFullScan(CancellationToken ct)
	{
		var portNames = TeensyRom.Core.Serial.SerialHelper.GetComPorts();
		var discoveredEndpoints = new List<DiscoveredEndpoint>();

		log.Internal($"SerialDiscoveryStrategy: Scanning {portNames.Count} COM port(s)");

		foreach (var portName in portNames)
		{
			ct.ThrowIfCancellationRequested();

			var endpoint = TryDiscoverDevice(portName);
			if (endpoint != null)
			{
				discoveredEndpoints.Add(endpoint);
				log.InternalSuccess($"SerialDiscoveryStrategy: Discovered device at {portName}");
			}
		}

		// Cache discovered ports for future fast discovery
		if (discoveredEndpoints.Count > 0)
		{
			SaveKnownPorts(discoveredEndpoints);
		}

		log.InternalSuccess($"SerialDiscoveryStrategy: Found {discoveredEndpoints.Count} device(s)");
		return discoveredEndpoints;
	}

	/// <summary>
	/// Scans previously discovered (cached) COM ports for fast reconnection.
	/// Reads port names from SerialPorts.json and validates they are still active.
	/// </summary>
	private async Task<List<DiscoveredEndpoint>> FindKnownEndpoints(CancellationToken ct)
	{
		var cache = LoadKnownPorts();

		if (cache == null || cache.KnownPorts.Count == 0)
		{
			log.Internal("SerialDiscoveryStrategy: No cached ports found");
			return [];
		}

		log.Internal($"SerialDiscoveryStrategy: Checking {cache.KnownPorts.Count} cached port(s)");

		var discoveredEndpoints = new List<DiscoveredEndpoint>();

		foreach (var cachedPort in cache.KnownPorts)
		{
			ct.ThrowIfCancellationRequested();

			var endpoint = TryDiscoverDevice(cachedPort.PortName);
			if (endpoint != null)
			{
				discoveredEndpoints.Add(endpoint);
				log.InternalSuccess($"SerialDiscoveryStrategy: Cached device found at {cachedPort.PortName}");
			}
		}

		return discoveredEndpoints;
	}

	/// <summary>
	/// Attempts to discover and validate a TeensyROM device on the specified COM port.
	/// Uses EnsureNormalFirmware to handle minimal mode devices, then pings for validation.
	/// </summary>
	private DiscoveredEndpoint? TryDiscoverDevice(string portName)
	{
		ICommunicationPort? communicationPort = null;

		try
		{
			communicationPort = transportFactory.CreateSerial(portName);
			communicationPort.OpenPort();

			if (!communicationPort.IsOpen)
			{
				communicationPort.Dispose();
				log.Internal($"Failed to make initial connection with port: {portName}");
				return null;
			}

			Thread.Sleep(100);  // Port stabilization

			var minimalResult = communicationPort.SendMinimalCommand(log);

			if (minimalResult is 1)
			{
				log.Internal("Minimal mode was detected during discovery.  Initializing reboot to normal firmware.");

				if (!communicationPort.ReconnectToFullFwSerial(log))
				{
					log.Internal($"Failed to switch to default FW on port: {portName}");
					return null;
				}				
				Thread.Sleep(8000);
				communicationPort.ClearBuffers();
			}
			var response = communicationPort.PingDevice(8000);

			if (!response.IsTeensyRom())
			{
				communicationPort.Dispose();
				return null;
			}
			if (response.IsTeensyRomBusy())
			{
				var reconnectedToFull = communicationPort.ForceResetAndReconnectToFullFw(log);

				if (!reconnectedToFull)
				{
					communicationPort.Dispose();
					return null;
				}
			}
			return new DiscoveredEndpoint(
				ConnectionType.Serial,
				Address: portName,
				Port: null,
				PingResponse: response,
				communicationPort
			);
		}
		catch (Exception)
		{
			communicationPort?.Dispose();
			return null;
		}
	}

	/// <summary>
	/// Loads known COM ports from cache file.
	/// </summary>
	private SerialPortCache? LoadKnownPorts()
	{
		lock (_lock)
		{
			if (!File.Exists(_cacheFilePath))
				return null;

			try
			{
				var content = File.ReadAllText(_cacheFilePath);
				return JsonSerializer.Deserialize<SerialPortCache>(content);
			}
			catch (Exception ex)
			{
				log.InternalError($"SerialDiscoveryStrategy: Failed to load cache: {ex.Message}");
				return null;
			}
		}
	}

	/// <summary>
	/// Saves discovered COM ports to cache file.
	/// </summary>
	private void SaveKnownPorts(List<DiscoveredEndpoint> endpoints)
	{
		lock (_lock)
		{
			try
			{
				var cache = new SerialPortCache
				{
					LastUpdated = DateTime.UtcNow,
					KnownPorts = endpoints.Select(e => new CachedSerialPort
					{
						PortName = e.Address,
						LastSeen = DateTime.UtcNow
					}).ToList()
				};

				var directory = Path.GetDirectoryName(_cacheFilePath);
				if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
					Directory.CreateDirectory(directory);

				var json = JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true });
				File.WriteAllText(_cacheFilePath, json);

				log.Internal($"SerialDiscoveryStrategy: Saved {endpoints.Count} port(s) to cache");
			}
			catch (Exception ex)
			{
				log.InternalError($"SerialDiscoveryStrategy: Failed to save cache: {ex.Message}");
			}
		}
	}
}
