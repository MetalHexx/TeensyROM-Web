# TCP-SUPPORT Task Handoff: Network Scanner

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-01-004-DEVICE-FINDER
**Task Name**: Create Network Scanner (TcpDeviceFinder)
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Create `TcpDeviceFinder` service that scans the local network in parallel to discover TeensyROM devices listening on TCP port 80, returning a list of discovered TCP devices with their IP addresses and response information.

**Why**: Network scanning enables automatic discovery of TeensyROM devices connected via WiFi or Ethernet. The scanner uses parallel TCP connections to quickly identify devices on the local subnet.

**Success Criteria**:
- [ ] `ITcpDeviceFinder` interface created with `ScanNetwork` and `ScanLocalSubnet` methods
- [ ] `TcpDeviceFinder` class implements the interface using `Parallel.ForEachAsync`
- [ ] Scanning uses `MaxDegreeOfParallelism = 256` for fast discovery (~1 second for /24 subnet)
- [ ] TCP connections use 200ms timeout per IP address
- [ ] TeensyROM ping token (0x6455) is sent to validate devices
- [ ] Response validation checks for "teensyrom" or "busy" (case-insensitive)
- [ ] `CancellationToken` is passed through for cancellation
- [ ] Unit tests pass with mocked TCP connections
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: `TcpObservablePort` implementation completed
- TCP-SUPPORT-TASK-01-002-NETWORK-HELPER: `NetworkHelper` utilities completed

**Dependencies**:
- `System.Net.Sockets` namespace for TcpClient connections
- `System.Threading.Tasks` namespace for `Parallel.ForEachAsync`
- `TeensyRom.Core.Serial` namespace for `TcpObservablePort`, `NetworkHelper`, `TeensyToken`
- `TeensyRom.Core.Device` namespace for device models
- `TeensyRom.Core.Logging` for `ILoggingService`

**Constraints**:
- Must use parallel scanning for performance (~1 second for /24 subnet)
- Must respect `CancellationToken` for early termination
- Must use 200ms connection timeout per IP (configurable via constructor)
- Must use TeensyROM ping token (0x6455) for device validation
- Must be thread-safe (multiple IPs scanned concurrently)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Device/TcpDiscoveredDevice.cs` - Discovered device model
- `src/apps/api/src/TeensyRom.Core.Device/ITcpDeviceFinder.cs` - Scanner interface
- `src/apps/api/src/TeensyRom.Core.Device/TcpDeviceFinder.cs` - Scanner implementation
- `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/TcpDeviceFinderTests.cs` - Unit tests

**Files to Modify**:
- (None for this task - DI registration happens in Phase 3)

**Files to Review**:
- `src/docs/projects/tcp/TCP_BRAINSTORMING.md#two-phase-discovery-strategy` - Discovery design
- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - TCP transport for scanning
- `src/apps/api/src/TeensyRom.Core.Serial/TeensyToken.cs` - Ping token (0x6455)
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Serial discovery reference pattern

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns
- [.NET Parallel.ForEachAsync](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.parallel.foreachasync) - API reference

**Key Requirements**:

1. **TcpDiscoveredDevice Model**:
   - Namespace: `TeensyRom.Core.Device`
   - Properties: `string IpAddress`, `int Port` (default: 80), `string? Response`, `DateTime DiscoveredAt`
   - Purpose: Lightweight DTO for discovered TCP devices (not yet converted to `Cart` entity)

2. **ITcpDeviceFinder Interface**:
   ```csharp
   public interface ITcpDeviceFinder
   {
       Task<List<TcpDiscoveredDevice>> ScanNetwork(IPAddress startIp, IPAddress endIp, CancellationToken ct);
       Task<List<TcpDiscoveredDevice>> ScanLocalSubnet(CancellationToken ct);
   }
   ```
   - `ScanNetwork`: Scans specified IP range (inclusive)
   - `ScanLocalSubnet`: Auto-detects local subnet and scans it

