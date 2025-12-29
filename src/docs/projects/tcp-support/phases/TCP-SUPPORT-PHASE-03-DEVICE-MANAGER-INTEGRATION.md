# TCP-SUPPORT Phase 3: Device Manager Integration

## 🎯 Objective

Refactor `CartFinder` and `DeviceConnectionManager` to support both Serial and TCP devices through a unified discovery and validation pipeline. Create transport-agnostic strategies for device discovery and reconnection, enabling seamless management of devices across both transport types.

**Value**: Completing this phase enables the device management system to discover, connect, and manage both Serial and TCP devices through the same unified code paths. Users will see both device types in the UI with appropriate icons and connection details.

**Key Design**: Separate "finding endpoints" from "validating devices" using strategy pattern. Both Serial and TCP discovery return `DiscoveredEndpoint` records, which then flow through a common validation pipeline (version check, tag ensure, device creation).

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md) - High-level feature plan
- [ ] [Phase 1 Completion Reports](../reports/) - TCP transport implementation context
- [ ] [Phase 2 Completion Reports](../reports/) - Domain model and factory context

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [ ] [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns and state machine

---

## 📋 Task Breakdown

<details open>
<summary><h3>Task 1: Create Discovery Strategy Pattern</h3></summary>

**Purpose**: Create the `IDiscoveryStrategy` interface and `DiscoveredEndpoint` record type, along with Serial and TCP discovery strategy implementations. This separates "finding endpoints" from "validating devices" and enables both transports to use the same validation pipeline.

**Task Handoff**: [TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES.md](../tasks/TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES.md)

**Implementation Subtasks**:

- [ ] Create `IDiscoveryStrategy` interface with `FindEndpoints(CancellationToken)` method
- [ ] Create `DiscoveredEndpoint` record with `ConnectionType`, `Address`, `Port?` properties
- [ ] Create `SerialDiscoveryStrategy` wrapping `SerialHelper.GetPorts()`
- [ ] Create `TcpDiscoveryStrategy` wrapping `TcpDeviceFinder.ScanLocalSubnet()`
- [ ] Both strategies return `List<DiscoveredEndpoint>` for parallel processing

</details>

---

<details open>
<summary><h3>Task 2: Refactor CartFinder with Unified Pipeline</h3></summary>

**Purpose**: Refactor `CartFinder` to orchestrate parallel discovery of all endpoints, then apply a common validation pipeline (version check, tag ensure, device creation) to all discovered endpoints regardless of transport type.

**Task Handoff**: [TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER.md](../tasks/TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER.md)

**Implementation Subtasks**:

- [ ] Accept `IEnumerable<IDiscoveryStrategy>` in constructor (DI injection)
- [ ] Create `DiscoverAllEndpoints()` running all strategies in parallel via `Task.WhenAll()`
- [ ] Create `ValidateAndCreateDevice()` unified pipeline method
- [ ] Unified pipeline: create transport → open → version check → ensure tags → create device
- [ ] Route to correct transport based on `endpoint.ConnectionType`
- [ ] Set `Cart.ConnectionType`, `ComPort`/`IpAddress`, `TcpPort` based on endpoint
- [ ] Keep existing DeviceId resolution and storage logic

</details>

---

<details open>
<summary><h3>Task 3: Create Reconnection Strategy Pattern</h3></summary>

**Purpose**: Create `IReconnectionStrategy` interface with Serial (COM port hunting) and TCP (retry with backoff) implementations. This enables transport-agnostic reconnection in `DeviceConnectionManager`.

**Task Handoff**: [TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES.md](../tasks/TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES.md)

**Implementation Subtasks**:

- [ ] Create `IReconnectionStrategy` interface with `TryReconnect(TeensyRomDevice, CancellationToken)`
- [ ] Create `SerialReconnectionStrategy` extracting existing COM port hunting logic
- [ ] Create `TcpReconnectionStrategy` with 3 retry attempts, 500ms/1s/1.5s backoff
- [ ] TCP strategy: retry same endpoint, then fail (no network rescan fallback)
- [ ] Both strategies return `bool` indicating success/failure
- [ ] Both strategies update `Cart.ComPort` or `Cart.IpAddress` on success

</details>

---

<details open>
<summary><h3>Task 4: Rename Reconnect Method and Use Strategy</h3></summary>

**Purpose**: Rename `ConnectToNextPort()` to `ReconnectDevice()` and refactor to use `IReconnectionStrategy` based on `Cart.ConnectionType`.

**Task Handoff**: [TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT.md](../tasks/TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT.md)

**Implementation Subtasks**:

- [ ] Accept `IReconnectionStrategy` implementations via DI (serial and TCP)
- [ ] Rename `ConnectToNextPort(string deviceId)` to `ReconnectDevice(string deviceId)`
- [ ] Select strategy based on `device.Cart.ConnectionType`
- [ ] Remove `GetAvailablePorts()` helper (moved to SerialReconnectionStrategy)
- [ ] Update error logging to use `Cart.ConnectionDisplay`
- [ ] Update all call sites to use new method name

</details>

---

<details open>
<summary><h3>Task 5: Update Health Check Logging</h3></summary>

**Purpose**: Update health check logging in `DeviceConnectionManager` to use `Cart.ConnectionDisplay` property instead of hardcoded `ComPort`.

**Task Handoff**: [TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING.md](../tasks/TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING.md)

**Implementation Subtasks**:

- [ ] Update line 249: use `{d.Cart.ConnectionDisplay}` instead of `{d.Cart.ComPort}`
- [ ] Update line 291: use `{device.Cart.ConnectionDisplay}` instead of `{device.Cart.ComPort}`
- [ ] Verify log messages show "Port: COM3" for Serial and "IP: 192.168.1.42:80" for TCP
- [ ] No other changes to health check logic (it already works for both transports)

</details>

---

<details open>
<summary><h3>Task 6: Register Services in DI Container</h3></summary>

**Purpose**: Register all new services (discovery strategies, reconnection strategies, TCP finder, transport factory) in the DI container.

**Task Handoff**: [TCP-SUPPORT-TASK-03-006-DI-REGISTRATION.md](../tasks/TCP-SUPPORT-TASK-03-006-DI-REGISTRATION.md)

**Implementation Subtasks**:

- [ ] Register `IDiscoveryStrategy` implementations (Serial, Tcp) as singleton
- [ ] Register `IReconnectionStrategy` implementations (Serial, Tcp) as singleton
- [ ] Register `ITcpDeviceFinder` as singleton (if not already registered)
- [ ] Register `IDeviceTransportFactory` as singleton (from Phase 2)
- [ ] Keep `ISerialFactory` registered for backwards compatibility
- [ ] Verify all CartFinder and DeviceConnectionManager dependencies are registered

</details>

---

<details open>
<summary><h3>Task 7: Integration Tests</h3></summary>

**Purpose**: Write integration tests for mixed Serial/TCP device scenarios, reconnection logic, and health checks.

**Task Handoff**: [TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS.md](../tasks/TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS.md)

**Implementation Subtasks**:

- [ ] Test mixed transport discovery (2 Serial + 1 TCP devices)
- [ ] Test Serial reconnection: port hunting through available COM ports
- [ ] Test TCP reconnection: retry with backoff, then fail
- [ ] Test health check removes disconnected TCP device
- [ ] Test health check logs use `ConnectionDisplay` correctly
- [ ] Test parallel discovery runs Serial and TCP strategies simultaneously
- [ ] Verify all tests pass with no regressions

</details>

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core.Device/
├── IDiscoveryStrategy.cs                      ✨ New - Discovery strategy interface
├── DiscoveredEndpoint.cs                      ✨ New - Endpoint record type
├── SerialDiscoveryStrategy.cs                 ✨ New - Serial port discovery
├── TcpDiscoveryStrategy.cs                    ✨ New - Network discovery wrapper
├── IReconnectionStrategy.cs                   ✨ New - Reconnection strategy interface
├── SerialReconnectionStrategy.cs              ✨ New - Serial reconnection logic
├── TcpReconnectionStrategy.cs                 ✨ New - TCP reconnection logic
├── CartFinder.cs                              📝 Modify - Orchestrate strategies
└── DeviceConnectionManager.cs                 📝 Modify - Use reconnection strategies

apps/api/src/TeensyRom.Api/Startup/
└── ServiceStartupExtensions.cs                📝 Modify - Register new services

apps/api/src/TeensyRom.Core.Device.Tests/
└── Device/
    ├── ReconnectionStrategyTests.cs           ✨ New - Strategy tests
    └── CartDiscoveryTests.cs                  📝 Modify - Add mixed transport tests
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

> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable behaviors, not implementation details
> - Include tests **within each task** as work progresses, not at the end
> - See [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) for behavioral testing guidance

---

## 🎯 Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] `IDiscoveryStrategy` interface and `DiscoveredEndpoint` record created
- [ ] `SerialDiscoveryStrategy` and `TcpDiscoveryStrategy` implemented
- [ ] `CartFinder` refactored with parallel discovery and unified validation
- [ ] `IReconnectionStrategy` interface with Serial and TCP implementations
- [ ] `ConnectToNextPort()` renamed to `ReconnectDevice()` using strategy pattern
- [ ] Health check logging uses `Cart.ConnectionDisplay` property
- [ ] All new services registered in DI container
- [ ] Integration tests pass for mixed transport scenarios

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] No regressions in existing Serial device functionality

