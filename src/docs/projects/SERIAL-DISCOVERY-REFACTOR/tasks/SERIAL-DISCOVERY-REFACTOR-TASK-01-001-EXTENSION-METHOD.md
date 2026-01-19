# Task Handoff: Extension Method & Refactor ReconnectToNormalFW

## 📋 Task Identity

**Task ID**: SERIAL-DISCOVERY-REFACTOR-TASK-01-001-EXTENSION-METHOD  
**Task Name**: Create EnsureNormalFirmware Extension Method & Refactor ReconnectToNormalFW  
**Assigned To**: Backend Wizard  
**Priority**: High  
**Estimated Context Size**: Small (1 file)

---

## 🎯 Objective

**What**: Create a new `EnsureNormalFirmware()` extension method in `TRStreamExtensions.cs` that ensures a device on a specific COM port is running normal firmware, and refactor `ReconnectToNormalFW()` to use it.

**Why**: The current `ReconnectToNormalFW()` combines two responsibilities: (1) checking/resetting firmware state on a port, and (2) scanning across multiple ports. We need to extract the single-port logic for reuse in `SerialDiscoveryStrategy`.

**Success Criteria**:
- [ ] `EnsureNormalFirmware()` method created that works on a single port
- [ ] Method returns `true` when device is in normal mode (or successfully reset)
- [ ] Method returns `false` when reset fails or unexpected response
- [ ] `ReconnectToNormalFW()` refactored to use `EnsureNormalFirmware()` internally
- [ ] Behavior of `ReconnectToNormalFW()` unchanged (just cleaner implementation)
- [ ] Solution builds without warnings
- [ ] Existing tests pass

---

## 📦 Context & Dependencies

**Prerequisites Completed**: None (first task)

**Dependencies**:
- `TeensyRom.Core.Serial` project
- `ICommunicationPort` interface
- `ILoggingService` interface
- Existing `SendMinimalCommand()` and `ResetDevice()` methods

**Constraints**:
- `EnsureNormalFirmware()` must NOT scan other ports - works only with current port
- `ReconnectToNormalFW()` behavior must remain unchanged for existing callers

---

## 📁 File Scope

**Files to Modify**:
- `apps/api/src/TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs`
  - Add `EnsureNormalFirmware()` method
  - Refactor `ReconnectToNormalFW()` to use new method

**Files to Review** (for context):
- `apps/api/src/TeensyRom.Core.Serial/Commands/LaunchFile/LaunchFileSerial/LaunchFileSerialHandler.cs` - Shows usage of `ReconnectToNormalFW()`
- `apps/api/src/TeensyRom.Core.Device/TcpDiscoveryStrategy.cs` - Shows similar minimal mode handling for TCP

---

## 🔧 Implementation Guidance

### 1. Create `EnsureNormalFirmware()` Method

Add this new extension method (insert before `ReconnectToNormalFW`):

```csharp
/// <summary>
/// Ensures the device on the current port is running normal firmware.
/// If in minimal mode, resets the device and waits for it to come back on the same port.
/// Unlike ReconnectToNormalFW, this does NOT scan other ports - works only with current port.
/// </summary>
/// <param name="communicationPort">The communication port to check.</param>
/// <param name="log">Logging service for diagnostics.</param>
/// <returns>True if device is now in normal firmware mode, false if reset failed or unexpected response.</returns>
public static bool EnsureNormalFirmware(this ICommunicationPort communicationPort, ILoggingService log)
```

**Behavior**:
1. Call `SendMinimalCommand()` to check firmware state
2. If result == 0 (normal mode): return `true` immediately
3. If result == 1 (minimal mode):
   - Log that device is in minimal mode
   - Call `ResetDevice()` to trigger firmware switch
   - Wait ~2 seconds for device to restart
   - Close and reopen the port
   - Clear buffers and wait ~200ms for stabilization
   - Call `SendMinimalCommand()` again to verify normal mode
   - Return `true` if now in normal mode, `false` otherwise
4. If result is anything else: return `false`

### 2. Refactor `ReconnectToNormalFW()`

The existing method scans all ports looking for a device. Refactor it to use `EnsureNormalFirmware()` in its inner loop:

```csharp
public static bool ReconnectToNormalFW(this ICommunicationPort communicationPort, ILoggingService log)
{
    var stopwatch = Stopwatch.StartNew();

    while (stopwatch.ElapsedMilliseconds < 30000)
    {
        var ports = SerialPort.GetPortNames().Distinct();

        foreach (var port in ports)
        {
            Thread.Sleep(10);

            try
            {
                communicationPort.ClosePort();
                communicationPort.SetPort(port);
                communicationPort.OpenPort(useRetryLoop: false);
                communicationPort.ClearBuffers();
                Thread.Sleep(200);

                // Use the new helper method instead of inline logic
                if (communicationPort.EnsureNormalFirmware(log))
                    return true;
            }
            catch
            {
                continue;
            }
        }
    }
    log.InternalError("ReconnectToNormalFW: Timed out searching for device");
    return false;
}
```

**Note**: The key difference is that `ReconnectToNormalFW()` iterates ports and calls `EnsureNormalFirmware()` on each, while `EnsureNormalFirmware()` only works with the current port.

---

## 🧪 Testing Requirements

**Manual Verification**:
- Build the solution: `dotnet build apps/api/src/TeensyRom.Core.Serial/TeensyRom.Core.Serial.csproj`
- Run existing tests to ensure no regressions

**Behavioral Expectations**:
- `EnsureNormalFirmware()` on a normal-mode device returns `true` quickly
- `EnsureNormalFirmware()` on a minimal-mode device resets and returns `true`
- `ReconnectToNormalFW()` behaves identically to before (scans ports until device found)

---

## 📤 Output

**Output Report Location**: `docs/projects/SERIAL-DISCOVERY-REFACTOR/reports/SERIAL-DISCOVERY-REFACTOR-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
