# Task Handoff: Phase 3 - Frontend Application Layer

## 📋 Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | `PHASE-03` |
| **Feature** | Per-Device Settings |
| **Phase** | 3 of 4 - Frontend Application Layer |
| **Estimated Scope** | 6 tasks (selectors, store updates) |
| **Dependencies** | Phase 1 ✅, Phase 2 ✅ |
| **Assigned To** | UI Wizard |

---

## 🎯 Objective

Update the NgRx Signal Store with per-device selectors for accessing device-specific settings. The current global `enableVideo()` and `videoSettings()` selectors need to be replaced with per-device variants.

After this phase:
1. New selector `getDeviceSettings(deviceId)` returns device settings or null
2. New selector `enableVideoForDevice(deviceId)` returns boolean for specific device
3. New selector `autoConnectForDevice(deviceId)` returns boolean for specific device  
4. New selector `allKnownDevices()` returns array of all known devices
5. Old global selectors removed/deprecated
6. Application layer compiles without errors

---

## 📚 Required Reading Before Starting

1. **[Phase 3 Details](./phases/phase-03-frontend-application.md)** - Full task breakdown
2. **[State Standards](../../STATE_STANDARDS.md)** - NgRx Signal Store patterns
3. **[Store Testing](../../STORE_TESTING.md)** - Store testing patterns

---

## 📂 Current State Analysis

### Existing Selectors (to be removed/replaced)

```
libs/application/src/lib/settings/selectors/
├── select-enable-video.ts      🗑️ Remove - Uses global videoSettings
├── select-video-settings.ts    🗑️ Remove - Uses global videoSettings
└── index.ts                    📝 Update - Replace exports
```

### Current Implementation (uses old global pattern)

```typescript
// select-enable-video.ts - CURRENT (BROKEN - videoSettings no longer exists globally)
export function selectEnableVideo(store: WritableStore<SettingsState>) {
  return {
    enableVideo: computed(() => store.settings()?.videoSettings?.enableVideo ?? false),
  };
}
```

### Domain Model (already correct)

```typescript
// libs/domain/src/lib/models/settings.model.ts
export interface Settings {
  playerSettings: PlayerSettings;
  fileTransferSettings: FileTransferSettings;
  searchSettings: SearchSettings;
  appSettings: AppSettings;
  knownDevices: DeviceSettings[];  // ✅ Already has per-device structure
}

export interface DeviceSettings {
  deviceId: string;
  videoSettings: VideoSettings;
  connectionSettings: ConnectionSettings;
}
```

---

## 🔨 Task Sequence

Execute in this order:

### Task 1: Create `select-device-settings.ts`

Create selector that returns a specific device's settings by ID.

**Selector:** `selectDeviceSettings(store)`  
**Returns:** `{ getDeviceSettings: (deviceId: string) => Signal<DeviceSettings | null> }`

**Behavior:**
- Search `store.settings()?.knownDevices` for matching `deviceId`
- Return `null` if device not found or settings not loaded
- Follow existing selector pattern in `get-settings.ts`

---

### Task 2: Create `select-enable-video-for-device.ts`

Create convenience selector for device-specific video enablement.

**Selector:** `selectEnableVideoForDevice(store)`  
**Returns:** `{ enableVideoForDevice: (deviceId: string) => Signal<boolean> }`

**Behavior:**
- Find device in `knownDevices` array
- Return `device.videoSettings.enableVideo`
- Default: `false` (safe default - no video for unknown devices)

---

### Task 3: Create `select-auto-connect-for-device.ts`

Create convenience selector for device-specific auto-connect.

**Selector:** `selectAutoConnectForDevice(store)`  
**Returns:** `{ autoConnectForDevice: (deviceId: string) => Signal<boolean> }`

**Behavior:**
- Find device in `knownDevices` array
- Return `device.connectionSettings.autoConnectEnabled`
- Default: `true` (new devices should auto-connect by default - matches backend)

---

### Task 4: Create `select-known-devices.ts`

Create selector that returns all known devices.

**Selector:** `selectKnownDevices(store)`  
**Returns:** `{ allKnownDevices: Signal<DeviceSettings[]> }`