**Quality Checks:**

- [ ] No C# compilation errors or warnings
- [ ] Code follows existing C# patterns and conventions
- [ ] Code formatting is consistent
- [ ] No console errors when running tests

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 4 (API Endpoint) or Phase 5 (Frontend)

---

## 📝 Notes & Considerations

### Design Decisions

- **Unified Pipeline**: Both Serial and TCP endpoints flow through the same validation logic (version check, tag ensure, device creation), eliminating code duplication
- **Parallel Discovery**: Serial and TCP strategies run via `Task.WhenAll()` for fastest results (~1 second total vs ~1.1 seconds serial)
- **TCP Reconnection**: 3 retry attempts with exponential backoff (500ms, 1s, 1.5s), then fail. No network rescan fallback to keep it simple.
- **Strategy Pattern**: Separates transport-specific discovery/reconnection logic from common orchestration/validation
- **Method Rename**: `ConnectToNextPort()` → `ReconnectDevice()` better reflects the new transport-agnostic behavior

### Implementation Constraints

- **Breaking Changes**: Method rename `ConnectToNextPort()` → `ReconnectDevice()` is a breaking change for any external callers (verify no external API depends on this)
- **No Network Rescan**: TCP reconnection does NOT rescan the network - just retries the same endpoint. Can be added later if needed.
- **Backwards Compatibility**: `ISerialFactory` remains registered for backwards compatibility

