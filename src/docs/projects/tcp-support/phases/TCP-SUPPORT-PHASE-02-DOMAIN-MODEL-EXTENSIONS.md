# TCP-SUPPORT Phase 2: Domain Model Extensions & Factory

## 🎯 Objective

Extend the domain models to support both Serial and TCP connection types, and create a unified transport factory that can create either Serial or TCP connections based on device configuration. This phase bridges the TCP transport with the existing device management system.

**Value**: Completing this phase enables the device management system to work with both Serial and TCP devices seamlessly, using the same `Cart` entity and `CartDto` for both transport types.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md) - High-level feature plan
- [x] [Phase 1 Completion Reports](../reports/) - TCP transport implementation context

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [ ] [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns and state machine

---

## 📋 Task Breakdown

<details open>
<summary><h3>Task 1: Extend Cart Entity with TCP Properties</h3></summary>

**Purpose**: Extend the `Cart` entity with TCP connection properties and computed display property.

**Task Handoff**: [TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY.md](../tasks/TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY.md)

**Implementation Subtasks**:

- [ ] Add `ConnectionType` property (enum, default: Serial)
- [ ] Add `IpAddress` property (string, default: empty)
- [ ] Add `TcpPort` property (int, default: 80)
- [ ] Add `ConnectionDisplay` computed property (returns "Port: COM3" or "IP: 192.168.1.42:80")
- [ ] Verify backwards compatibility with existing serial devices

</details>

---

<details open>
<summary><h3>Task 2: Extend CartDto API Model</h3></summary>

**Purpose**: Extend the `CartDto` API model with TCP connection properties and update `FromDevice()` mapping.

**Task Handoff**: [TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO.md](../tasks/TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO.md)

**Implementation Subtasks**:

- [ ] Add `ConnectionType` property with `[Required]` attribute
- [ ] Add `IpAddress` property with `[Required]` attribute
- [ ] Add `TcpPort` property with `[Required]` attribute
- [ ] Update `FromDevice()` to map new properties from `Cart`
- [ ] Verify API serialization/deserialization works correctly

</details>

---

<details open>
<summary><h3>Task 3: Create Device Transport Factory</h3></summary>

**Purpose**: Create `IDeviceTransportFactory` interface and `DeviceTransportFactory` implementation for creating Serial or TCP transports.

**Task Handoff**: [TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY.md](../tasks/TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY.md)

**Implementation Subtasks**:

- [ ] Create `IDeviceTransportFactory` interface with `Create()`, `CreateSerial()`, `CreateTcp()` methods
- [ ] Create `DeviceTransportFactory` class implementing the interface
- [ ] `Create(Cart)` creates correct transport based on `cart.ConnectionType`
- [ ] `CreateSerial()` creates Serial transport with `SimpleObservableSerialPort`
- [ ] `CreateTcp()` creates TCP transport with `TcpObservablePort`
- [ ] Inject `ILoggingService` and `IAlertService` dependencies

</details>

---

<details open>
<summary><h3>Task 4: Update CartFinder for Serial Devices</h3></summary>

**Purpose**: Update `CartFinder.FindDevices()` to set `ConnectionType.Serial` on discovered serial devices.

**Task Handoff**: [TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER.md](../tasks/TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER.md)

**Implementation Subtasks**:

- [ ] Set `cart.ConnectionType = ConnectionType.Serial` in `FindDevices()` method
- [ ] Verify property is set before `TeensyRomDevice` is created
- [ ] Ensure existing serial device discovery continues to work

</details>

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core/Entities/Device/
├── Cart.cs                                    📝 Modify - Add TCP properties
└── TeensyRomDevice.cs                         📖 Read - Device wrapper

apps/api/src/TeensyRom.Api/Models/
└── CartDto.cs                                 📝 Modify - Add TCP properties to DTO

apps/api/src/TeensyRom.Core.Serial/
├── SerialFactory.cs                           📖 Read - Existing factory pattern
└── IDeviceTransportFactory.cs                 ✨ New - Unified transport factory interface

apps/api/src/TeensyRom.Core.Device/
├── DeviceTransportFactory.cs                  ✨ New - Factory implementation
└── CartFinder.cs                              📝 Modify - Set ConnectionType.Serial

apps/api/src/TeensyRom.Core.Device.Tests/
└── Device/DeviceTransportFactoryTests.cs      ✨ New - Factory tests
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **class names**, **method names**, **interface names**, **property names**
> - Small code snippets (2-5 lines) are OK for critical type definitions only
> - **NO large code blocks** - link to standards docs or existing implementations instead
> - Prefer describing behavior over showing implementation
>
> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable behaviors, not implementation details
> - Include tests **within each task** as work progresses, not at the end
> - See [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) for behavioral testing guidance

---

## 🎯 Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] `Cart` entity extended with `ConnectionType`, `IpAddress`, `TcpPort` properties
- [ ] `Cart.ConnectionDisplay` computed property returns correct display string
- [ ] `CartDto` extended with same connection properties
- [ ] `CartDto.FromDevice()` maps new connection properties correctly
- [ ] `IDeviceTransportFactory` interface and implementation created
- [ ] `DeviceTransportFactory` creates correct transport based on `ConnectionType`
- [ ] `CartFinder` sets `ConnectionType.Serial` on discovered serial devices
- [ ] All implementations follow [Coding Standards](../../../../src/docs/CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No C# compilation errors or warnings
- [ ] Code follows existing C# patterns and conventions
- [ ] Code formatting is consistent
- [ ] No console errors when running tests

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 3 (Device Manager Integration)

---

## 📝 Notes & Considerations

### Design Decisions

- **Backwards Compatibility**: Maintain existing `ISerialFactory` for backwards compatibility - new `IDeviceTransportFactory` will replace it over time
- **Computed Display Property**: `ConnectionDisplay` provides user-friendly string like "Port: COM3" or "IP: 192.168.1.42:80"
- **Factory Pattern**: `IDeviceTransportFactory` uses `Cart.ConnectionType` to decide which transport to create
- **Default Values**: TCP port defaults to 80 (TeensyROM hardware standard), `IpAddress` defaults to empty string for serial devices

### Implementation Constraints

- **Breaking Changes**: None - all changes are additive (new properties have defaults)
- **Database Migration**: No database exists (settings are file-based), no migration needed
- **API Compatibility**: New DTO properties are optional for serial devices (use defaults)

### Future Enhancements

- **TCP Device Persistence**: Store discovered TCP devices to avoid re-scanning on startup
- **Connection Pooling**: Support multiple TCP endpoints for failover scenarios
- **Connection Quality Metrics**: Add latency/packet loss tracking for TCP connections

---

## 🎓 Next Steps After Phase 2

Upon completion of Phase 2, the following tasks will be ready:

1. **Phase 3, Task 1**: Integrate `TcpDeviceFinder` into `DeviceConnectionManager` for network scanning
2. **Phase 3, Task 2**: Handle TCP reconnection in `ConnectToNextPort()`
3. **Phase 3, Task 3**: Update health check logging with `ConnectionDisplay` property

The domain models will be ready for dual transport support, and the factory pattern will enable seamless creation of either Serial or TCP connections.

---

## 📂 Task Handoff Files

**New Task Files Created**:

- [TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY.md](../tasks/TCP-SUPPORT-TASK-02-001-EXTEND-CART-ENTITY.md) (Task 1)
- [TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO.md](../tasks/TCP-SUPPORT-TASK-02-002-EXTEND-CART-DTO.md) (Task 2)
- [TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY.md](../tasks/TCP-SUPPORT-TASK-02-003-TRANSPORT-FACTORY.md) (Task 3)
- [TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER.md](../tasks/TCP-SUPPORT-TASK-02-004-UPDATE-CART-FINDER.md) (Task 4)

