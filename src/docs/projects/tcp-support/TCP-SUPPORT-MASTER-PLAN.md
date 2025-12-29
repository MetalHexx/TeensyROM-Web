# TCP-SUPPORT Master Plan

## Project Overview

Enable TCP/IP network connectivity for TeensyROM devices while maintaining full backward compatibility with existing serial (COM port) connections. The design leverages the existing transport-agnostic `IObservableSerialPort` interface.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../../src/docs/CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../../src/docs/TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../../src/docs/STATE_STANDARDS.md)
- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../../src/docs/BACKEND_ARCHITECTURE.md)
- **API Client Generation**: [API_CLIENT_GENERATION.md](../../../src/docs/API_CLIENT_GENERATION.md)

---

## 🎯 Project Objective

Add TCP/IP network connection support to TeensyROM, enabling devices to be discovered and connected over a local network (WiFi or Ethernet) alongside existing USB/Serial connections. The system will automatically scan the local subnet for TeensyROM devices listening on port 80, persist discovered devices, and allow users to connect via either transport type interchangeably.

**User Value**: Users can place TeensyROM devices anywhere on their network without needing direct USB connection to the machine running the API. Devices show the same in the UI regardless of connection type (Serial or TCP), with appropriate icons (USB vs WiFi) and connection details (COM port vs IP address).

**Technical Foundation**: The existing `IObservableSerialPort` interface is already transport-agnostic, allowing the same state machine, command pipeline, and device management logic to work with either transport. The `ConnectionType` enum already exists with `Serial = 0` and `Tcp = 1` values.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: TCP Transport Infrastructure</h3></summary>

### Objective

Implement the core TCP transport layer that enables TeensyROM devices to communicate over TCP/IP instead of serial connections. This phase creates the foundational TCP client implementation, network utilities, and device discovery mechanisms needed before any UI or integration work.

### Key Deliverables

- [ ] `TcpObservablePort` class implementing `IObservableSerialPort` using TcpClient/NetworkStream
- [ ] `NetworkHelper` utilities for subnet detection and IP range generation
- [ ] `TcpDeviceFinder` for parallel network scanning with configurable parallelism
- [ ] Unit tests for TCP transport (mock NetworkStream)
- [ ] Integration tests for network discovery

### High-Level Tasks

1. **Create TCP Transport Implementation**: Implement `IObservableSerialPort` using `System.Net.Sockets.TcpClient` with connection management, health checks, and error handling
2. **Create Network Utilities**: Build `NetworkHelper` for local subnet detection, IP range generation, endpoint parsing/formatting
3. **Create Network Scanner**: Build `TcpDeviceFinder` with parallel IP scanning, TeensyROM ping validation, and device discovery
4. **Write Tests**: Unit tests for TCP transport and integration tests for network discovery

### Open Questions for Phase 1

- **TCP Connection Timeout**: What is the optimal default timeout for TCP connections during discovery (current draft: 200ms)?
- **Health Check Interval**: How frequently should TCP keepalive health checks occur (current draft: 5 seconds)?
- **Parallelism Degree**: What is the default MaxDegreeOfParallelism for network scanning (current draft: 256 threads)?

</details>

---

<details open>
<summary><h3>Phase 2: Domain Model Extensions & Factory</h3></summary>

### Objective

Extend the domain models to support both Serial and TCP connection types, and create a unified transport factory that can create either Serial or TCP connections based on device configuration. This phase bridges the TCP transport with the existing device management system.

### Key Deliverables

- [ ] Extended `Cart` entity with `ConnectionType`, `IpAddress`, `TcpPort` properties
- [ ] Extended `CartDto` API model with same connection properties
- [ ] `IDeviceTransportFactory` interface and implementation
- [ ] Updated `CartFinder` to set `ConnectionType.Serial` on discovered serial devices
- [ ] Updated DTO mapping in `CartDto.FromDevice()` to include connection properties

### High-Level Tasks

1. **Extend Cart Entity**: Add `ConnectionType`, `IpAddress`, `TcpPort` properties with `ConnectionDisplay` computed property
2. **Extend CartDto**: Add same properties to API DTO with `[Required]` attributes
3. **Create Transport Factory**: Build `IDeviceTransportFactory` with `CreateSerial()`, `CreateTcp()`, `Create(Cart)` methods
4. **Update CartFinder**: Set `ConnectionType.Serial` on all discovered serial devices
5. **Update DTO Mapping**: Include new connection properties in `FromDevice()` method

### Open Questions for Phase 2

- **Backwards Compatibility**: Should we maintain the existing `ISerialFactory` for backwards compatibility, or replace it entirely?

</details>

---

<details open>
<summary><h3>Phase 3: Device Manager Integration</h3></summary>

### Objective

