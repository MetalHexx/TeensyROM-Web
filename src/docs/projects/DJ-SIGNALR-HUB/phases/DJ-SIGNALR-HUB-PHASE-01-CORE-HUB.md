# Phase 1: Core Hub Infrastructure

## 🎯 Objective

Create the foundational SignalR hub infrastructure for DJ features, implementing the DJHub with SID voice muting as the first command. This phase establishes the architectural pattern for all future DJ commands while delivering immediate functionality through voice muting capabilities.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md) - High-level feature plan
- [ ] [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - MediatR patterns and SignalR hubs

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices

**Reference Implementations:**

- [ ] [LogsHub.cs](../../../../apps/api/src/TeensyRom.Api/Endpoints/Serial/Logs/LogsHub.cs) - Existing SignalR hub example
- [ ] [DeviceEventHub.cs](../../../../apps/api/src/TeensyRom.Api/Endpoints/Serial/DeviceEvents/DeviceEventHub.cs) - Hub with streaming pattern
- [ ] [MuteSidVoicesCommand.cs](../../../../apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/MuteSidVoicesCommand.cs) - Existing MediatR command
- [ ] [MuteSidVoicesHandler.cs](../../../../apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/MuteSidVoicesHandler.cs) - Command handler

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/Endpoints/DJ/
├── DJHub.cs                                    ✨ New - SignalR hub for DJ commands
└── DJHub.Tests.cs                              ✨ New - Unit tests (optional location)

apps/api/src/TeensyRom.Api/
├── Program.cs                                   📝 Modified - Register DJHub endpoint

apps/api/tests/TeensyRom.Api.Tests.Unit/        (if separate test project)
└── Endpoints/DJ/
    └── DJHubTests.cs                            ✨ New - Unit tests

apps/api/tests/TeensyRom.Api.Tests.Integration/  (if integration tests)
└── Endpoints/DJ/
    └── DJHubIntegrationTests.cs                 ✨ New - Integration tests
```

---

## 📋 Implementation Guidelines

<details open>
<summary><h3>Task 1: Create DJHub Class</h3></summary>

**Purpose**: Create the core SignalR hub class that will host all DJ commands, starting with SID voice muting.

**Related Documentation:**

- [Backend Architecture - SignalR Hubs](../../../BACKEND_ARCHITECTURE.md#signalr-integration) - Hub patterns
- [LogsHub.cs](../../../../apps/api/src/TeensyRom.Api/Endpoints/Serial/Logs/LogsHub.cs) - Reference implementation

**Implementation Subtasks:**

- [ ] **Create DJHub.cs** in `apps/api/src/TeensyRom.Api/Endpoints/DJ/` folder
- [ ] **Define DJHub class** inheriting from `Hub` (Microsoft.AspNetCore.SignalR)
- [ ] **Inject dependencies**: `IMediator` (for MediatR), `IDeviceConnectionManager` (for device resolution)
- [ ] **Create MuteSidVoices method** accepting `deviceId` and three `VoiceState` parameters (Voice1, Voice2, Voice3)
- [ ] **Implement device resolution** using `IDeviceConnectionManager.GetConnectedDevice(deviceId)`
- [ ] **Handle null device** - throw appropriate exception or return error response
- [ ] **Create MuteSidVoicesCommand** instance with parameters
- [ ] **Dispatch command** via `IMediator.Send()` with cancellation token
- [ ] **Return result** to caller (success/failure)

**Testing Subtask:**

- [ ] **Write Tests**: Test hub method behaviors (see Testing section below)

**Key Implementation Notes:**

- Hub methods should be public and async (return `Task` or `Task<T>`)
- Use constructor injection for dependencies (MediatR, DeviceConnectionManager)
- Follow naming convention: method names match command names without "Command" suffix
- Device resolution must happen before command creation to validate device exists

**Critical Type/Interface**:

```csharp
// Hub method signature
public async Task MuteSidVoices(
    string deviceId, 
    VoiceState voice1, 
    VoiceState voice2, 
    VoiceState voice3)
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Hub method can be invoked**: Method callable from SignalR client
- [ ] **Valid device resolution**: Method retrieves device from DeviceConnectionManager
- [ ] **MediatR dispatch**: Command sent to MediatR with correct parameters
- [ ] **Null device handling**: Appropriate exception thrown for invalid deviceId
- [ ] **Result returned**: Method returns success/failure to caller

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing patterns
- Unit tests should mock `IMediator` and `IDeviceConnectionManager`

</details>

---

<details open>
<summary><h3>Task 2: Register Hub in Application</h3></summary>

**Purpose**: Register the DJHub with the ASP.NET Core application and map its endpoint route.

**Related Documentation:**

- [Program.cs](../../../../apps/api/src/TeensyRom.Api/Program.cs) - Application startup
- Lines 65-66 show existing hub registrations

**Implementation Subtasks:**

- [ ] **Open Program.cs** in `apps/api/src/TeensyRom.Api/`
- [ ] **Add using statement** for `TeensyRom.Api.Endpoints.DJ` (if needed)
- [ ] **Add MapHub line** after existing hub registrations: `app.MapHub<DJHub>("/api/djHub");`
- [ ] **Verify ordering** - MapHub must come before `MapFallbackToFile`
- [ ] **Verify DI registration** - Hub dependencies (IMediator, IDeviceConnectionManager) already registered

**Testing Subtask:**

- [ ] **Manual Verification**: Start API and verify `/api/djHub` endpoint accessible

**Key Implementation Notes:**

- Add hub mapping near line 66 after DeviceEventHub
- Route convention: `/api/{hubName}` (lowercase "djHub")
- No explicit DI registration needed for hub class (automatic)
- Hub dependencies must be registered in DI container (IMediator and IDeviceConnectionManager already are)

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Hub registered**: SignalR negotiation endpoint responds at `/api/djHub/negotiate`
- [ ] **WebSocket upgrade**: Connection can establish WebSocket transport

**Testing Reference:**

- Integration test: Create SignalR HubConnection to `/api/djHub` and verify connection succeeds

</details>

---

<details open>
<summary><h3>Task 3: Implement Error Handling</h3></summary>

**Purpose**: Add robust error handling for device validation and command execution failures.

**Related Documentation:**

- [Backend Architecture - Error Handling](../../../BACKEND_ARCHITECTURE.md#error-handling--retries) - Error patterns
- [ExceptionBehavior](../../../../apps/api/src/TeensyRom.Core.Serial/Commands/Behaviors/ExceptionBehavior.cs) - MediatR error handling

**Implementation Subtasks:**

- [ ] **Device validation**: Check if device exists before creating command
- [ ] **Throw HubException**: Use `HubException` for client-visible errors
- [ ] **Add try-catch**: Wrap MediatR.Send in try-catch for unexpected exceptions
- [ ] **Log errors**: Use ILogger for error logging (inject `ILogger<DJHub>`)
- [ ] **Return structured errors**: Consider returning error DTO instead of throwing

**Testing Subtask:**

- [ ] **Write Tests**: Test error scenarios (see Testing section below)

**Key Implementation Notes:**

- `HubException` messages are sent to SignalR clients automatically
- MediatR ExceptionBehavior already handles serial exceptions - hub should catch outer exceptions
- Consider user-friendly error messages ("Device not found") vs technical details

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Invalid device ID**: HubException thrown with "Device not found" message
- [ ] **Device disconnected**: Error propagated from MediatR command
- [ ] **Unexpected exceptions**: Logged and returned as generic error

**Testing Reference:**

- Mock `IDeviceConnectionManager.GetConnectedDevice()` to return null
- Mock `IMediator.Send()` to throw exception
- Verify HubException is thrown with expected message

</details>

---

<details open>
<summary><h3>Task 4: Add Comprehensive Unit Tests</h3></summary>

**Purpose**: Create thorough unit tests covering all hub method behaviors and error scenarios.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- xUnit + NSubstitute + FluentAssertions (existing test stack)

**Implementation Subtasks:**

- [ ] **Create test file**: `DJHubTests.cs` in appropriate test project
- [ ] **Test setup**: Create test fixtures with mocked dependencies
- [ ] **Happy path test**: Valid parameters result in successful command dispatch
- [ ] **Parameter validation**: All voice state combinations tested
- [ ] **Device resolution**: Test device found and device not found scenarios
- [ ] **MediatR integration**: Verify command created with correct parameters
- [ ] **Error handling**: Test all error scenarios
- [ ] **Async behavior**: Verify Task-based async/await patterns

**Testing Subtask:**

- [ ] **Run Tests**: All unit tests pass with >90% code coverage

**Key Implementation Notes:**

- Use NSubstitute for mocking IMediator and IDeviceConnectionManager
- Use FluentAssertions for readable assertions
- Follow AAA pattern (Arrange, Act, Assert)
- Test class naming: `DJHubTests` or `DJHub_MuteSidVoicesTests`

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Successful command execution**: All parameters passed correctly to MediatR
- [ ] **All voice combinations**: Test various Enabled/Disabled combinations
- [ ] **Device validation**: Null device throws exception
- [ ] **MediatR result handling**: Result returned to caller
- [ ] **Exception propagation**: Errors from MediatR propagate correctly

**Test Example Structure:**

```csharp
[Fact]
public async Task MuteSidVoices_ValidParameters_DispatchesCommand()
{
    // Arrange
    var mediator = Substitute.For<IMediator>();
    var deviceManager = Substitute.For<IDeviceConnectionManager>();
    // ... setup mocks
    
    // Act
    await hub.MuteSidVoices("device1", VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);
    
    // Assert
    await mediator.Received(1).Send(Arg.Is<MuteSidVoicesCommand>(cmd => 
        cmd.DeviceId == "device1" && 
        cmd.Voice1Enabled == VoiceState.Enabled));
}
```

</details>

---

<details open>
<summary><h3>Task 5: Add Integration Tests (Optional but Recommended)</h3></summary>

**Purpose**: Create integration tests verifying the complete flow from hub invocation to MediatR command execution.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing
- Microsoft.AspNetCore.Mvc.Testing (WebApplicationFactory pattern)

**Implementation Subtasks:**

- [ ] **Create integration test file**: `DJHubIntegrationTests.cs`
- [ ] **Setup WebApplicationFactory**: Create test server with API host
- [ ] **Create SignalR client**: Use HubConnectionBuilder to connect to test server
- [ ] **Test end-to-end flow**: Invoke hub method from client
- [ ] **Mock serial layer**: Use test doubles for ISerialStateContext
- [ ] **Verify command execution**: Ensure command reaches handler
- [ ] **Test latency**: Measure command execution time (should be <100ms)

**Testing Subtask:**

- [ ] **Run Tests**: Integration tests pass consistently

**Key Implementation Notes:**

- Integration tests require test server (WebApplicationFactory)
- Mock serial layer to avoid physical device dependency
- Use SignalR client library (@microsoft/signalr) or HubConnection from .NET
- Test realistic scenarios including connection lifecycle

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] **Hub connection established**: Client connects to hub successfully
- [ ] **Method invocation**: Client can invoke MuteSidVoices method
- [ ] **Result received**: Client receives success/failure response
- [ ] **Performance**: Command completes within latency requirement
- [ ] **Error scenarios**: Client receives error for invalid parameters

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**New Files:**

- `apps/api/src/TeensyRom.Api/Endpoints/DJ/DJHub.cs`
- `apps/api/tests/TeensyRom.Api.Tests.Unit/Endpoints/DJ/DJHubTests.cs` (or colocated in DJ folder)
- `apps/api/tests/TeensyRom.Api.Tests.Integration/Endpoints/DJ/DJHubIntegrationTests.cs` (optional)

**Modified Files:**

- `apps/api/src/TeensyRom.Api/Program.cs` (add hub registration)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Test Execution Commands

**Running Tests:**

```bash
# Run all API unit tests
dotnet test apps/api/tests/TeensyRom.Api.Tests.Unit/

# Run specific test file
dotnet test --filter "FullyQualifiedName~DJHubTests"

# Run integration tests
dotnet test apps/api/tests/TeensyRom.Api.Tests.Integration/

# Run with coverage
dotnet test /p:CollectCoverage=true
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] DJHub class created in `Endpoints/DJ/DJHub.cs`
- [ ] MuteSidVoices hub method implemented with device routing
- [ ] Hub registered in Program.cs at `/api/djHub` endpoint
- [ ] Device validation implemented (throws HubException for invalid device)
- [ ] Error handling covers all error scenarios
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] Unit tests created covering all hub method behaviors
- [ ] Unit tests pass with >90% code coverage for DJHub class
- [ ] Integration tests verify end-to-end flow (if implemented)
- [ ] All tests pass consistently without flakiness
- [ ] Error scenarios properly tested

**Quality Checks:**

- [ ] No build errors or warnings
- [ ] API server starts successfully
- [ ] Hub endpoint accessible at `/api/djHub`
- [ ] SignalR negotiation endpoint responds
- [ ] Code reviewed for patterns and consistency

**Documentation:**

- [ ] Inline XML documentation on public hub methods
- [ ] Error messages are user-friendly and descriptive

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Hub ready for frontend integration
- [ ] Code merged to main branch (if applicable)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Hub Method Signature**: Chose to accept deviceId as parameter rather than connection-based context. This is more explicit and supports future scenarios where clients may control multiple devices.

- **Synchronous Response**: Hub method returns Task indicating success/failure synchronously. For DJ features requiring ultra-low latency, this is preferred over event-based callbacks.

- **MediatR Integration**: Reusing existing MuteSidVoicesCommand ensures consistency with serial behaviors (locking, logging, exception handling) without code duplication.

### Implementation Constraints

- **Device Context Binding**: The SerialBehavior in MediatR requires `ISerialStateContext` bound to command. Hub must resolve device and bind context before dispatching command.

- **Connection Lifecycle**: Unlike LogsHub (streaming) or DeviceEventHub (push), DJHub uses request-response pattern. Connection can be short-lived per command.

### Future Enhancements

- **Command Batching**: Support sending multiple commands in single hub call for complex DJ sequences
- **State Subscription**: Add hub methods for clients to subscribe to real-time device state updates
- **Command History**: Track command history for undo/redo functionality

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents creating and using this document**

### Key Questions Resolved

**Q: Should hub return Task or Task\<TResult\>?**
A: Return `Task` for fire-and-forget commands. For this feature, return `Task` as the MediatR result is primarily for internal logging. If frontend needs explicit success confirmation, return `Task<bool>`.

**Q: Where should error handling happen - hub or MediatR?**
A: Both. MediatR ExceptionBehavior handles serial-level errors. Hub should catch and translate outer exceptions to HubException for client consumption.

**Q: How to handle concurrent commands?**
A: SerialBehavior in MediatR already handles locking. Hub doesn't need additional concurrency control.

### During Implementation

**Progress Tracking:**

1. ✅ Mark checkboxes as completing each subtask
2. 📝 Document any design decisions or deviations
3. 🚧 Note blockers if device behavior differs from expected

**Testing Integration:**

1. Write unit tests as you implement each hub method
2. Run tests continuously during development
3. Verify integration test coverage before considering complete

</details>
