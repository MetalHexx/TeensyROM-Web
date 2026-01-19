# Cart Refactoring - Master Plan

**Project Overview**: Eliminate connection state duplication between `Cart` and `ICommunicationPort` by removing connection properties from Cart (ComPort, IpAddress, TcpPort, ConnectionType) and exposing this information directly through ICommunicationPort. This solves the synchronization problem where connection state can become stale during reconnection scenarios.

**Standards Documentation**:
- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)

---

## 🎯 Project Objective

Currently, `Cart` stores connection information (ComPort, IpAddress, TcpPort, ConnectionType) as a "shadow copy" of the actual runtime state in `ICommunicationPort`. This creates a dual source of truth where the Cart properties can fall out of sync with the actual port state, especially during reconnection when COM ports change.

**The Solution**: Make connection info computed from `ICommunicationPort` rather than stored in `Cart`. This ensures a single source of truth—the actual communication port always reflects the current connection state.

**User Value**: 
- Eliminates bugs where device connection info is stale after reconnection
- Reduces complexity by removing redundant state management
- Makes reconnection logic more robust and predictable

**Technical Benefits**:
- Single source of truth for connection state
- Impossible for connection info to fall out of sync
- Cleaner separation: Cart = discovery config, ICommunicationPort = runtime state
- Simplifies CartFinder by removing connection property population

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Refactor Core Entities & Interfaces</h3></summary>

### Objective

Extend `ICommunicationPort` to expose connection information, remove connection fields from `Cart`, add computed properties to `TeensyRomDevice`, and update all direct consumers of these entities.

### Key Deliverables

- [ ] `ICommunicationPort` extended with `GetEndpoint()` and `GetConnectionType()` methods
- [ ] Both `SimpleObservableSerialPort` and `TcpObservablePort` implement new interface methods
- [ ] `Cart.cs` has 4 properties removed (ComPort, IpAddress, TcpPort, ConnectionType)
- [ ] `TeensyRomDevice.cs` has computed properties for connection info
- [ ] `CartFinder.cs` updated to stop populating removed Cart properties
- [ ] `DeviceConnectionManager.cs` updated to use new computed properties
- [ ] All reconnection strategies updated (SerialReconnectionStrategy, TcpReconnectionStrategy)
- [ ] All tests passing with updated entity structure

### High-Level Tasks

1. **Extend ICommunicationPort Interface & Implementations** - Add connection info methods to interface and implement in Serial/TCP port classes (3 files)
2. **Refactor Core Entity Structure** - Remove Cart connection fields, add TeensyRomDevice computed properties, update CartFinder (4 files)  
3. **Update Device Manager & Reconnection** - Fix all callers of connection properties in device management and reconnection logic (3 files + tests)

</details>

---

## 🏗️ Architecture Overview

### Current Problem
```
Cart {
  ComPort: "COM3"          // ❌ Can become stale
  IpAddress: "192.168.1.42" // ❌ Can become stale
  ConnectionType: Serial   // ❌ Shadow copy
}

ICommunicationPort {
  _serialPort.PortName = "COM5"  // ✅ Actual state (after reconnection)
}
```

### Solution Architecture
```
ICommunicationPort {
  + GetEndpoint(): string           // Returns "COM5" or "192.168.1.42:80"
  + GetConnectionType(): ConnectionType  // Returns Serial/Tcp
}

Cart {
  DeviceId, Name, FwVersion, IsCompatible  // ✅ Config only
  SdStorage, UsbStorage                     // ✅ Discovery info
  // ❌ REMOVED: ComPort, IpAddress, TcpPort, ConnectionType
}

TeensyRomDevice {
  Cart (config)
  CommunicationPort (runtime state)
  
  // Computed properties (always current)
  ComPort => CommunicationPort.GetEndpoint()
  ConnectionType => CommunicationPort.GetConnectionType()
}
```

### Key Integration Points

- **CartFinder**: Stops populating connection fields on Cart (they no longer exist)
- **DeviceConnectionManager**: Uses `device.ComPort` instead of `device.Cart.ComPort`
- **Reconnection Strategies**: Update connection state via ICommunicationPort methods, not Cart properties
- **API DTOs**: Map from computed properties instead of Cart fields

---

## 🧪 Testing Strategy

### Unit Testing
- ICommunicationPort implementations return correct endpoint/type info
- TeensyRomDevice computed properties delegate correctly
- Cart no longer has connection properties (compilation check)

### Integration Testing  
- DeviceConnectionManager selects correct strategy using computed properties
- Reconnection updates port state correctly (visible via computed properties)
- CartFinder creates valid devices without setting connection fields on Cart

### Behavioral Testing
- After reconnection, `device.ComPort` reflects new port (not stale)
- TCP/Serial devices report correct connection type
- Device discovery works without Cart connection fields

---

## ✅ Success Criteria

- [ ] Cart has no connection-related properties (ComPort, IpAddress, TcpPort, ConnectionType removed)
- [ ] All connection info flows through ICommunicationPort.GetEndpoint()/GetConnectionType()
- [ ] TeensyRomDevice has computed properties that delegate to CommunicationPort
- [ ] All existing tests pass with refactored structure
- [ ] No compilation errors or breaking changes to public APIs
- [ ] Reconnection scenarios work correctly (connection info stays current)
- [ ] CartFinder creates devices without populating removed Cart fields

---

## 📦 Deliverables Summary

**Phase 1** (3 substantial tasks):
1. Interface & implementations (ICommunicationPort + Serial/TCP ports)
2. Core entities (Cart, TeensyRomDevice, CartFinder)
3. Device management (DeviceConnectionManager + reconnection strategies + tests)

**Total Estimated Files**: ~10-12 files modified across the backend
**Estimated Effort**: 1 focused session with substantial tasks
**Risk Level**: Low (internal refactoring, no frontend changes)

---

## 🚀 Execution Roadmap

### Phase 1 Execution Order

```
TASK 1: Extend ICommunicationPort
  ├─ Add GetEndpoint() and GetConnectionType() to interface
  ├─ Implement in SimpleObservableSerialPort  
  └─ Implement in TcpObservablePort
  
TASK 2: Refactor Core Entities
  ├─ Remove 4 connection properties from Cart
  ├─ Add computed properties to TeensyRomDevice
  └─ Update CartFinder to stop populating removed fields
  
TASK 3: Update Device Management  
  ├─ Fix DeviceConnectionManager to use computed properties
  ├─ Update reconnection strategies (stop setting Cart properties)
  ├─ Fix all test files
  └─ Verify all tests pass
```

### Dependencies
- Task 1 must complete before Task 2 (need interface methods available)
- Task 2 must complete before Task 3 (entities must be restructured)
- All tasks are backend-only (no frontend coordination needed)

---

## 📝 Open Questions

**None** - Architecture is well-defined, implementation is straightforward refactoring.

---

## 🎯 First Task

**Start with**: [CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE.md](tasks/CART-REFACTOR-TASK-01-001-COMMUNICATION-PORT-INTERFACE.md)

This task extends the ICommunicationPort abstraction to expose connection information, enabling the rest of the refactoring.
