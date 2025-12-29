# TCP-SUPPORT Task Handoff: Refactor CartFinder with Unified Pipeline

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER
**Task Name**: Refactor CartFinder to Orchestrate Discovery Strategies
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Large

---

### INPUT_DOC

**What**: Refactor `CartFinder` to accept `IEnumerable<IDiscoveryStrategy>`, run all strategies in parallel, and apply a unified validation pipeline (create transport, version check, tag ensure, create device) to all discovered endpoints regardless of transport type.

**Why**: The current `CartFinder` only handles Serial discovery. By accepting discovery strategies via DI and running them in parallel, it can discover both Serial and TCP devices. The unified validation pipeline eliminates code duplication - both transports go through the same version check, tag ensure, and device creation logic.

**Success Criteria**:
- [ ] Constructor accepts `IEnumerable<IDiscoveryStrategy>` via DI
- [ ] `DiscoverAllEndpoints()` runs all strategies in parallel via `Task.WhenAll()`
- [ ] `ValidateAndCreateDevice()` unified pipeline handles both Serial and TCP endpoints
- [ ] Pipeline creates correct transport based on `endpoint.ConnectionType`
- [ ] Pipeline sets `Cart.ConnectionType`, `ComPort`/`IpAddress`, `TcpPort` correctly
- [ ] Existing DeviceId resolution and storage logic preserved
- [ ] Integration tests pass for mixed Serial + TCP discovery

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES: Discovery strategies implemented
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: IDeviceTransportFactory implemented
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity with ConnectionType

**Dependencies**:
- `TeensyRom.Core.Device` namespace - `IDiscoveryStrategy`, `DiscoveredEndpoint`
- `TeensyRom.Core.Serial` namespace - `IDeviceTransportFactory`
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum
- `TeensyRom.Core.Storage` namespace - `IStorageFactory`, `ICartTagger`
- `TeensyRom.Core.Serial` namespace - `IFwVersionChecker`
- `MediatR` - `IMediator` for version check commands

**Constraints**:
- Must NOT break existing Serial device discovery
- Must NOT modify DeviceId resolution logic
- Must NOT modify storage tag ensure logic
- Version check and tag ensure work for both transports (already transport-agnostic)

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Refactor to orchestrate strategies

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Current implementation to refactor
- `src/apps/api/src/TeensyRom.Core.Device/IDiscoveryStrategy.cs` - Strategy interface
- `src/apps/api/src/TeensyRom.Core.Serial/IDeviceTransportFactory.cs` - Factory to create transports

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **Constructor Changes**:
   - Accept `IEnumerable<IDiscoveryStrategy> discoveryStrategies` via DI
   - Store as `_discoveryStrategies` list
   - Keep existing dependencies: `ILoggingService`, `IDeviceTransportFactory`, `IStorageFactory`, `ICartTagger`, `IFwVersionChecker`, `IMediator`

2. **DiscoverAllEndpoints() Method**:
   ```csharp
   private async Task<List<DiscoveredEndpoint>> DiscoverAllEndpoints(CancellationToken ct)
   {
       var tasks = _discoveryStrategies.Select(s => s.FindEndpoints(ct));
       var results = await Task.WhenAll(tasks);
       return results.SelectMany(r => r).ToList();
   }
   ```
   - Run all strategies in parallel for fastest results
   - Merge all endpoint lists into single result

3. **ValidateAndCreateDevice() Method**:
   ```csharp
   private async Task<TeensyRomDevice?> ValidateAndCreateDevice(
       DiscoveredEndpoint endpoint, CancellationToken ct)
   {
       // 1. Create transport based on ConnectionType
       // 2. Open port
       // 3. Version check (transport-agnostic)
       // 4. If not TeensyROM, dispose and return null
       // 5. Create Cart with ConnectionType, ComPort/IpAddress, TcpPort
       // 6. Ensure tags (transport-agnostic)
       // 7. Resolve DeviceId
       // 8. Create TeensyRomDevice
   }
   ```

4. **Transport Creation**:
   - Switch on `endpoint.ConnectionType`
   - `Serial`: call `_transportFactory.CreateSerial(endpoint.Address)`
   - `Tcp`: call `_transportFactory.CreateTcp($"{endpoint.Address}:{endpoint.Port}")`
   - Throw `ArgumentException` for unknown `ConnectionType`

5. **Cart Property Mapping**:
   - `ConnectionType = endpoint.ConnectionType`
   - If Serial: `ComPort = endpoint.Address`, `IpAddress = string.Empty`, `TcpPort = 80`
   - If TCP: `ComPort = string.Empty`, `IpAddress = endpoint.Address`, `TcpPort = endpoint.Port ?? 80`

6. **FindDevices() Method**:
   - Call `DiscoverAllEndpoints()` to get all endpoints (Serial + TCP in parallel)
   - For each endpoint, call `ValidateAndCreateDevice()`
   - Collect all successfully created devices
   - Return list of `TeensyRomDevice`

**Anti-Patterns to Avoid**:
- Don't duplicate validation logic between Serial and TCP
- Don't modify existing DeviceId resolution logic
- Don't change storage tag ensure logic
- Don't hardcode transport type - use `endpoint.ConnectionType`

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] `DiscoverAllEndpoints()` runs all strategies in parallel
- [ ] `DiscoverAllEndpoints()` merges results from multiple strategies
- [ ] `ValidateAndCreateDevice()` creates Serial transport for Serial endpoint
- [ ] `ValidateAndCreateDevice()` creates TCP transport for TCP endpoint
- [ ] `ValidateAndCreateDevice()` returns null if version check fails
- [ ] `ValidateAndCreateDevice()` sets `Cart.ConnectionType` correctly
- [ ] `ValidateAndCreateDevice()` sets `ComPort` for Serial, `IpAddress`/`TcpPort` for TCP
- [ ] `FindDevices()` returns devices from both Serial and TCP strategies

**Integration Tests**:
- [ ] Mixed transport discovery: 2 Serial + 1 TCP devices
- [ ] Serial-only discovery: only Serial strategy registered
- [ ] TCP-only discovery: only TCP strategy registered
- [ ] No strategies registered: returns empty device list
- [ ] Version check filters out non-TeensyROM devices
- [ ] Tag ensure works for both Serial and TCP

**Behavioral Expectations**:
- Both Serial and TCP devices are discovered in parallel
- All discovered devices go through same validation pipeline
- Serial devices continue to work as before (backwards compatible)
- TCP devices are discovered, validated, and created correctly

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [CartFinder](../../../../src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs) - Current implementation
- [Task 03-001 Report](../reports/TCP-SUPPORT-TASK-03-001-REPORT.md) - Discovery strategies

**Related Tasks**:
- TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES: Discovery strategies (completed) - used by CartFinder
- TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES: Reconnection strategies (next) - similar pattern

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-002-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-002-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
