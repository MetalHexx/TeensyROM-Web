# Phase 5: Video Device Persistence

## 🎯 Objective

Update `VideoCaptureComponent` to persist the selected video device ID per TeensyROM device. The component should read the initial video device from `SettingsStore` and save changes immediately when the user selects a different video device from the dropdown.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - High-level feature plan
- [ ] [Phase 4 Report](../reports/TASK-04-report.md) - Frontend component changes (when available)

**Standards & Guidelines:**

- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Angular conventions

---

## 📂 File Structure Overview

```
libs/application/src/lib/settings/
├── selectors/
│   ├── select-video-device-for-device.ts           ✨ New - Selector for videoDeviceId
│   ├── select-video-device-for-device.spec.ts      ✨ New - Selector tests
│   └── index.ts                                    📝 Modified - Export new selector
├── actions/
│   ├── update-device-video-device-id.ts            ✨ New - Action to update videoDeviceId
│   ├── update-device-video-device-id.spec.ts       ✨ New - Action tests
│   └── index.ts                                    📝 Modified - Export new action

libs/features/player/src/lib/player-view/player-device-container/
├── video-capture/
│   ├── video-capture.component.ts                  📝 Modified - Integrate store
│   └── video-capture.component.spec.ts             📝 Modified - Add integration tests
```

---

## 📋 Implementation Guidelines

> **Code Reference Policy**: Show component structure and key patterns. Reference existing selectors/actions as patterns.

> **Testing Policy**: Unit tests for selectors and actions. Behavioral tests for component integration.

---

<details open>
<summary><h3>Task 1: Create videoDeviceId Selector</h3></summary>

**Purpose**: Create a selector to retrieve the stored `videoDeviceId` for a specific TeensyROM device.

**Related Documentation:**

- Pattern: `select-enable-video-for-device.ts`

**Implementation Subtasks:**

- [ ] **Create Selector File**: `select-video-device-for-device.ts`
- [ ] **Export from Index**: Add to `selectors/index.ts`
- [ ] **Write Unit Tests**: Test selector behavior

**Selector Pattern (follow existing):**

```typescript
// select-video-device-for-device.ts
import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting the stored video device ID for a specific device
 * Returns empty string if device is not found or videoDeviceId not set
 */
export function selectVideoDeviceForDevice(store: WritableStore<SettingsState>) {
  return {
    videoDeviceIdForDevice: (deviceId: string) =>
      computed(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return '';
        const device = settings.knownDevices.find((d) => d.deviceId === deviceId);
        return device?.videoSettings?.videoDeviceId ?? '';
      }),
  };
}
```

**Testing Subtask:**

- [ ] **Write Unit Tests**: Returns empty string when device not found
- [ ] **Write Unit Tests**: Returns empty string when videoDeviceId not set
- [ ] **Write Unit Tests**: Returns stored videoDeviceId when set

</details>

---

<details open>
<summary><h3>Task 2: Create updateDeviceVideoDeviceId Action</h3></summary>

**Purpose**: Create an action to update the `videoDeviceId` for a specific TeensyROM device and immediately save to backend.

**Related Documentation:**

- Pattern: `update-settings.ts` for state updates with history

**Implementation Subtasks:**

- [ ] **Create Action File**: `update-device-video-device-id.ts`
- [ ] **Export from Index**: Add to `actions/index.ts`
- [ ] **Implement Save**: Action should update state AND call saveSettings
- [ ] **Write Unit Tests**: Test action behavior

**Action Structure:**

```typescript
// update-device-video-device-id.ts
import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { ISettingsService } from '@teensyrom-nx/domain';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export interface UpdateDeviceVideoDeviceIdParams {
  deviceId: string;      // TeensyROM device ID
  videoDeviceId: string; // Selected video capture device ID
}

export function updateDeviceVideoDeviceId(
  writableStore: WritableStore<SettingsState>,
  settingsService: ISettingsService
) {
  return {
    updateDeviceVideoDeviceId: async (params: UpdateDeviceVideoDeviceIdParams): Promise<void> => {
      const actionMessage = createAction('update-device-video-device-id');

      logInfo(LogType.Start, 'UpdateDeviceVideoDeviceId: Updating video device for TeensyROM', {
        actionMessage,
        params,
      });

      const currentSettings = writableStore.settings();
      if (!currentSettings) {
        logInfo(LogType.Info, 'UpdateDeviceVideoDeviceId: No current settings, cannot update');
        return;
      }

      // Find and update the device's videoDeviceId
      const updatedKnownDevices = currentSettings.knownDevices.map((device) => {
        if (device.deviceId === params.deviceId) {
          return {
            ...device,
            videoSettings: {
              ...device.videoSettings,
              videoDeviceId: params.videoDeviceId,
            },
          };
        }
        return device;
      });

      // Check if device was found
      const deviceFound = updatedKnownDevices.some((d) => d.deviceId === params.deviceId);
      if (!deviceFound) {
        logInfo(LogType.Info, 'UpdateDeviceVideoDeviceId: Device not found in knownDevices', {
          deviceId: params.deviceId,
        });
        return;
      }

      const updatedSettings = {
        ...currentSettings,
        knownDevices: updatedKnownDevices,
      };

      // Update state
      updateState(writableStore, actionMessage, (state) => ({
        ...state,
        settings: updatedSettings,
        lastUpdated: Date.now(),
      }));

      // Persist to backend immediately
      try {
        await settingsService.saveSettings(updatedSettings).toPromise();
        logInfo(LogType.Success, 'UpdateDeviceVideoDeviceId: Settings saved successfully');
      } catch (error) {
        logInfo(LogType.Error, 'UpdateDeviceVideoDeviceId: Failed to save settings', { error });
        // Consider: Should we revert state on save failure?
      }

      logInfo(LogType.Finish, 'UpdateDeviceVideoDeviceId: Video device update completed');
    },
  };
}
```

