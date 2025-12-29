# TCP-SUPPORT Task Handoff: Integration Tests

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-03-007-INTEGRATION-TESTS
**Task Name**: Write Integration Tests for Phase 3
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Write integration tests for Phase 3 features: mixed Serial/TCP device discovery, reconnection strategies, health check monitoring, and end-to-end device management scenarios.

**Why**: Integration tests verify that all Phase 3 components work together correctly. They catch issues that unit tests miss, such as DI configuration issues, strategy selection bugs, and inter-component communication failures.

**Success Criteria**:
- [ ] Mixed transport discovery test (2 Serial + 1 TCP devices)
- [ ] Serial reconnection test (COM port hunting through available ports)
- [ ] TCP reconnection test (retry with backoff, then fail)
- [ ] Health check test (removes disconnected TCP device)
- [ ] Health check logging test (uses ConnectionDisplay correctly)
- [ ] Parallel discovery test (runs Serial and TCP strategies simultaneously)
- [ ] All tests pass with no regressions
- [ ] Test coverage meets project standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-03-001 through 03-006: All Phase 3 implementation complete
- TCP-SUPPORT-TASK-03-006-DI-REGISTRATION: DI registration complete

**Dependencies**:
- `TeensyRom.Core.Device` namespace - All Phase 3 components
- `TeensyRom.Core.Device.Tests` namespace - Test project
- Testing frameworks (xUnit, Moq, FluentAssertions)

**Constraints**:
- Tests must NOT require actual hardware (mock TcpClient, SerialPort)
- Tests must be deterministic (no random failures)
- Tests must run quickly (< 5 seconds total)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/ReconnectionStrategyTests.cs` - Strategy tests
- Update `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/CartDiscoveryTests.cs` - Add mixed transport tests

**Files to Modify**:
- (None for this task - new test file and updates to existing test file)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core.Device.Tests/Device/CartDiscoveryTests.cs` - Existing discovery tests
- `src/apps/api/src/TeensyRom.Core.Device/CartFinder.cs` - Implementation under test
- `src/apps/api/src/TeensyRom.Core.Device/DeviceConnectionManager.cs` - Implementation under test

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches

**Key Requirements**:

1. **ReconnectionStrategyTests.cs - New File**:
   - Test `SerialReconnectionStrategy`:
     - Hunts through available COM ports
     - Updates `Cart.ComPort` on success
     - Returns false when no TeensyROM found
   - Test `TcpReconnectionStrategy`:
     - Retries same endpoint 3 times with backoff
     - Returns true on successful connection
     - Returns false after 3 failed attempts
     - Does NOT do network rescan

2. **CartDiscoveryTests.cs - Update Existing File**:
   - Add mixed transport discovery test:
     - Mock `SerialDiscoveryStrategy` → returns 2 Serial endpoints
     - Mock `TcpDiscoveryStrategy` → returns 1 TCP endpoint
     - Mock version checker → all return valid TeensyROM
     - Mock tagger → all return DeviceIds
     - **Expected**: `FindDevices()` returns 3 TeensyRomDevice (2 Serial + 1 TCP)
   - Add parallel discovery test:
     - Verify both strategies are called
     - Verify `Task.WhenAll()` is used (strategies run in parallel)

3. **DeviceConnectionManagerTests.cs - Update Existing File**:
   - Add `ReconnectDevice()` test:
     - Mock Serial device → calls SerialReconnectionStrategy
     - Mock TCP device → calls TcpReconnectionStrategy
     - Verify correct strategy selected based on `ConnectionType`
   - Add health check test:
     - Create TCP device that loses connection
     - Mock `EnsureConnection()` to throw exception
     - **Expected**: Device removed from list, logged with `ConnectionDisplay`

**Test Implementation Guidelines**:
- Use Moq to mock all dependencies (strategies, version checker, tagger, etc.)
- Mock `TcpClient` and `NetworkStream` for TCP tests (no actual network I/O)
- Mock `SerialPort` for Serial tests (no actual serial I/O)
- Use FluentAssertions for readable assertions
- Use `async`/`await` for all async test methods

**Anti-Patterns to Avoid**:
- Don't require actual hardware (TCP network or Serial ports)
- Don't use `Thread.Sleep()` for timing (use Moq callbacks for verification)
- Don't make tests dependent on execution order
- Don't catch generic exceptions - catch specific types

---

**Test Coverage Required**:

**ReconnectionStrategyTests.cs**:
- [ ] `SerialReconnectionStrategy_TriesAllAvailablePorts()` - Hunts through COM ports
- [ ] `SerialReconnectionStrategy_UpdatesCartComPort_OnSuccess()` - Updates ComPort property
- [ ] `SerialReconnectionStrategy_ReturnsFalse_WhenNoTeensyRomFound()` - Failure case
- [ ] `TcpReconnectionStrategy_RetriesThreeTimes()` - Retry logic
- [ ] `TcpReconnectionStrategy_UsesExponentialBackoff()` - Backoff timing
- [ ] `TcpReconnectionStrategy_ReturnsTrue_OnSuccess()` - Success case
- [ ] `TcpReconnectionStrategy_ReturnsFalse_AfterThreeFailures()` - Failure case
- [ ] `TcpReconnectionStrategy_DoesNotRescanNetwork()` - No network rescan

**CartDiscoveryTests.cs** (additions):
- [ ] `FindDevices_WithMixedTransports_ReturnsAllDevices()` - 2 Serial + 1 TCP
- [ ] `FindDevices_WithParallelDiscovery_RunsStrategiesInParallel()` - Parallel execution
- [ ] `FindDevices_WithTcpOnly_ReturnsTcpDevices()` - TCP-only scenario
- [ ] `FindDevices_WithSerialOnly_ReturnsSerialDevices()` - Serial-only scenario
- [ ] `ValidateAndCreateDevice_Serial_CreatesSerialTransport()` - Transport creation
- [ ] `ValidateAndCreateDevice_Tcp_CreatesTcpTransport()` - Transport creation

**DeviceConnectionManagerTests.cs** (additions):
- [ ] `ReconnectDevice_Serial_UsesSerialStrategy()` - Strategy selection
- [ ] `ReconnectDevice_Tcp_UsesTcpStrategy()` - Strategy selection
- [ ] `ReconnectDevice_UnknownConnectionType_Throws()` - Error handling
- [ ] `HealthCheck_RemovesDisconnectedTcpDevice()` - Device removal
- [ ] `HealthCheck_LogsConnectionDisplay_ForTcpDevice()` - Logging verification

**Integration Context**:
- Tests should verify complete workflows from discovery to connection
- Tests should verify DI container resolves all dependencies
- Tests should verify no regressions in Serial device functionality

**Behavioral Expectations**:
- Mixed transport scenarios work correctly
- Serial and TCP devices can coexist
- Reconnection works for both transports
- Health check monitors both transports
- Logging shows correct connection details

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-3) - Overall project plan
- [Phase 3 Plan](../phases/TCP-SUPPORT-PHASE-03-DEVICE-MANAGER-INTEGRATION.md) - Current phase details
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Testing approaches

**Related Tasks**:
- TCP-SUPPORT-TASK-03-001 through 03-006: All Phase 3 implementation (completed) - tested by this task
- Phase 4: API Endpoint (next) - will build on Phase 3 foundation

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\src\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-03-007-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `src/docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-03-007-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
