using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Device;

/// <summary>
/// Cache structure for storing discovered device IP addresses.
/// </summary>
public record DeviceIpCache
{
	public DateTime LastUpdated { get; init; } = DateTime.UtcNow;
	public List<CachedDeviceIp> KnownEndpoints { get; init; } = new();
}

/// <summary>
/// Represents a cached device endpoint with metadata.
/// </summary>
public record CachedDeviceIp
{
	public required string IpAddress { get; init; }
	public int Port { get; init; } = TcpConstants.TeensyRomPort;
	public DateTime LastSeen { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Discovers TeensyROM devices on the local network via TCP scanning.
/// Uses true async I/O without thread pool blocking for efficient parallel scanning.
/// Implements IDiscoveryStrategy to provide a unified discovery interface.
/// </summary>
public class TcpDiscoveryStrategy(
	ILoggingService log,
	IDeviceTransportFactory transportFactory) : IDiscoveryStrategy
{
	private const int _maxDegreeOfParallelism = 256;  // High parallelism safe with true async I/O (no thread blocking)
	private readonly string _cacheFilePath = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), "Assets/System/Config/DeviceIps.json");
	private readonly object _lock = new();	

	/// <summary>
	/// Finds all available TCP endpoints on the local network.
	/// If fullScan is true, performs complete subnet scan (ignoring cache).
	/// If fullScan is false, tries cached endpoints first and falls back to full scan if cache is empty.
	/// Implements IDiscoveryStrategy to provide unified discovery across transport types.
	/// </summary>
	/// <param name="ct">Cancellation token to abort the network scan.</param>
	/// <param name="fullScan">If true, skips cache and performs full subnet scan. If false, tries cache first with fallback to full scan. Defaults to false.</param>
	/// <returns>List of TCP endpoints (IP:port) where TeensyROM devices were found.</returns>
	public async Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct, bool fullScan = false)
	{
		if (fullScan)
		{
			log.Internal("TcpDiscoveryStrategy: fullScan=true, skipping cache and performing full subnet scan");
			return await PerformFullScan(ct);
		}

		log.Internal("TcpDiscoveryStrategy: fullScan=false, attempting fast discovery using cached endpoints");

		var knownEndpoints = await FindKnownEndpoints(ct);

		if (knownEndpoints.Count > 0)
		{
			log.InternalSuccess($"TcpDiscoveryStrategy: Fast discovery successful - found {knownEndpoints.Count} cached device(s)");
			return knownEndpoints;
		}

		log.Internal("TcpDiscoveryStrategy: No cached devices found, falling back to full subnet scan");
		return await PerformFullScan(ct);
	}

	/// <summary>
	/// Performs a full subnet scan and caches discovered devices.
	/// </summary>
	private async Task<List<DiscoveredEndpoint>> PerformFullScan(CancellationToken ct)
	{
		var subnetRange = NetworkHelper.GetLocalSubnetRange();

		if (!subnetRange.HasValue)
		{
			log.InternalError("TcpDiscoveryStrategy: Unable to detect local subnet range");
			return [];
		}

		var (startIp, endIp) = subnetRange.Value;
		log.Internal($"TcpDiscoveryStrategy: Scanning range {startIp} to {endIp}");

		var discoveredDevices = await ScanNetwork(startIp, endIp, ct);

		// Save discovered devices to cache for future fast discovery
		if (discoveredDevices.Count > 0)
		{
			SaveKnownIps(discoveredDevices);
		}

		var endpoints = discoveredDevices
			.Select(device => new DiscoveredEndpoint(
				ConnectionType.Tcp,
				device.IpAddress,
				device.Port,
				device.Response,
				device.CommunicationPort
			))
			.ToList();

		return endpoints;
	}

	/// <summary>
	/// Scans previously discovered (cached) device endpoints for fast reconnection.
	/// Reads IP addresses from DeviceIps.json and validates they are still active.
	/// </summary>
	/// <param name="ct">Cancellation token to abort the scan.</param>
	/// <returns>List of discovered endpoints from the cache, or empty if none found.</returns>
	private async Task<List<DiscoveredEndpoint>> FindKnownEndpoints(CancellationToken ct)
	{
		var cache = LoadKnownIps();

		if (cache == null || cache.KnownEndpoints.Count == 0)
		{
			log.Internal("TcpDiscoveryStrategy: No cached endpoints found");
			return [];
		}

		log.Internal($"TcpDiscoveryStrategy: Scanning {cache.KnownEndpoints.Count} cached endpoint(s)");

		var discoveredDevices = new ConcurrentBag<TcpDiscoveredDevice>();

		var parallelOptions = new ParallelOptions
		{
			MaxDegreeOfParallelism = cache.KnownEndpoints.Count,
			CancellationToken = ct
		};

		await Parallel.ForEachAsync(cache.KnownEndpoints, parallelOptions, async (cachedIp, ct) =>
		{
			ct.ThrowIfCancellationRequested();

			if (!IPAddress.TryParse(cachedIp.IpAddress, out var ip))
			{
				log.InternalError($"TcpDiscoveryStrategy: Invalid cached IP address: {cachedIp.IpAddress}");
				return;
			}

			var device = await TryDiscoverDeviceAsync(ip, cachedIp.Port);
			if (device != null)
			{
				discoveredDevices.Add(device);
				log.InternalSuccess($"TcpDiscoveryStrategy: Cached device found at {device.IpAddress}:{device.Port}");
			}
		});

		var endpoints = discoveredDevices
			.Select(device => new DiscoveredEndpoint(
				ConnectionType.Tcp,
				device.IpAddress,
				device.Port,
				device.Response,
				device.CommunicationPort
			))
			.ToList();

		return endpoints;
	}

	/// <summary>
	/// Scans the specified IP range for TeensyROM devices using parallel TCP connections.
	/// Each IP is probed with a TeensyROM ping token (0x6455) to validate the device.
	/// </summary>
	private async Task<List<TcpDiscoveredDevice>> ScanNetwork(IPAddress startIp, IPAddress endIp, CancellationToken ct)
	{
		var ipRange = NetworkHelper.GenerateIpRange(startIp, endIp);
		var discoveredDevices = new ConcurrentBag<TcpDiscoveredDevice>();

		var parallelOptions = new ParallelOptions
		{
			MaxDegreeOfParallelism = _maxDegreeOfParallelism,
			CancellationToken = ct
		};

		log.Internal($"TcpDiscoveryStrategy: Scanning {ipRange.Count} IP addresses with MaxDegreeOfParallelism = {_maxDegreeOfParallelism}");

		await Parallel.ForEachAsync(ipRange, parallelOptions, async (ip, ct) =>
		{
			ct.ThrowIfCancellationRequested();

			var device = await TryDiscoverDeviceAsync(ip, TcpConstants.TeensyRomPort);
			if (device != null)
			{
				discoveredDevices.Add(device);
				log.InternalSuccess($"TcpDiscoveryStrategy: Discovered TeensyROM device at {device.IpAddress}:{device.Port}");
			}
		});

		var result = discoveredDevices.ToList();
		log.InternalSuccess($"TcpDiscoveryStrategy: Scan complete. Found {result.Count} device(s)");

		return result;
	}

	/// <summary>
	/// Attempts to discover a TeensyROM device at the specified IP address and port.
	/// Uses raw TcpClient with true async I/O for fast, non-blocking network scanning.
	/// If device validates as TeensyROM, wraps the live connection in TcpObservablePort for reuse.
	/// </summary>
	private async Task<TcpDiscoveredDevice?> TryDiscoverDeviceAsync(IPAddress ip, int port)
	{
		TcpClient? tcpClient = null;
		ICommunicationPort? communicationPort = null;

		try
		{
			var endpoint = $"{ip}:{port}";
			tcpClient = new TcpClient();

			using var connectCts = new CancellationTokenSource(100);
			await tcpClient.ConnectAsync(ip, port, connectCts.Token);

			if (!tcpClient.Connected)
			{
				tcpClient?.Dispose();
				return null;
			}

			var stream = tcpClient.GetStream();
			stream.ReadTimeout = 500;
			stream.WriteTimeout = 500;

			byte[] sendBytes = BitConverter.GetBytes(TeensyToken.FwCheckToken.Value);
			if (BitConverter.IsLittleEndian)
			{
				Array.Reverse(sendBytes);
			}

			using var writeCts = new CancellationTokenSource(100);
			await stream.WriteAsync(sendBytes, 0, sendBytes.Length, writeCts.Token);
			await stream.FlushAsync(writeCts.Token);

			await Task.Delay(75);

			byte[] responseBytes = new byte[2];
			using var readCts = new CancellationTokenSource(500);
			int bytesRead = await stream.ReadAsync(responseBytes, 0, 2, readCts.Token);

			if (bytesRead != 2)
			{
				tcpClient.Dispose();
				return null;
			}

			ushort fwCheckResult = BitConverter.ToUInt16(responseBytes, 0);

			if (fwCheckResult != TeensyToken.FWMinimalToken.Value && fwCheckResult != TeensyToken.FWFullToken.Value)
			{
				tcpClient.Dispose();
				return null;
			}

			bool isMinimalMode = fwCheckResult == TeensyToken.FWMinimalToken.Value;

			communicationPort = new TcpCommunicationPort(log, tcpClient);

			if (isMinimalMode)
			{
				log.Internal($"TcpDiscoveryStrategy: Device at {endpoint} is in minimal mode, resetting...");
				communicationPort.ResetDevice(log);
				communicationPort.ClosePort();
				communicationPort.OpenPort();

				if (!communicationPort.IsOpen)
				{
					communicationPort.Dispose();
					return null;
				}

				log.InternalSuccess($"TcpDiscoveryStrategy: Reconnected to {endpoint} after reset");
			}

			var response = communicationPort.PingDevice();

			if (!response.IsTeensyRom())
			{
				communicationPort.Dispose();
				return null;
			}
			if (response.IsTeensyRomBusy())
			{
				var reconnectedToFull = communicationPort.ResetAndReconnectToFullFwTcp(log);

				if(!reconnectedToFull)
				{
					communicationPort.Dispose();
					return null;
				}
			}
			return new TcpDiscoveredDevice
			{
				IpAddress = ip.ToString(),
				Port = port,
				Response = response,
				DiscoveredAt = DateTime.UtcNow,
				CommunicationPort = communicationPort
			};
		}
		catch (Exception)
		{
			tcpClient?.Dispose();
			communicationPort?.Dispose();
			return null;
		}
	}

	/// <summary>
	/// Loads known device IPs from cache file.
	/// </summary>
	/// <returns>DeviceIpCache if file exists and is valid, null otherwise.</returns>
	private DeviceIpCache? LoadKnownIps()
	{
		lock (_lock)
		{
			if (!File.Exists(_cacheFilePath))
			{
				return null;
			}

			try
			{
				var content = File.ReadAllText(_cacheFilePath);
				return JsonSerializer.Deserialize<DeviceIpCache>(content);
			}
			catch (Exception ex)
			{
				log.InternalError($"TcpDiscoveryStrategy: Failed to load device cache: {ex.Message}");
				return null;
			}
		}
	}

	/// <summary>
	/// Saves discovered devices to cache file.
	/// Replaces existing cache contents with new discoveries.
	/// </summary>
	/// <param name="devices">List of discovered devices to cache.</param>
	private void SaveKnownIps(List<TcpDiscoveredDevice> devices)
	{
		lock (_lock)
		{
			try
			{
				var cache = new DeviceIpCache
				{
					LastUpdated = DateTime.UtcNow,
					KnownEndpoints = devices.Select(d => new CachedDeviceIp
					{
						IpAddress = d.IpAddress,
						Port = d.Port,
						LastSeen = d.DiscoveredAt
					}).ToList()
				};

				var directory = Path.GetDirectoryName(_cacheFilePath);
				if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
				{
					Directory.CreateDirectory(directory);
				}

				var json = JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true });
				File.WriteAllText(_cacheFilePath, json);

				log.Internal($"TcpDiscoveryStrategy: Saved {devices.Count} device(s) to cache: {_cacheFilePath}");
			}
			catch (Exception ex)
			{
				log.InternalError($"TcpDiscoveryStrategy: Failed to save device cache: {ex.Message}");
			}
		}
	}
}