**Key Implementation Notes:**

- Action is **async** because it saves to backend
- Uses immutable update pattern for `knownDevices` array
- Saves immediately after state update (not debounced)
- Does NOT add to undo history (per-device video device selection is not undo-able)

**Testing Subtask:**

- [ ] **Write Unit Tests**: Updates correct device's videoDeviceId
- [ ] **Write Unit Tests**: Does not modify other devices
- [ ] **Write Unit Tests**: Calls saveSettings with updated settings
- [ ] **Write Unit Tests**: Handles device not found gracefully

</details>

---

<details open>
<summary><h3>Task 3: Update VideoCaptureComponent to Use Store</h3></summary>

**Purpose**: Modify `VideoCaptureComponent` to read initial video device from store and save selection changes.

**Implementation Subtasks:**

- [ ] **Inject Dependencies**: Add SettingsStore injection
- [ ] **Accept deviceId Input**: Component needs TeensyROM device ID (already has `deviceId` input)
- [ ] **Read Initial Selection**: Use `videoDeviceIdForDevice` selector on mount
- [ ] **Save on Selection Change**: Call `updateDeviceVideoDeviceId` when dropdown changes
- [ ] **Remove Hardcoded Selection**: Remove "auto-select second device" logic

**Current Code (to update):**

```typescript
// video-capture.component.ts - Current auto-select logic
// Auto-select second device if available, otherwise first
if (videoInputs.length > 1) {
  this.selectedDeviceId.set(videoInputs[1].deviceId);
  setTimeout(() => this.switchToDevice(videoInputs[1].deviceId), 100);
} else if (videoInputs.length > 0) {
  this.selectedDeviceId.set(videoInputs[0].deviceId);
  setTimeout(() => this.switchToDevice(videoInputs[0].deviceId), 100);
}
```

**Updated Logic:**

```typescript
// video-capture.component.ts

// Inject SettingsStore
private readonly settingsStore = inject(SettingsStore);

// After enumerating devices, apply stored or fallback selection
private selectInitialDevice(videoInputs: VideoDevice[]): void {
  if (videoInputs.length === 0) return;

  const teensyDeviceId = this.deviceId();
  const storedVideoDeviceId = this.settingsStore.videoDeviceIdForDevice(teensyDeviceId)();
  
  // Check if stored device exists in available devices
  const storedDeviceExists = storedVideoDeviceId && 
    videoInputs.some(d => d.deviceId === storedVideoDeviceId);

  let selectedId: string;
  
  if (storedDeviceExists) {
    // Use stored device
    selectedId = storedVideoDeviceId;
    console.log('🎥 Using stored video device:', selectedId);
  } else {
    // Fallback: select first available device
    selectedId = videoInputs[0].deviceId;
    console.log('🎥 No stored device, selecting first:', selectedId);
  }

  this.selectedDeviceId.set(selectedId);
  setTimeout(() => this.switchToDevice(selectedId), 100);
}
```

**Updated onDeviceSelected:**

```typescript
/**
 * Handle device selection from dropdown
 * Saves selection to settings for this TeensyROM device
 */
onDeviceSelected(deviceId: string): void {
  console.log('🎥 User selected device:', deviceId);
  this.selectedDeviceId.set(deviceId);
  this.switchToDevice(deviceId);
  
  // Persist selection for this TeensyROM device
  const teensyDeviceId = this.deviceId();
  if (teensyDeviceId) {
    this.settingsStore.updateDeviceVideoDeviceId({
      deviceId: teensyDeviceId,
      videoDeviceId: deviceId,
    });
  }
}
```

**Key Implementation Notes:**

- `deviceId` input is the TeensyROM device ID (already exists)
- `storedVideoDeviceId` is the video capture device ID from settings
- Fallback to first device (not second) when no stored preference
- Save happens immediately on selection change

**Testing Subtask:**

