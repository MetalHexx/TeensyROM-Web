# TCP-SUPPORT Task Handoff: Update CartFinder for Serial Devices

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER
**Task Name**: Update CartFinder to Set ConnectionType.Serial
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Update `CartFinder.FindDevices()` to set `ConnectionType.Serial` on all discovered serial devices, ensuring they are properly marked as Serial connections in the domain model.

**Why**: The `CartFinder` discovers serial (COM port) devices but doesn't currently set the `ConnectionType` property. As new devices are discovered, they should be marked with the appropriate connection type so the rest of the system can handle them correctly.

**Success Criteria**:
- [ ] `CartFinder.FindDevices()` sets `cart.ConnectionType = ConnectionType.Serial` on discovered devices
- [ ] Property is set before `TeensyRomDevice` is created
- [ ] Existing serial device discovery continues to work unchanged
- [ ] All existing tests continue to pass
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity extended with ConnectionType
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: Device transport factory created

**Dependencies**:
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum
- `TeensyRom.Core.Entities.Device` namespace - `Cart` entity with new properties
- `TeensyRom.Core.Device` namespace - `CartFinder` class

**Constraints**:
- Must not break existing serial device discovery
- Must not affect TCP device discovery (handled in Phase 3)
- Minimal code changes (add one line to set property)

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Set ConnectionType.Serial on discovered devices

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - Cart entity with ConnectionType property
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Current discovery implementation

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches

**Key Requirements**:

1. **Set ConnectionType.Serial in FindDevices()**:
   - Locate where `Cart` instance is created in `FindDevices()` method
   - Add `cart.ConnectionType = ConnectionType.Serial;` after cart creation
   - Ensure property is set before `TeensyRomDevice` is created
   - Verify property is set for all discovered serial devices

2. **Preserve Existing Behavior**:
   - Don't modify any other logic in `FindDevices()`
   - Don't change how devices are discovered
   - Don't change error handling

**Anti-Patterns to Avoid**:
- Don't add TCP device discovery to `CartFinder` (handled in Phase 3)
- Don't modify the existing `ISerialFactory` pattern
- Don't change the order of operations in device discovery
- Don't add unnecessary logging or validation

---

**Test Coverage Required**:

**Integration Tests**:
- [ ] Discovered serial devices have `ConnectionType.Serial` set
- [ ] Existing serial device discovery tests continue to pass
- [ ] `Cart.ComPort` is still populated correctly
- [ ] No regression in device discovery functionality

**Behavioral Expectations**:
- All existing serial device discovery tests pass without modification
- Discovered devices have correct `ConnectionType` value
- Device connection process works unchanged for serial devices

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-2) - Overall project plan
- [Phase 2 Plan](../phases/TCP-SUPPORT-PHASE-02-DOMAIN-MODEL-EXTENSIONS.md) - Current phase details
- [CartFinder](../../../../src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs) - Current discovery implementation
- [Task 2-001 Report](../reports/TCP-SUPPORT-TASK-02-001-REPORT.md) - Cart entity extension

**Related Tasks**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Extend Cart entity (completed) - added ConnectionType property
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: Create Transport Factory (completed) - factory uses this property

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-02-004-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-02-004-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