Integrate TCP devices into the existing `DeviceConnectionManager` so they are discovered via network scanning and managed alongside serial devices. The auto-connect infrastructure should work for both transport types without modification.

### Key Deliverables

- [ ] Updated `DeviceConnectionManager` to scan for TCP devices via `TcpDeviceFinder`
- [ ] TCP device validation using existing version check mechanism
- [ ] TCP reconnection handling in `ConnectToNextPort()`
- [ ] Health check logging using `ConnectionDisplay` property (healthcheck already handled by `DeviceConnectionManager.StartHealthCheck()`)
- [ ] Integration tests with mixed Serial/TCP devices

### High-Level Tasks

1. **Scan for TCP Devices**: Modify `FindDevices()` to also call `TcpDeviceFinder.ScanLocalSubnet()` and discover TCP devices
2. **TCP Reconnection**: Update `ConnectToNextPort()` to handle TCP reconnection (retry same endpoint vs scanning ports)
3. **Update Logging**: Use `Cart.ConnectionDisplay` property in health check logging messages
4. **Register Services**: Add `ITcpDeviceFinder`, `IDeviceTransportFactory` to DI container
5. **Integration Testing**: Test with multiple devices on different transports simultaneously

### Open Questions for Phase 3

- **TCP Connection Retry**: How many retry attempts for TCP connection failures before marking device offline?

</details>

---

<details open>
<summary><h3>Phase 4: API Endpoint</h3></summary>

### Objective

Determine the API approach for TCP device discovery. The existing `FindDevicesEndpoint` (`/api/devices/`) already handles device discovery and returns all available devices. Consider whether to extend this endpoint or create a separate network scan endpoint.

**Key Considerations**:
- Network scanning can take ~1 second for /24 subnet and is more resource-intensive
- Serial port scanning is fast (<100ms) and happens automatically
- Network scanning will happen automatically during device discovery
- A separate endpoint allows users to trigger on-demand network scans for new devices

### Key Deliverables (Option A - Separate Endpoint)

- [ ] `ScanNetworkEndpoint` accepting optional `StartIp` and `EndIp` parameters
- [ ] `ScanNetworkRequest` and `ScanNetworkResponse` models
- [ ] Rate limiting for network scan endpoint
- [ ] OpenAPI documentation for the endpoint

### Key Deliverables (Option B - Extend Existing FindDevices)

- [ ] Extend `FindDevicesEndpoint` with optional `scanNetwork` query parameter
- [ ] Add network scanning logic when `scanNetwork=true`
- [ ] Update `FindDevicesResponse` to include any newly discovered TCP devices
- [ ] Rate limiting adjustment for network scanning
- [ ] OpenAPI documentation updates

### Open Questions for Phase 4

- **Endpoint Strategy**: Should we create a separate `/api/devices/scan-network` endpoint or extend the existing `/api/devices/` endpoint?
- **Default Scan Range**: If user doesn't specify IP range, should we auto-detect local subnet or require explicit range?

### High-Level Tasks

**Option A - Separate Endpoint**:
1. **Create Endpoint**: Implement `Post("/api/devices/scan-network")` endpoint
2. **Create Models**: Build request/response DTOs with validation
3. **Implement Scanning**: Call `TcpDeviceFinder.ScanNetwork()` and return discovered devices
4. **Add Rate Limiting**: Configure rate limiter to prevent abuse
5. **Update Documentation**: Add OpenAPI description and tags

**Option B - Extend Existing**:
1. **Extend Endpoint**: Add `scanNetwork` query parameter to existing `GET /api/devices/`
2. **Conditional Logic**: Execute network scan when `scanNetwork=true`
3. **Merge Results**: Combine newly discovered TCP devices with existing results
4. **Adjust Rate Limiting**: Update rate limiter to account for longer scan time
5. **Update Documentation**: Update OpenAPI description for the modified endpoint

</details>

---

<details open>
<summary><h3>Phase 5: Frontend Implementation</h3></summary>

### Objective

Update the Angular frontend to display connection type information and support TCP devices. The UI should show different icons (WiFi vs USB) and connection details (IP:port vs COM port) based on the device's connection type.

### Key Deliverables

- [ ] Extended `Device` interface with `connectionType`, `ipAddress`, `tcpPort` properties
- [ ] Updated `DomainMapper.toDevice()` to map new properties
- [ ] Dynamic device-item component showing connection icon and label
- [ ] Regenerated API client with updated DTOs
- [ ] Optional: Network scan dialog component for triggering scans

### High-Level Tasks

1. **Regenerate API Client**: Run `pnpm run generate:api-client` after backend changes
2. **Extend Device Interface**: Add `connectionType`, `ipAddress`, `tcpPort` properties
3. **Update Domain Mapper**: Map new DTO properties in `toDevice()` method
4. **Update Device Item Component**: Add computed properties for dynamic icon and connection display
5. **Update Component Template**: Show WiFi icon for TCP, USB icon for Serial

