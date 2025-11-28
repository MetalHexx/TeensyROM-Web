# Task Handoff: Phase 1 - Backend Domain & Services

## 📋 Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | `PHASE-01` |
| **Feature** | Per-Device Settings |
| **Phase** | 1 of 4 - Backend Domain & Services |
| **Estimated Scope** | 8 tasks (domain models, interfaces, services, DI) |
| **Dependencies** | None - this is the first phase |

---

## 🎯 Objective

Implement the core backend changes to support per-device settings. After this phase:

1. `TeensySettings` will have a `KnownDevices` list instead of global `ConnectionSettings`/`VideoSettings`
2. New `IDeviceSettingsProvider` interface provides per-device settings access
3. `ApplicationBootstrapService` auto-connects devices based on **per-device** settings
4. API returns/accepts `knownDevices` array in settings endpoint

---

## 📚 Required Reading Before Starting

Read these documents in order:

1. **[Master Plan](./master-plan.md)** - High-level feature context and design decisions
2. **[Phase 1 Details](./phases/phase-01-backend-domain-services.md)** - Full task breakdown with implementation details
3. **[Backend Architecture](../BACKEND_ARCHITECTURE.md)** - Backend patterns and conventions

---

## 🔑 Key Design Decisions (Pre-Made)

These decisions are **already finalized** - implement as specified:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Settings access pattern | `IDeviceSettingsProvider` with `GetOrCreateDeviceSettings(deviceId)` | Creates new devices with defaults automatically |
| Default `enableVideo` | `false` | Video is opt-in |
| Default `autoConnectEnabled` | `true` | New devices should auto-connect |
| Migration strategy | None - users delete old `Settings.json` | Simplifies implementation |

---

## 📂 Files to Modify/Create

### New Files
- `apps/api/src/TeensyRom.Core/Abstractions/IDeviceSettingsProvider.cs`

### Modified Files
- `apps/api/src/TeensyRom.Core/Settings/TeensySettings.cs` - Remove global settings
- `apps/api/src/TeensyRom.Core/Settings/ISettingsService.cs` - Update interface inheritance
- `apps/api/src/TeensyRom.Core/Settings/SettingsService.cs` - Implement `IDeviceSettingsProvider`
- `apps/api/src/TeensyRom.Api/Services/ApplicationBootstrapService.cs` - Per-device auto-connect
- `apps/api/src/TeensyRom.Api/Endpoints/Serial/FindDevices/FindDevicesEndpoint.cs` - Remove old provider
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs` - Add DTOs
- `apps/api/src/TeensyRom.Api/Startup/ServiceStartupExtensions.cs` - Update DI

### Deleted Files
- `apps/api/src/TeensyRom.Core/Abstractions/IConnectionSettingsProvider.cs`
- `apps/api/src/TeensyRom.Core/Abstractions/IVideoSettingsProvider.cs`

---

## 🔨 Implementation Order

Execute tasks in this order to minimize broken builds:

```
1. Create IDeviceSettingsProvider interface (Task 2)
2. Update TeensySettings - remove global settings (Task 1)
3. Remove deprecated interfaces (Task 3)
4. Update SettingsService implementation (Task 4)
5. Update ApplicationBootstrapService (Task 5)
6. Update FindDevicesEndpoint (Task 6)
7. Update DTOs in SettingsModels (Task 7)
8. Update DI registrations (Task 8)
```

---

## 📝 Critical Implementation Details

### IDeviceSettingsProvider Interface

```csharp
// apps/api/src/TeensyRom.Core/Abstractions/IDeviceSettingsProvider.cs
public interface IDeviceSettingsProvider
{
    IObservable<List<DeviceSettings>> KnownDevices { get; }
    DeviceSettings? GetDeviceSettings(string deviceId);
    DeviceSettings GetOrCreateDeviceSettings(string deviceId);
    void SaveDeviceSettings(DeviceSettings deviceSettings);
}
```

### GetOrCreateDeviceSettings Logic

```csharp
public DeviceSettings GetOrCreateDeviceSettings(string deviceId)
{
    var existing = _currentSettings.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
    if (existing != null) return existing;
    
    var newDevice = new DeviceSettings
    {
        DeviceId = deviceId,
        VideoSettings = new VideoSettings { EnableVideo = false },
        ConnectionSettings = new ConnectionSettings 
        { 
            AutoConnectEnabled = true,
            ConnectionType = ConnectionType.Serial 
        }
    };
    
    _currentSettings.KnownDevices.Add(newDevice);
    SaveSettings(); // Persist immediately
    return newDevice;
}
```

### ApplicationBootstrapService New Flow

```csharp
// 1. Discover all devices (don't auto-connect yet)
var devices = await _deviceManager.FindDevices(autoConnect: false, ct);

foreach (var device in devices)
{
    // 2. Get or create device settings (creates with defaults if new)
    var deviceSettings = _settingsService.GetOrCreateDeviceSettings(device.DeviceId);
    
    // 3. Auto-connect only if enabled for this device
    if (deviceSettings.ConnectionSettings.AutoConnectEnabled)
    {
        _deviceManager.Connect(device.DeviceId);
        _log.InternalSuccess($"Auto-connected device: {device.DeviceId}");
    }
}
```

### DeviceSettingsDto

```csharp
public record DeviceSettingsDto
{
    [Required] public string DeviceId { get; set; } = string.Empty;
    [Required] public VideoSettingsDto VideoSettings { get; set; } = null!;
    [Required] public ConnectionSettingsDto ConnectionSettings { get; set; } = null!;
}
```

---

## ✅ Success Criteria

Complete this phase when:

- [ ] Solution builds without errors: `dotnet build`
- [ ] All tests pass: `dotnet test`
- [ ] API starts successfully: `dotnet run`
- [ ] GET `/api/settings` returns response with `knownDevices` array
- [ ] POST `/api/settings` accepts `knownDevices` array
- [ ] OpenAPI spec regenerated (for Phase 2)

---

## 🧪 Testing Requirements

### Unit Tests to Write

1. **SettingsService.GetDeviceSettings**
   - Returns null for unknown device ID
   - Returns correct device for known ID

2. **SettingsService.GetOrCreateDeviceSettings**
   - Creates new device with correct defaults (enableVideo=false, autoConnectEnabled=true)
   - Returns existing device without modification

3. **SettingsService.SaveDeviceSettings**
   - Updates existing device in list
   - Persists changes to disk

### Integration/Smoke Tests

1. **API Startup** - Application starts without DI errors
2. **Settings Endpoint** - GET/POST work with new structure

---

## ⚠️ Common Pitfalls to Avoid

1. **Don't forget SaveSettings()** in `GetOrCreateDeviceSettings` - new devices must persist
2. **Don't remove `ConnectionSettings.cs` or `VideoSettings.cs` classes** - these are still used by `DeviceSettings`
3. **Build the API project** after changes to regenerate OpenAPI spec: `dotnet build TeensyRom.Api.csproj`

---

## 📤 Handoff to Phase 2

After completing Phase 1, ensure:

1. OpenAPI spec is regenerated (happens automatically on build)
2. API is in a working state
3. Create `reports/PHASE-01-report.md` with:
   - Tasks completed
   - Any deviations from plan
   - Test results
   - Issues encountered

Phase 2 will regenerate the TypeScript API client and update frontend infrastructure.

---

## 🔗 Related Documentation

- [Phase 1 Details](./phases/phase-01-backend-domain-services.md) - Full task breakdown
- [Master Plan](./master-plan.md) - Feature overview
- [Backend Architecture](../BACKEND_ARCHITECTURE.md) - Patterns reference