- [ ] **Write Unit Tests**: Uses stored device when available
- [ ] **Write Unit Tests**: Falls back to first device when no stored preference
- [ ] **Write Unit Tests**: Falls back to first device when stored device unavailable
- [ ] **Write Unit Tests**: Saves selection when user changes dropdown

</details>

---

<details open>
<summary><h3>Task 4: Unit Tests for VideoCaptureComponent Integration</h3></summary>

**Purpose**: Add comprehensive tests for store integration in video capture component.

**Implementation Subtasks:**

- [ ] **Create/Update Spec File**: `video-capture.component.spec.ts`
- [ ] **Mock SettingsStore**: Provide mock store with selector and action
- [ ] **Test Initial Selection**: Verify store value used when available
- [ ] **Test Fallback**: Verify first device selected when no stored value
- [ ] **Test Save on Change**: Verify action called when dropdown changes

**Test Scenarios:**

| Scenario | Store Value | Available Devices | Expected Selection |
|----------|-------------|-------------------|-------------------|
| Stored device exists | "cam-123" | ["cam-123", "cam-456"] | "cam-123" |
| Stored device missing | "cam-xyz" | ["cam-123", "cam-456"] | "cam-123" (first) |
| No stored value | "" | ["cam-123", "cam-456"] | "cam-123" (first) |
| No devices | "cam-123" | [] | None (no selection) |

**Testing Notes:**

- Mock `navigator.mediaDevices` API for device enumeration
- Mock `SettingsStore` with `videoDeviceIdForDevice` selector
- Verify `updateDeviceVideoDeviceId` called with correct params on change

</details>

---

<details open>
<summary><h3>Task 5: Integration Testing</h3></summary>

**Purpose**: Verify end-to-end flow works correctly.

**Implementation Subtasks:**

- [ ] **Manual Test**: Connect device, select video device, refresh page
- [ ] **Manual Test**: Verify selection persists across page refreshes
- [ ] **Manual Test**: Verify fallback works when stored device unavailable

**Integration Test Scenarios:**

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Fresh device | Connect new TeensyROM, open player | First video device auto-selected |
| Saved preference | Select different video device, refresh page | Same video device selected |
| Device unplugged | Unplug saved video device, refresh | First available device selected |
| Multiple TeensyROMs | Switch between connected devices | Each uses its own video device setting |

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/application/src/lib/settings/selectors/select-video-device-for-device.ts`
- `libs/application/src/lib/settings/selectors/select-video-device-for-device.spec.ts`
- `libs/application/src/lib/settings/actions/update-device-video-device-id.ts`
- `libs/application/src/lib/settings/actions/update-device-video-device-id.spec.ts`

**Modified Files:**

- `libs/application/src/lib/settings/selectors/index.ts`
- `libs/application/src/lib/settings/actions/index.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

**Test Categories:**

| Task | Test Type | Key Behaviors |
|------|-----------|---------------|
| Task 1 | Unit | Selector returns correct videoDeviceId |
| Task 2 | Unit | Action updates state and saves |
| Task 3 | Unit | Component uses store for selection |
| Task 4 | Unit | Component integration tests |
| Task 5 | Integration | End-to-end persistence flow |

**Test Execution:**

```bash
pnpm nx test application --testPathPattern="select-video-device-for-device"
pnpm nx test application --testPathPattern="update-device-video-device-id"
pnpm nx test features-player --testPathPattern="video-capture"
pnpm nx lint
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] `videoDeviceIdForDevice` selector returns stored video device ID
- [ ] `updateDeviceVideoDeviceId` action updates and persists setting
- [ ] `VideoCaptureComponent` reads initial selection from store
- [ ] Selection changes are persisted immediately
- [ ] Fallback to first device when no stored preference
- [ ] Fallback to first device when stored device unavailable

**Testing Requirements:**

- [ ] Selector unit tests pass
- [ ] Action unit tests pass
- [ ] Component unit tests pass
- [ ] Integration tests pass

**Quality Checks:**

- [ ] No TypeScript errors
- [ ] Lint passes
- [ ] Hardcoded "second device" logic removed

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Device ID Clarification

This phase deals with TWO different device IDs:

1. **TeensyROM Device ID** (`deviceId` input): The unique identifier for the TeensyROM hardware device
2. **Video Device ID** (`videoDeviceId`): The browser's identifier for video capture devices (webcams, capture cards)

The setting maps: TeensyROM Device → Video Capture Device preference

### Fallback Behavior

**Order of preference:**
1. Stored `videoDeviceId` if it exists in available devices
2. First available video device
3. No selection (no devices available)

### Save Strategy

- **Immediate save** on selection change (no debounce)
- No undo/redo for video device changes (too granular)
- Errors logged but don't block UI

### Browser Considerations

- Video device IDs may change across browser sessions
- Device labels require camera permission first
- Component already handles permission denial gracefully

</details>