3. **TcpDeviceFinder Implementation**:
   - Constructor accepts `ILoggingService` dependency (logging only, no TCP registry yet)
   - `ScanLocalSubnet`: Calls `NetworkHelper.GetLocalSubnetRange()`, then delegates to `ScanNetwork()`
   - `ScanNetwork`: Implements parallel scanning using `Parallel.ForEachAsync()`
   - Use `new ParallelOptions { MaxDegreeOfParallelism = 256, CancellationToken = ct }`
   - For each IP: attempt TCP connection to port 80 with 200ms timeout
   - On successful connection: send ping token (0x6455) and read response
   - Use `ConcurrentBag<TcpDiscoveredDevice>` for thread-safe collection
   - Return `List<TcpDiscoveredDevice>` with all discovered devices

4. **Ping Validation Logic**:
   - Create `TcpObservablePort` instance for each IP
   - Call `SetPort($"{ip}:80")` then `OpenPort()` to establish connection
   - Send ping token: call `SendIntBytes((ushort)TeensyToken.Ping.Value, 2)` via port
   - Read response: call `ReadSerialAsString(100)` to get device response
   - Validate response contains "teensyrom" or "busy" (case-insensitive)
   - Add to results if validation passes
   - Dispose port after each IP attempt

5. **Error Handling**:
   - Catch and log `SocketException`, `IOException`, `TimeoutException` for each IP
   - Don't let single IP failure stop the scan
   - Log each connection attempt at appropriate level
   - Respect `CancellationToken` throughout

6. **Cancellation Support**:
   - Pass `CancellationToken` to `Parallel.ForEachAsync`
   - Pass `CancellationToken` to all async operations
   - Throw `OperationCanceledException` if cancelled mid-scan

**Anti-Patterns to Avoid**:
- Don't create a new `TcpObservablePort` for each IP (use per-IP instances)
- Don't block on async operations (use proper async/await)
- Don't forget to dispose TCP connections after each IP
- Don't throw exceptions for individual IP failures (log and continue)
- Don't scan without timeout (use 200ms per IP)
- Don't ignore `CancellationToken`

---

**Test Coverage Required**:

**Unit Tests** (mock TCP connections using test doubles):
- [ ] `ScanLocalSubnet()` uses detected subnet range from `NetworkHelper`
- [ ] `ScanNetwork()` returns all TeensyROM devices in range (mock TCP)
- [ ] `ScanNetwork()` returns empty list when no devices respond (mock TCP)
- [ ] `ScanNetwork()` respects `CancellationToken` and stops scanning
- [ ] `ScanNetwork()` validates responses containing "teensyrom"
- [ ] `ScanNetwork()` validates responses containing "busy"
- [ ] `ScanNetwork()` rejects responses not matching expected pattern
- [ ] `ScanNetwork()` handles multiple devices discovered concurrently
- [ ] Individual IP connection failures don't stop the scan
- [ ] Parallel execution scans multiple IPs concurrently (timing test optional)

**Integration Context**:
- Tests should use mocked `TcpObservablePort` to avoid real network calls
- Tests should verify `NetworkHelper` is called correctly in `ScanLocalSubnet()`
- Tests should verify ping token is sent and responses are validated

**Behavioral Expectations**:
- Scanning completes in ~1 second for typical /24 subnet (256 IPs)
- All devices responding correctly on port 80 are discovered
- Non-TeensyROM devices are filtered out by ping validation
- Scan can be cancelled via `CancellationToken`
- Scan is thread-safe (multiple IPs scanned concurrently)

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-1) - Overall project plan
- [Phase 1 Plan](../phases/TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE.md) - Current phase details
- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md) - Design discussion
- [Task 1 Report](../reports/TCP-SUPPORT-TASK-01-001-REPORT.md) - TcpObservablePort implementation
- [Task 2 Report](../reports/TCP-SUPPORT-TASK-01-002-REPORT.md) - NetworkHelper implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: TCP transport (completed) - used for scanning
- TCP-SUPPORT-TASK-01-002-NETWORK-HELPER: Network utilities (completed) - subnet detection
- TCP-SUPPORT-TASK-01-006-INTEGRATION: Integration tests (next) - end-to-end testing

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-01-003-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-01-003-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
