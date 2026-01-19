# CART-REFACTOR Task Handoff: Refactor Core Entity Structure

## 🎯 Subagent Task Assignment

### INPUT_DOC

**Task ID**: CART-REFACTOR-TASK-01-002-CORE-ENTITIES
**Task Name**: Remove Cart Connection Fields & Add TeensyRomDevice Computed Properties  
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium (4-5 files)

---

**What**: Remove the 4 connection-related properties from `Cart` (ComPort, IpAddress, TcpPort, ConnectionType), add computed properties to `TeensyRomDevice` that delegate to `ICommunicationPort`, and update `CartFinder` to stop populating the removed fields.

**Why**: These properties create a "shadow copy" of connection state that can become stale. By removing them from Cart and computing them from ICommunicationPort, we establish a single source of truth for connection info.

**Success Criteria**:
- [ ] `Cart.cs` has 4 properties removed (ComPort, IpAddress, TcpPort, ConnectionType)
- [ ] `TeensyRomDevice.cs` has computed properties for connection info
- [ ] Helper methods added to parse TCP endpoints (IP extraction, port extraction)
- [ ] `CartFinder.ValidateAndCreateDevice()` doesn't set removed Cart properties
- [ ] `CartDto` mapping updated if it references removed Cart fields
- [ ] All code compiles successfully
- [ ] No tests broken by entity structure changes

---

### Context & Dependencies

**Prerequisites Completed**:
- CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE: ICommunicationPort has GetEndpoint()/GetConnectionType()

**Dependencies**:
- `ICommunicationPort.GetEndpoint()` and `GetConnectionType()` methods available
- `DiscoveredEndpoint` in CartFinder already has ConnectionType, Address, Port fields
- `Cart` is currently used in CartFinder, DeviceConnectionManager, reconnection strategies

**Constraints**:
- Don't break Cart serialization (if it's serialized to JSON/DB)
- Keep DeviceId, Name, FwVersion, IsCompatible, SdStorage, UsbStorage on Cart
- TeensyRomDevice computed properties should match previous Cart property names

---

### File Scope

**Files to Modify**:
- `apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - Remove 4 properties
- `apps/api/src/TeensyRom.Core/Entities/Device/TeensyRomDevice.cs` - Add computed properties + helpers
- `apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Stop setting removed Cart fields (lines 134-137)
- `apps/api/src/TeensyRom.Api/Models/CartDto.cs` - Update mapping if needed

**Files to Review** (for context):
- `apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Uses Cart.ConnectionType (will fix in Task 3)
- `apps/api/src/TeensyRom.Core.Device/SerialReconnectionStrategy.cs` - Sets Cart.ComPort (will fix in Task 3)

---

### Implementation Guidance

**Standards to Follow**:
- [Backend Architecture](../../../../docs/BACKEND_ARCHITECTURE.md)
- [Coding Standards](../../../../docs/CODING_STANDARDS.md)

**Key Requirements**:

1. **Cart.cs** - Delete these properties:
   ```csharp
   // DELETE:
   public ConnectionType ConnectionType { get; set; }
   public string ComPort { get; set; }
   public string IpAddress { get; set; }
   public int TcpPort { get; set; }
   ```

2. **TeensyRomDevice.cs** - Add computed properties:
   ```csharp
   // Connection info computed from CommunicationPort
   public string ComPort => CommunicationPort.GetEndpoint();
   public ConnectionType ConnectionType => CommunicationPort.GetConnectionType();
   
   // TCP-specific properties (parse endpoint string)
   public string IpAddress => ParseIpAddress(CommunicationPort.GetEndpoint());
   public int TcpPort => ParseTcpPort(CommunicationPort.GetEndpoint());
   
   // Helper methods
   private static string ParseIpAddress(string endpoint)
   {
       // For TCP: "192.168.1.42:80" -> "192.168.1.42"
       // For Serial: "COM3" -> empty string
       if (string.IsNullOrEmpty(endpoint) || !endpoint.Contains(':'))
           return string.Empty;
       return endpoint.Split(':')[0];
   }
   
   private static int ParseTcpPort(string endpoint)
   {
       // For TCP: "192.168.1.42:80" -> 80
       // For Serial: "COM3" -> 0
       if (string.IsNullOrEmpty(endpoint) || !endpoint.Contains(':'))
           return 0;
       var parts = endpoint.Split(':');
       return parts.Length == 2 && int.TryParse(parts[1], out int port) ? port : 0;
   }
   ```

3. **CartFinder.cs** - In `ValidateAndCreateDevice()` method (around line 134), remove these lines:
   ```csharp
   // DELETE THESE LINES:
   ConnectionType = endpoint.ConnectionType,
   ComPort = endpoint.ConnectionType == ConnectionType.Serial ? endpoint.Address : string.Empty,
   IpAddress = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Address : string.Empty,
   TcpPort = endpoint.ConnectionType == ConnectionType.Tcp ? endpoint.Port ?? 80 : 80,
   ```

4. **CartDto.cs** - If this file exists and maps Cart properties:
   - Check if it references ComPort, IpAddress, TcpPort, ConnectionType
   - If it does, update mapping to get values from TeensyRomDevice instead
   - Example: `ComPort = device.ComPort` (not `device.Cart.ComPort`)

**Anti-Patterns to Avoid**:
- Don't store connection info on Cart anymore (it's all computed now)
- Don't cache the computed values (always delegate to CommunicationPort)
- Don't throw exceptions in parsing helpers (return empty/0 for invalid input)

---

### Testing Requirements

**Test Coverage Required**:
- [ ] Cart can be instantiated without connection properties
- [ ] TeensyRomDevice computed properties return correct values
- [ ] IP/Port parsing handles edge cases (no colon, invalid port, empty string)
- [ ] CartFinder creates devices successfully without setting Cart connection fields
- [ ] Existing CartFinder tests pass

**Behavioral Expectations**:
- For Serial devices: ComPort returns "COM3", IpAddress/TcpPort return empty/0
- For TCP devices: All properties populated correctly from endpoint string
- Parsing is defensive (doesn't crash on malformed input)

---

### Reference Materials

**Related Documentation**:
- [CART-REFACTOR-MASTER-PLAN.md](../CART-REFACTOR-MASTER-PLAN.md) - Architecture overview
- [CART-REFACTOR-PHASE-01-CORE-REFACTORING.md](../phases/CART-REFACTOR-PHASE-01-CORE-REFACTORING.md) - Phase details

**Related Tasks**:
- CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE: Provides the methods we're calling
- CART-REFACTOR-TASK-01-003-DEVICE-MANAGEMENT: Will update all callers of these properties

**Key Insight from Discovery**:
The `DiscoveredEndpoint` struct already contains the connection info, so CartFinder doesn't need to store it on Cart—the `ICommunicationPort` created from that endpoint already has it internally.

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/CART-REFACTOR/reports/CART-REFACTOR-TASK-01-002-REPORT.md`
**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
**Return Value**: File path of saved report

---

## 📌 Task Execution Notes

This is the core refactoring work. After this task, Cart becomes a pure discovery/configuration DTO with no runtime connection state.

**Critical**: Make sure to search the codebase for any Cart instantiation or serialization that might expect the removed properties. The compiler will catch most issues, but serialization might be runtime-only.

**Implementation time**: ~30-45 minutes
**Risk level**: Medium (entity structure changes, but all compile-time catchable)
