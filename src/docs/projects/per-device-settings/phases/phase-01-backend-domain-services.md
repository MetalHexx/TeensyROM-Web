# Phase 1: Backend Domain & Services

## ✅ PHASE COMPLETE

**Completed**: 2025-11-27  
**Report**: [PHASE-01-report.md](../reports/PHASE-01-report.md)

---

## 🎯 Objective

Implement the core backend changes to support per-device settings. This includes updating the settings domain models, creating the `IDeviceSettingsProvider` interface, modifying `SettingsService`, and updating `ApplicationBootstrapService` for per-device auto-connect logic.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - High-level feature plan
- [ ] [Settings Overview](../../../SETTINGS_OVERVIEW.md) - Current settings architecture

**Standards & Guidelines:**

- [ ] [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - Backend patterns and conventions
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core/
├── Settings/
│   ├── TeensySettings.cs                    📝 Modified - Remove global Connection/VideoSettings
│   ├── DeviceSettings.cs                    ✅ Already exists - No changes needed
│   ├── ConnectionSettings.cs                ✅ No changes - Used by DeviceSettings
│   ├── VideoSettings.cs                     ✅ No changes - Used by DeviceSettings
│   ├── SettingsService.cs                   📝 Modified - Add IDeviceSettingsProvider impl
│   └── ISettingsService.cs                  📝 Modified - Update interface hierarchy
├── Abstractions/
│   ├── IDeviceSettingsProvider.cs           ✨ New - Per-device settings provider interface
│   ├── IConnectionSettingsProvider.cs       🗑️ Remove - No longer needed (was global)
│   └── IVideoSettingsProvider.cs            🗑️ Remove - No longer needed (was global)

apps/api/src/TeensyRom.Api/
├── Services/
│   └── ApplicationBootstrapService.cs       📝 Modified - Per-device auto-connect logic
├── Endpoints/
│   └── Serial/FindDevices/
│       └── FindDevicesEndpoint.cs           📝 Modified - Remove IConnectionSettingsProvider
│   └── Settings/
│       └── SettingsModels.cs                📝 Modified - Add DeviceSettingsDto
├── Startup/
│   └── ServiceStartupExtensions.cs          📝 Modified - Update DI registrations
```

---

## 📋 Implementation Guidelines

> **Code Reference Policy**: Focus on WHAT to implement with class/method names. Small snippets for critical structures only.

> **Testing Policy**: Tests included within each task. Favor behavioral testing.

---

<details open>
<summary><h3>Task 1: Update TeensySettings Domain Model</h3></summary>

**Purpose**: Remove global `ConnectionSettings` and `VideoSettings` properties from `TeensySettings` since these are now per-device in `KnownDevices`.

**Related Documentation:**

- [Settings Overview - Data Model](../../../SETTINGS_OVERVIEW.md)

**Implementation Subtasks:**

- [ ] **Remove Properties**: Remove `ConnectionSettings` and `VideoSettings` properties from `TeensySettings.cs`
- [ ] **Verify DeviceSettings**: Confirm `DeviceSettings.cs` has correct structure (DeviceId, VideoSettings, ConnectionSettings)
- [ ] **Build Verification**: Ensure solution builds (will have errors in consumers - expected)

**Key Implementation Notes:**

- `TeensySettings` should only have: `PlayerSettings`, `FileTransferSettings`, `SearchSettings`, `AppSettings`, `KnownDevices`
- Build errors in `SettingsService` and other consumers are expected - we'll fix those in subsequent tasks

**Testing Subtask:**

- [ ] **Build Verification**: Solution compiles after removing properties (consumers will fail - that's expected at this stage)

</details>

---

<details open>
<summary><h3>Task 2: Create IDeviceSettingsProvider Interface</h3></summary>

**Purpose**: Create a new provider interface for per-device settings access, following the existing provider pattern.

**Related Documentation:**

- [IConnectionSettingsProvider](../../../../apps/api/src/TeensyRom.Core/Abstractions/IConnectionSettingsProvider.cs) - Pattern reference

**Implementation Subtasks:**

- [ ] **Create Interface**: Create `IDeviceSettingsProvider.cs` in `TeensyRom.Core/Abstractions/`
- [ ] **Define Methods**: Add `GetDeviceSettings(string deviceId)`, `GetOrCreateDeviceSettings(string deviceId)`, `SaveDeviceSettings(DeviceSettings)`
- [ ] **Add Observable**: Add `IObservable<List<DeviceSettings>> KnownDevices` property

**Critical Interface Definition:**

```csharp
public interface IDeviceSettingsProvider
{
    IObservable<List<DeviceSettings>> KnownDevices { get; }
    DeviceSettings? GetDeviceSettings(string deviceId);
    DeviceSettings GetOrCreateDeviceSettings(string deviceId);
    void SaveDeviceSettings(DeviceSettings deviceSettings);
}
```

**Key Implementation Notes:**

- `GetOrCreateDeviceSettings` should create with defaults: `enableVideo=false`, `autoConnectEnabled=true`
- Follow existing naming conventions in `Abstractions/` folder

**Testing Subtask:**

- [ ] **Compile Verification**: Interface compiles without errors

</details>

---

<details open>
<summary><h3>Task 3: Remove Deprecated Provider Interfaces</h3></summary>

**Purpose**: Remove `IConnectionSettingsProvider` and `IVideoSettingsProvider` since these are now per-device.

**Implementation Subtasks:**

- [ ] **Remove IConnectionSettingsProvider**: Delete `IConnectionSettingsProvider.cs`
- [ ] **Remove IVideoSettingsProvider**: Delete `IVideoSettingsProvider.cs`
- [ ] **Update ISettingsService**: Remove these interfaces from the inheritance list

**Key Implementation Notes:**

- `ISettingsService` currently inherits from multiple provider interfaces
- Remove `IConnectionSettingsProvider` and `IVideoSettingsProvider` from the list
- Add `IDeviceSettingsProvider` to the inheritance list

**Testing Subtask:**

- [ ] **Compile Verification**: Will have errors in `SettingsService` - expected

</details>

---

<details open>
<summary><h3>Task 4: Update SettingsService Implementation</h3></summary>

**Purpose**: Implement `IDeviceSettingsProvider` in `SettingsService` and remove deprecated global settings methods.

**Implementation Subtasks:**

- [ ] **Remove Global Observables**: Remove `ConnectionSettings` and `VideoSettings` observable properties
- [ ] **Remove Global Getters**: Remove `GetConnectionSettings()` and `GetVideoSettings()` methods
- [ ] **Add KnownDevices Observable**: Add `IObservable<List<DeviceSettings>> KnownDevices` property
- [ ] **Implement GetDeviceSettings**: Return device from `KnownDevices` list or null
- [ ] **Implement GetOrCreateDeviceSettings**: Return existing or create new with defaults
- [ ] **Implement SaveDeviceSettings**: Update device in list and persist

**Key Implementation Notes:**

- `GetOrCreateDeviceSettings` should:
  1. Look up device by ID in `_currentSettings.KnownDevices`
  2. If found, return it
  3. If not found, create new `DeviceSettings` with defaults, add to list, save, return
- Defaults: `enableVideo = false`, `autoConnectEnabled = true`, `connectionType = Serial`

**Testing Subtask:**

- [ ] **Write Unit Tests**: Test `GetDeviceSettings` returns null for unknown device
- [ ] **Write Unit Tests**: Test `GetOrCreateDeviceSettings` creates with correct defaults
- [ ] **Write Unit Tests**: Test `SaveDeviceSettings` updates existing device

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] `GetDeviceSettings("unknown")` returns null
- [ ] `GetDeviceSettings("known-id")` returns correct device
- [ ] `GetOrCreateDeviceSettings("new-id")` creates device with `enableVideo=false`, `autoConnectEnabled=true`
- [ ] `GetOrCreateDeviceSettings("existing-id")` returns existing without modification
- [ ] `SaveDeviceSettings(updated)` persists changes to Settings.json

</details>

---

<details open>
<summary><h3>Task 5: Update ApplicationBootstrapService</h3></summary>

**Purpose**: Implement per-device auto-connect logic that creates settings for new devices and respects per-device auto-connect flags.

**Related Documentation:**

- [ApplicationBootstrapService](../../../../apps/api/src/TeensyRom.Api/Services/ApplicationBootstrapService.cs) - Current implementation

**Implementation Subtasks:**

- [ ] **Change Discovery Call**: Call `FindDevices(autoConnect: false)` to discover without connecting
- [ ] **Loop Through Devices**: For each discovered device, get or create settings
- [ ] **Per-Device Auto-Connect**: Connect only devices where `autoConnectEnabled = true`
- [ ] **Log Actions**: Log which devices are connected vs skipped

**New Flow:**

```csharp
// 1. Discover all devices (don't auto-connect yet)
var devices = await _deviceManager.FindDevices(autoConnect: false, ct);

foreach (var device in devices)
{
    // 2. Get or create device settings (creates with defaults if new)
    var deviceSettings = _settingsService.GetOrCreateDeviceSettings(device.DeviceId);
    
    // 3. Auto-connect if enabled for this device
    if (deviceSettings.ConnectionSettings.AutoConnectEnabled)
    {
        _deviceManager.Connect(device.DeviceId);
        _log.InternalSuccess($"Auto-connected device: {device.DeviceId}");
    }
    else
    {
        _log.Internal($"Skipped auto-connect for device: {device.DeviceId}");
    }
}
```

**Key Implementation Notes:**

- Remove the old global `settings.ConnectionSettings.AutoConnectEnabled` check
- New devices will be auto-created with `autoConnectEnabled=true` default, so they will connect
- Previously-seen devices with `autoConnectEnabled=false` will be skipped

**Testing Subtask:**

- [ ] **Write Integration Test**: New device is created with defaults and connected
- [ ] **Write Integration Test**: Known device with autoConnect=false is not connected
- [ ] **Write Integration Test**: Known device with autoConnect=true is connected

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] New device appears → settings created with autoConnectEnabled=true → device connects
- [ ] Known device with autoConnectEnabled=false → device NOT connected
- [ ] Known device with autoConnectEnabled=true → device connected
- [ ] Multiple devices handled correctly (some connect, some skip)

</details>

---

<details open>
<summary><h3>Task 6: Update FindDevicesEndpoint</h3></summary>

**Purpose**: Remove dependency on `IConnectionSettingsProvider` since auto-connect is now handled in bootstrap.

**Implementation Subtasks:**

- [ ] **Remove Provider Injection**: Remove `IConnectionSettingsProvider` from constructor
- [ ] **Simplify Logic**: Always pass `autoConnect: false` to `FindDevices()` (let bootstrap handle auto-connect)
- [ ] **Or**: Inject `IDeviceSettingsProvider` if per-device behavior needed at endpoint level

**Key Implementation Notes:**

- The endpoint's job is discovery, not auto-connect logic
- Auto-connect is handled in `ApplicationBootstrapService` at startup
- Manual "Find Devices" calls from UI should just discover and return, not auto-connect

**Testing Subtask:**

- [ ] **Compile Verification**: Endpoint compiles without `IConnectionSettingsProvider`

</details>

---

<details open>
<summary><h3>Task 7: Update SettingsModels DTOs</h3></summary>

**Purpose**: Add `DeviceSettingsDto` and update `GetSettingsResponse`/`SaveSettingsRequest` to include `KnownDevices`.

**Implementation Subtasks:**

- [ ] **Create DeviceSettingsDto**: New DTO with `DeviceId`, `VideoSettings`, `ConnectionSettings`
- [ ] **Update GetSettingsResponse**: Add `List<DeviceSettingsDto> KnownDevices`
- [ ] **Update SaveSettingsRequest**: Add `List<DeviceSettingsDto> KnownDevices`
- [ ] **Remove Global DTOs**: Remove `ConnectionSettingsDto` and `VideoSettingsDto` from root response (keep the classes, just remove from root)

**Critical DTO Definition:**

```csharp
public record DeviceSettingsDto
{
    [Required] public string DeviceId { get; set; } = string.Empty;
    [Required] public VideoSettingsDto VideoSettings { get; set; } = null!;
    [Required] public ConnectionSettingsDto ConnectionSettings { get; set; } = null!;
}
```

**Testing Subtask:**

- [ ] **Build API**: Ensure OpenAPI spec is generated correctly
- [ ] **Verify Spec**: Check that `knownDevices` array appears in generated spec

</details>

---

<details open>
<summary><h3>Task 8: Update DI Registrations</h3></summary>

**Purpose**: Update `ServiceStartupExtensions.cs` to register new provider and remove deprecated ones.

**Implementation Subtasks:**

- [ ] **Remove Old Registrations**: Remove `IConnectionSettingsProvider` and `IVideoSettingsProvider` registrations
- [ ] **Add New Registration**: Add `IDeviceSettingsProvider` → `SettingsService`
- [ ] **Verify Startup**: Application starts without DI errors

**Key Implementation Notes:**

- `SettingsService` is registered as singleton
- New provider registration follows same pattern: `services.AddSingleton<IDeviceSettingsProvider>(sp => sp.GetRequiredService<SettingsService>())`

**Testing Subtask:**

- [ ] **Startup Test**: API starts and can accept requests
- [ ] **Endpoint Test**: GET /settings returns response with `knownDevices` array

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `apps/api/src/TeensyRom.Core/Abstractions/IDeviceSettingsProvider.cs`

**Modified Files:**

- `apps/api/src/TeensyRom.Core/Settings/TeensySettings.cs`
- `apps/api/src/TeensyRom.Core/Settings/SettingsService.cs`
- `apps/api/src/TeensyRom.Core/Settings/ISettingsService.cs`
- `apps/api/src/TeensyRom.Api/Services/ApplicationBootstrapService.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Serial/FindDevices/FindDevicesEndpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs`
- `apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs`

**Removed Files:**

- `apps/api/src/TeensyRom.Core/Abstractions/IConnectionSettingsProvider.cs`
- `apps/api/src/TeensyRom.Core/Abstractions/IVideoSettingsProvider.cs`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

**Core Testing Philosophy:**

- Behavioral testing - test observable outcomes
- Test as you go - each task includes testing subtasks
- Mock external dependencies (file system, serial ports)

**Test Categories:**

| Task | Test Type | Key Behaviors |
|------|-----------|---------------|
| Task 4 | Unit | GetDeviceSettings, GetOrCreateDeviceSettings, SaveDeviceSettings |
| Task 5 | Integration | Auto-connect flow with mocked DeviceConnectionManager |
| Task 8 | Smoke | API startup and settings endpoint response |

**Test Execution:**

```bash
cd apps/api
dotnet test
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] `TeensySettings` no longer has global `ConnectionSettings` or `VideoSettings`
- [ ] `IDeviceSettingsProvider` interface exists with required methods
- [ ] `SettingsService` implements `IDeviceSettingsProvider`
- [ ] `ApplicationBootstrapService` uses per-device auto-connect logic
- [ ] API builds and starts without errors
- [ ] GET /settings returns `knownDevices` array
- [ ] POST /settings accepts `knownDevices` array

**Testing Requirements:**

- [ ] All unit tests pass
- [ ] API starts successfully
- [ ] Settings can be saved and loaded

**Quality Checks:**

- [ ] No C# compilation errors or warnings
- [ ] OpenAPI spec generated correctly
- [ ] DI container resolves all services

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **GetOrCreateDeviceSettings over upsert**: Cleaner API that always returns a valid `DeviceSettings`, creating with defaults if needed
- **SaveDeviceSettings separate from GetOrCreate**: Allows read-only access without triggering saves; explicit save when user edits

### Dependencies for Next Phase

- OpenAPI spec must be regenerated before Phase 2
- Run `dotnet build TeensyRom.Api.csproj` to generate spec
- Phase 2 will run `pnpm run generate:api-client`

</details>