### Open Questions for Phase 5

- **Network Scan UI**: Should we create a dedicated network scan dialog, or integrate scanning into the existing refresh flow?

</details>

---

<details open>
<summary><h3>Phase 6: Testing & Documentation</h3></summary>

### Objective

Complete end-to-end testing with actual TCP connections and update documentation to reflect the new TCP connectivity option.

### Key Deliverables

- [ ] E2E tests for TCP device discovery and connection
- [ ] E2E tests for mixed Serial/TCP device scenarios
- [ ] Updated backend architecture documentation
- [ ] User documentation for TCP connections
- [ ] API documentation updates

### High-Level Tasks

1. **E2E Testing**: Test complete flow from network scan to device connection to operations
2. **Mixed Transport Tests**: Verify multiple devices on different transports work simultaneously
3. **Update Docs**: Document TCP support in architecture and user guides
4. **API Docs**: Update Scalar/OpenAPI documentation

### Open Questions for Phase 6

- **Test Hardware**: Do we have TeensyROM hardware with Ethernet/WiFi for testing, or do we need to mock TCP connections?

</details>

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **Transport Abstraction**: The existing `IObservableSerialPort` interface is already transport-agnostic, allowing TCP implementation without changes to state machine, command pipeline, or business logic
- **Polymorphic Factory**: `IDeviceTransportFactory` replaces `ISerialFactory` to create either Serial or TCP contexts based on `Cart.ConnectionType`
- **Two-Phase Discovery**: Network scan quickly finds devices (TCP ping validation), then existing version check performs full validation
- **On-Demand Scanning**: TCP devices are discovered via network scanning (~1 second for /24 subnet) - persistence can be added later if needed
- **Parallel Scanning**: Use `Parallel.ForEachAsync` with configurable parallelism for fast network discovery (~1 second for /24 subnet)
- **Fixed Port**: TeensyROM hardware listens on port 80, eliminating need for port configuration

### Integration Points

- **IObservableSerialPort Interface**: TCP implementation must implement all 30+ methods of this interface for compatibility with existing state machine
- **SerialStateContext**: Works unchanged with either `SimpleObservableSerialPort` or `TcpObservablePort` implementation
- **DeviceConnectionManager**: Singleton that manages devices, extended to scan for TCP devices via `TcpDeviceFinder`
- **ApplicationBootstrapService**: Auto-connect infrastructure works for both transports without modification (uses `FindDevices()`)
- **CartFinder**: Serial discovery unchanged, but now sets `ConnectionType.Serial` on discovered devices
- **CartDto**: Extended to include connection type information for frontend display

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] `TcpObservablePort` connection lifecycle (connect, disconnect, reconnect)
- [ ] `TcpObservablePort` read/write operations via NetworkStream
- [ ] `TcpObservablePort` lock/unlock behavior
- [ ] `TcpObservablePort` health check mechanism
- [ ] `NetworkHelper.GetLocalSubnetRange()` for various network configurations
- [ ] `NetworkHelper.GenerateIpRange()` for different subnet masks
- [ ] `NetworkHelper.ParseEndpoint()` and `FormatEndpoint()`
- [ ] `TcpDeviceFinder` with mocked TCP connections

### Integration Tests

- [ ] `TcpDeviceFinder` with real TCP connections to test TeensyROM device
- [ ] `DeviceConnectionManager.FindDevices()` scans for both Serial and TCP devices
- [ ] `DeviceTransportFactory.Create()` creates correct transport based on `ConnectionType`
- [ ] `CartDto.FromDevice()` maps all connection properties correctly

### E2E Tests

- [ ] Network scan discovers TCP devices on local subnet
- [ ] TCP devices appear in device list alongside serial devices
- [ ] Connecting to TCP device works identically to serial device
- [ ] All device operations (ping, logs, file operations) work over TCP
- [ ] Device-item component shows correct icon (WiFi vs USB) and connection details
- [ ] Mixed transport scenario: Serial device + TCP device connected simultaneously

---

## ✅ Success Criteria

- [ ] TCP devices can be discovered on local network via scan (~1 second for /24 subnet)
- [ ] All existing device operations (connect, disconnect, ping, logs, reset) work unchanged over TCP
- [ ] Device-item component shows connection type with appropriate icon (WiFi/USB)
- [ ] Connection details display correctly (IP:port for TCP, COM port for Serial)
- [ ] Network scanning completes in acceptable time for typical networks
- [ ] Auto-connect works for both Serial and TCP devices
- [ ] All unit, integration, and E2E tests pass successfully
- [ ] API documentation updated with TCP support information
- [ ] Feature ready for production deployment

