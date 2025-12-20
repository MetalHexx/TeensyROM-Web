# Task Handoff: Create DJ SignalR Hub

## 📋 Task Identity

**Task ID**: DJ-SIGNALR-HUB-TASK-01-001-CREATE-HUB  
**Task Name**: Create DJ SignalR Hub with SID Voice Muting  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (3-5 files)

---

## 🎯 Objective

**What**: Create the DJHub SignalR hub class with MuteSidVoices method that integrates with the existing MuteSidVoicesCommand through MediatR, implementing device routing and error handling.

**Why**: Establishes low-latency, real-time command infrastructure for DJ features. SignalR's persistent WebSocket connections provide sub-100ms latency required for responsive audio manipulation, compared to 100-300ms for REST endpoints.

**Success Criteria**:
- [ ] DJHub class created in `Endpoints/DJ/DJHub.cs` inheriting from SignalR `Hub`
- [ ] MuteSidVoices hub method accepts deviceId and three VoiceState parameters
- [ ] Device resolution via IDeviceConnectionManager with null device validation
- [ ] MediatR command created and dispatched with proper parameter binding
- [ ] Error handling via HubException for invalid deviceId
- [ ] Hub registered in Program.cs at `/api/djHub` endpoint
- [ ] Unit tests cover all hub method behaviors with >90% coverage
- [ ] All tests pass consistently

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- ✅ MuteSidVoicesCommand already exists and is fully functional
- ✅ MediatR pipeline with SerialBehavior, LoggingBehavior, ExceptionBehavior operational
- ✅ DeviceConnectionManager manages multi-device orchestration
- ✅ Existing SignalR infrastructure (LogsHub, DeviceEventHub) provide reference patterns

**Dependencies**:
- `Microsoft.AspNetCore.SignalR` - Hub base class
- `MediatR` - IMediator for command dispatch
- `TeensyRom.Core.Device` - IDeviceConnectionManager for device resolution
- `TeensyRom.Core.Serial.Commands.MuteSidVoices` - Existing command and VoiceState enum
- xUnit + NSubstitute + FluentAssertions - Testing stack

**Constraints**:
- Hub must support multi-device scenarios (deviceId parameter required)
- Command latency target: <100ms from hub invocation to serial execution
- Hub methods must be async (return Task or Task<T>)
- Follow existing SignalR hub patterns in codebase (LogsHub, DeviceEventHub)
- Must integrate with existing MediatR pipeline behaviors without modification

---

## 📁 File Scope

**Files to Create**:
- `apps/api/src/TeensyRom.Api/Endpoints/DJ/DJHub.cs` - SignalR hub with MuteSidVoices method
- `apps/api/tests/TeensyRom.Api.Tests.Unit/Endpoints/DJ/DJHubTests.cs` - Unit tests (or colocate in DJ folder)

**Files to Modify**:
- `apps/api/src/TeensyRom.Api/Program.cs` - Add hub registration: `app.MapHub<DJHub>("/api/djHub");`

**Files to Review** (for reference patterns):
- `apps/api/src/TeensyRom.Api/Endpoints/Serial/Logs/LogsHub.cs` - Minimal hub example
- `apps/api/src/TeensyRom.Api/Endpoints/Serial/DeviceEvents/DeviceEventHub.cs` - Hub with dependency injection
- `apps/api/src/TeensyRom.Api/Program.cs` (lines 65-66) - Existing hub registration pattern
- `apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/MuteSidVoicesCommand.cs` - Command interface
- `apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/VoiceState.cs` - VoiceState enum

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - MediatR patterns, SignalR hub architecture
- [Coding Standards](../../../CODING_STANDARDS.md) - C# conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach

**Key Requirements**:

### 1. Hub Class Structure

Create `DJHub` class:
- Inherit from `Hub` (Microsoft.AspNetCore.SignalR)
- Inject `IMediator` and `IDeviceConnectionManager` via constructor
- Inject `ILogger<DJHub>` for error logging
- Follow namespace convention: `TeensyRom.Api.Endpoints.DJ`

### 2. MuteSidVoices Method Signature

