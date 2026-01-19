# CART-REFACTOR Task Handoff: Extend ICommunicationPort Interface

## 🎯 Subagent Task Assignment

### INPUT_DOC

**Task ID**: CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE
**Task Name**: Extend ICommunicationPort Interface with Connection Info Methods
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small (3 files)

---

**What**: Add `GetEndpoint()` and `GetConnectionType()` methods to the `ICommunicationPort` interface and implement them in `SimpleObservableSerialPort` and `TcpObservablePort` to expose current connection information.

**Why**: Currently, connection info (COM port, IP address, connection type) is stored redundantly in the `Cart` entity as a "shadow copy" that can fall out of sync with the actual port state. By exposing this info through the interface, we establish `ICommunicationPort` as the single source of truth for connection state.

**Success Criteria**:
- [ ] `ICommunicationPort` has two new methods with XML documentation
- [ ] `SimpleObservableSerialPort.GetEndpoint()` returns current COM port name
- [ ] `SimpleObservableSerialPort.GetConnectionType()` returns `ConnectionType.Serial`
- [ ] `TcpObservablePort.GetEndpoint()` returns current TCP endpoint string
- [ ] `TcpObservablePort.GetConnectionType()` returns `ConnectionType.Tcp`
- [ ] All existing tests continue to pass
- [ ] Code compiles without errors

---

### Context & Dependencies

**Prerequisites Completed**:
- None (this is the first task in the refactoring)

**Dependencies**:
- `TeensyRom.Core.Abstractions` - Contains `ICommunicationPort` interface
- `TeensyRom.Core.Settings` - Contains `ConnectionType` enum
- `SimpleObservableSerialPort` has `_serialPort.PortName` available
- `TcpObservablePort` has `_endpoint` field available

**Constraints**:
- Methods must return current runtime state, not cached values
- Serial port should return empty string if port name is null/unset
- TCP port should return endpoint in format "IP:Port" or empty string if null

---

### File Scope

**Files to Modify**:
- `apps/api/src/TeensyRom.Core/Abstractions/ICommunicationPort.cs` - Add interface methods
- `apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs` - Implement methods
- `apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - Implement methods

**Files to Review** (for context):
- `apps/api/src/TeensyRom.Core/Settings/ConnectionType.cs` - Enum values
- `apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - Properties to be removed later

---

### Implementation Guidance

**Standards to Follow**:
- [Backend Architecture](../../../../docs/BACKEND_ARCHITECTURE.md)
- [Coding Standards](../../../../docs/CODING_STANDARDS.md)

**Key Requirements**:

1. **ICommunicationPort.cs** - Add two methods:
   ```csharp
   /// <summary>
   /// Gets the current connection endpoint (COM port name or TCP address:port)
   /// </summary>
   string GetEndpoint();
   
   /// <summary>
   /// Gets the type of connection (Serial or TCP)
   /// </summary>
   ConnectionType GetConnectionType();
   ```

2. **SimpleObservableSerialPort.cs** - Implement methods:
   - `GetEndpoint()`: Return `_serialPort.PortName ?? string.Empty`
   - `GetConnectionType()`: Return `ConnectionType.Serial`

3. **TcpObservablePort.cs** - Implement methods:
   - `GetEndpoint()`: Return `_endpoint ?? string.Empty`
   - `GetConnectionType()`: Return `ConnectionType.Tcp`

**Anti-Patterns to Avoid**:
- Don't cache endpoint values (return live state)
- Don't throw exceptions if port/endpoint is null (return empty string)
- Don't add additional fields to store this data (use existing fields)

---

### Testing Requirements

**Test Coverage Required**:
- [ ] Existing tests continue to pass (no behavioral changes)
- [ ] Manual verification: Serial port returns correct COM port name
- [ ] Manual verification: TCP port returns correct endpoint string
- [ ] Manual verification: Both return correct ConnectionType

**Behavioral Expectations**:
- Methods should be callable at any time (open or closed port)
- If port not set, return empty string (not null)
- Connection type never changes for a port instance

---

### Reference Materials

**Related Documentation**:
- [CART-REFACTOR-MASTER-PLAN.md](../CART-REFACTOR-MASTER-PLAN.md) - Full project context
- [BACKEND_ARCHITECTURE.md](../../../../docs/BACKEND_ARCHITECTURE.md#serial-communication) - Serial patterns

**Related Tasks**:
- CART-REFACTOR-TASK-01-002-CORE-ENTITIES: Will use these methods for computed properties
- CART-REFACTOR-TASK-01-003-DEVICE-MANAGEMENT: Will update callers

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/CART-REFACTOR/reports/CART-REFACTOR-TASK-01-001-REPORT.md`
**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
**Return Value**: File path of saved report

---

## 📌 Task Execution Notes

This is a straightforward interface extension. The key insight is that both port implementations already have the connection info internally—we're just exposing it through the interface.

**Implementation time**: ~15 minutes
**Risk level**: Minimal (additive change, no existing code broken)
