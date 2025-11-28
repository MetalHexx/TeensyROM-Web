# Phase 3: Frontend Application Layer

## 🎯 Objective

Update the NgRx Signal Store with per-device selectors for accessing device-specific settings. Remove or deprecate global video/connection selectors that no longer apply.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - High-level feature plan
- [ ] [Phase 2 Report](../reports/TASK-02-report.md) - Infrastructure changes (when available)

**Standards & Guidelines:**

- [ ] [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [ ] [Store Testing](../../../STORE_TESTING.md) - Store testing patterns
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions

---

## 📂 File Structure Overview

```
libs/application/src/lib/settings/
├── settings-store.ts                        ✅ No changes - Store definition
├── settings-state.interface.ts              ✅ No changes - State shape uses Settings model
├── actions/
│   └── (no changes needed - updateSettings still works)
├── selectors/
│   ├── index.ts                             📝 Modified - Export new selectors
│   ├── select-device-settings.ts            ✨ New - getDeviceSettings(deviceId)
│   ├── select-enable-video-for-device.ts    ✨ New - enableVideoForDevice(deviceId)
│   ├── select-auto-connect-for-device.ts    ✨ New - autoConnectForDevice(deviceId)
│   ├── select-known-devices.ts              ✨ New - allKnownDevices selector
│   ├── select-enable-video.ts               🗑️ Remove - Was global, no longer valid
│   └── select-video-settings.ts             🗑️ Remove - Was global, no longer valid
```

---

## 📋 Implementation Guidelines

> **Code Reference Policy**: Focus on selector patterns with method signatures. Show small examples of computed signal usage.

> **Testing Policy**: Each selector needs behavioral tests verifying correct data retrieval.

---

<details open>
<summary><h3>Task 1: Create Per-Device Selector: getDeviceSettings</h3></summary>

**Purpose**: Create a selector that returns a specific device's settings by ID, or null if not found.

**Related Documentation:**

- [State Standards - Selectors](../../../STATE_STANDARDS.md)
- [Existing selector pattern](../../../../libs/application/src/lib/settings/selectors/get-settings.ts)

**Implementation Subtasks:**

- [ ] **Create Selector File**: Create `select-device-settings.ts` in selectors folder
- [ ] **Implement Selector**: Return computed signal for specific device by ID
- [ ] **Handle Missing Device**: Return null if device not found in knownDevices

**Selector Implementation:**

```typescript
// select-device-settings.ts
import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';
import { DeviceSettings } from '@teensyrom-nx/domain';

/**
 * Selector factory for getting a specific device's settings by ID
 * Returns null if device is not found in knownDevices
 */
export function selectDeviceSettings(store: WritableStore<SettingsState>) {
  return {
    getDeviceSettings: (deviceId: string) => computed(() => {
      const settings = store.settings();
      if (!settings?.knownDevices) return null;
      return settings.knownDevices.find(d => d.deviceId === deviceId) ?? null;
    }),
  };
}
```

**Key Implementation Notes:**

- Returns a function that takes `deviceId` and returns a computed signal
- The computed signal reactively updates when settings change
- Returns `null` for unknown devices (not undefined, for explicit handling)

**Testing Subtask:**

- [ ] **Write Unit Tests**: Test selector returns correct device for known ID
- [ ] **Write Unit Tests**: Test selector returns null for unknown ID
- [ ] **Write Unit Tests**: Test selector returns null when settings is null

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] `getDeviceSettings("device-1")` returns device-1's settings when it exists
- [ ] `getDeviceSettings("unknown")` returns null
- [ ] `getDeviceSettings` returns null when settings hasn't loaded yet
- [ ] Selector reactively updates when knownDevices changes

</details>

---

<details open>
<summary><h3>Task 2: Create Per-Device Selector: enableVideoForDevice</h3></summary>

**Purpose**: Create a convenience selector that returns whether video is enabled for a specific device.

**Implementation Subtasks:**

- [ ] **Create Selector File**: Create `select-enable-video-for-device.ts`
- [ ] **Implement Selector**: Return computed signal for device's enableVideo flag
- [ ] **Default to False**: Return false if device not found or settings not loaded

**Selector Implementation:**

```typescript
// select-enable-video-for-device.ts
import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting whether video is enabled for a specific device
 * Returns false if device is not found (safe default)
 */
export function selectEnableVideoForDevice(store: WritableStore<SettingsState>) {
  return {
    enableVideoForDevice: (deviceId: string) => computed(() => {
      const settings = store.settings();
      if (!settings?.knownDevices) return false;
      const device = settings.knownDevices.find(d => d.deviceId === deviceId);
      return device?.videoSettings?.enableVideo ?? false;
    }),
  };
}
```

