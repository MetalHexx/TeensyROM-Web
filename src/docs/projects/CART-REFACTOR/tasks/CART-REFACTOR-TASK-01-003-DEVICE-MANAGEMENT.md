# CART-REFACTOR Task Handoff: Update Device Management & Reconnection Logic

## 🎯 Subagent Task Assignment

### INPUT_DOC

**Task ID**: CART-REFACTOR-TASK-01-003-DEVICE-MANAGEMENT
**Task Name**: Update Device Manager & Reconnection to Use Computed Properties
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Large (7-10 files including tests)

---

**What**: Update `DeviceConnectionManager`, reconnection strategies, and all other consumers to use the new computed properties on `TeensyRomDevice` instead of accessing Cart connection fields (which no longer exist). Fix all tests that instantiate Cart with connection properties.

**Why**: Complete the refactoring by updating all callers to use the single source of truth (ICommunicationPort via TeensyRomDevice computed properties). This eliminates all references to the removed Cart fields.

**Success Criteria**:
- [ ] `DeviceConnectionManager.ReconnectDevice()` uses `device.ConnectionType`
- [ ] `SerialReconnectionStrategy` no longer sets `device.Cart.ComPort`
- [ ] `TcpReconnectionStrategy` no longer sets `device.Cart.IpAddress` (if it does)
- [ ] All codebase references to `device.Cart.ComPort` / `.IpAddress` / `.ConnectionType` replaced
- [ ] All test files updated to not set Cart connection properties
- [ ] Full backend test suite passes (unit + integration)
- [ ] No compilation errors or warnings
- [ ] Reconnection scenarios work correctly (verify via existing tests)

---

### Context & Dependencies

**Prerequisites Completed**:
- CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE: Interface methods available
- CART-REFACTOR-TASK-01-002-CORE-ENTITIES: Cart refactored, TeensyRomDevice has computed properties

**Dependencies**:
- `DeviceConnectionManager` currently accesses `device.Cart.ConnectionType`
- `SerialReconnectionStrategy.TryReconnect()` sets `device.Cart.ComPort` on success (line 55)
- Various test files instantiate `Cart` with connection properties
- Reconnection strategies rely on connection type to select correct strategy

**Constraints**:
- Don't change reconnection logic behavior (only property access)
- Maintain backward compatibility for API responses (CartDto)
- All existing tests must pass with updated entity structure

---

### File Scope