### Future Enhancements

- **TCP Device Persistence**: Store discovered TCP devices to avoid re-scanning on startup
- **Network Rescan on Reconnect**: Add optional network rescan in `TcpReconnectionStrategy` for DHCP lease changes
- **Connection Pooling**: Support multiple TCP endpoints for failover scenarios
- **Connection Quality Metrics**: Add latency/packet loss tracking for TCP connections

---

## 🎓 Next Steps After Phase 3

Upon completion of Phase 3, the following tasks will be ready:

1. **Phase 4, Task 1**: Determine API approach for TCP device discovery (separate endpoint vs extend existing)
2. **Phase 4, Task 2**: Implement chosen API endpoint approach with rate limiting
3. **Phase 5, Task 1**: Regenerate API client and extend frontend Device interface
4. **Phase 5, Task 2**: Update device-item component to show connection icon and details

The backend will be fully ready for dual transport support, and the API/frontend phases can consume this unified infrastructure.

---

## 📂 Task Handoff Files

**New Task Files Created**:

- [TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES.md](../tasks/TCP-SUPPORT-TASK-03-001-DISCOVERY-STRATEGIES.md) (Task 1)
- [TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER.md](../tasks/TCP-SUPPORT-TASK-03-002-REFACTOR-CART-FINDER.md) (Task 2)
- [TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES.md](../tasks/TCP-SUPPORT-TASK-03-003-RECONNECTION-STRATEGIES.md) (Task 3)
- [TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT.md](../tasks/TCP-SUPPORT-TASK-03-004-RENAME-RECONNECT.md) (Task 4)
- [TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING.md](../tasks/TCP-SUPPORT-TASK-03-005-HEALTH-CHECK-LOGGING.md) (Task 5)
- [TCP-SUPPORT-TASK-03-006-DI-REGISTRATION.md](../tasks/TCP-SUPPORT-TASK-03-006-DI-REGISTRATION.md) (Task 6)
- [TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS.md](../tasks/TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS.md) (Task 7)
