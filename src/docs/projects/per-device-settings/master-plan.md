# Per-Device Settings Feature

## 🎯 Project Objective

Move `ConnectionSettings` and `VideoSettings` from global application settings to per-device settings, enabling users to configure each TeensyROM device independently. This supports multi-device scenarios where different devices may have different video capture setups or auto-connect preferences.

**User Value**: Users with multiple TeensyROM devices can configure each device independently—one device may have video capture enabled while another doesn't, or one device may auto-connect on startup while another requires manual connection.

**Technical Value**: The settings model becomes properly scoped to devices, aligning with the multi-device architecture already present in `DeviceConnectionManager`. New devices discovered during startup are automatically added to `KnownDevices` with sensible defaults.

---

## 📋 Implementation Phases

<details>
<summary><h3>✅ Phase 1: Backend Domain & Services (COMPLETE)</h3></summary>

### Objective

Implement the core backend changes: update settings models, create `IDeviceSettingsProvider`, modify `SettingsService`, and update `ApplicationBootstrapService` for per-device auto-connect logic.

### Key Deliverables

- [x] Remove global `ConnectionSettings` and `VideoSettings` from `TeensySettings`
- [x] Create `IDeviceSettingsProvider` interface with per-device methods
- [x] Update `SettingsService` to implement `IDeviceSettingsProvider`
- [x] Update `ApplicationBootstrapService` with per-device auto-connect flow
- [x] Update `FindDevicesEndpoint` to use new provider pattern
- [x] Update DTOs in `SettingsModels.cs` for API contract
- [x] All backend tests pass

### Completion Notes

- **Completed**: 2025-11-27
- **Report**: [PHASE-01-report.md](./reports/PHASE-01-report.md)
- **Cleanup Required**: Delete deprecated `IConnectionSettingsProvider.cs` and `IVideoSettingsProvider.cs`

</details>

---

<details>
<summary><h3>✅ Phase 2: Frontend Infrastructure Layer (COMPLETE)</h3></summary>

### Objective

Regenerate the API client and update the frontend infrastructure layer: domain models, mappers, and infrastructure service implementations.

### Key Deliverables

- [x] API client regenerated with new DTOs
- [x] Frontend `Settings` model updated with `knownDevices` array
- [x] Frontend `DeviceSettings` interface created
- [x] `DomainMapper` updated for device settings transformations
- [x] Infrastructure layer compiles without errors

### Completion Notes

- **Completed**: 2025-11-27
- `DomainMapper` tests updated for `knownDevices` handling
- Settings round-trip transformations verified in tests

</details>

---

<details>
<summary><h3>✅ Phase 3: Frontend Application Layer (COMPLETE)</h3></summary>

### Objective

Update the NgRx Signal Store with per-device selectors and any needed actions for managing device settings.

### Key Deliverables

- [x] New selector: `getDeviceSettings(deviceId)` 
- [x] New selector: `enableVideoForDevice(deviceId)`
- [x] New selector: `autoConnectForDevice(deviceId)`
- [x] New selector: `allKnownDevices`
- [x] Remove or deprecate global `enableVideo` selector
- [x] All store tests pass (502 passing)

### High-Level Tasks

1. **Create Per-Device Selectors**: `getDeviceSettings`, `enableVideoForDevice`, `autoConnectForDevice`, `allKnownDevices`
2. **Update Selector Exports**: Update `index.ts` to export new selectors
3. **Remove/Deprecate Global Selectors**: Deleted `selectEnableVideo`, `selectVideoSettings`
4. **Write Selector Tests**: 21 new tests with comprehensive coverage

### Completion Notes

- **Completed**: 2025-11-27
- **Report**: [PHASE-03-report.md](./reports/PHASE-03-report.md)
- Application layer tests: 502 passing (+21 new tests)
- 16 expected failures in player feature (resolved in Phase 4)

</details>

---

<details open>
<summary><h3>🔄 Phase 4: Frontend Feature Layer (Components) (IN PROGRESS)</h3></summary>

### Objective

Update the player component to use per-device video settings and restructure the settings view with a new Devices section replacing the separate Video and Connection sections.

### Key Deliverables

- [ ] `PlayerDeviceContainerComponent` uses per-device `enableVideoForDevice(deviceId)`
- [ ] New `devices-settings-section` component created (with `lib-scaling-card` per device)
- [ ] Settings view navigation updated ("Devices" button replaces Video/Connection)
- [ ] `SettingsFormService` updated for `knownDevices` FormArray
- [ ] Remove deprecated video/connection section components
- [ ] All component tests pass
- [ ] Manual UI verification complete

### High-Level Tasks

1. **Fix PlayerDeviceContainerComponent**: Use per-device selector (unblocks 16 tests)
2. **Update Settings Navigation**: Add "Devices" button, remove Video/Connection
3. **Create DevicesSettingsSectionComponent**: Outer section with `lib-scaling-card` per device
4. **Update SettingsFormService**: Build form with `knownDevices` FormArray
5. **Update SettingsViewComponent**: Wire up new section, remove deprecated methods
6. **Remove Deprecated Components**: Delete old video/connection sections
7. **Write Component Tests**: Test new components

### Open Questions for Phase 4

- None

</details>

---

<details open>
<summary><h2>🏗️ Architecture Overview</h2></summary>

### Key Design Decisions

- **IDeviceSettingsProvider Pattern**: New interface provides `GetDeviceSettings(deviceId)` and `GetOrCreateDeviceSettings(deviceId)` methods, following existing provider patterns (`IConnectionSettingsProvider`, `IVideoSettingsProvider`)
- **Bootstrap-Time Device Registration**: `ApplicationBootstrapService` creates `DeviceSettings` for newly discovered devices with defaults (enableVideo=false, autoConnect=true)
- **Per-Device Selectors**: Store exposes `enableVideoForDevice(deviceId)` returning a computed signal, allowing components to reactively access device-specific settings
- **Single Devices Section**: UI consolidates Video and Connection settings under one "Devices" section with cards for each known device

