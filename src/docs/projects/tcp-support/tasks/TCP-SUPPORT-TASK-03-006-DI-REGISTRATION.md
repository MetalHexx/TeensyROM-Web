# TCP-SUPPORT Task Handoff: Register Services in DI Container

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-006-DI-REGISTRATION
**Task Name**: Register All New Services in DI Container
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Register all new services (discovery strategies, reconnection strategies, TCP finder, transport factory) in the DI container in `ServiceStartupExtensions.cs`. Keep `ISerialFactory` for backwards compatibility.

**Why**: The new services (strategies, finders, factories) need to be registered in the DI container so they can be injected into `CartFinder` and `DeviceConnectionManager`. Without registration, the application will fail to start.

**Success Criteria**:
- [ ] `IDiscoveryStrategy` implementations registered as singleton (Serial, Tcp)
- [ ] `IReconnectionStrategy` implementations registered as singleton (Serial, Tcp)
- [ ] `ITcpDeviceFinder` registered as singleton (if not already registered)
- [ ] `IDeviceTransportFactory` registered as singleton (from Phase 2)
- [ ] `ISerialFactory` remains registered for backwards compatibility
- [ ] All `CartFinder` and `DeviceConnectionManager` dependencies are registered
- [ ] Application starts without DI errors
- [ ] Integration tests pass

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES: Discovery strategies implemented
- TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES: Reconnection strategies implemented
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: Device transport factory implemented
- TCP-SUPPORT-TASK-01-003-DEVICE-FINDER: TcpDeviceFinder implemented

**Dependencies**:
- `TeensyRom.Core.Device` namespace - All strategy and finder classes
- `TeensyRom.Core.Serial` namespace - `IDeviceTransportFactory`
- `Microsoft.Extensions.DependencyInjection` - DI registration methods

**Constraints**:
- Must NOT remove existing service registrations
- Must maintain `ISerialFactory` for backwards compatibility
- Must use singleton lifetime for all services (stateless)

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs` - Add new service registrations

**Files to Review**:
- `src/apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs` - Current DI registrations
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Constructor dependencies
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Constructor dependencies

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - DI patterns

**Key Requirements**:

1. **Register Discovery Strategies**:
   ```csharp
   // Register as IEnumerable<IDiscoveryStrategy> for CartFinder injection
   services.AddSingleton<IDiscoveryStrategy, SerialDiscoveryStrategy>();
   services.AddSingleton<IDiscoveryStrategy, TcpDiscoveryStrategy>();
   ```

2. **Register Reconnection Strategies**:
   ```csharp
   // Register individually for DeviceConnectionManager injection
   services.AddSingleton<IReconnectionStrategy, SerialReconnectionStrategy>();
   services.AddSingleton<IReconnectionStrategy, TcpReconnectionStrategy>();
   ```

3. **Register TcpDeviceFinder** (if not already registered):
   ```csharp
   services.AddSingleton<ITcpDeviceFinder, TcpDeviceFinder>();
   ```

4. **Register DeviceTransportFactory** (from Phase 2, verify registered):
   ```csharp
   services.AddSingleton<IDeviceTransportFactory, DeviceTransportFactory>();
   ```

5. **Keep ISerialFactory** (backwards compatibility):
   ```csharp
   // Keep existing registration - do NOT remove
   services.AddSingleton<ISerialFactory, SerialFactory>();
   ```

6. **Verify All Dependencies**:
   - `CartFinder` requires: `IEnumerable<IDiscoveryStrategy>`, `IDeviceTransportFactory`, `IStorageFactory`, `ICartTagger`, `IFwVersionChecker`, `IMediator`, `ILoggingService`
   - `DeviceConnectionManager` requires: `ICartFinder`, `IReconnectionStrategy` (2x), `IFwVersionChecker`, `ILoggingService`
   - Ensure all dependencies are registered

**Anti-Patterns to Avoid**:
- Don't remove existing service registrations
- Don't use scoped or transient lifetime (use singleton)
- Don't forget to register `ITcpDeviceFinder` (needed by TcpDiscoveryStrategy)
- Don't register `IDiscoveryStrategy` as a single implementation (need both Serial and Tcp)

---

**Test Coverage Required**:

**Integration Tests**:
- [ ] Application starts without DI errors
- [ ] `CartFinder` receives both discovery strategies via constructor
- [ ] `DeviceConnectionManager` receives both reconnection strategies via constructor
- [ ] `TcpDiscoveryStrategy` receives `ITcpDeviceFinder` via constructor
- [ ] All services are singletons (same instance returned)

**Behavioral Expectations**:
- DI container resolves all dependencies correctly
- `CartFinder` gets both Serial and TCP discovery strategies
- `DeviceConnectionManager` gets both Serial and TCP reconnection strategies
- Application starts and runs without errors

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [ServiceStartupExtensions](../../../../src/apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs) - DI configuration

**Related Tasks**:
- TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES: Discovery strategies (completed) - need registration
- TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES: Reconnection strategies (completed) - need registration
- TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS: Integration Tests (next) - verify DI works

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-006-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-006-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