```csharp
public async Task MuteSidVoices(
    string deviceId, 
    VoiceState voice1, 
    VoiceState voice2, 
    VoiceState voice3)
```

**Behavior**:
- Resolve device using `deviceManager.GetConnectedDevice(deviceId)`
- If device is null, throw `HubException` with message: "Device not found: {deviceId}"
- Get device's serial context: `device.SerialState`
- Create `MuteSidVoicesCommand` instance with parameters
- Bind `Serial` property: `command.Serial = serialContext`
- Dispatch via MediatR: `await mediator.Send(command, cancellationToken)`
- Return Task (no explicit return value needed - MediatR result is internal)

### 3. Device Resolution Pattern

```csharp
var device = _deviceManager.GetConnectedDevice(deviceId);
if (device is null)
{
    throw new HubException($"Device not found: {deviceId}");
}

var command = new MuteSidVoicesCommand
{
    DeviceId = deviceId,
    Voice1Enabled = voice1,
    Voice2Enabled = voice2,
    Voice3Enabled = voice3,
    Serial = device.SerialState // Bind serial context
};

await _mediator.Send(command, Context.ConnectionAborted);
```

### 4. Program.cs Registration

Add line after existing hub registrations (around line 66):

```csharp
app.MapHub<DJHub>("/api/djHub");
```

**Critical**: This must come **before** `app.MapFallbackToFile("index.html")` to avoid SPA routing conflicts.

### 5. Error Handling

**Use HubException** for client-visible errors:
- Invalid deviceId → `new HubException("Device not found: {deviceId}")`
- Log unexpected exceptions before throwing
- MediatR ExceptionBehavior already handles serial-level errors (device busy, port closed, etc.)

**Do NOT catch MediatR exceptions** - let them propagate to SignalR's error handling. The frontend will receive error details automatically.

### 6. Testing Requirements

**Unit Tests** (use xUnit + NSubstitute + FluentAssertions):

```csharp
[Fact]
public async Task MuteSidVoices_ValidParameters_DispatchesCommandToMediatR()
{
    // Arrange: Mock dependencies
    var mediator = Substitute.For<IMediator>();
    var deviceManager = Substitute.For<IDeviceConnectionManager>();
    var device = CreateMockDevice("device1");
    deviceManager.GetConnectedDevice("device1").Returns(device);
    
    var hub = new DJHub(mediator, deviceManager, logger);
    
    // Act
    await hub.MuteSidVoices("device1", VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);
    
    // Assert: Verify command dispatched with correct parameters
    await mediator.Received(1).Send(
        Arg.Is<MuteSidVoicesCommand>(cmd =>
            cmd.DeviceId == "device1" &&
            cmd.Voice1Enabled == VoiceState.Enabled &&
            cmd.Voice2Enabled == VoiceState.Disabled &&
            cmd.Voice3Enabled == VoiceState.Enabled
        ),
        Arg.Any<CancellationToken>()
    );
}

[Fact]
public async Task MuteSidVoices_InvalidDeviceId_ThrowsHubException()
{
    // Arrange
    var deviceManager = Substitute.For<IDeviceConnectionManager>();
    deviceManager.GetConnectedDevice(Arg.Any<string>()).Returns((TeensyRomDevice?)null);
    
    var hub = new DJHub(mediator, deviceManager, logger);
    
    // Act & Assert
    var exception = await Assert.ThrowsAsync<HubException>(() =>
        hub.MuteSidVoices("invalid-device", VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled)
    );
    
    exception.Message.Should().Contain("Device not found");
}
```

**Test Coverage**:
- [ ] Valid parameters dispatch command to MediatR
- [ ] All voice state combinations (Enabled/Disabled)
- [ ] Invalid deviceId throws HubException
- [ ] Null device from DeviceConnectionManager throws HubException
- [ ] Command contains correct deviceId and voice states
- [ ] Serial context properly bound to command
- [ ] CancellationToken from hub context passed to MediatR

