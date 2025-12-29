# TCP-SUPPORT Task Handoff: Integration Tests

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-01-006-INTEGRATION
**Task Name**: Write Integration Tests for TCP Transport
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: Medium
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Create integration tests for the TCP transport implementation that verify real TCP connections, end-to-end discovery flows, and integration with existing device management components.

**Why**: Integration tests validate that `TcpObservablePort`, `NetworkHelper`, and `TcpDeviceFinder` work correctly with real TCP connections (not mocks) and integrate properly with the existing device management infrastructure.

**Success Criteria**:
- [ ] `TcpObservablePort` can connect to local echo server and exchange data
- [ ] `TcpObservablePort` connection timeout behavior is verified
- [ ] `NetworkHelper.GetLocalSubnetRange()` works with real network interfaces
- [ ] `NetworkHelper.GenerateIpRange()` generates correct IP ranges
- [ ] `NetworkHelper.ParseEndpoint()` and `FormatEndpoint()` round-trip correctly
- [ ] `TcpDeviceFinder` can scan localhost range and find test server (if TeensyROM device available)
- [ ] Tests follow existing integration test patterns (xUnit, AutoFixture, behavioral assertions)
- [ ] Tests are skipped gracefully when TeensyROM hardware is not available
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: `TcpObservablePort` implementation completed
- TCP-SUPPORT-TASK-01-002-NETWORK-HELPER: `NetworkHelper` utilities completed
- TCP-SUPPORT-TASK-01-004-DEVICE-FINDER: `TcpDeviceFinder` scanner completed

**Dependencies**:
- `System.Net.Sockets` for real TCP server creation (for testing)
- `xunit` for test framework
- `AutoFixture` for test data generation
- `FluentAssertions` for assertions
- `TeensyRom.Core.Serial` namespace for TCP components
- `TeensyRom.Core.Device` namespace for device finder

**Constraints**:
- Tests must use real TCP connections (not mocks) - this is integration testing
- Tests must be skippable when TeensyROM hardware is not available
- Tests should use localhost/127.0.0.1 for predictable testing
- Tests must clean up resources (dispose TCP connections)
- Tests must not require external network connectivity

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/TcpTransportIntegrationTests.cs` - TCP transport integration tests
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/NetworkHelperIntegrationTests.cs` - Network utilities integration tests
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/GlobalUsings.cs` - Global using statements
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Integration/TeensyRom.Core.Serial.Tests.Integration.csproj` - Test project file

