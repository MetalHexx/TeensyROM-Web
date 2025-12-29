# TCP-SUPPORT Phase 1: TCP Transport Infrastructure

## 🎯 Objective

Implement the core TCP transport layer that enables TeensyROM devices to communicate over TCP/IP instead of serial connections. This phase creates the foundational TCP client implementation, network utilities, and device discovery mechanisms needed before any UI or integration work.

**Value**: Completing this phase provides all the building blocks needed for TCP connectivity. The subsequent phases will integrate these components into the existing device management system and add UI support.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md) - High-level feature plan
- [ ] [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md) - Original design discussion
- [ ] [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - Backend patterns and MediatR flow

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [ ] [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [IObservableSerialPort Interface](../../../../src/apps/api/src/TeensyRom.Core/Abstractions/IObservableSerialPort.cs) - Contract to implement
- [ ] [SimpleObservableSerialPort](../../../../src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs) - Reference implementation

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core.Serial/
├── TcpObservablePort.cs                    ✨ New - TCP transport implementation
├── NetworkHelper.cs                        ✨ New - Network utility functions
├── SimpleObservableSerialPort.cs           📖 Read - Reference implementation
└── SerialFactory.cs                        📖 Read - Existing factory pattern

apps/api/src/TeensyRom.Core.Device/
├── TcpDeviceFinder.cs                      ✨ New - Network scanner
├── DeviceConnectionManager.cs              📖 Read - Will be modified in Phase 3
└── CartFinder.cs                           📖 Read - Serial discovery reference

apps/api/src/TeensyRom.Core.Tests/ (or equivalent test project)
├── Serial/
│   ├── TcpObservablePortTests.cs          ✨ New - TCP transport unit tests
│   ├── NetworkHelperTests.cs               ✨ New - Network utility tests
│   └── TcpDeviceFinderTests.cs             ✨ New - Discovery tests (with mocks)
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **class names**, **method names**, **interface names**, **property names**
> - Small code snippets (2-5 lines) are OK for critical type definitions only
> - **NO large code blocks** - link to standards docs or existing implementations instead
> - Prefer describing behavior over showing implementation
>
> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable behaviors, not implementation details
> - Include tests **within each task** as work progresses, not at the end
> - See [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) for behavioral testing guidance

---

<details open>
<summary><h3>Task 1: Create TCP Transport Implementation (TcpObservablePort)</h3></summary>

**Purpose**: Implement the `IObservableSerialPort` interface using TCP/IP networking, providing a transport-compatible replacement for `SimpleObservableSerialPort` that communicates over `TcpClient`/`NetworkStream` instead of `SerialPort`.

**Related Documentation:**

- [IObservableSerialPort Interface](../../../../src/apps/api/src/TeensyRom.Core/Abstractions/IObservableSerialPort.cs) - Contract to implement (30+ methods)
- [SimpleObservableSerialPort](../../../../src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs) - Reference implementation pattern
- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md#proposed-architecture) - Design discussion

**Implementation Subtasks:**

- [ ] **Create Class**: Create `TcpObservablePort` class in `TeensyRom.Core.Serial` namespace implementing `IObservableSerialPort`
- [ ] **Constructor**: Accept `ILoggingService` and `IAlertService` dependencies (same as `SimpleObservableSerialPort`)
- [ ] **TcpClient Field**: Add private `TcpClient _tcpClient` field for connection management
- [ ] **NetworkStream Field**: Add private `NetworkStream? _stream` field for I/O operations
- [ ] **SetPort Method**: Implement `SetPort(string endpoint)` to parse "ip:port" format and store connection parameters
- [ ] **OpenPort Method**: Implement `OpenPort()` to establish TCP connection with configurable timeout (default: 2000ms)
- [ ] **ClosePort Method**: Implement `ClosePort()` to close TCP client and dispose NetworkStream
- [ ] **IsOpen Property**: Implement `IsOpen` to check `TcpClient.Connected` and stream state
- [ ] **Write Methods**: Implement `Write(byte[], int, int)` and `Write(string)` using NetworkStream
- [ ] **Read Methods**: Implement `Read(byte[], int, int)`, `ReadByte()`, and `ReadSerialAsString()` using NetworkStream
- [ ] **Lock/Unlock**: Implement `Lock()` and `Unlock()` to control data reception (use semaphore or flag)
- [ ] **ClearBuffers**: Implement `ClearBuffers()` (TCP doesn't have buffers, so this may be no-op or flush stream)
- [ ] **EnsureConnection**: Implement `EnsureConnection(int waitTimeMs)` to reconnect if dropped
- [ ] **State Observable**: Implement `State` observable using `BehaviorSubject<Type>` to emit state changes
- [ ] **Ports Observable**: Implement `Ports` observable returning empty array (TCP has no port enumeration)
- [ ] **SendIntBytes**: Implement using NetworkStream Write
- [ ] **ReadIntBytes**: Implement using NetworkStream Read
- [ ] **SendSignedChar/SendSignedShort**: Implement using NetworkStream Write
- [ ] **Error Handling**: Wrap TCP exceptions and map to appropriate error states

**Testing Subtask:**

- [ ] **Write Tests**: Test TCP transport behaviors (see Testing section below)

**Key Implementation Notes:**

- **Endpoint Format**: Use "ip:port" format (e.g., "192.168.1.42:80") for `SetPort`
- **Connection Timeout**: Default to 2000ms for connection attempts, make configurable
- **Error Handling**: Handle `SocketException`, `IOException`, `TimeoutException` appropriately
- **Port Enumeration**: Return empty array from `Ports` observable (TCP has no enumerable ports)
- **State Machine**: The `SerialStateContext` works unchanged with this implementation

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Connection**: `OpenPort()` successfully connects to valid IP:port and returns connection string
- [ ] **Connection Failure**: `OpenPort()` throws appropriate exception for invalid/unreachable IP
- [ ] **Write**: `Write()` sends data correctly over TCP connection
- [ ] **Read**: `Read()` receives data correctly from TCP connection
- [ ] **IsOpen**: `IsOpen` returns true when connected, false when disconnected
- [ ] **Close**: `ClosePort()` closes connection and cleans up resources
- [ ] **Lock/Unlock**: `Lock()` prevents data reception, `Unlock()` resumes it
- [ ] **Reconnection**: `EnsureConnection()` reconnects if connection dropped

**Testing Reference:**

- See [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) for behavioral testing patterns
- Mock `NetworkStream` for unit tests (don't use real TCP connections in unit tests)

</details>

---

<details open>
<summary><h3>Task 2: Create Network Utilities (NetworkHelper)</h3></summary>

**Purpose**: Provide utility functions for detecting the local subnet, generating IP ranges for scanning, and parsing/formatting endpoint strings.

**Related Documentation:**

- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md#smart-defaults) - Subnet detection design
- [.NET NetworkInterface](https://learn.microsoft.com/en-us/dotnet/api/system.net.networkinformation.networkinterface) - API reference

**Implementation Subtasks:**

- [ ] **Create Class**: Create static `NetworkHelper` class in `TeensyRom.Core.Serial` namespace
- [ ] **GetLocalSubnetRange Method**: Implement `GetLocalSubnetRange()` returning `(IPAddress Start, IPAddress End)?`
  - Use `NetworkInterface.GetAllNetworkInterfaces()` to get active interfaces
  - Filter for `OperationalStatus.Up` and non-loopback
  - Get IPv4 address and subnet mask from `UnicastAddresses`
  - Calculate network range: `(IP & Mask)` to `(IP | ~Mask)`
  - Return first valid interface's range
- [ ] **GenerateIpRange Method**: Implement `GenerateIpRange(IPAddress start, IPAddress end)` returning `List<IPAddress>`
  - Convert IP addresses to 32-bit integers
  - Generate all addresses between start and end (inclusive)
  - Convert back to IPAddress objects
  - Handle /24 subnet (~254 addresses) efficiently
- [ ] **FormatEndpoint Method**: Implement `FormatEndpoint(string ip, int port)` returning formatted "ip:port" string
- [ ] **ParseEndpoint Method**: Implement `ParseEndpoint(string endpoint)` returning `(string Ip, int Port)?`
  - Split on ":" to separate IP and port
  - Parse port as integer
  - Return null if format is invalid

**Testing Subtask:**

- [ ] **Write Tests**: Test network utility behaviors

**Key Implementation Notes:**

- **Subnet Calculation**: Use bitwise AND for network address: `networkAddress = ipAddress & subnetMask`
- **Broadcast Calculation**: Use bitwise OR for broadcast: `broadcastAddress = ipAddress | ~subnetMask`
- **Multiple Interfaces**: If multiple active interfaces exist, return the first non-loopback one
- **Error Handling**: Return `null` from `GetLocalSubnetRange()` if no valid interface found

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Subnet Detection**: `GetLocalSubnetRange()` returns correct range for typical /24 network
- [ ] **No Network**: `GetLocalSubnetRange()` returns null when no active network interface
- [ ] **IP Range**: `GenerateIpRange()` generates all addresses between start and end
- [ ] **Single IP**: `GenerateIpRange()` with start==end returns single-element list
- [ ] **Format Endpoint**: `FormatEndpoint()` produces valid "ip:port" string
- [ ] **Parse Endpoint**: `ParseEndpoint()` correctly parses valid "ip:port" strings
- [ ] **Parse Invalid**: `ParseEndpoint()` returns null for invalid formats

</details>

---

<details open>
<summary><h3>Task 3: Create Network Scanner (TcpDeviceFinder)</h3></summary>

**Purpose**: Scan the local network in parallel to discover TeensyROM devices listening on TCP port 80.

**Task Handoff**: [TCP-SUPPORT-TASK-01-003-DEVICE-FINDER.md](../tasks/TCP-SUPPORT-TASK-01-003-DEVICE-FINDER.md)

**Related Documentation:**

- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md#two-phase-discovery-strategy) - Discovery design
- [.NET Parallel.ForEachAsync](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.parallel.foreachasync) - API reference

**Implementation Subtasks:**

- [ ] **Create Interface**: Create `ITcpDeviceFinder` interface with methods:
  - `Task<List<TcpDiscoveredDevice>> ScanNetwork(IPAddress startIp, IPAddress endIp, CancellationToken ct)`
  - `Task<List<TcpDiscoveredDevice>> ScanLocalSubnet(CancellationToken ct)`
- [ ] **Implement Class**: Create `TcpDeviceFinder` implementing `ITcpDeviceFinder`
- [ ] **Inject Dependencies**: Accept `ILoggingService` in constructor (no TCP registry yet)
- [ ] **ScanLocalSubnet Method**: Implement to call `NetworkHelper.GetLocalSubnetRange()` then `ScanNetwork()`
- [ ] **ScanNetwork Method**: Implement parallel scanning:
  - Generate IP range using `NetworkHelper.GenerateIpRange()`
  - Use `Parallel.ForEachAsync()` with `MaxDegreeOfParallelism = 256`
  - For each IP: attempt TCP connection to port 80 with 200ms timeout
  - Send TeensyROM ping token (0x6455) via `TcpObservablePort`
  - Read response and check if it contains "teensyrom" or "busy"
  - Add successful discoveries to `ConcurrentBag<TcpDiscoveredDevice>`
  - Return list of discovered devices
- [ ] **IsTeensyRom Validation**: Create method to validate device response contains expected strings

**Testing Subtask:**

- [ ] **Write Tests**: Test network scanner behaviors (with mocked TCP connections)

**Key Implementation Notes:**

- **Parallelism**: Use `new ParallelOptions { MaxDegreeOfParallelism = 256, CancellationToken = ct }`
- **Timeout**: Use 200ms connection timeout per IP for fast scanning
- **CancellationToken**: Pass through to all async operations for cancellation
- **Ping Token**: Use existing TeensyROM ping token (0x6455) from `TeensyToken` enum
- **Response Validation**: Check response string contains "teensyrom" (case-insensitive) or "busy"

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Scan Network**: `ScanNetwork()` returns all TeensyROM devices in range (mock TCP)
- [ ] **No Devices**: `ScanNetwork()` returns empty list when no devices respond (mock TCP)
- [ ] **Scan Local Subnet**: `ScanLocalSubnet()` uses detected subnet range
- [ ] **Cancellation**: `ScanNetwork()` respects CancellationToken and stops scanning
- [ ] **Parallel Execution**: Multiple IPs are scanned concurrently (verify with timing test)

</details>

---

<details open>
<summary><h3>Task 4: Write Integration Tests</h3></summary>

**Purpose**: Ensure all components work together correctly and handle real-world scenarios.

**Task Handoff**: [TCP-SUPPORT-TASK-01-004-INTEGRATION.md](../tasks/TCP-SUPPORT-TASK-01-004-INTEGRATION.md)

**Related Documentation:**

- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Testing patterns
- [Existing Test Patterns](../../../../src/apps/api/src/TeensyRom.Api.Tests.Integration) - Reference test patterns

**Implementation Subtasks:**

- [ ] **Create Test Project**: Create `TeensyRom.Core.Serial.Tests.Integration` project
- [ ] **TcpObservablePort Integration Tests**: Test with real local TCP server (echo server)
- [ ] **NetworkHelper Integration Tests**: Test with real network interfaces
- [ ] **TcpDeviceFinder Integration Tests**: Test with actual TCP connections if TeensyROM hardware available
- [ ] **Test Organization**: Follow xUnit, AutoFixture, FluentAssertions patterns

**Testing Subtask:**

- [ ] **Write Tests**: Complete integration test suite

**Key Implementation Notes:**

- **Use Real TCP**: For integration tests, use actual `TcpClient` connections to localhost
- **Echo Server**: Create a simple echo server for testing
- **TeensyROM Hardware**: Tests requiring hardware should use `[Fact(Skip = "Requires TeensyROM hardware")]`

**Testing Focus for Task 4:**

**Integration Behaviors to Test:**

- [ ] **TCP Transport**: `TcpObservablePort` can connect to local echo server and exchange data
- [ ] **Network Discovery**: `NetworkHelper.GetLocalSubnetRange()` works with real interfaces
- [ ] **IP Range Generation**: `NetworkHelper.GenerateIpRange()` generates correct ranges
- [ ] **Endpoint Parsing**: `ParseEndpoint()` and `FormatEndpoint()` round-trip correctly
- [ ] **Connection Timeout**: Verify timeout behavior when connecting to non-routable IP

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**New Implementation Files:**

- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs`
- `src/apps/api/src/TeensyRom.Core.Serial/NetworkHelper.cs`
- `src/apps/api/src/TeensyRom.Core.Device/TcpDiscoveredDevice.cs`
- `src/apps/api/src/TeensyRom.Core.Device/ITcpDeviceFinder.cs`
- `src/apps/api/src/TeensyRom.Core.Device/TcpDeviceFinder.cs`

**New Test Files:**

- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Unit/Serial/TcpObservablePortTests.cs`
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Unit/Serial/NetworkHelperTests.cs`
- `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/TcpDeviceFinderTests.cs`
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/TcpTransportIntegrationTests.cs`
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/NetworkHelperIntegrationTests.cs`

**New Task Handoff Files:**

- `src/docs/projects/tcp-support/tasks/TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT.md` (Task 1 - Complete)
- `src/docs/projects/tcp-support/tasks/TCP-SUPPORT-TASK-01-002-NETWORK-HELPER.md` (Task 2)
- `src/docs/projects/tcp-support/tasks/TCP-SUPPORT-TASK-01-003-DEVICE-FINDER.md` (Task 3)
- `src/docs/projects/tcp-support/tasks/TCP-SUPPORT-TASK-01-004-INTEGRATION.md` (Task 4)

**Files to Review (Context Only):**

- `src/apps/api/src/TeensyRom.Core/Abstractions/IObservableSerialPort.cs`
- `src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs`
- `src/apps/api/src/TeensyRom.Core.Serial/SerialFactory.cs`
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs`

---

## 📝 Testing Summary

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Where Tests Are Written

**Tests are embedded in each task above** with:
- **Testing Subtask**: Checkbox in the task's subtask list
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run tests for specific project
npx nx test TeensyRom.Core

# Run tests in watch mode during development
npx nx test TeensyRom.Core --watch

# Run all tests
npx nx run-many --target=test --all
```

---

## ✅ Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] `TcpObservablePort` implements all 30+ methods of `IObservableSerialPort`
- [ ] `NetworkHelper` can detect local subnet and generate IP ranges
- [ ] `TcpDeviceFinder` can scan IP range and discover TeensyROM devices
- [ ] All implementations follow [Coding Standards](../../../../src/docs/CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No C# compilation errors or warnings
- [ ] Code follows existing C# patterns and conventions
- [ ] Code formatting is consistent
- [ ] No console errors when running tests

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 2 (Domain Model Extensions)

---

## 📝 Notes & Considerations

### Design Decisions

- **TcpClient vs Sockets**: Use `TcpClient` for simplicity (built-in timeout support, manages NetworkStream)
- **Parallelism**: 256 threads for scanning balances speed vs resource usage (~1 second for /24 subnet)
- **No Initial Persistence**: TCP device discovery will scan the network each time (~1 second) - persistence can be added later if performance is an issue
- **Fixed Port 80**: TeensyROM hardware listens on port 80, no user configuration needed

### Implementation Constraints

- **Network Dependence**: TCP discovery requires network connectivity; no devices found if offline
- **Firewall**: Windows Firewall may block scanning; consider firewall rules for production
- **Subnet Limitation**: Only scans local subnet by default; /16 networks require longer scan time

### Future Enhancements

- **TCP Device Persistence**: Store discovered devices to avoid re-scanning on startup (deferred pending performance evaluation)
- **Multiple Subnets**: Scan all active network interfaces simultaneously
- **mDNS/Bonjour**: Zero-config discovery (requires firmware changes)
- **Manual IP Entry**: UI for adding TCP devices without scanning
- **Connection Quality**: Show latency/packet loss metrics for TCP connections

### Open Questions from Planning

- **TCP Connection Timeout**: Default to 200ms for discovery; configurable via constructor parameter
- **Parallelism Degree**: Default to 256 threads; configurable via `ParallelOptions`

---

## 🎓 Next Steps After Phase 1

Upon completion of Phase 1, the following tasks will be ready:

1. **Phase 2, Task 1**: Extend `Cart` entity with connection properties
2. **Phase 2, Task 3**: Create `IDeviceTransportFactory` using `TcpObservablePort`
3. **Phase 3, Task 1**: Integrate `TcpDeviceFinder` into `DeviceConnectionManager` for network scanning

The TCP transport infrastructure will be complete and ready for integration with the existing device management system.
