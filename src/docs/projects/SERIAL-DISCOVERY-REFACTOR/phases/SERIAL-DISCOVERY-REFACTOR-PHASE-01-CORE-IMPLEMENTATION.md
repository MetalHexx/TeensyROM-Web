# Phase 1: Core Implementation

## 🎯 Objective

Implement the `EnsureNormalFirmware()` extension method, refactor `ReconnectToNormalFW()` to use it, and refactor `SerialDiscoveryStrategy` with caching and simplified sequential processing.

---

## 📚 Required Reading

- [ ] [SERIAL-DISCOVERY-REFACTOR-MASTER-PLAN.md](../SERIAL-DISCOVERY-REFACTOR-MASTER-PLAN.md) - Project overview
- [ ] [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - Backend patterns
- [ ] [TcpDiscoveryStrategy.cs](../../../../apps/api/src/TeensyRom.Core.Device/TcpDiscoveryStrategy.cs) - Caching pattern reference

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core.Serial/Routines/
└── TRStreamExtensions.cs                      📝 Modified - Add EnsureNormalFirmware(), refactor ReconnectToNormalFW()

apps/api/src/TeensyRom.Core.Device/
└── SerialDiscoveryStrategy.cs                 📝 Modified - Major refactor with caching

apps/api/src/TeensyRom.Core.Device.Tests.Unit/Discovery/
└── SerialDiscoveryStrategyTests.cs            ✨ New - Unit tests
```

---

## 📋 Tasks

### Task 01-001: Extension Method & Refactor ReconnectToNormalFW

**Purpose**: Create reusable `EnsureNormalFirmware()` method and refactor `ReconnectToNormalFW()` to use it.

**Files**:
- Modify: `apps/api/src/TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs`

**Deliverables**:
- `EnsureNormalFirmware()` extension method that works on a single port
- `ReconnectToNormalFW()` refactored to use `EnsureNormalFirmware()` in its port-scanning loop

---

### Task 01-002: SerialDiscoveryStrategy Refactor with Caching

**Purpose**: Refactor `SerialDiscoveryStrategy` to use the new extension method, add COM port caching, and simplify to sequential processing.

**Dependencies**: Task 01-001 completed

**Files**:
- Modify: `apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs`

**Deliverables**:
- Cache records (`SerialPortCache`, `CachedSerialPort`)
- `FindKnownEndpoints()` method for fast discovery
- `PerformFullScan()` method for complete COM port scan
- `LoadKnownPorts()` / `SaveKnownPorts()` cache persistence
- Simplified `TryDiscoverDevice()` using `EnsureNormalFirmware()`

---

### Task 01-003: Unit Tests for SerialDiscoveryStrategy

**Purpose**: Create comprehensive unit tests for the refactored `SerialDiscoveryStrategy`.

**Dependencies**: Task 01-002 completed

**Files**:
- Create: `apps/api/src/TeensyRom.Core.Device.Tests.Unit/Discovery/SerialDiscoveryStrategyTests.cs`

**Deliverables**:
- Tests for cache loading/saving
- Tests for fast discovery path
- Tests for fallback to full scan
- Tests for minimal mode handling

---

## ✅ Success Criteria

- [ ] `EnsureNormalFirmware()` method exists and handles all firmware states
- [ ] `ReconnectToNormalFW()` behavior unchanged (just refactored internally)
- [ ] `SerialDiscoveryStrategy` caches and loads COM ports
- [ ] `SerialDiscoveryStrategy` uses sequential processing
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Solution builds without warnings
