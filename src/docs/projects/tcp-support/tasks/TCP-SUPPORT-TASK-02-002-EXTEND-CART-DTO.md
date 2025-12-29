# TCP-SUPPORT Task Handoff: Extend CartDto API Model

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO
**Task Name**: Extend CartDto with TCP Properties
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Extend the `CartDto` API model with TCP connection properties (`ConnectionType`, `IpAddress`, `TcpPort`) matching the `Cart` entity extension, and update `FromDevice()` mapping to include the new properties.

**Why**: The API DTO must mirror the domain model changes to expose TCP connection information to the frontend, enabling the UI to display appropriate icons and connection details based on transport type.

**Success Criteria**:
- [ ] `CartDto` extended with `ConnectionType` property (enum, default: Serial)
- [ ] `CartDto` extended with `IpAddress` property (string, default: empty)
- [ ] `CartDto` extended with `TcpPort` property (int, default: 80)
- [ ] All new properties have `[Required]` attributes
- [ ] `CartDto.FromDevice()` maps new properties from `Cart` entity
- [ ] Existing API functionality remains unchanged (backwards compatible)
- [ ] Unit tests pass for new properties and mapping
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity extended with TCP properties

**Dependencies**:
- `TeensyRom.Core.Settings` namespace - `ConnectionType` enum already exists
- `TeensyRom.Core.Entities.Device` namespace - `Cart` entity with new TCP properties
- `TeensyRom.Api.Models` namespace - `CartDto` class

**Constraints**:
- Must be backwards compatible (existing API responses continue to work)
- New properties must have sensible defaults for serial devices
- `FromDevice()` must map all new properties correctly from `Cart`

---

**Files to Create**:
- (None for this task - pure modification of existing file)

**Files to Modify**:
- `src/apps/api/src/TeensyRom.Api/Models/CartDto.cs` - Add TCP properties and update mapping

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core/Entities/Device/Cart.cs` - Entity to mirror (modified in Task 2-001)
- `src/apps/api/src/TeensyRom.Core/Entities/Device/TeensyRomDevice.cs` - Device wrapper passed to `FromDevice()`
- `src/apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs` - Where DTOs are used

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **Add ConnectionType Property**:
   ```csharp
   [Required] public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;
   ```
   - Type: `ConnectionType` enum (add `using TeensyRom.Core.Settings;`)
   - Default: `ConnectionType.Serial` for backwards compatibility
   - Attribute: `[Required]` for API validation

2. **Add IpAddress Property**:
   ```csharp
   [Required] public string IpAddress { get; set; } = string.Empty;
   ```
   - Type: `string`
   - Default: `string.Empty` (serial devices don't have IP address)
   - Attribute: `[Required]` for API validation

3. **Add TcpPort Property**:
   ```csharp
   [Required] public int TcpPort { get; set; } = 80;
   ```
   - Type: `int`
   - Default: `80` (TeensyROM hardware standard port)
   - Attribute: `[Required]` for API validation
   - Note: Used only when `ConnectionType == ConnectionType.Tcp`

4. **Update FromDevice() Mapping**:
   - Add `ConnectionType = device.Cart.ConnectionType` to mapping
   - Add `IpAddress = device.Cart.IpAddress` to mapping
   - Add `TcpPort = device.Cart.TcpPort` to mapping
   - Ensure all new properties are copied from `Cart` to `CartDto`

**Anti-Patterns to Avoid**:
- Don't break existing API clients (new properties have defaults)
- Don't change the namespace of the `CartDto` class
- Don't remove or rename existing properties
- Don't change the signature of `FromDevice()` method

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] New `CartDto` instance has `ConnectionType.Serial` by default
- [ ] New `CartDto` instance has `IpAddress = string.Empty` by default
- [ ] New `CartDto` instance has `TcpPort = 80` by default
- [ ] `FromDevice()` maps `ConnectionType` from `Cart` correctly
- [ ] `FromDevice()` maps `IpAddress` from `Cart` correctly
- [ ] `FromDevice()` maps `TcpPort` from `Cart` correctly
- [ ] Existing API responses continue to work (backwards compatibility)

**Integration Context**:
- Tests should verify `CartDto` can be serialized to JSON correctly
- Tests should verify API clients can deserialize DTO with new properties

**Behavioral Expectations**:
- All existing API endpoints that return `CartDto` continue to work
- API clients can access new properties (will have default values for serial devices)
- OpenAPI documentation includes new properties with correct types

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-2) - Overall project plan
- [Phase 2 Plan](../phases/TCP-SUPPORT-PHASE-02-DOMAIN-MODEL-EXTENSIONS.md) - Current phase details
- [CartDto](../../../../src/apps/api/src/TeensyRom.Api/Models/CartDto.cs) - Current DTO implementation
- [Task 2-001 Report](../reports/TCP-SUPPORT-TASK-02-001-REPORT.md) - Cart entity extension

**Related Tasks**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Extend Cart entity (completed) - provides source properties
- TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY: Create Transport Factory (next) - will use these DTOs

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-02-002-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-02-002-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
