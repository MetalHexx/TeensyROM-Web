# CART-REFACTOR Phase 1: Core Entity Refactoring

## 🎯 Phase Objective

Eliminate connection state duplication by extending `ICommunicationPort` to expose connection information, removing connection fields from `Cart`, and making `TeensyRomDevice` compute connection properties from the actual port state. This phase completes the entire refactoring in one focused effort.

**What This Phase Delivers**:
- Single source of truth for connection state (ICommunicationPort)
- Cart becomes a pure configuration/discovery DTO
- TeensyRomDevice exposes computed connection properties
- All device management and reconnection logic updated
- Full test coverage maintained

---

## 📋 Task Breakdown

### Task 1: Extend ICommunicationPort Interface

**Purpose**: Add `GetEndpoint()` and `GetConnectionType()` methods to the communication port abstraction so connection info can be queried from the port itself rather than stored redundantly.

**Task Handoff**: [CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE.md](../tasks/CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE.md)

**Implementation Subtasks**:
- [ ] Add `string GetEndpoint()` method to `ICommunicationPort` interface
- [ ] Add `ConnectionType GetConnectionType()` method to `ICommunicationPort` interface
- [ ] Implement `GetEndpoint()` in `SimpleObservableSerialPort` (return `_serialPort.PortName`)
- [ ] Implement `GetConnectionType()` in `SimpleObservableSerialPort` (return `ConnectionType.Serial`)
- [ ] Implement `GetEndpoint()` in `TcpObservablePort` (return `_endpoint`)
- [ ] Implement `GetConnectionType()` in `TcpObservablePort` (return `ConnectionType.Tcp`)
- [ ] Add XML doc comments explaining method contracts

**Files Modified**: 3
- `ICommunicationPort.cs`
- `SimpleObservableSerialPort.cs`
- `TcpObservablePort.cs`

---

### Task 2: Refactor Core Entity Structure

**Purpose**: Remove connection properties from Cart (eliminating the shadow copy), add computed properties to TeensyRomDevice that delegate to ICommunicationPort, and update CartFinder to stop populating the removed fields.

**Task Handoff**: [CART-REFACTOR-TASK-01-002-CORE-ENTITIES.md](../tasks/CART-REFACTOR-TASK-01-002-CORE-ENTITIES.md)

**Implementation Subtasks**:
- [ ] Remove 4 properties from `Cart.cs`: `ComPort`, `IpAddress`, `TcpPort`, `ConnectionType`
- [ ] Add computed properties to `TeensyRomDevice.cs`:
  - `public string ComPort => CommunicationPort.GetEndpoint()`
  - `public string IpAddress => ExtractIpAddress(CommunicationPort.GetEndpoint())`
  - `public int TcpPort => ExtractPort(CommunicationPort.GetEndpoint())`
  - `public ConnectionType ConnectionType => CommunicationPort.GetConnectionType()`
- [ ] Add helper methods for parsing TCP endpoint: `ExtractIpAddress()`, `ExtractPort()`
- [ ] Update `CartFinder.ValidateAndCreateDevice()` to remove lines setting Cart connection fields (lines 134-137)
- [ ] Update `CartDto` mapping if it references removed Cart fields

**Files Modified**: 4
- `Cart.cs`
- `TeensyRomDevice.cs`
- `CartFinder.cs`
- `CartDto.cs` (if needed for API mapping)

---

### Task 3: Update Device Management & Reconnection

**Purpose**: Update all consumers of connection properties to use the new computed properties on TeensyRomDevice, and fix reconnection strategies to stop updating Cart fields (which no longer exist).

**Task Handoff**: [CART-REFACTOR-TASK-01-003-DEVICE-MANAGEMENT.md](../tasks/CART-REFACTOR-TASK-01-003-DEVICE-MANAGEMENT.md)

**Implementation Subtasks**:
- [ ] Update `DeviceConnectionManager.ReconnectDevice()` to use `device.ConnectionType` (not `device.Cart.ConnectionType`)
- [ ] Update `SerialReconnectionStrategy.TryReconnect()` to remove line setting `device.Cart.ComPort` (line 55)
- [ ] Update `TcpReconnectionStrategy.TryReconnect()` to remove line setting `device.Cart.IpAddress` (if exists)
- [ ] Update `IDeviceTransportFactory.Create(Cart cart)` signature if needed
- [ ] Search for all `device.Cart.ComPort` / `device.Cart.IpAddress` / `device.Cart.ConnectionType` references
- [ ] Replace with `device.ComPort` / `device.IpAddress` / `device.ConnectionType`
- [ ] Update all test files that mock or assert on Cart connection properties
- [ ] Run full test suite and fix any compilation errors

**Files Modified**: ~5-7 files
- `DeviceConnectionManager.cs`
- `SerialReconnectionStrategy.cs`
- `TcpReconnectionStrategy.cs`
- `DeviceTransportFactory.cs` (possibly)
- Test files (various)

---

## ✅ Phase Completion Criteria

- [ ] `ICommunicationPort` has `GetEndpoint()` and `GetConnectionType()` methods
- [ ] Serial and TCP port implementations return correct values
- [ ] `Cart` has no connection-related properties (4 removed)
- [ ] `TeensyRomDevice` computes connection properties from `CommunicationPort`
- [ ] `CartFinder` creates devices without setting removed Cart fields
- [ ] `DeviceConnectionManager` uses computed properties
- [ ] Reconnection strategies don't attempt to set Cart properties
- [ ] All existing unit and integration tests pass
- [ ] No compilation errors in backend projects
- [ ] Reconnection scenarios work correctly (verified via existing tests)

---

## 🧪 Testing Focus

### Key Test Scenarios
1. **Connection Info Accuracy**: `device.ComPort` matches actual port state
2. **Reconnection Updates**: After reconnection, computed properties reflect new connection
3. **Type Detection**: Serial devices return Serial, TCP devices return Tcp
4. **Endpoint Parsing**: TCP endpoints correctly parse IP and port
5. **Strategy Selection**: DeviceConnectionManager selects correct strategy by type

### Test Files to Update
- `DeviceConnectionManagerTests.cs` - Update Cart construction to remove connection fields
- `SerialReconnectionStrategyTests.cs` - Verify strategy doesn't set Cart properties
- `TcpReconnectionStrategyTests.cs` - Verify strategy doesn't set Cart properties
- `CartFinderTests.cs` - Verify devices created without Cart connection fields

---

## 📊 Risk Assessment

**Risk Level**: Low

**Rationale**:
- Pure backend refactoring (no frontend impact)
- No new functionality (just restructuring)
- Comprehensive test coverage exists
- Breaking changes are compile-time errors (easy to find)

**Mitigation**:
- Run tests after each task
- Use compiler errors to find all Cart property usages
- Search codebase for string patterns (`device.Cart.ComPort`, etc.)

---

## 🚀 Execution Strategy

**Sequential Task Execution**:
1. Task 1 first (foundation)
2. Task 2 second (core entities)
3. Task 3 last (wire everything together)

**Validation Points**:
- After Task 1: Interface compiles, implementations work
- After Task 2: Entities compile, CartFinder works
- After Task 3: All tests green, reconnection verified

**Estimated Duration**: 1-2 hours focused work

---

## 📝 Notes

- This refactoring has no user-facing changes (internal architecture only)
- OpenAPI spec may need regeneration if CartDto changes
- Frontend API client should automatically update if DTOs change
- Consider adding integration test specifically for reconnection state accuracy