---

## 🎭 User Scenarios

### Discovery and Connection Scenarios

<details open>
<summary><strong>Scenario 1: Discover TCP Devices on Network</strong></summary>

```gherkin
Given a TeensyROM device is connected to the network via WiFi or Ethernet
When the API scans for devices
Then the local network is scanned for TCP devices
And serial ports are scanned for Serial devices
And both device types appear in the device list
```

</details>

<details open>
<summary><strong>Scenario 2: Trigger Network Scan</strong></summary>

```gherkin
Given a user wants to discover new TCP devices
When the user triggers a network scan via the API endpoint
Then the local subnet is scanned in parallel
And TeensyROM devices responding on port 80 are discovered
And discovered devices appear in the device list
```

</details>

<details open>
<summary><strong>Scenario 3: Connect to TCP Device</strong></summary>

```gherkin
Given a TCP device is discovered and showing in the device list
When the user clicks the connect button on the device
Then a TCP connection is established to the device's IP address on port 80
And the device state changes to Connected
And all device operations (ping, logs, file operations) work normally
```

</details>

---

### UI Display Scenarios

<details open>
<summary><strong>Scenario 4: Serial Device Display</strong></summary>

```gherkin
Given a device is connected via Serial (COM port)
When the device-item component renders
Then the component shows a USB icon
And the connection label displays "Port: COM3"
And the device shows as Connected when successfully connected
```

</details>

<details open>
<summary><strong>Scenario 5: TCP Device Display</strong></summary>

```gherkin
Given a device is connected via TCP/IP
When the device-item component renders
Then the component shows a WiFi icon
And the connection label displays "IP Address: 192.168.1.42:80"
And the device shows as Connected when successfully connected
```

</details>

---

### Mixed Transport Scenarios

<details open>
<summary><strong>Scenario 6: Multiple Devices on Different Transports</strong></summary>

```gherkin
Given two TeensyROM devices exist
And Device A is connected via Serial (COM3)
And Device B is connected via TCP (192.168.1.42:80)
When both devices are connected
Then both devices appear in the device list
And Device A shows USB icon with "Port: COM3"
And Device B shows WiFi icon with "IP Address: 192.168.1.42:80"
And operations on Device A do not affect Device B
And operations on Device B do not affect Device A
```

</details>

---

### Edge Cases and Error Handling

<details open>
<summary><strong>Scenario 7: TCP Device Not Responding</strong></summary>

```gherkin
Given a TCP device was previously discovered and persisted
When the API starts up and the device is offline
Then the device is marked as unavailable
And the device shows appropriate connection status in UI
And the device can be reconnected when it comes online
```

</details>

<details open>
<summary><strong>Scenario 8: Network Scan Finds No Devices</strong></summary>

```gherkin
Given a network scan is triggered
When no TeensyROM devices respond on the network
Then the scan completes successfully
And an appropriate message is returned indicating no devices found
And the existing device registry is preserved
```

</details>

---

## 📝 Notes

### Design Considerations

- **Performance**: Parallel scanning with 256 threads achieves ~1 second scan time for /24 subnet
- **Persistence**: TCP device persistence deferred as future enhancement - will evaluate scanning performance first
- **Health Check**: Device health monitoring is already handled by `DeviceConnectionManager.StartHealthCheck()` - works for both Serial and TCP devices
- **Backwards Compatibility**: All existing serial functionality remains unchanged, `ISerialFactory` kept for compatibility
- **Fixed Port**: TeensyROM hardware listens on port 80, eliminating port configuration complexity
- **Connection Type**: `ConnectionType` enum already exists in codebase with Serial and Tcp values

### Future Enhancement Ideas

- **TCP Device Persistence**: Store discovered TCP devices to avoid re-scanning on startup (deferred pending performance evaluation)
- **mDNS/Bonjour Discovery**: Zero-config network discovery (requires firmware changes)
- **Manual IP Entry**: UI for adding TCP devices without scanning
- **Connection Quality Metrics**: Show latency/packet loss for TCP connections
- **WebSocket Upgrade**: HTTP to WebSocket for real-time events over TCP
- **Multiple Subnet Scanning**: Scan all active network interfaces simultaneously

---

## 📚 Related Documentation

- **TCP Brainstorming**: [`TCP_BRAINSTORMING.md`](../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md) - Original design discussion
- **Backend Architecture**: [`BACKEND_ARCHITECTURE.md`](../../../src/docs/BACKEND_ARCHITECTURE.md) - Complete backend patterns
- **Coding Standards**: [`CODING_STANDARDS.md`](../../../src/docs/CODING_STANDARDS.md) - Coding conventions
- **Testing Standards**: [`TESTING_STANDARDS.md`](../../../src/docs/TESTING_STANDARDS.md) - Testing approaches