### Integration Points

- **DeviceConnectionManager ↔ SettingsService**: Bootstrap service coordinates device discovery with settings persistence
- **CartFinder → DeviceSettings**: Device IDs from `cart-tag.txt` map to `KnownDevices` entries
- **SettingsStore → PlayerDeviceContainerComponent**: Per-device video toggle flows through store selectors
- **SettingsFormService → DeviceSettingsSection**: Form array manages multiple device settings cards

### Data Flow

```
Backend Discovery:
CartFinder → DeviceId → ApplicationBootstrapService → GetOrCreateDeviceSettings() → SettingsService → Settings.json

Frontend Display:
Settings.json → API → SettingsStore.knownDevices → enableVideoForDevice(deviceId) → PlayerDeviceContainerComponent

Frontend Edit:
DeviceSettingsSection → FormArray → SettingsFormService → SettingsStore.saveSettings() → API → Settings.json
```

</details>

---

<details open>
<summary><h2>🧪 Testing Strategy</h2></summary>

### Unit Tests

- [ ] `SettingsService.GetDeviceSettings()` returns correct device or null
- [ ] `SettingsService.GetOrCreateDeviceSettings()` creates new device with defaults
- [ ] `SettingsService.SaveSettings()` persists `KnownDevices` correctly
- [ ] Store selectors return correct per-device values
- [ ] Store selectors return defaults for unknown devices

### Integration Tests

- [ ] `ApplicationBootstrapService` creates settings for new devices
- [ ] `ApplicationBootstrapService` respects per-device auto-connect flag
- [ ] Settings round-trip through API (save → load → verify)

### E2E Tests

- [ ] User can toggle video for specific device in settings
- [ ] User can toggle auto-connect for specific device
- [ ] Video overlay appears only for devices with enableVideo=true
- [ ] New device appears in settings after connection

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

- [ ] Global `ConnectionSettings` and `VideoSettings` removed from `TeensySettings`
- [ ] `KnownDevices` list persists per-device settings correctly
- [ ] New devices are automatically added to `KnownDevices` with defaults on discovery
- [ ] Per-device auto-connect works correctly at startup
- [ ] Video overlay visibility is controlled per-device
- [ ] Settings UI shows all known devices with their settings
- [ ] All existing tests pass (with updates for new model)
- [ ] No TypeScript or C# compilation errors
- [ ] Manual testing confirms expected behavior

</details>

---

<details open>
<summary><h2>🎭 User Scenarios</h2></summary>

### Device Discovery & Settings Creation

<details open>
<summary><strong>Scenario 1: New Device Discovered</strong></summary>

```gherkin
Given the API starts up
And a TeensyROM device is connected that has never been seen before
When device discovery runs
Then a new DeviceSettings entry is created in KnownDevices
And the device has enableVideo = false (default)
And the device has autoConnectEnabled = true (default)
And the settings are persisted to Settings.json
```

</details>

<details open>
<summary><strong>Scenario 2: Known Device Auto-Connects</strong></summary>

```gherkin
Given a device exists in KnownDevices with autoConnectEnabled = true
When the API starts up and discovers that device
Then the device is automatically connected
```

</details>

<details open>
<summary><strong>Scenario 3: Known Device Skips Auto-Connect</strong></summary>

```gherkin
Given a device exists in KnownDevices with autoConnectEnabled = false
When the API starts up and discovers that device
Then the device is NOT automatically connected
And the device remains in the disconnected devices list
```

</details>

---

### Video Settings Per-Device

<details open>
<summary><strong>Scenario 4: Video Overlay Shown for Enabled Device</strong></summary>

```gherkin
Given device A has enableVideo = true in its DeviceSettings
And device B has enableVideo = false in its DeviceSettings
When viewing the player for device A
Then the video capture component is visible
When viewing the player for device B
Then the video capture component is NOT visible
```

</details>

---

### Settings UI

<details open>
<summary><strong>Scenario 5: View Device Settings</strong></summary>

```gherkin
Given two devices exist in KnownDevices
When the user navigates to Settings > Devices
Then both devices are displayed in a list
And each device shows its connection type, auto-connect toggle, and video toggle
```

</details>

<details open>
<summary><strong>Scenario 6: Modify Device Settings</strong></summary>

```gherkin
Given a device exists in KnownDevices with enableVideo = false
When the user toggles enableVideo to true in the settings UI
Then the setting is auto-saved (after debounce)
And the video overlay becomes visible for that device
```

</details>

</details>

---

<details open>
<summary><h2>📚 Related Documentation</h2></summary>

- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **Settings Overview**: [SETTINGS_OVERVIEW.md](../../SETTINGS_OVERVIEW.md)
- **API Client Generation**: [API_CLIENT_GENERATION.md](../../API_CLIENT_GENERATION.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h2>📝 Notes</h2></summary>

### Design Considerations

- **No Migration**: Users delete existing `Settings.json`; fresh start with new structure
- **No Device Names**: Devices identified by hash ID only (display name feature deferred)
- **No Device Removal UI**: `KnownDevices` grows over time; cleanup feature deferred
- **Default Values**: New devices get `enableVideo=false`, `autoConnectEnabled=true`

### File Cleanup

After implementation, these files should be removed or significantly modified:
- `video-settings-section/` - Merged into `device-settings-section/`
- `connection-settings-section/` - Merged into `device-settings-section/`
- `IConnectionSettingsProvider.cs` - May be removed or kept for backwards compat
- `IVideoSettingsProvider.cs` - May be removed or kept for backwards compat

</details>