**Files to Modify** (Primary):
- `apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Use `device.ConnectionType`
- `apps/api/src/TeensyRom.Core.Device/SerialReconnectionStrategy.cs` - Remove `Cart.ComPort` assignment
- `apps/api/src/TeensyRom.Core.Device/TcpReconnectionStrategy.cs` - Remove `Cart.IpAddress` assignment (if present)

**Files to Modify** (Tests):
- `apps/api/src/TeensyRom.Core.Device.Tests.Integration/DeviceConnectionManagerTests.cs`
- `apps/api/src/TeensyRom.Core.Device.Tests/SerialReconnectionStrategyTests.cs` (if exists)
- `apps/api/src/TeensyRom.Core.Device.Tests/TcpReconnectionStrategyTests.cs` (if exists)
- `apps/api/src/TeensyRom.Core.Device.Tests.Integration/CartFinderIntegrationTests.cs`

**Search Required**:
Use `grep_search` or semantic search to find ALL occurrences of:
- `device.Cart.ComPort`
- `device.Cart.IpAddress`
- `device.Cart.TcpPort`
- `device.Cart.ConnectionType`
- `cart.ComPort` (in test setup)
- `cart.IpAddress` (in test setup)

**Files to Review** (for context):
- `apps/api/src/TeensyRom.Api/Endpoints/Device/*/` - Check if any endpoints access Cart connection fields

---

### Implementation Guidance

**Standards to Follow**:
- [Backend Architecture](../../../../docs/BACKEND_ARCHITECTURE.md)
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md)

**Key Requirements**:

1. **DeviceConnectionManager.cs** - Line ~42-49 in `ReconnectDevice()`:
   ```csharp
   // CHANGE FROM:
   var strategy = device.Cart.ConnectionType switch
   
   // CHANGE TO:
   var strategy = device.ConnectionType switch
   ```

2. **SerialReconnectionStrategy.cs** - Line ~55 in `TryReconnect()`:
   ```csharp
   // DELETE THIS LINE:
   device.Cart.ComPort = port;
   
   // The port is already updated via ICommunicationPort.SetPort(port)
   // Computed property device.ComPort will automatically reflect new value
   ```

3. **TcpReconnectionStrategy.cs** - Check if it sets `device.Cart.IpAddress`:
   ```csharp
   // If this line exists, DELETE IT:
   device.Cart.IpAddress = ...;
   
   // The endpoint is already set via ICommunicationPort
   ```

4. **Test Files** - Update Cart instantiation:
   ```csharp
   // CHANGE FROM:
   var cart = new Cart
   {
       DeviceId = "test-device",
       ComPort = "COM3",                    // DELETE
       ConnectionType = ConnectionType.Serial  // DELETE
   };
   
   // CHANGE TO:
   var cart = new Cart
   {
       DeviceId = "test-device",
       Name = "Test Device",
       FwVersion = "1.0.0",
       IsCompatible = true
   };
   ```

5. **Codebase Search Strategy**:
   - Run grep search for `\.Cart\.ComPort` pattern
   - Run grep search for `\.Cart\.IpAddress` pattern
   - Run grep search for `\.Cart\.ConnectionType` pattern
   - Replace with `device.ComPort`, `device.IpAddress`, `device.ConnectionType`

**Anti-Patterns to Avoid**:
- Don't try to "update" Cart connection fields (they don't exist anymore)
- Don't cache connection values (always use computed properties)
- Don't skip test file updates (they'll fail at runtime with missing properties)

---

### Testing Requirements

**Test Coverage Required**:
- [ ] DeviceConnectionManager selects correct reconnection strategy
- [ ] Serial reconnection updates port successfully (reflected in computed property)
- [ ] TCP reconnection retries correctly
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No test creates Cart with removed properties

**Behavioral Expectations**:
- After reconnection, `device.ComPort` reflects the new port automatically
- Connection type correctly identifies Serial vs TCP devices
- Reconnection logic unchanged (only property access changed)

**Key Test Files to Verify**:
- `DeviceConnectionManagerTests.cs` - Verify all tests pass, especially reconnection tests
- `SerialReconnectionStrategyTests.cs` - Verify doesn't set Cart properties
- Integration tests - Verify full workflow works end-to-end

---

### Reference Materials

**Related Documentation**:
- [CART-REFACTOR-MASTER-PLAN.md](../CART-REFACTOR-MASTER-PLAN.md) - Full context
- [BACKEND_ARCHITECTURE.md](../../../../docs/BACKEND_ARCHITECTURE.md#reconnection-strategies) - Reconnection patterns

**Related Tasks**:
- CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE: Provided the foundation
- CART-REFACTOR-TASK-01-002-CORE-ENTITIES: Created the computed properties we're using

**Key Insight**:
The reconnection strategies already update the ICommunicationPort (via `SetPort()`, `OpenPort()`). The computed properties automatically reflect this updated state—no need to separately update Cart anymore.

**Search Commands to Run**:
```csharp
// Find all Cart.ComPort references
grep_search: "Cart\.ComPort"

// Find all Cart.IpAddress references  
grep_search: "Cart\.IpAddress"

// Find all Cart.ConnectionType references
grep_search: "Cart\.ConnectionType"

// Find test Cart instantiations
grep_search: "new Cart\s*\{.*ConnectionType"
```

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/CART-REFACTOR/reports/CART-REFACTOR-TASK-01-003-REPORT.md`
**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
**Return Value**: File path of saved report

---

## 📌 Task Execution Notes

This is the "wiring" task that completes the refactoring. Use systematic search to find all references, then fix them one by one.

**Suggested Execution Order**:
1. Search for all Cart connection property references
2. Fix DeviceConnectionManager first (high priority)
3. Fix reconnection strategies (remove Cart assignments)
4. Fix test files (update Cart instantiation)
5. Run full test suite and fix any remaining compilation errors
6. Verify reconnection tests pass (they validate the whole refactoring)

**Implementation time**: ~45-60 minutes (includes testing)
**Risk level**: Low (compiler catches everything, tests verify behavior)

**Success Indicator**: All tests green, no compilation errors, reconnection works correctly.