**Key Implementation Notes:**

- Convenience selector wrapping `getDeviceSettings`
- Safe default of `false` - video disabled if device unknown

**Testing Subtask:**

- [ ] **Write Unit Tests**: Returns true when device has enableVideo=true
- [ ] **Write Unit Tests**: Returns false when device has enableVideo=false
- [ ] **Write Unit Tests**: Returns false for unknown device

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] Device with `enableVideo=true` → selector returns true
- [ ] Device with `enableVideo=false` → selector returns false
- [ ] Unknown device → selector returns false
- [ ] Settings not loaded → selector returns false

</details>

---

<details open>
<summary><h3>Task 3: Create Per-Device Selector: autoConnectForDevice</h3></summary>

**Purpose**: Create a convenience selector that returns whether auto-connect is enabled for a specific device.

**Implementation Subtasks:**

- [ ] **Create Selector File**: Create `select-auto-connect-for-device.ts`
- [ ] **Implement Selector**: Return computed signal for device's autoConnectEnabled flag
- [ ] **Default to True**: Return true if device not found (new devices should auto-connect)

**Selector Implementation:**

```typescript
// select-auto-connect-for-device.ts
import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting whether auto-connect is enabled for a specific device
 * Returns true if device is not found (new devices should auto-connect by default)
 */
export function selectAutoConnectForDevice(store: WritableStore<SettingsState>) {
  return {
    autoConnectForDevice: (deviceId: string) => computed(() => {
      const settings = store.settings();
      if (!settings?.knownDevices) return true; // Default: auto-connect new devices
      const device = settings.knownDevices.find(d => d.deviceId === deviceId);
      return device?.connectionSettings?.autoConnectEnabled ?? true;
    }),
  };
}
```

**Key Implementation Notes:**

- Default of `true` matches backend behavior for new devices
- This selector is mainly for UI display, not backend logic

**Testing Subtask:**

- [ ] **Write Unit Tests**: Returns true when device has autoConnectEnabled=true
- [ ] **Write Unit Tests**: Returns false when device has autoConnectEnabled=false
- [ ] **Write Unit Tests**: Returns true for unknown device (default)

</details>

---

<details open>
<summary><h3>Task 4: Create Selector: allKnownDevices</h3></summary>

**Purpose**: Create a selector that returns the full list of known devices for the settings UI.

**Implementation Subtasks:**

- [ ] **Create Selector File**: Create `select-known-devices.ts`
- [ ] **Implement Selector**: Return computed signal for knownDevices array
- [ ] **Default to Empty Array**: Return empty array if not loaded

**Selector Implementation:**

```typescript
// select-known-devices.ts
import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';
import { DeviceSettings } from '@teensyrom-nx/domain';

/**
 * Selector for getting all known devices
 * Returns empty array if settings not loaded
 */
export function selectKnownDevices(store: WritableStore<SettingsState>) {
  return {
    allKnownDevices: computed(() => {
      const settings = store.settings();
      return settings?.knownDevices ?? [];
    }),
  };
}
```

**Testing Subtask:**

- [ ] **Write Unit Tests**: Returns devices when available
- [ ] **Write Unit Tests**: Returns empty array when settings null

</details>

---

<details open>
<summary><h3>Task 5: Remove Deprecated Global Selectors</h3></summary>

**Purpose**: Remove the global `enableVideo` and `videoSettings` selectors that are no longer valid.

**Implementation Subtasks:**

- [ ] **Delete select-enable-video.ts**: Remove the file
- [ ] **Delete select-video-settings.ts**: Remove the file
- [ ] **Update index.ts exports**: Remove imports and exports for deleted selectors
- [ ] **Update withSettingsSelectors**: Remove references to deleted selectors

**Files to Delete:**

- `libs/application/src/lib/settings/selectors/select-enable-video.ts`
- `libs/application/src/lib/settings/selectors/select-video-settings.ts`

**Key Implementation Notes:**

- Components using these selectors will get compile errors - that's expected
- Phase 4 will update `PlayerDeviceContainerComponent` to use new per-device selectors

**Testing Subtask:**

- [ ] **Compile Check**: Application layer compiles (some downstream errors expected)

</details>

---

<details open>
<summary><h3>Task 6: Update Selector Index and Store</h3></summary>