**Files to Modify**:
- (None for this task - integration tests are standalone)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Api.Tests.Integration/TeensyRom.Api.Tests.Integration.csproj` - Integration test project reference pattern
- `src/apps/api/src/TeensyRom.Api.Tests.Integration/FindDevicesTests.cs` - Device discovery test pattern
- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - TCP transport to test
- `src/docs/TESTING_STANDARDS.md` - Behavioral testing patterns

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Existing Integration Tests](../../../../src/apps/api/src/TeensyRom.Api.Tests.Integration) - Test patterns

**Key Requirements**:

1. **Test Project Setup**:
   - Target Framework: `net9.0`
   - Project references: `TeensyRom.Core.Serial`, `TeensyRom.Core`, `TeensyRom.Core.Device`
   - Package references: `xunit`, `AutoFixture`, `FluentAssertions`, `Microsoft.NET.Test.Sdk`
   - Follow existing integration test project structure

2. **TcpTransportIntegrationTests**:
   - **Echo Server Test**: Create a simple TCP listener on localhost that echoes back data, verify `TcpObservablePort` can connect and exchange data
   - **Connection Timeout Test**: Verify connection timeout behavior when connecting to non-routable IP (e.g., 192.0.2.1)
   - **Write/Read Test**: Send data via `Write()`, receive via `Read()`, verify round-trip
   - **Lock/Unlock Test**: Verify data reception stops on `Lock()` and resumes on `Unlock()`
   - **Dispose Test**: Verify `Dispose()` properly cleans up TCP connection

3. **NetworkHelperIntegrationTests**:
   - **GetLocalSubnetRange Test**: Verify method returns valid range for current machine's network interface
   - **GenerateIpRange Test**: Generate range for 192.168.1.1 to 192.168.1.5, verify correct count
   - **FormatEndpoint Test**: Format "192.168.1.42" and 80, verify "192.168.1.42:80"
   - **ParseEndpoint Test**: Parse "192.168.1.42:80", verify correct IP and port
   - **RoundTrip Test**: Format endpoint, then parse it, verify original values match

4. **Test Organization**:
   - Use `IAsyncLifetime` for setup/teardown of TCP servers
   - Use `Fact` for single-test cases
   - Use `Theory` with `InlineData` for parameterized tests
   - Use `Skip` attribute for tests requiring TeensyROM hardware
   - Include descriptive test names that explain the behavior being tested

5. **Resource Cleanup**:
   - Implement `IAsyncDisposable` on test classes
   - Dispose all `TcpListener` instances in `DisposeAsync()`
   - Dispose all `TcpObservablePort` instances in `DisposeAsync()`
   - Use `using` statements for short-lived resources

6. **Graceful Degradation**:
   - Tests requiring TeensyROM hardware should use `[Fact(Skip = "Requires TeensyROM hardware")]` attribute
   - Include comment explaining how to run skipped tests
   - Tests should not fail if hardware is unavailable

**Anti-Patterns to Avoid**:
- Don't use mocked TCP connections in integration tests (that's unit testing)
- Don't leak TCP connections (always dispose)
- Don't require external network access (use localhost)
- Don't hardcode specific IP addresses that may not exist on test machines
- Don't skip tests without documenting why and how to enable them

---

**Test Coverage Required**:

**TcpTransportIntegrationTests**:
- [ ] `TcpObservablePort` can connect to local echo server on port 8080
- [ ] `TcpObservablePort.Write()` sends data correctly over TCP
- [ ] `TcpObservablePort.Read()` receives data correctly from TCP
- [ ] `TcpObservablePort` connection timeout occurs after expected duration
- [ ] `TcpObservablePort.Lock()` stops data reception, `Unlock()` resumes it
- [ ] `TcpObservablePort.Dispose()` properly cleans up TCP connection
- [ ] `TcpObservablePort` handles connection errors gracefully

**NetworkHelperIntegrationTests**:
- [ ] `GetLocalSubnetRange()` returns valid (start, end) IP addresses
- [ ] `GetLocalSubnetRange()` returns null when no active network interface (test with disconnected network)
- [ ] `GenerateIpRange()` generates all addresses between start and end
- [ ] `GenerateIpRange()` handles /24 subnet efficiently
- [ ] `FormatEndpoint()` produces valid "ip:port" string
- [ ] `ParseEndpoint()` correctly parses valid endpoints
- [ ] `ParseEndpoint()` returns null for invalid formats
- [ ] Format and parse round-trip correctly

**Optional Tests (require TeensyROM hardware)**:
- [ ] `TcpDeviceFinder` can scan local subnet and find real TeensyROM device
- [ ] `TcpObservablePort` can connect to real TeensyROM device
- [ ] `TcpObservablePort` can send/receive TeensyROM ping token

**Integration Context**:
- Tests should run on any machine with .NET 9.0 installed
- Tests should not require TeensyROM hardware (except explicitly skipped tests)
- Tests should complete quickly (no long-running network operations)

**Behavioral Expectations**:
- Echo server test completes in <5 seconds
- Connection timeout test completes in ~3 seconds (timeout is 2000ms)
- Network helper tests complete in <1 second
- All tests pass when run on machine with active network interface
- Skipped tests have clear documentation on how to enable them

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-1) - Overall project plan
- [Phase 1 Plan](../phases/TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE.md) - Current phase details
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing patterns
- [Task 1 Report](../reports/TCP-SUPPORT-TASK-01-001-REPORT.md) - TcpObservablePort implementation
- [Task 2 Report](../reports/TCP-SUPPORT-TASK-01-002-REPORT.md) - NetworkHelper implementation
- [Task 3 Report](../reports/TCP-SUPPORT-TASK-01-003-REPORT.md) - TcpDeviceFinder implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: TCP transport (completed)
- TCP-SUPPORT-TASK-01-002-NETWORK-HELPER: Network utilities (completed)
- TCP-SUPPORT-TASK-01-003-DEVICE-FINDER: Network scanner (completed)

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-01-004-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-01-004-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