**Behavior:**
- Return `store.settings()?.knownDevices` or empty array
- No filtering, just expose the full list

---

### Task 5: Delete Deprecated Selectors

Remove the old global selectors that no longer work:
- `select-enable-video.ts`
- `select-video-settings.ts`

---

### Task 6: Update `selectors/index.ts`

Update the barrel export:
- Import new selectors: `selectDeviceSettings`, `selectEnableVideoForDevice`, `selectAutoConnectForDevice`, `selectKnownDevices`
- Remove old selectors: `selectVideoSettings`, `selectEnableVideo`
- Add new selectors to `withSettingsSelectors()` return object

---

## 📂 Files to Create/Modify/Delete

### New Files
- `libs/application/src/lib/settings/selectors/select-device-settings.ts`
- `libs/application/src/lib/settings/selectors/select-enable-video-for-device.ts`
- `libs/application/src/lib/settings/selectors/select-auto-connect-for-device.ts`
- `libs/application/src/lib/settings/selectors/select-known-devices.ts`

### Modified Files
- `libs/application/src/lib/settings/selectors/index.ts`

### Deleted Files
- `libs/application/src/lib/settings/selectors/select-enable-video.ts`
- `libs/application/src/lib/settings/selectors/select-video-settings.ts`

---

## 🧪 Testing Requirements

Each new selector needs unit tests. Follow the existing test patterns in `libs/application/src/lib/settings/selectors/*.spec.ts`.

### Test Scenarios per Selector

**`selectDeviceSettings`:**
- Returns correct device when ID matches
- Returns `null` for unknown device ID  
- Returns `null` when settings not loaded

**`selectEnableVideoForDevice`:**
- Returns `true` when device has video enabled
- Returns `false` when device has video disabled
- Returns `false` for unknown device (safe default)
- Returns `false` when settings not loaded

**`selectAutoConnectForDevice`:**
- Returns `true` when device has auto-connect enabled
- Returns `false` when device has auto-connect disabled
- Returns `true` for unknown device (default to connect)
- Returns `true` when settings not loaded

**`selectKnownDevices`:**
- Returns array of all known devices
- Returns empty array when settings not loaded

---

## ✅ Success Criteria

Complete this phase when:

- [x] All 4 new selector files created ✅
- [x] All new selectors have unit tests ✅ (21 new tests)
- [x] Old selectors deleted (`select-enable-video.ts`, `select-video-settings.ts`) ✅
- [x] `index.ts` updated with new exports ✅
- [x] Application library compiles: `pnpm nx build application` ✅
- [x] All tests pass: `pnpm nx test application` ✅ (502/502 passing)
- [x] Lint passes: `pnpm nx lint application` ✅ (0 new warnings)

**Expected downstream errors**: After this phase, `PlayerDeviceContainerComponent` will have a compile error because it uses `settingsStore.enableVideo()` which no longer exists. This is expected and will be fixed in Phase 4.

---

## ⚠️ Important Notes

### Selector Pattern for Per-Device

The new selectors return **functions that create computed signals** for a given device ID. Components will use them like:

```typescript
// Component gets deviceId from DeviceStore, then uses per-device selector
const enableVideo = this.settingsStore.enableVideoForDevice(deviceId)();
```

### Default Values

| Selector | Default (when device not found) | Reason |
|----------|--------------------------------|--------|
| `getDeviceSettings` | `null` | Explicit "not found" |
| `enableVideoForDevice` | `false` | Safe - don't enable video unexpectedly |
| `autoConnectForDevice` | `true` | Matches backend - new devices auto-connect |
| `allKnownDevices` | `[]` | Empty list when not loaded |

---

## 📤 Handoff to Phase 4

After completing Phase 3, ensure:

1. Application layer compiles without errors
2. All selector tests pass
3. Create `reports/PHASE-03-report.md` with:
   - Tasks completed
   - Test results
   - Any deviations

Phase 4 will update the components to use these new per-device selectors.

---

## 🔗 Related Documentation

- [Phase 3 Details](./phases/phase-03-frontend-application.md) - Full task breakdown
- [Master Plan](./master-plan.md) - Feature overview
- [State Standards](../../STATE_STANDARDS.md) - Store patterns