**Purpose**: Export new selectors and integrate them into the store.

**Implementation Subtasks:**

- [ ] **Update index.ts**: Add imports and spread operators for new selectors
- [ ] **Verify Store Exports**: Ensure new selectors are accessible via `SettingsStore`

**Updated index.ts:**

```typescript
import { withMethods } from '@ngrx/signals';
import { SettingsState } from '../settings-state.interface';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { getSettings } from './get-settings';
import { canUndo } from './can-undo';
import { canRedo } from './can-redo';
import { getHistoryPosition } from './get-history-position';
import { isNavigatingHistory } from './is-navigating-history';
import { historyPositionDisplay } from './history-position-display';
// NEW imports
import { selectDeviceSettings } from './select-device-settings';
import { selectEnableVideoForDevice } from './select-enable-video-for-device';
import { selectAutoConnectForDevice } from './select-auto-connect-for-device';
import { selectKnownDevices } from './select-known-devices';
// REMOVED: selectVideoSettings, selectEnableVideo

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function withSettingsSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<SettingsState>;
    return {
      ...getSettings(writableStore),
      ...canUndo(writableStore),
      ...canRedo(writableStore),
      ...getHistoryPosition(writableStore),
      ...isNavigatingHistory(writableStore),
      ...historyPositionDisplay(writableStore),
      // NEW selectors
      ...selectDeviceSettings(writableStore),
      ...selectEnableVideoForDevice(writableStore),
      ...selectAutoConnectForDevice(writableStore),
      ...selectKnownDevices(writableStore),
      // REMOVED: selectVideoSettings, selectEnableVideo
    };
  });
}
```

**Testing Subtask:**

- [ ] **Compile Check**: Application layer compiles
- [ ] **Integration Test**: Store methods are accessible

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/application/src/lib/settings/selectors/select-device-settings.ts`
- `libs/application/src/lib/settings/selectors/select-enable-video-for-device.ts`
- `libs/application/src/lib/settings/selectors/select-auto-connect-for-device.ts`
- `libs/application/src/lib/settings/selectors/select-known-devices.ts`

**Modified Files:**

- `libs/application/src/lib/settings/selectors/index.ts`

**Removed Files:**

- `libs/application/src/lib/settings/selectors/select-enable-video.ts`
- `libs/application/src/lib/settings/selectors/select-video-settings.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

**Core Testing Philosophy:**

- Behavioral testing for selectors
- Test observable/computed behavior
- Cover edge cases (null settings, unknown devices)

**Test Categories:**

| Task | Test Type | Key Behaviors |
|------|-----------|---------------|
| Task 1 | Unit | getDeviceSettings returns correct device or null |
| Task 2 | Unit | enableVideoForDevice returns correct boolean |
| Task 3 | Unit | autoConnectForDevice returns correct boolean with default |
| Task 4 | Unit | allKnownDevices returns array or empty |
| Task 6 | Compile | Store compiles and exports methods |

**Test Execution:**

```bash
pnpm nx test application
pnpm nx lint application
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] `getDeviceSettings(deviceId)` returns device settings or null
- [ ] `enableVideoForDevice(deviceId)` returns boolean (false default)
- [ ] `autoConnectForDevice(deviceId)` returns boolean (true default)
- [ ] `allKnownDevices()` returns array of all devices
- [ ] Global `enableVideo` and `videoSettings` selectors removed

**Testing Requirements:**

- [ ] All selector unit tests pass
- [ ] Application library compiles
- [ ] Lint passes with no errors

**Quality Checks:**

- [ ] No TypeScript errors in application layer
- [ ] Selectors follow existing patterns
- [ ] Defaults are safe and documented

**Ready for Next Phase:**

- [ ] Application layer compiles cleanly
- [ ] Selectors ready for component consumption (Phase 4)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Selector Pattern Notes

- Selectors that take parameters (like `deviceId`) return a function that creates a computed signal
- Components should call `store.enableVideoForDevice(deviceId)()` to get the signal value
- Or bind: `readonly enableVideo = computed(() => this.store.enableVideoForDevice(this.deviceId())());`

### Known Compile Errors After This Phase

The following files will have compile errors until Phase 4:
- `PlayerDeviceContainerComponent` - uses removed `enableVideo()` selector

This is expected - Phase 4 addresses component updates.

### Downstream Dependencies

- Phase 4 components will consume these selectors
- `SettingsFormService` will need `allKnownDevices` for building form arrays

</details>
