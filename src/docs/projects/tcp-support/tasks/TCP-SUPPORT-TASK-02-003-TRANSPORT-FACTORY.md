# TCP-SUPPORT Task Handoff: Create Device Transport Factory

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY
**Task Name**: Create Unified Device Transport Factory
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Create `IDeviceTransportFactory` interface and `DeviceTransportFactory` implementation that can create either Serial or TCP transport contexts based on a `Cart` entity's `ConnectionType` property.

**Why**: The existing `ISerialFactory` only creates Serial connections. The new factory will support both Serial and TCP transports, using the `Cart.ConnectionType` property to determine which transport to instantiate. This enables the device management system to work seamlessly with both transport types.

**Success Criteria**:
- [ ] `IDeviceTransportFactory` interface created with `Create()`, `CreateSerial()`, `CreateTcp()` methods
- [ ] `DeviceTransportFactory` class implements the interface
- [ ] `Create(Cart cart)` creates correct transport based on `cart.ConnectionType`
- [ ] `CreateSerial(string portName)` creates `SerialStateContext` with `SimpleObservableSerialPort`
- [ ] `CreateTcp(string endpoint)` creates `SerialStateContext` with `TcpObservablePort`
- [ ] Factory accepts `ILoggingService` and `IAlertService` dependencies
- [ ] Unit tests pass with >90% coverage
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Cart entity extended with ConnectionType
- TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE: TcpObservablePort implementation complete

**Dependencies**:
- `TeensyRom.Core.Abstractions` namespace - `IObservableSerialPort`, `ISerialStateContext` interfaces
- `TeensyRom.Core.Serial` namespace - `SimpleObservableSerialPort`, `TcpObservablePort`, `SerialStateContext`
- `TeensyRom.Core.Serial.State` namespace - State machine classes
- `TeensyRom.Core.Entities.Device` namespace - `Cart` entity with `ConnectionType` property
- `TeensyRom.Core.Logging` namespace - `ILoggingService`
- `TeensyRom.Core.Alert` namespace - `IAlertService` (likely path, verify)

**Constraints**:
- Must maintain backwards compatibility with `ISerialFactory` (keep existing factory)
- Must handle all enum values of `ConnectionType` (Serial, Tcp)
- Must validate input parameters (port name, endpoint format)
- Must dispose resources properly (implement IDisposable pattern if needed)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Serial/IDeviceTransportFactory.cs` - Factory interface
- `src/apps/api/src/TeensyRom.Core.Serial/DeviceTransportFactory.cs` - Factory implementation
- `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/DeviceTransportFactoryTests.cs` - Factory tests

**Files to Modify**:
- (None for this task - factory is new, ISerialFactory remains for compatibility)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Serial/SerialFactory.cs` - Existing factory pattern to follow
- `src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs` - Serial transport
- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - TCP transport
- `src/apps/api/src/TeensyRom.Core.Serial/State/SerialStateContext.cs` - State context wrapper

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns

**Key Requirements**:

1. **IDeviceTransportFactory Interface**:
   ```csharp
   public interface IDeviceTransportFactory
   {
       ISerialStateContext Create(Cart cart);
       ISerialStateContext CreateSerial(string portName);
       ISerialStateContext CreateTcp(string endpoint);
   }
   ```
   - `Create(Cart)`: Creates transport based on `cart.ConnectionType`
   - `CreateSerial(string)`: Creates Serial transport (COM port)
   - `CreateTcp(string)`: Creates TCP transport (ip:port endpoint)

2. **DeviceTransportFactory Implementation**:
   - Constructor accepts `ILoggingService` and `IAlertService` dependencies
   - `Create(Cart cart)` implementation:
     - Switch on `cart.ConnectionType`
     - For `Serial`: call `CreateSerial(cart.ComPort)`
     - For `Tcp`: call `CreateTcp($"{cart.IpAddress}:{cart.TcpPort}")`
     - Throw `ArgumentException` for unknown `ConnectionType` values
   - `CreateSerial(string portName)` implementation:
     - Create `SimpleObservableSerialPort` instance
     - Create `SerialStateContext` wrapper
     - Call `serial.SetPort(portName)` on the port
     - Return the context
   - `CreateTcp(string endpoint)` implementation:
     - Validate endpoint format using `NetworkHelper.TryParseEndpoint()`
     - Create `TcpObservablePort` instance
     - Create `SerialStateContext` wrapper
     - Call `port.SetPort(endpoint)` on the port
     - Return the context

3. **Error Handling**:
   - `Create()` throws `ArgumentException` for unknown `ConnectionType`
   - `CreateTcp()` throws `ArgumentException` for invalid endpoint format
   - Follow existing factory pattern for error handling

4. **DI Registration** (not part of this task, but note for next task):
   - Register `IDeviceTransportFactory` as singleton in DI container
   - Keep `ISerialFactory` registered for backwards compatibility

**Anti-Patterns to Avoid**:
- Don't modify or remove `ISerialFactory` (maintain backwards compatibility)
- Don't hardcode transport creation - use `ConnectionType` to decide
- Don't forget to call `SetPort()` on the transport before returning
- Don't throw exceptions for valid inputs (only for invalid/unexpected values)

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] `CreateSerial()` returns `SerialStateContext` with `SimpleObservableSerialPort`
- [ ] `CreateSerial()` calls `SetPort()` with the provided port name
- [ ] `CreateTcp()` returns `SerialStateContext` with `TcpObservablePort`
- [ ] `CreateTcp()` calls `SetPort()` with the provided endpoint
- [ ] `CreateTcp()` throws `ArgumentException` for invalid endpoint format
- [ ] `Create(Cart)` with `ConnectionType.Serial` calls `CreateSerial()`
- [ ] `Create(Cart)` with `ConnectionType.Tcp` calls `CreateTcp()`
- [ ] `Create(Cart)` throws `ArgumentException` for unknown `ConnectionType`
- [ ] Factory injects `ILoggingService` and `IAlertService` into transports

**Integration Context**:
- Tests should verify factory creates correct transport type based on `ConnectionType`
- Tests should verify transports are properly configured (SetPort called)

**Behavioral Expectations**:
- Factory creates working transport contexts for both Serial and TCP
- Transports are ready to connect after creation (SetPort already called)
- Invalid inputs throw appropriate exceptions with descriptive messages

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-2) - Overall project plan
- [Phase 2 Plan](../phases/TCP-SUPPORT-PHASE-02-DOMAIN-MODEL-EXTENSIONS.md) - Current phase details
- [SerialFactory](../../../../src/apps/api/src/TeensyRom.Core.Serial/SerialFactory.cs) - Existing factory pattern
- [Task 2-001 Report](../reports/TCP-SUPPORT-TASK-02-001-REPORT.md) - Cart entity extension

**Related Tasks**:
- TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY: Extend Cart entity (completed) - provides ConnectionType
- TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO: Extend CartDto (completed) - mirrors Cart changes
- TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER: Update CartFinder (next) - will use this factory

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-02-003-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-02-003-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
