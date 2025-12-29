# TCP-SUPPORT Task Handoff: Extend Cart Entity

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY
**Task Name**: Extend Cart Entity with TCP Properties
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Extend the `Cart` entity with TCP connection properties (`ConnectionType`, `IpAddress`, `TcpPort`) and a computed `ConnectionDisplay` property for user-friendly display.

**Why**: The `Cart` entity currently only supports Serial (COM port) connections. Adding TCP properties enables the same entity to represent devices connected via either transport type, providing a unified domain model.

**Success Criteria**:
- [ ] `Cart` entity extended with `ConnectionType` property (enum, default: Serial)
- [ ] `Cart` entity extended with `IpAddress` property (string, default: empty)
- [ ] `Cart` entity extended with `TcpPort` property (int, default: 80)
- [ ] `Cart.ConnectionDisplay` computed property returns "Port: {ComPort}" for Serial
- [ ] `Cart.ConnectionDisplay` computed property returns "IP: {IpAddress}:{TcpPort}" for TCP
- [ ] Existing serial device functionality remains unchanged (backwards compatible)
- [ ] Unit tests pass for new properties and computed display
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE: TCP transport implementation complete

**Dependencies**:
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum already exists
- No other project dependencies (pure entity extension)

**Constraints**:
- Must be backwards compatible (existing serial devices continue to work)
- New properties must have sensible defaults for serial devices
- `ConnectionDisplay` must handle all edge cases (empty IP, missing ComPort, etc.)

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - Add TCP properties and computed display

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core/Settings/ConnectionSettings.cs` - `ConnectionType` enum reference
- `src/apps/api/src/TeensyRom.Core/Entities/Device/TeensyRomDevice.cs` - Device wrapper that uses Cart

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches

**Key Requirements**:

1. **Add ConnectionType Property**:
   ```csharp
   public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;
   ```
   - Type: `ConnectionType` enum (already exists in `TeensyRom.Core.Settings`)
   - Default: `ConnectionType.Serial` for backwards compatibility

2. **Add IpAddress Property**:
   ```csharp
   public string IpAddress { get; set; } = string.Empty;
   ```
   - Type: `string`
   - Default: `string.Empty` (serial devices don't have IP address)

3. **Add TcpPort Property**:
   ```csharp
   public int TcpPort { get; set; } = 80;
   ```
   - Type: `int`
   - Default: `80` (TeensyROM hardware standard port)
   - Note: Used only when `ConnectionType == ConnectionType.Tcp`

4. **Add ConnectionDisplay Computed Property**:
   ```csharp
   public string ConnectionDisplay => ConnectionType switch
   {
       ConnectionType.Serial => $"Port: {ComPort}",
       ConnectionType.Tcp => $"IP: {IpAddress}:{TcpPort}",
       _ => "Unknown"
   };
   ```
   - Must return user-friendly display string
   - For Serial: "Port: COM3" (shows ComPort value)
   - For TCP: "IP: 192.168.1.42:80" (shows IpAddress:TcpPort)
   - Handle edge cases: empty ComPort returns "Port: ", empty IpAddress returns "IP: :80"

**Anti-Patterns to Avoid**:
- Don't break existing serial device functionality
- Don't add database migration (no database exists)
- Don't make `ComPort` nullable (keep existing string.Empty default)
- Don't change the namespace of the `Cart` class

---

**Test Coverage Required**:

**Unit Tests** (create new test file if needed):
- [ ] New `Cart` instance has `ConnectionType.Serial` by default
- [ ] New `Cart` instance has `IpAddress = string.Empty` by default
- [ ] New `Cart` instance has `TcpPort = 80` by default
- [ ] `ConnectionDisplay` returns "Port: COM3" for Serial device
- [ ] `ConnectionDisplay` returns "IP: 192.168.1.42:80" for TCP device
- [ ] `ConnectionDisplay` handles empty `ComPort` (returns "Port: ")
- [ ] `ConnectionDisplay` handles empty `IpAddress` (returns "IP: :80")
- [ ] Existing serial devices continue to work (backwards compatibility)

**Integration Context**:
- Tests should verify `Cart` can be created and serialized/deserialized correctly
- Tests should verify `ConnectionType` enum values work correctly

**Behavioral Expectations**:
- All existing code that uses `Cart` continues to work without modification
- New properties are ignored by serial device code paths
- `ConnectionDisplay` provides meaningful information for both transport types

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-2) - Overall project plan
- [Phase 2 Plan](../phases/TCP-SUPPORT-PHASE-02-DOMAIN-MODEL-EXTENSIONS.md) - Current phase details
- [ConnectionSettings](../../../../src/apps/api/src/TeensyRom.Core/Settings/ConnectionSettings.cs) - ConnectionType enum
- [Task 1 Report](../reports/TCP-SUPPORT-TASK-01-001-REPORT.md) - TcpObservablePort implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO: Extend CartDto (next) - mirrors these changes in API DTO
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: Create Transport Factory (pending) - will use these properties

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-02-001-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-02-001-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
