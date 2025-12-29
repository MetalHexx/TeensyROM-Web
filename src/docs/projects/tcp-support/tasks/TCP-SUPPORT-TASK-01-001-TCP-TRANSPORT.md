# TCP-SUPPORT Task Handoff: TCP Transport Implementation

## 🎯 Subagent Task Assignment

**Task ID**: TCP-SUPPORT-TASK-01-001-TCP-TRANSPORT
**Task Name**: Create TCP Transport Implementation (TcpObservablePort)
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

### INPUT_DOC

**What**: Implement the `IObservableSerialPort` interface using `System.Net.Sockets.TcpClient` and `NetworkStream`, providing a TCP/IP transport layer compatible with the existing serial-based state machine and command pipeline.

**Why**: The existing `IObservableSerialPort` interface is transport-agnostic, allowing a TCP implementation to work with the existing `SerialStateContext`, MediatR command pipeline, and device management without any changes to those components.

**Success Criteria**:
- [ ] `TcpObservablePort` implements all 30+ methods of `IObservableSerialPort`
- [ ] TCP connections can be established to valid IP:port endpoints
- [ ] Read/write operations work correctly over NetworkStream
- [ ] Connection lifecycle (open, close, reconnect) works correctly
- [ ] Lock/unlock mechanism controls data reception
- [ ] Unit tests pass with >90% coverage (mock NetworkStream)
- [ ] Integration tests pass with real TCP connections
- [ ] Code follows C# coding standards

---

**Prerequisites Completed**:
- None (this is the first task in Phase 1)

**Dependencies**:
- `System.Net.Sockets` namespace for TcpClient/NetworkStream
- `System.Reactive` (already in project) for BehaviorSubject observables
- `TeensyRom.Core` project interfaces and abstractions

**Constraints**:
- Must implement all 30+ methods of `IObservableSerialPort` interface
- Connection timeout: default 2000ms (configurable)
- Use "ip:port" format for endpoint strings (e.g., "192.168.1.42:80")
- Return empty array from `Ports` observable (TCP has no enumerable ports)

---

**Files to Create**:
- `src/apps/api/src/TeensyRom.Core.Serial/TcpObservablePort.cs` - TCP transport implementation
- `src/apps/api/src/TeensyRom.Core.Tests/Serial/TcpObservablePortTests.cs` - Unit tests

**Files to Modify**:
- (None for this task)

**Files to Review**:
- `src/apps/api/src/TeensyRom.Core/Abstractions/IObservableSerialPort.cs` - Contract to implement
- `src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs` - Reference implementation
- `src/apps/api/src/TeensyRom.Core.Serial/State/SerialStateContext.cs` - State machine that will use TCP transport

---

**Standards to Follow**:
- [Coding Standards](../../../../src/docs/CODING_STANDARDS.md) - C# coding patterns and conventions
- [Testing Standards](../../../../src/docs/TESTING_STANDARDS.md) - Behavioral testing approaches
- [Backend Architecture](../../../../src/docs/BACKEND_ARCHITECTURE.md) - MediatR patterns and state machine

**Key Requirements**:

1. **Class Structure**:
   - Namespace: `TeensyRom.Core.Serial`
   - Constructor: Accept `ILoggingService` and `IAlertService` (same as SimpleObservableSerialPort)
   - Private fields: `TcpClient _tcpClient`, `NetworkStream? _stream`, connection parameters
   - Implement `IDisposable` to clean up TCP resources

2. **Connection Management**:
   - `SetPort(string endpoint)`: Parse "ip:port" format, store for connection
   - `OpenPort()`: Connect to IP:port with timeout (default 2000ms), return connection string
   - `ClosePort()`: Close TCP client, dispose NetworkStream
   - `IsOpen`: Check `TcpClient.Connected` and stream state
   - `EnsureConnection(int waitTimeMs)`: Reconnect if connection dropped

3. **I/O Operations**:
   - `Write(byte[], int, int)`: Write to NetworkStream
   - `Write(string)`: Convert to bytes and write
   - `Read(byte[], int, int)`: Read from NetworkStream
   - `ReadByte()`: Read single byte
   - `ReadSerialAsString(int msToWait)`: Read and convert to string
   - `SendIntBytes`, `ReadIntBytes`: Implement for protocol compatibility
   - `SendSignedChar`, `SendSignedShort`: Implement for protocol compatibility

4. **Observables**:
   - `Ports`: Return `Observable.Empty<string[]>()` (TCP has no port enumeration)
   - `State`: Use `BehaviorSubject<Type>` to emit state changes
   - Emit appropriate states during connection lifecycle

5. **Lock/Unlock**:
   - `Lock()`: Set flag to stop automatic data reception
   - `Unlock()`: Clear flag to resume automatic data reception
   - Use `SemaphoreSlim` or similar for thread safety

7. **Error Handling**:
   - Catch `SocketException`, `IOException`, `TimeoutException`
   - Map to appropriate error states via State observable
   - Log errors via ILoggingService

**Anti-Patterns to Avoid**:
- Don't implement port enumeration (TCP doesn't have enumerable ports)
- Don't use blocking operations without cancellation token support
- Don't forget to dispose NetworkStream and TcpClient
- Don't ignore connection state changes
- Don't implement complex retry logic in OpenPort (leave to EnsureConnection)

---

**Test Coverage Required**:

**Unit Tests** (mock NetworkStream):
- [ ] `OpenPort()` successfully connects to valid IP:port
- [ ] `OpenPort()` throws exception for invalid/unreachable IP
- [ ] `ClosePort()` closes connection and cleans up resources
- [ ] `IsOpen` returns true when connected, false when disconnected
- [ ] `Write()` sends data correctly over TCP
- [ ] `Read()` receives data correctly from TCP
- [ ] `Lock()` prevents data reception, `Unlock()` resumes it
- [ ] `EnsureConnection()` reconnects if connection dropped
- [ ] Error states are emitted via State observable

**Integration Tests** (real TCP):
- [ ] Connect to local echo server and exchange data
- [ ] Verify connection timeout behavior

**Behavioral Expectations**:
- TCP transport works identically to serial transport from consumer perspective
- State machine transitions work correctly over TCP
- Connection drops are detected and reconnection is attempted
- All protocol operations (send/receive tokens) work over TCP

---

**Related Documentation**:
- [Master Plan](../TCP-SUPPORT-MASTER-PLAN.md) - Overall project plan
- [Phase 1 Plan](../phases/TCP-SUPPORT-PHASE-01-TCP-TRANSPORT-INFRASTRUCTURE.md) - Current phase details
- [TCP Brainstorming](../../../../src/docs/projects/tcp/TCP_BRAINSTORMING.md) - Design discussion
- [IObservableSerialPort Interface](../../../../src/apps/api/src/TeensyRom.Core/Abstractions/IObservableSerialPort.cs) - Contract to implement
- [SimpleObservableSerialPort](../../../../src/apps/api/src/TeensyRom.Core.Serial/SimpleObservableSerialPort.cs) - Reference implementation

**Related Tasks**:
- TCP-SUPPORT-TASK-01-002-NETWORK-HELPER: Network utilities (next task) - will use this transport for testing
- TCP-SUPPORT-TASK-01-004-DEVICE-FINDER: Network scanner (pending) - will use this transport for discovery

---

### OUTPUT_DOC

**Output Report Location**: `C:\dev\src\TeensyROM-Web\docs\projects\tcp-support\reports\TCP-SUPPORT-TASK-01-001-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../src/docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/tcp-support/reports/TCP-SUPPORT-TASK-01-001-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
