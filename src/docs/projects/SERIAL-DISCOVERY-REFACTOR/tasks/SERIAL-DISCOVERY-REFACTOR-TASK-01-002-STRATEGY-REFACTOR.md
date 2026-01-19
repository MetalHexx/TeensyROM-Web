# Task Handoff: SerialDiscoveryStrategy Refactor with Caching

## 📋 Task Identity

**Task ID**: SERIAL-DISCOVERY-REFACTOR-TASK-01-002-STRATEGY-REFACTOR  
**Task Name**: Refactor SerialDiscoveryStrategy with Caching and Simplified Flow  
**Assigned To**: Backend Wizard  
**Priority**: High  
**Estimated Context Size**: Medium (1 file + reference files)

---

## 🎯 Objective

**What**: Refactor `SerialDiscoveryStrategy` to use the new `EnsureNormalFirmware()` extension method, add COM port caching for faster discovery, and simplify to sequential processing.

**Why**: The current implementation has manual ping logic (duplicated from `TRStreamExtensions`), doesn't handle minimal firmware mode, has no caching, and uses unnecessary parallelism for a small number of COM ports.

**Success Criteria**:
- [ ] Uses `EnsureNormalFirmware()` instead of manual ping/minimal check logic
- [ ] Uses `PingDevice()` extension method for device validation
- [ ] Caches discovered COM ports to `Assets/System/Config/SerialPorts.json`
- [ ] Loads cached ports for fast discovery when `fullScan=false`
- [ ] Falls back to full COM port scan when cache empty or `fullScan=true`
- [ ] Sequential processing (no `Task.WhenAll` or parallelism)
- [ ] Solution builds without warnings

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- SERIAL-DISCOVERY-REFACTOR-TASK-01-001-EXTENSION-METHOD: `EnsureNormalFirmware()` method exists

**Dependencies**:
- `TeensyRom.Core.Device` project
- `TeensyRom.Core.Serial.Routines.TRStreamExtensions` - `EnsureNormalFirmware()`, `PingDevice()`
- `IDiscoveryStrategy` interface
- `IDeviceTransportFactory` for creating serial ports
- `ILoggingService` for diagnostics

**Constraints**:
- Must implement `IDiscoveryStrategy.FindEndpoints()` interface
- Cache file location: `Assets/System/Config/SerialPorts.json` (same pattern as `TcpDiscoveryStrategy`)
- Must return `DiscoveredEndpoint` with open `ICommunicationPort` for validated devices

---

## 📁 File Scope

**Files to Modify**:
- `apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs` - Major refactor

**Files to Review** (for context and patterns):
- `apps/api/src/TeensyRom.Core.Device/TcpDiscoveryStrategy.cs` - Caching pattern reference
- `apps/api/src/TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs` - Extension methods
- `apps/api/src/TeensyRom.Core.Device/DiscoveredEndpoint.cs` - Return type
- `apps/api/src/TeensyRom.Core/Common/StringExtensions.cs` - `IsTeensyRom()` method

---

## 🔧 Implementation Guidance

### 1. Add Cache Records (at top of file, after usings)

```csharp
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
```

### 2. Add Required Usings

Add these at the top:
```csharp
using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Serial.Routines;  // For TRStreamExtensions
```

### 3. Refactor Class Structure

**Remove**:
- `_readTimeoutMs` constant
- `_bufferSize` constant
- `ArrayPool<byte>` usage

**Add**:
- `_cacheFilePath` field (similar to TCP strategy)
- `_lock` object for thread-safe cache access
- `FindKnownEndpoints()` method
- `PerformFullScan()` method  
- `LoadKnownPorts()` method
- `SaveKnownPorts()` method

### 4. Refactor `FindEndpoints()` Method

```csharp
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
```

### 5. Implement `PerformFullScan()` Method

```csharp
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
```

### 6. Implement `FindKnownEndpoints()` Method

```csharp
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
```

### 7. Simplify `TryDiscoverDevice()` Method

Replace the entire `TryDiscoverDeviceAsync` method with a synchronous version:

```csharp
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
            return null;
        }

        Thread.Sleep(100);  // Port stabilization

        // Ensure device is in normal firmware mode
        if (!communicationPort.EnsureNormalFirmware(log))
        {
            log.Internal($"SerialDiscoveryStrategy: Device at {portName} failed firmware check");
            communicationPort.Dispose();
            return null;
        }

        // Ping and validate as TeensyROM
        var response = communicationPort.PingDevice();

        if (response.IsTeensyRom())
        {
            return new DiscoveredEndpoint(
                ConnectionType.Serial,
                portName,
                Port: null,
                PingResponse: response,
                communicationPort
            );
        }

        communicationPort.Dispose();
        return null;
    }
    catch (Exception)
    {
        communicationPort?.Dispose();
        return null;
    }
}
```

### 8. Implement Cache Methods

Follow the pattern from `TcpDiscoveryStrategy`:

```csharp
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
```

---

## 🧪 Testing Requirements

**Manual Verification**:
- Build the solution: `dotnet build apps/api/src/TeensyRom.Core.Device/TeensyRom.Core.Device.csproj`
- Build full API: `dotnet build apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`

**Behavioral Expectations**:
- First discovery creates cache file
- Subsequent discovery with `fullScan=false` checks cached ports first
- `fullScan=true` ignores cache and scans all COM ports
- Devices in minimal mode are reset before validation

---

## 📤 Output

**Output Report Location**: `docs/projects/SERIAL-DISCOVERY-REFACTOR/reports/SERIAL-DISCOVERY-REFACTOR-TASK-01-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