**Anti-Patterns to Avoid**:
- ❌ Don't create hub instance manually - ASP.NET Core handles instantiation
- ❌ Don't store state in hub class - hubs are transient per connection
- ❌ Don't catch HubException and wrap it - let SignalR handle propagation
- ❌ Don't inject ISerialStateContext directly - resolve via device
- ❌ Don't bypass MediatR pipeline - always use mediator.Send()
- ❌ Don't return null from Task methods - return Task.CompletedTask if needed

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md) - Overall project context
- [Phase 1 Plan](../phases/DJ-SIGNALR-HUB-PHASE-01-CORE-HUB.md) - Detailed phase breakdown
- [Backend Architecture](../../../BACKEND_ARCHITECTURE.md#signalr-integration) - SignalR patterns

**Related Code Examples**:
- [LogsHub.cs](../../../../apps/api/src/TeensyRom.Api/Endpoints/Serial/Logs/LogsHub.cs) - Simple hub structure
- [DeviceEventHub.cs](../../../../apps/api/src/TeensyRom.Api/Endpoints/Serial/DeviceEvents/DeviceEventHub.cs) - Hub with DI
- [MuteSidVoicesCommand.cs](../../../../apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/MuteSidVoicesCommand.cs) - Command contract
- [MuteSidVoicesHandler.cs](../../../../apps/api/src/TeensyRom.Core.Serial/Commands/MuteSidVoices/MuteSidVoicesHandler.cs) - Command handler

**Related Tasks**:
- None (this is the first task in Phase 1)

---

## 📤 Output

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete

---

## 💡 Implementation Notes

### Design Rationale

**Why SignalR instead of REST?**
- REST: ~100-300ms latency (TCP handshake + HTTP headers per request)
- SignalR: ~20-50ms latency (persistent WebSocket connection)
- DJ features require instantaneous feedback for live mixing experience

**Why deviceId parameter?**
- Supports multi-device scenarios where user controls multiple TeensyROMs
- More explicit than connection-based device context
- Consistent with existing endpoint patterns

**Why integrate with existing MediatR command?**
- Reuses all pipeline behaviors (locking, logging, exception handling)
- Ensures consistency with other serial operations
- No code duplication or maintenance burden

### Expected Challenges

**Challenge**: Resolving correct device and binding serial context  
**Solution**: Use `DeviceConnectionManager.GetConnectedDevice(deviceId)`, then access `device.SerialState`

**Challenge**: Understanding Hub lifecycle (transient per connection)  
**Solution**: Don't store state in hub. Use DI for services, resolve data per method call.

**Challenge**: Testing hub methods with SignalR infrastructure  
**Solution**: Unit tests mock IMediator and IDeviceConnectionManager. Integration tests use WebApplicationFactory with HubConnection client.

### Testing Strategy

**Unit Tests**: Focus on hub method logic in isolation
- Mock all dependencies (IMediator, IDeviceConnectionManager)
- Verify correct command creation and dispatch
- Test error scenarios (null device, invalid parameters)

**Integration Tests** (optional but recommended):
- Use WebApplicationFactory to spin up test server
- Create SignalR HubConnection client
- Invoke hub method from client
- Verify command reaches handler (mock serial layer)

---

## ✅ Success Validation

Before marking complete, verify:

1. **Compilation**: `dotnet build` succeeds with zero errors/warnings
2. **Tests Pass**: `dotnet test` shows all tests green
3. **Hub Accessible**: API server starts, hub negotiation endpoint responds at `/api/djHub/negotiate`
4. **Code Review**: DJHub.cs follows patterns from LogsHub.cs and DeviceEventHub.cs
5. **Coverage**: Unit tests achieve >90% coverage for DJHub class
6. **Documentation**: XML doc comments on public hub method

---

## 🚀 Ready to Start?

You have everything needed to implement this task:
- ✅ Clear success criteria
- ✅ Existing MediatR command (no new command needed)
- ✅ Reference implementations (LogsHub, DeviceEventHub)
- ✅ Device resolution pattern established
- ✅ Testing examples and requirements

**Estimated Effort**: 2-3 hours (hub implementation + unit tests)

**Next Task After Completion**: DJ-SIGNALR-HUB-TASK-01-002-INTEGRATION-TESTS (if integration tests deferred)

---

**Questions before starting?** Review the reference files or consult [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) for additional context.
