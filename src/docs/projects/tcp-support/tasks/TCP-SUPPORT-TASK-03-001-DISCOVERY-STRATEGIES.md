# TCP-SUPPORT Task Handoff: Create Discovery Strategy Pattern

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES
**Task Name**: Create Discovery Strategy Interface and Implementations
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Create `IDiscoveryStrategy` interface and `DiscoveredEndpoint` record type, along with `SerialDiscoveryStrategy` and `TcpDiscoveryStrategy` implementations. This separates "finding endpoints" from "validating devices" enabling both transports to use the same validation pipeline.

**Why**: The current `CartFinder` does too much - it discovers Serial ports AND validates them in one monolithic method. TCP discovery (`TcpDeviceFinder`) only returns IPs. By extracting discovery into strategies, both Serial and TCP return the same `DiscoveredEndpoint` type, allowing a unified validation pipeline.

**Success Criteria**:
- [ ] `IDiscoveryStrategy` interface created with `FindEndpoints(CancellationToken)` method
- [ ] `DiscoveredEndpoint` record created with `ConnectionType`, `Address`, `Port?` properties
- [ ] `SerialDiscoveryStrategy` wraps `SerialHelper.GetPorts()` and returns Serial endpoints
- [ ] `TcpDiscoveryStrategy` wraps `TcpDeviceFinder.ScanLocalSubnet()` and returns TCP endpoints
- [ ] Both strategies are lightweight - only discovery, no validation
- [ ] Unit tests pass for both strategies

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-01-003-DEVICE-FINDER: TcpDeviceFinder implementation complete
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity with ConnectionType complete

**Dependencies**:
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum
- `TeensyRom.Core.Device` namespace - `TcpDeviceFinder`, `ITcpDeviceFinder`
- `TeensyRom.Core.Serial` namespace - `SerialHelper.GetPorts()`

**Constraints**:
- Strategies must NOT do validation (version check, tag ensure) - only discovery
- Strategies must NOT create `TeensyRomDevice` instances - only return endpoints
- Both strategies return the same `DiscoveredEndpoint` type for unified processing

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Device/IDiscoveryStrategy.cs` - Discovery strategy interface
- `src/apps/api/src/TeensyRom.Core.Device/DiscoveredEndpoint.cs` - Endpoint record type
- `src/apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs` - Serial port discovery
- `src/apps/api/src/TeensyRom.Core.Device/TcpDiscoveryStrategy.cs` - Network discovery wrapper

**Files to Modify**:
- (None for this task - all new files)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Current monolithic discovery + validation
- `src/apps/api/src/TeensyRom.Core.Device/TcpDeviceFinder.cs` - Network scanning to wrap
- `src/apps/api/src/TeensyRom.Core.Serial/SerialHelper.cs` - `GetPorts()` method to wrap

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **IDiscoveryStrategy Interface**:
   ```csharp
   public interface IDiscoveryStrategy
   {
       Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct);
   }
   ```
   - Single method returning list of discovered endpoints
   - Accepts cancellation token for aborting long-running scans

2. **DiscoveredEndpoint Record**:
   ```csharp
   public record DiscoveredEndpoint(
       ConnectionType ConnectionType,
       string Address,      // "COM3" or "192.168.1.42"
       int? Port            // null for Serial, 80 for TCP
   );
   ```
   - Record type for immutability
   - `Address` is port name for Serial, IP address for TCP
   - `Port` is null for Serial, port number for TCP

3. **SerialDiscoveryStrategy**:
   - Constructor accepts `ILoggingService` (optional, for logging)
   - `FindEndpoints()` calls `SerialHelper.GetPorts()`
   - Returns list of `DiscoveredEndpoint` with `ConnectionType.Serial`
   - `Address` = COM port name, `Port` = null

4. **TcpDiscoveryStrategy**:
   - Constructor accepts `ITcpDeviceFinder` and `ILoggingService`
   - `FindEndpoints()` calls `_tcpFinder.ScanLocalSubnet(ct)`
   - Converts `TcpDiscoveredDevice` to `DiscoveredEndpoint`
   - Returns list with `ConnectionType.Tcp`, `Address` = IP, `Port` = port

**Anti-Patterns to Avoid**:
- Don't do version checking in strategies (that's validation, not discovery)
- Don't create transports in strategies (that's validation, not discovery)
- Don't call `tagger.EnsureTag()` in strategies
- Don't return `TeensyRomDevice` from strategies

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] `SerialDiscoveryStrategy.FindEndpoints()` returns list of COM ports as endpoints
- [ ] `SerialDiscoveryStrategy` endpoints have `ConnectionType.Serial`
- [ ] `SerialDiscoveryStrategy` endpoints have `Port = null`
- [ ] `TcpDiscoveryStrategy.FindEndpoints()` calls `ScanLocalSubnet()`
- [ ] `TcpDiscoveryStrategy` converts `TcpDiscoveredDevice` to `DiscoveredEndpoint`
- [ ] `TcpDiscoveryStrategy` endpoints have `ConnectionType.Tcp`
- [ ] `TcpDiscoveryStrategy` endpoints have correct `Address` and `Port`

**Integration Context**:
- Tests should verify both strategies can be run in parallel via `Task.WhenAll()`
- Tests should verify endpoint format is correct for both transports

**Behavioral Expectations**:
- Serial discovery returns all available COM ports
- TCP discovery returns all TeensyROM devices on local network
- Both strategies return same `DiscoveredEndpoint` type for unified processing
- Strategies are lightweight and fast (< 2 seconds total when run in parallel)

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [TcpDeviceFinder](../../../../src/apps/api/src/TeensyRom.Core.Device/TcpDeviceFinder.cs) - Network scanning implementation
- [CartFinder](../../../../src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs) - Current monolithic approach

**Related Tasks**:
- TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER: Refactor CartFinder (next) - will use these strategies
- TCP-SUPPORT-TASK-01-003-DEVICE-FINDER: TcpDeviceFinder (completed) - wrapped by TcpDiscoveryStrategy

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-001-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-001-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
