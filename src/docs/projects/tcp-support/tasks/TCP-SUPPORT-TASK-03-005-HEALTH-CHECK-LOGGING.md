# TCP-SUPPORT Task Handoff: Update Health Check Logging

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING
**Task Name**: Update Health Check Logging to Use ConnectionDisplay
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: Low
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Update health check logging in `DeviceConnectionManager` to use `Cart.ConnectionDisplay` property instead of hardcoded `Cart.ComPort`. This ensures log messages show "Port: COM3" for Serial and "IP: 192.168.1.42:80" for TCP.

**Why**: The health check logs currently reference `Cart.ComPort` which is empty for TCP devices. Using `Cart.ConnectionDisplay` provides a transport-agnostic display string that works for both Serial and TCP devices.

**Success Criteria**:
- [ ] Line 249: Use `{d.Cart.ConnectionDisplay}` instead of `{d.Cart.ComPort}`
- [ ] Line 291: Use `{device.Cart.ConnectionDisplay}` instead of `{device.Cart.ComPort}`
- [ ] Verify log messages show "Port: COM3" for Serial devices
- [ ] Verify log messages show "IP: 192.168.1.42:80" for TCP devices
- [ ] No other changes to health check logic

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity with ConnectionDisplay

**Dependencies**:
- `TeensyRom.Core.Entities.Device` namespace - `Cart.ConnectionDisplay` property

**Constraints**:
- Must NOT change health check logic (only logging strings)
- Must NOT change log levels or log method calls
- Must verify exact line numbers match current implementation

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Update log messages (2 lines)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Current health check logging
- `src/apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - ConnectionDisplay property

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions

**Key Requirements**:

1. **Line 249 Update** (in health check loop, device removal):
   - Current: `@ {d.Cart.ComPort}`
   - Change to: `@ {d.Cart.ConnectionDisplay}`
   - Log message: "Device {Name} - {DeviceId} @ {ConnectionDisplay} is no longer connected..."

2. **Line 291 Update** (in CheckDeviceHealth method):
   - Current: `@ {device.Cart.ComPort}`
   - Change to: `@ {device.Cart.ConnectionDisplay}`
   - Log message: "Unauthorized access to {Name} - {DeviceId} @ {ConnectionDisplay}"

3. **Verify Context**:
   - Read both log messages in context to ensure changes are correct
   - Verify line numbers match current implementation
   - No other references to `ComPort` in logging need updating

**Anti-Patterns to Avoid**:
- Don't change health check logic (only the display string in log messages)
- Don't change log levels (InternalWarning, InternalError)
- Don't modify any other parts of the health check

---

**Test Coverage Required**:

**Integration Tests**:
- [ ] Serial device health check failure logs "Port: COM3"
- [ ] TCP device health check failure logs "IP: 192.168.1.42:80"
- [ ] Health check removes disconnected TCP device correctly
- [ ] Log messages are readable and informative for both transports

**Behavioral Expectations**:
- Health check continues to work identically for Serial devices
- TCP devices are monitored and removed when disconnected
- Log messages clearly indicate connection type and endpoint

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [Cart](../../../../src/apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs) - ConnectionDisplay property

**Related Tasks**:
- TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT: Rename Reconnect Method (completed) - related DeviceConnectionManager changes
- TCP-SUPPORT-TASK-03-006-DI-REGISTRATION: DI Registration (next) - register all services

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-005-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-005-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
