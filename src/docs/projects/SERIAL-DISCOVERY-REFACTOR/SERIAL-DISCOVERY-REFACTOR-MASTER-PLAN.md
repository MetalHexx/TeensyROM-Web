# Serial Discovery Strategy Refactoring

## 🎯 Project Objective

Refactor `SerialDiscoveryStrategy` to properly handle devices in minimal firmware mode, add COM port caching for faster discovery, and reduce code duplication by creating a reusable `EnsureNormalFirmware()` extension method in `TRStreamExtensions`.

**User Value**: Faster device discovery on subsequent connections using cached COM ports, and reliable device detection regardless of firmware state (normal or minimal mode).

**Technical Value**: Clean separation of concerns between "ensure device is in normal mode on THIS port" vs "hunt across ALL ports for a device that changed COM ports". Reduced code duplication and simpler, sequential discovery logic.

---

## 📋 Scope

### In Scope
- Create `EnsureNormalFirmware()` extension method in `TRStreamExtensions.cs`
- Refactor `ReconnectToNormalFW()` to leverage the new method
- Refactor `SerialDiscoveryStrategy` to:
  - Use `EnsureNormalFirmware()` instead of manual ping logic
  - Add COM port caching (similar to `TcpDiscoveryStrategy`)
  - Simplify to sequential processing (remove unnecessary parallelism)
- Create unit tests for `SerialDiscoveryStrategy`

### Out of Scope
- Changes to `TcpDiscoveryStrategy` (already has caching)
- Changes to `CartFinder` or device validation pipeline
- Frontend changes

---

## 📚 Standards Documentation

- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **Single Responsibility**: `EnsureNormalFirmware()` handles one port only; `ReconnectToNormalFW()` scans multiple ports
- **Cache Pattern**: Mirror `TcpDiscoveryStrategy` caching approach with `SerialPortCache` stored in `Assets/System/Config/SerialPorts.json`
- **Sequential Processing**: For 1-4 COM ports, parallelism adds complexity without meaningful benefit

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `EnsureNormalFirmware()` | Single port: check minimal, reset if needed, confirm normal mode |
| `ReconnectToNormalFW()` | Multi-port: scan all ports using `EnsureNormalFirmware()` until device found |
| `SerialDiscoveryStrategy` | Discovery: iterate ports, call `EnsureNormalFirmware()` + `PingDevice()` on each, cache results |

### Integration Points

- **TRStreamExtensions**: New extension method consumed by discovery and launch handlers
- **SerialDiscoveryStrategy**: Implements `IDiscoveryStrategy` interface, used by `CartFinder`
- **Cache File**: JSON file at `Assets/System/Config/SerialPorts.json`

---

## 📋 Implementation Phases

### Phase 1: Core Implementation

**Objective**: Implement the new extension method, refactor existing code, and add caching to serial discovery.

**Tasks**:
1. Create `EnsureNormalFirmware()` extension method and refactor `ReconnectToNormalFW()`
2. Refactor `SerialDiscoveryStrategy` with caching and simplified flow
3. Create unit tests for `SerialDiscoveryStrategy`

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] `EnsureNormalFirmware()` returns true when already in normal mode
- [ ] `EnsureNormalFirmware()` resets device and returns true when in minimal mode
- [ ] `EnsureNormalFirmware()` returns false on unexpected response
- [ ] `SerialDiscoveryStrategy` cache loading and saving
- [ ] `SerialDiscoveryStrategy` fast discovery using cached ports
- [ ] `SerialDiscoveryStrategy` fallback to full scan when cache empty
- [ ] `SerialDiscoveryStrategy` handles minimal mode devices

### Integration Tests
- [ ] End-to-end discovery with real/mocked COM ports (existing `CartFinderIntegrationTests`)

---

## ✅ Success Criteria

- [ ] `EnsureNormalFirmware()` method created and working
- [ ] `ReconnectToNormalFW()` refactored to use new method (no behavioral change)
- [ ] `SerialDiscoveryStrategy` uses `EnsureNormalFirmware()` instead of manual ping
- [ ] `SerialDiscoveryStrategy` caches discovered COM ports to JSON
- [ ] `SerialDiscoveryStrategy` loads cached ports for fast discovery
- [ ] `SerialDiscoveryStrategy` falls back to full scan when cache miss
- [ ] All existing tests pass
- [ ] New unit tests for `SerialDiscoveryStrategy` pass
- [ ] Code compiles without warnings

---

## 📁 Files Affected

### New Files
- `docs/projects/SERIAL-DISCOVERY-REFACTOR/` - Project documentation

### Modified Files
- `apps/api/src/TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs` - Add `EnsureNormalFirmware()`, refactor `ReconnectToNormalFW()`
- `apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs` - Major refactor

### New Test Files
- `apps/api/src/TeensyRom.Core.Device.Tests.Unit/Discovery/SerialDiscoveryStrategyTests.cs`

---

## 📚 Related Documentation

- [TcpDiscoveryStrategy.cs](../../../apps/api/src/TeensyRom.Core.Device/TcpDiscoveryStrategy.cs) - Reference for caching pattern
- [TRStreamExtensions.cs](../../../apps/api/src/TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs) - Extension methods location
- [SerialDiscoveryStrategy.cs](../../../apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs) - File to refactor

---

## 🗓️ Execution Order

| Order | Task ID | Description | Dependencies |
|-------|---------|-------------|--------------|
| 1 | SERIAL-DISCOVERY-REFACTOR-TASK-01-001 | Extension Method & Refactor ReconnectToNormalFW | None |
| 2 | SERIAL-DISCOVERY-REFACTOR-TASK-01-002 | SerialDiscoveryStrategy Refactor with Caching | Task 01-001 |
| 3 | SERIAL-DISCOVERY-REFACTOR-TASK-01-003 | Unit Tests for SerialDiscoveryStrategy | Task 01-002 |
