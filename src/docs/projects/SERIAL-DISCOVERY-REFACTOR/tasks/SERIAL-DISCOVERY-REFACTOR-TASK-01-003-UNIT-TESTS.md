# Task Handoff: Unit Tests for SerialDiscoveryStrategy

## 📋 Task Identity

**Task ID**: SERIAL-DISCOVERY-REFACTOR-TASK-01-003-UNIT-TESTS  
**Task Name**: Create Unit Tests for SerialDiscoveryStrategy  
**Assigned To**: Backend Wizard  
**Priority**: Medium  
**Estimated Context Size**: Medium (new test file + reference)

---

## 🎯 Objective

**What**: Create comprehensive unit tests for the refactored `SerialDiscoveryStrategy`, mirroring the test patterns used in `TcpDiscoveryStrategyTests`.

**Why**: The original `SerialDiscoveryStrategyTests.cs` was deleted because it required real hardware. The new tests should mock dependencies (`IDeviceTransportFactory`, `ICommunicationPort`) to enable proper unit testing without hardware.

**Success Criteria**:
- [ ] Test file created at `TeensyRom.Core.Device.Tests.Unit/Discovery/SerialDiscoveryStrategyTests.cs`
- [ ] Tests verify `IDiscoveryStrategy` interface implementation
- [ ] Tests verify cache loading behavior
- [ ] Tests verify cache fallback to full scan
- [ ] Tests verify `fullScan=true` skips cache
- [ ] Tests verify logging calls
- [ ] All tests pass

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- SERIAL-DISCOVERY-REFACTOR-TASK-01-001-EXTENSION-METHOD
- SERIAL-DISCOVERY-REFACTOR-TASK-01-002-STRATEGY-REFACTOR

**Dependencies**:
- `TeensyRom.Core.Device.Tests.Unit` project
- `NSubstitute` for mocking
- `FluentAssertions` for assertions
- xUnit test framework

**Constraints**:
- Tests must NOT require real COM ports or hardware
- Tests should mock `IDeviceTransportFactory` and `ICommunicationPort`
- Follow patterns established in `TcpDiscoveryStrategyTests.cs`

---

## 📁 File Scope

**Files to Create**:
- `apps/api/src/TeensyRom.Core.Device.Tests.Unit/Discovery/SerialDiscoveryStrategyTests.cs`

**Files to Review** (for patterns):
- `apps/api/src/TeensyRom.Core.Device.Tests.Unit/Discovery/TcpDiscoveryStrategyTests.cs` - Test patterns
- `apps/api/src/TeensyRom.Core.Device/SerialDiscoveryStrategy.cs` - Class under test

---

## 🔧 Implementation Guidance

### Test File Structure

```csharp
using FluentAssertions;
using NSubstitute;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for SerialDiscoveryStrategy covering caching, discovery flow, and fallback logic.
/// </summary>
public class SerialDiscoveryStrategyTests : IDisposable
{
    private readonly ILoggingService _mockLog;
    private readonly IDeviceTransportFactory _mockTransportFactory;
    private readonly SerialDiscoveryStrategy _sut;

    public SerialDiscoveryStrategyTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockTransportFactory = Substitute.For<IDeviceTransportFactory>();
        _sut = new SerialDiscoveryStrategy(_mockLog, _mockTransportFactory);
    }

    public void Dispose()
    {
        // Cleanup if needed
    }

    // Tests go here...
}
```

### Required Test Categories

#### 1. Interface Implementation Tests

```csharp
[Fact]
public void SerialDiscoveryStrategy_ShouldImplementIDiscoveryStrategy()
{
    _sut.Should().BeAssignableTo<IDiscoveryStrategy>();
}

[Fact]
public async Task FindEndpoints_ShouldReturnList()
{
    var ct = CancellationToken.None;
    var result = await _sut.FindEndpoints(ct);
    result.Should().NotBeNull();
    result.Should().BeOfType<List<DiscoveredEndpoint>>();
}
```

#### 2. Cache Behavior Tests

```csharp
[Fact]
public async Task FindEndpoints_WhenNoCacheExists_ShouldPerformFullScan()
{
    var ct = CancellationToken.None;
    await _sut.FindEndpoints(ct);
    
    _mockLog.Received().Internal(Arg.Is<string>(s => 
        s.Contains("No cached") || s.Contains("full scan")));
}

[Fact]
public async Task FindEndpoints_WithFullScanTrue_ShouldSkipCache()
{
    var ct = CancellationToken.None;
    await _sut.FindEndpoints(ct, fullScan: true);
    
    _mockLog.Received().Internal(Arg.Is<string>(s => 
        s.Contains("fullScan=true")));
}
```

#### 3. Fast Discovery Tests

```csharp
[Fact]
public async Task FindEndpoints_ShouldAttemptFastDiscoveryFirst()
{
    var ct = CancellationToken.None;
    await _sut.FindEndpoints(ct);
    
    _mockLog.Received().Internal(Arg.Is<string>(s => 
        s.Contains("fast discovery") || s.Contains("cached")));
}
```

#### 4. Connection Type Tests

```csharp
[Fact]
public async Task FindEndpoints_ShouldReturnEndpointsWithConnectionTypeSerial()
{
    var ct = CancellationToken.None;
    var result = await _sut.FindEndpoints(ct);
    
    if (result.Count > 0)
    {
        result.Should().AllSatisfy(endpoint =>
            endpoint.ConnectionType.Should().Be(ConnectionType.Serial));
    }
}
```

#### 5. Cancellation Tests

```csharp
[Fact]
public async Task FindEndpoints_ShouldRespectCancellationToken()
{
    var cts = new CancellationTokenSource();
    var ct = cts.Token;

    var task = _sut.FindEndpoints(ct);
    cts.Cancel();

    // Should complete without hanging
    try
    {
        await task;
    }
    catch (OperationCanceledException)
    {
        // Expected
    }
}
```

---

## 🧪 Testing Requirements

**Run Tests**:
```bash
dotnet test apps/api/src/TeensyRom.Core.Device.Tests.Unit/TeensyRom.Core.Device.Tests.Unit.csproj
```

**Expected Results**:
- All new tests pass
- Tests complete without requiring hardware
- Tests verify observable behavior through logging

---

## 📤 Output

**Output Report Location**: `docs/projects/SERIAL-DISCOVERY-REFACTOR/reports/SERIAL-DISCOVERY-REFACTOR-TASK-01-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
