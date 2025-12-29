# TCP-SUPPORT Task Handoff: Create Reconnection Strategy Pattern

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES
**Task Name**: Create Reconnection Strategy Interface and Implementations
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Create `IReconnectionStrategy` interface with `SerialReconnectionStrategy` (extracting existing COM port hunting logic) and `TcpReconnectionStrategy` (retry with backoff). This enables `DeviceConnectionManager.ReconnectDevice()` to use transport-agnostic reconnection.

**Why**: The current `ConnectToNextPort()` method in `DeviceConnectionManager` is tightly coupled to Serial (COM port hunting). TCP devices need different reconnection logic (retry same endpoint with backoff). By extracting into strategies, `ReconnectDevice()` can select the correct strategy based on `Cart.ConnectionType`.

**Success Criteria**:
- [ ] `IReconnectionStrategy` interface created with `TryReconnect(TeensyRomDevice, CancellationToken)` method
- [ ] `SerialReconnectionStrategy` extracts existing COM port hunting logic from `DeviceConnectionManager`
- [ ] `TcpReconnectionStrategy` implements 3 retry attempts with 500ms/1s/1.5s backoff
- [ ] `TcpReconnectionStrategy` retries same endpoint, then fails (no network rescan)
- [ ] Both strategies return `bool` indicating success/failure
- [ ] Both strategies update `Cart.ComPort` or `Cart.IpAddress` on success
- [ ] Unit tests pass for both strategies

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER: CartFinder with unified pipeline
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity with ConnectionType

**Dependencies**:
- `TeensyRom.Core.Device` namespace - `TeensyRomDevice`, `Cart`
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum
- `TeensyRom.Core.Serial` namespace - `ISerialStateContext`, `IFwVersionChecker`
- `TeensyRom.Core.Common` namespace - `SerialHelper.GetPorts()`

**Constraints**:
- `SerialReconnectionStrategy` must extract existing logic without changing behavior
- `TcpReconnectionStrategy` must NOT do network rescan (just retry same endpoint)
- Both strategies must handle connection failures gracefully
- Both strategies must leave device in clean state on failure (port closed)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Device/IReconnectionStrategy.cs` - Reconnection strategy interface
- `src/apps/api/src/TeensyRom.Core.Device/SerialReconnectionStrategy.cs` - Serial reconnection logic
- `src/apps/api/src/TeensyRom.Core.Device/TcpReconnectionStrategy.cs` - TCP reconnection logic

**Files to Modify**:
- (None for this task - next task will modify DeviceConnectionManager to use these)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Current `ConnectToNextPort()` to extract
- `src/apps/api/src/TeensyRom.Core.Serial/IFwVersionChecker.cs` - Version checking interface

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **IReconnectionStrategy Interface**:
   ```csharp
   public interface IReconnectionStrategy
   {
       Task<bool> TryReconnect(TeensyRomDevice device, CancellationToken ct);
   }
   ```
   - Single method returning success/failure
   - Accepts device to reconnect and cancellation token

2. **SerialReconnectionStrategy** (extract existing logic from DeviceConnectionManager):
   - Constructor accepts `ILoggingService`, `IFwVersionChecker`
   - `TryReconnect()` implementation:
     - Get available COM ports via `SerialHelper.GetPorts()`
     - Exclude currently connected ports
     - For each available port:
       - Close existing connection
       - Set port, open, lock
       - Version check via `_versionChecker.GetAllVersionInfo()`
       - If TeensyROM found: update `device.Cart.ComPort`, return true
     - If no TeensyROM found: close port, return false

3. **TcpReconnectionStrategy**:
   - Constructor accepts `ILoggingService`, `IFwVersionChecker`
   - `TryReconnect()` implementation:
     - Build endpoint: `$"{device.Cart.IpAddress}:{device.Cart.TcpPort}"`
     - For 1 to 3 retry attempts:
       - Close existing connection
       - Set endpoint, open, lock
       - Version check via `_versionChecker.GetAllVersionInfo()`
       - If TeensyROM found: return true
       - If failed: backoff 500ms * attempt number
     - After 3 failures: close port, return false
     - **NO network rescan** - just retry same endpoint

4. **Error Handling**:
   - Both strategies catch exceptions on individual connection attempts
   - Both strategies ensure port is closed on final failure
   - Both strategies log appropriate error messages

**Anti-Patterns to Avoid**:
- Don't change Serial reconnection behavior (must match existing logic)
- Don't add network rescan to TCP reconnection (explicitly not doing that)
- Don't throw exceptions - return false on failure
- Don't leave port open on failure

---

**Test Coverage Required**:

**Unit Tests - SerialReconnectionStrategy**:
- [ ] Tries all available COM ports when device disconnected
- [ ] Skips currently connected COM ports
- [ ] Returns true and updates `Cart.ComPort` when TeensyROM found
- [ ] Returns false when no TeensyROM found on any port
- [ ] Closes port and logs error when all attempts fail

**Unit Tests - TcpReconnectionStrategy**:
- [ ] Retries same endpoint up to 3 times
- [ ] Returns true on successful connection
- [ ] Uses exponential backoff (500ms, 1s, 1.5s) between retries
- [ ] Returns false after 3 failed attempts
- [ ] Does NOT do network rescan (only retries same endpoint)
- [ ] Closes port on final failure

**Integration Tests**:
- [ ] Serial device successfully reconnects to new COM port
- [ ] TCP device successfully reconnects after 1-3 retries
- [ ] TCP device fails reconnection after 3 bad attempts
- [ ] Both strategies work with `IFwVersionChecker` interface

**Behavioral Expectations**:
- Serial reconnection hunts through available COM ports looking for TeensyROM
- TCP reconnection retries same endpoint with backoff, then fails
- Both strategies leave device in clean state on failure
- Both strategies update Cart properties on success

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [DeviceConnectionManager](../../../../src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs) - Logic to extract

**Related Tasks**:
- TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER: Refactor CartFinder (completed) - unified pipeline
- TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT: Rename Reconnect Method (next) - will use these strategies

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-003-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-003-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
