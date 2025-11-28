# Phase 5: Video Device Persistence - Task Handoff

## 🎯 Subagent Task Assignment

I am handing off the following task to a worker subagent:

---

### INPUT_DOC

**Task ID**: TASK-05-VIDEO-DEVICE-PERSISTENCE
**Task Name**: Implement Video Device Persistence for Per-Device Settings
**Assigned To**: UI Wizard (Clean Coder)
**Agent Chatmode**: `.github/chatmodes/Clean Coder.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium (4-8 files)

---

## Objective

**What**: Update `VideoCaptureComponent` to persist the selected video capture device ID per TeensyROM device. Create a new selector to read stored video device ID and an action to save it immediately when the user changes the dropdown selection.

**Why**: Users want their video device preference remembered for each TeensyROM device. Currently, the component auto-selects a device on each mount with hardcoded logic.

**Success Criteria**:
- [ ] `videoDeviceIdForDevice(deviceId)` selector returns stored video device ID
- [ ] `updateDeviceVideoDeviceId` action updates state AND persists immediately
- [ ] `VideoCaptureComponent` reads initial selection from store
- [ ] Selection changes trigger immediate save
- [ ] Fallback to first available device when no stored preference or stored device unavailable
- [ ] Hardcoded "second device" auto-selection logic removed
- [ ] All unit tests pass
- [ ] Lint passes

---

## Context & Dependencies

**Prerequisites Completed**:
- Phase 4: Frontend Components (per-device settings UI completed)
- Domain model includes `videoDeviceId` in `VideoSettings`
- `SettingsStore` has existing per-device selectors (`enableVideoForDevice`, `getDeviceSettings`)

**Dependencies**:
- `@teensyrom-nx/application` - SettingsStore
- `@teensyrom-nx/domain` - Settings, DeviceSettings, VideoSettings models
- Existing selector patterns in `libs/application/src/lib/settings/selectors/`
- Existing action patterns in `libs/application/src/lib/settings/actions/`

**Constraints**:
- Follow existing selector/action patterns exactly
- Action must save immediately (not debounced)
- No undo/redo for video device changes (too granular)
- Fallback to FIRST device (not second) when no preference stored

---

## File Scope

**Files to Create**:
- `libs/application/src/lib/settings/selectors/select-video-device-for-device.ts` - Selector for videoDeviceId
- `libs/application/src/lib/settings/selectors/select-video-device-for-device.spec.ts` - Selector tests
- `libs/application/src/lib/settings/actions/update-device-video-device-id.ts` - Action to update and save
- `libs/application/src/lib/settings/actions/update-device-video-device-id.spec.ts` - Action tests

**Files to Modify**:
- `libs/application/src/lib/settings/selectors/index.ts` - Add new selector export
- `libs/application/src/lib/settings/actions/index.ts` - Add new action export
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts` - Integrate store
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts` - Add integration tests

**Files to Review** (for patterns):
- `libs/application/src/lib/settings/selectors/select-enable-video-for-device.ts` - Selector pattern to follow
- `libs/application/src/lib/settings/actions/update-settings.ts` - Action pattern reference
- `libs/application/src/lib/settings/actions/save-settings.ts` - How to persist settings
- `libs/domain/src/lib/models/settings.model.ts` - Domain model structure

---

## Implementation Guidance

**Standards to Follow**:
- [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [Store Testing](../../../STORE_TESTING.md) - Testing selectors and actions
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript/Angular conventions
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component integration testing

---

### Task 1: Create `videoDeviceIdForDevice` Selector

**Pattern Reference**: `select-enable-video-for-device.ts`

Create selector that:
- Takes `deviceId` (TeensyROM device ID) as parameter
- Searches `settings.knownDevices` array by `deviceId`
- Returns `device.videoSettings.videoDeviceId` if found
- Returns empty string `''` if device not found or settings not loaded
- Uses `computed()` for reactivity

**Tests to Write**:
- Returns empty string when settings is null
- Returns empty string when knownDevices is empty
- Returns empty string when device not found
- Returns empty string when videoDeviceId not set
- Returns stored videoDeviceId when set

---

### Task 2: Create `updateDeviceVideoDeviceId` Action

**Pattern Reference**: `update-settings.ts` and `save-settings.ts`

Create action that:
- Takes params: `{ deviceId: string, videoDeviceId: string }`
- Updates the specific device's `videoSettings.videoDeviceId` in state
- Calls `settingsService.saveSettings()` immediately after state update
- Uses immutable update pattern for `knownDevices` array
- Does NOT add to undo history (this is too granular for undo)
- Logs operations using existing logging utilities

**Tests to Write**:
- Updates correct device's videoDeviceId in state
- Does not modify other devices in knownDevices array
- Calls saveSettings with updated settings
- Handles device not found gracefully (no error, just log)
- Handles null settings gracefully

---

### Task 3: Update `VideoCaptureComponent`

**Current Behavior to Remove** (lines 76-85 in component):
```typescript
// Auto-select second device if available, otherwise first
if (videoInputs.length > 1) {
  this.selectedDeviceId.set(videoInputs[1].deviceId);
  setTimeout(() => this.switchToDevice(videoInputs[1].deviceId), 100);
} else if (videoInputs.length > 0) {
  this.selectedDeviceId.set(videoInputs[0].deviceId);
  setTimeout(() => this.switchToDevice(videoInputs[0].deviceId), 100);
}
```

**New Behavior**:

1. **Inject SettingsStore** (add to component)

2. **Create `selectInitialDevice` method** that:
   - Gets stored videoDeviceId via `settingsStore.videoDeviceIdForDevice(teensyDeviceId)()`
   - Checks if stored device exists in available devices list
   - Uses stored device if available
   - Falls back to FIRST device if stored device not found or empty
   - Logs which selection path was taken

3. **Update `onDeviceSelected` method** to:
   - Call existing logic (set signal, switch device)
   - Also call `settingsStore.updateDeviceVideoDeviceId({ deviceId, videoDeviceId })`

**Key Points**:
- `deviceId` input is the TeensyROM device ID (already exists on component)
- `videoDeviceId` from store is the video capture device ID
- These are two different device IDs - naming is important

---

### Task 4: Component Unit Tests

**Test Scenarios**:

| Scenario | Store `videoDeviceId` | Available Devices | Expected Selection |
|----------|----------------------|-------------------|-------------------|
| Stored device exists | `"cam-123"` | `["cam-123", "cam-456"]` | `"cam-123"` |
| Stored device missing | `"cam-xyz"` | `["cam-123", "cam-456"]` | `"cam-123"` (first) |
| No stored value | `""` | `["cam-123", "cam-456"]` | `"cam-123"` (first) |
| No devices available | `"cam-123"` | `[]` | None (no selection) |

**Additional Tests**:
- `updateDeviceVideoDeviceId` is called when user selects from dropdown
- `updateDeviceVideoDeviceId` receives correct deviceId (TeensyROM) and videoDeviceId (capture device)

**Testing Notes**:
- Mock `navigator.mediaDevices` API for device enumeration
- Mock `SettingsStore` with selector and action
- Use `vi.fn()` to spy on action calls

---

## Anti-Patterns to Avoid

- ❌ Don't debounce the save - save immediately on selection
- ❌ Don't add to undo history - video device selection is too granular
- ❌ Don't fallback to "second device" - always use first as fallback
- ❌ Don't throw errors on device not found - log and continue gracefully
- ❌ Don't confuse TeensyROM device ID with video capture device ID

---

## Testing Requirements

**Test Coverage Required**:

**Unit Tests - Selector**:
- [ ] Returns empty string for null settings
- [ ] Returns empty string for device not found
- [ ] Returns stored videoDeviceId when present

**Unit Tests - Action**:
- [ ] Updates correct device in state
- [ ] Calls saveSettings after state update
- [ ] Handles device not found gracefully

**Unit Tests - Component**:
- [ ] Uses stored device when available in device list
- [ ] Falls back to first device when stored device unavailable
- [ ] Falls back to first device when no stored preference
- [ ] Calls updateDeviceVideoDeviceId on selection change

**Behavioral Expectations**:
- Selection persists across page refreshes
- Each TeensyROM device can have different video device preference
- Unplugging stored video device gracefully falls back to first available

---

## Reference Materials

**Phase Plan**:
- [Phase 5 Plan](../phases/phase-05-video-device-persistence.md) - Detailed task breakdown

**Related Code**:
- `libs/application/src/lib/settings/selectors/select-enable-video-for-device.ts` - Selector pattern
- `libs/application/src/lib/settings/actions/save-settings.ts` - Save pattern
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts` - Component to modify

**Domain Model Reference**:
```typescript
// VideoSettings interface (in settings.model.ts)
interface VideoSettings {
  enableVideo: boolean;
  videoDeviceId: string;  // <-- This is what we're persisting
}

// DeviceSettings interface
interface DeviceSettings {
  deviceId: string;           // TeensyROM device ID
  videoSettings: VideoSettings;
  connectionSettings: ConnectionSettings;
}
```

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/per-device-settings/reports/TASK-05-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/per-device-settings/reports/TASK-05-report.md`

---

## Quick Start Commands

```bash
# Run selector tests
pnpm nx test application --testPathPattern="select-video-device-for-device"

# Run action tests
pnpm nx test application --testPathPattern="update-device-video-device-id"

# Run component tests
pnpm nx test features-player --testPathPattern="video-capture"

# Lint check
pnpm nx lint application
pnpm nx lint features-player
```
