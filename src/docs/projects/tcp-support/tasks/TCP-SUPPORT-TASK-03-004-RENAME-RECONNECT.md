# TCP-SUPPORT Task Handoff: Rename Reconnect Method and Use Strategy

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT
**Task Name**: Rename ConnectToNextPort to ReconnectDevice and Use Strategy Pattern
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Rename `ConnectToNextPort()` to `ReconnectDevice()` in `DeviceConnectionManager` and refactor to use `IReconnectionStrategy` based on `Cart.ConnectionType`. Remove the `GetAvailablePorts()` helper method (moved to `SerialReconnectionStrategy`).

**Why**: The current method name is Serial-specific ("NextPort") but needs to work for both Serial and TCP. The new name `ReconnectDevice()` is transport-agnostic. Using the strategy pattern allows each transport to have its own reconnection logic without a large switch statement.

**Success Criteria**:
- [ ] Method renamed from `ConnectToNextPort(string deviceId)` to `ReconnectDevice(string deviceId)`
- [ ] Constructor accepts `IReconnectionStrategy` implementations via DI
- [ ] Method selects strategy based on `device.Cart.ConnectionType`
- [ ] `GetAvailablePorts()` helper method removed (moved to SerialReconnectionStrategy)
- [ ] Error logging uses `Cart.ConnectionDisplay` instead of `Cart.ComPort`
- [ ] All call sites updated to use new method name (verify no external API depends on this)
- [ ] Integration tests pass for both Serial and TCP reconnection

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES: Reconnection strategies implemented
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity with ConnectionDisplay

**Dependencies**:
- `TeensyRom.Core.Device` namespace - `IReconnectionStrategy`, `TeensyRomDevice`, `Cart`
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum

**Constraints**:
- Must verify no external callers depend on `ConnectToNextPort()` (breaking change)
- Must NOT change reconnection behavior for Serial devices
- Must NOT change public interface of `IDeviceConnectionManager`

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Rename method and use strategies

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Current implementation
- `src/apps/api/src/TeensyRom.Core.Device/IReconnectionStrategy.cs` - Strategy interface
- `src/apps/api/src/TeensyRom.Core.Device/IDeviceConnectionManager.cs` - Public interface

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **Constructor Changes**:
   - Accept `IReconnectionStrategy serialReconnection` via DI
   - Accept `IReconnectionStrategy tcpReconnection` via DI
   - Store as private fields

2. **Rename Method**:
   - Rename `ConnectToNextPort(string deviceId)` to `ReconnectDevice(string deviceId)`
   - Update XML documentation comments if present
   - Search codebase for any callers of this method to update

3. **Select Strategy Based on ConnectionType**:
   ```csharp
   public async Task<bool> ReconnectDevice(string deviceId)
   {
       var device = GetConnectedDevice(deviceId)
           ?? throw new TeensyException($"Device {deviceId} not found");

       var strategy = device.Cart.ConnectionType switch
       {
           ConnectionType.Serial => _serialReconnection,
           ConnectionType.Tcp => _tcpReconnection,
           _ => throw new ArgumentException($"Unknown connection type: {device.Cart.ConnectionType}")
       };

       return await strategy.TryReconnect(device, CancellationToken.None);
   }
   ```

4. **Remove GetAvailablePorts() Method**:
   - Delete `GetAvailablePorts()` helper method (moved to SerialReconnectionStrategy)
   - No longer needed in DeviceConnectionManager

5. **Update Error Logging**:
   - Change error log from: `$"Could not reconnect to {deviceId}"`
   - Keep generic - don't mention "ports" or "endpoints" (strategy-specific)
   - Log method name is `InternalError`, stays the same

6. **Verify No External Callers**:
   - Search codebase for `ConnectToNextPort`
   - If found in other projects, update those call sites too
   - If part of public API, may need to keep old method as deprecated wrapper

**Anti-Patterns to Avoid**:
- Don't include switch statement for reconnection logic in DeviceConnectionManager (that's in strategies)
- Don't duplicate strategy selection logic
- Don't forget to update all call sites
- Don't leave `GetAvailablePorts()` method in code (unused)

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] `ReconnectDevice()` selects Serial strategy for `ConnectionType.Serial`
- [ ] `ReconnectDevice()` selects TCP strategy for `ConnectionType.Tcp`
- [ ] `ReconnectDevice()` throws for unknown `ConnectionType`
- [ ] `ReconnectDevice()` returns true when strategy succeeds
- [ ] `ReconnectDevice()` returns false when strategy fails
- [ ] `ReconnectDevice()` throws `TeensyException` when device not found

**Integration Tests**:
- [ ] Serial device reconnects via SerialReconnectionStrategy
- [ ] TCP device reconnects via TcpReconnectionStrategy
- [ ] Method name change doesn't break existing functionality
- [ ] Error logging works correctly for both transports

**Behavioral Expectations**:
- Serial devices reconnect via COM port hunting (existing behavior preserved)
- TCP devices reconnect via retry with backoff
- Method name is transport-agnostic
- No functional changes to reconnection logic (just refactored)

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [DeviceConnectionManager](../../../../src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs) - Current implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES: Reconnection strategies (completed) - used by this task
- TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING: Health Check Logging (next) - update log messages

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-004-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-004-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
