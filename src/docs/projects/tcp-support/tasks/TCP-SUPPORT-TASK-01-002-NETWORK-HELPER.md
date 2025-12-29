# TCP-SUPPORT Task Handoff: Network Utilities

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-01-002-NETWORK-HELPER
**Task Name**: Create Network Utilities (NetworkHelper)
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small

---

### INPUT_DOC

**What**: Create `NetworkHelper` static utility class for TCP device discovery, providing subnet detection, IP range generation, and endpoint parsing/formatting functions.

**Why**: Network discovery utilities are needed for `TcpDeviceFinder` to scan the local subnet for TeensyROM devices. These utilities abstract away the complexity of network interface detection and IP address arithmetic.

**Success Criteria**:
- [ ] `NetworkHelper` static class created in `TeensyRom.Core.Serial` namespace
- [ ] `GetLocalSubnetRange()` returns `(IPAddress Start, IPAddress End)?` for first active non-loopback interface
- [ ] `GenerateIpRange()` generates all IP addresses between start and end (inclusive)
- [ ] `FormatEndpoint()` produces valid "ip:port" string
- [ ] `ParseEndpoint()` correctly parses "ip:port" strings, returns null for invalid format
- [ ] Unit tests pass with >90% coverage
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: `TcpObservablePort` implementation completed

**Dependencies**:
- `System.Net.NetworkInformation` namespace for network interface detection
- `System.Net` namespace for IPAddress manipulation
- No other project dependencies (pure utility class)

**Constraints**:
- Must handle multiple network interfaces gracefully (return first valid)
- Must return null when no active network interface found
- Must be thread-safe (static methods with no shared state)
- Must handle various subnet masks (/8, /16, /24, /32)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Serial/NetworkHelper.cs` - Network utility class
- `src/apps/api/src/TeensyRom.Core.Serial.Tests.Unit/Serial/NetworkHelperTests.cs` - Unit tests

**Files to Modify**:
- (None for this task)

**Files to Review**:
- `src/docs/projects/tcp/TCP_BRAINSTORMING.md#smart-defaults` - Subnet detection design discussion
- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - Uses endpoint format (for reference)

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [.NET NetworkInterface API](https://learn.microsoft.com/en-us/dotnet/api/system.net.networkinformation.networkinterface) - API reference

**Key Requirements**:

1. **GetLocalSubnetRange Method**:
   - Use `NetworkInterface.GetAllNetworkInterfaces()` to get all interfaces
   - Filter for `OperationalStatus.Up` and non-loopback (`NetworkInterfaceType.Loopback`)
   - Get IPv4 address and subnet mask from `UnicastAddresses` collection
   - Skip IPv6 addresses (check `AddressFamily == InterNetwork`)
   - Calculate network address: `ipAddress & subnetMask` (bitwise AND)
   - Calculate broadcast address: `ipAddress | ~subnetMask` (bitwise OR)
   - Return `(networkAddress, broadcastAddress)` tuple
   - Return `null` if no valid interface found

2. **GenerateIpRange Method**:
   - Accept `IPAddress start` and `IPAddress end` parameters
   - Convert IP addresses to 32-bit integers using `IPAddress.GetAddressBytes()`
   - Generate all addresses between start and end (inclusive)
   - Handle typical /24 subnet (~254 addresses) efficiently
   - Return `List<IPAddress>` with generated addresses

3. **FormatEndpoint Method**:
   - Accept `string ip` and `int port` parameters
   - Return formatted string in "ip:port" format
   - No validation needed (formatting is straightforward)

4. **ParseEndpoint Method**:
   - Accept `string endpoint` parameter
   - Split on ":" to separate IP and port
   - Validate format has exactly 2 parts
   - Parse port as integer, validate range 1-65535
   - Return `(string Ip, int Port)?` tuple (null if invalid)
   - Handle edge cases: missing port, non-numeric port, out-of-range port

**Anti-Patterns to Avoid**:
- Don't include loopback interfaces in subnet detection
- Don't throw exceptions for invalid endpoint format (return null instead)
- Don't assume only one network interface exists
- Don't generate IPv6 addresses (IPv4 only for TeensyROM discovery)
- Don't block indefinitely on network operations

---

**Test Coverage Required**:

**Unit Tests** (mock or use real network interfaces):
- [ ] `GetLocalSubnetRange()` returns valid range for typical /24 network
- [ ] `GetLocalSubnetRange()` returns null when no active network interface
- [ ] `GetLocalSubnetRange()` handles multiple interfaces (returns first valid)
- [ ] `GenerateIpRange()` generates all addresses between start and end
- [ ] `GenerateIpRange()` with start==end returns single-element list
- [ ] `GenerateIpRange()` handles /24 subnet efficiently
- [ ] `FormatEndpoint()` produces valid "ip:port" string
- [ ] `ParseEndpoint()` correctly parses valid "ip:port" strings
- [ ] `ParseEndpoint()` returns null for invalid formats (missing port, non-numeric port, out-of-range port, empty string)
- [ ] `ParseEndpoint()` handles edge cases (multiple colons, negative port, port 0)

**Integration Context**:
- Tests should work on any machine with active network interface
- Use localhost addresses for deterministic testing where possible

**Behavioral Expectations**:
- Subnet detection works on Windows/Linux/Mac
- IP range generation is efficient for /24 subnets
- Endpoint parsing is forgiving (returns null for invalid, no exceptions)
- All methods are thread-safe (static, no shared state)

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md#phase-1) - Overall project plan
- [Phase 1 Plan](../phases/TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE.md) - Current phase details
- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md) - Design discussion
- [Task 1 Report](../reports/TCP-SUPPORT-TASK-01-001-REPORT.md) - TcpObservablePort implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT: TCP transport (completed) - uses endpoint format
- TCP-SUPPORT-TASK-01-004-DEVICE-FINDER: Network scanner (next) - will use these utilities

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-01-002-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-01-002-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
