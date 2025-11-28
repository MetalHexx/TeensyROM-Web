# Task Handoff: Phase 4 - Frontend Feature Layer (Components)

## 📋 Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | `PHASE-04` |
| **Feature** | Per-Device Settings |
| **Phase** | 4 of 4 - Frontend Feature Layer |
| **Estimated Scope** | Medium (8-12 files) |
| **Dependencies** | Phase 1 ✅, Phase 2 ✅, Phase 3 ✅ |
| **Assigned To** | UI Wizard |

---

## 🎯 Objective

Update UI components to use per-device settings:
1. Fix `PlayerDeviceContainerComponent` (16 failing tests) to use per-device selector
2. Add "Devices" navigation button to settings view (replaces Video + Connection)
3. Create `DevicesSettingsSectionComponent` following existing section patterns
4. Display each device in its own `lib-scaling-card` with even spacing
5. Update `SettingsFormService` for `knownDevices` FormArray
6. Delete deprecated `video-settings-section` and `connection-settings-section`

**After this phase**: Feature complete. Video visibility controlled per-device, settings UI shows device cards.

---

## 📚 Required Reading

1. **[Phase 3 Report](./reports/PHASE-03-report.md)** - Selector API reference (`enableVideoForDevice`, `allKnownDevices`)
2. **[Smart Component Testing](../../SMART_COMPONENT_TESTING.md)** - Component testing patterns
3. **[Form Standards](../../FORM_STANDARDS.md)** - Reactive form patterns

---

## 🏗️ Existing Patterns to Follow

### Navigation Card Pattern

**Current** (settings-view.component.html):
```html
<lib-scaling-compact-card class="navigation-card">
  <div class="navigation-buttons">
    <lib-action-button icon="play_circle" label="Player" ... />
    <lib-action-button icon="videocam" label="Video" ... />     <!-- REMOVE -->
    <lib-action-button icon="folder" label="File Transfer" ... />
    <lib-action-button icon="search" label="Search" ... />
    <lib-action-button icon="settings_ethernet" label="Connection" ... />  <!-- REMOVE -->
  </div>
</lib-scaling-compact-card>
```

**Required**: Replace "Video" and "Connection" buttons with single "Devices" button (`icon="devices"`, `label="Devices"`).

### Section Component Pattern

**Reference**: `player-settings-section.component.ts`

Every settings section follows this pattern:
- **Inputs**: `formGroup = input.required<FormGroup>()`, `animationTrigger = input<boolean>(true)`
- **Template**: Wraps content in `<lib-scaling-card title="..." [animationTrigger]="animationTrigger()">`
- **Content**: Form controls inside the scaling-card

### Scaling Card Component

**Key Inputs** (`ScalingCardComponent`):
- `title: string` - Header text
- `animationTrigger: boolean` - Controls visibility animation
- Content projected inside card layout

---

## 🔥 Task 1: Fix PlayerDeviceContainerComponent ⚡ (Unblocks 16 Tests)

**File**: `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts`

**Problem**: Component uses `settingsStore.enableVideo()` which no longer exists (removed in Phase 3).

**Current (broken)**:
```typescript
readonly enableVideo = computed(() => this.settingsStore.enableVideo());
```

**Required Fix**:
- Component already has `deviceId` computed property
- Use `settingsStore.enableVideoForDevice(deviceId)()` 
- Return `false` when `deviceId` is empty

**Spec File Updates** (`player-device-container.component.spec.ts`):
- Mock `enableVideoForDevice` as function returning a signal
- Pattern: `enableVideoForDevice: () => () => signal(true)`

---

## 🔨 Task 2: Update Settings Navigation

**Files**: 
- `settings-view.component.ts`
- `settings-view.component.html`

### 2a. Update `activeSection` Type

**Change `activeSection` signal type**:
- Remove: `'video' | 'connection'`
- Add: `'devices'`
- Result: `'player' | 'devices' | 'fileTransfer' | 'search'`

### 2b. Update Navigation Buttons

**Remove** from template:
- Video button (`icon="videocam"`, `label="Video"`)
- Connection button (`icon="settings_ethernet"`, `label="Connection"`)

**Add** to template (after Player button):
```html
<lib-action-button
  icon="devices"
  label="Devices"
  [variant]="activeSection() === 'devices' ? 'raised' : 'stroked'"
  [color]="activeSection() === 'devices' ? 'primary' : 'normal'"
  (buttonClick)="setActiveSection('devices')" />
```

### 2c. Update Imports

- Remove: `VideoSettingsSectionComponent`, `ConnectionSettingsSectionComponent`
- Add: `DevicesSettingsSectionComponent` (after Task 3)

### 2d. Update Template Sections

Replace video/connection section usage with devices section:
```html
<lib-devices-settings-section
  [knownDevicesArray]="getKnownDevices()"
  [animationTrigger]="activeSection() === 'devices'" />
```

---

## 🔨 Task 3: Create DevicesSettingsSectionComponent

**Location**: `libs/features/settings/src/lib/settings-view/devices-settings-section/`

This is the **outer section component** (like `player-settings-section`). It receives the FormArray and renders a `lib-scaling-card` for each device.

### Component Contract

**Inputs**:
- `knownDevicesArray = input.required<FormArray>()` - The `knownDevices` FormArray
- `animationTrigger = input<boolean>(true)` - Controls visibility

### Template Structure

```html
<lib-scaling-card title="Device Settings" [animationTrigger]="animationTrigger()">
  @if (knownDevicesArray().length === 0) {
    <div class="empty-state">
      <mat-icon>devices</mat-icon>
      <p>No devices have been connected yet.</p>
      <p class="hint">Connect a TeensyROM device to configure its settings.</p>
    </div>
  } @else {
    <div class="devices-grid">
      @for (deviceGroup of knownDevicesArray().controls; track deviceGroup.get('deviceId')?.value; let i = $index) {
        <lib-scaling-card [title]="getDeviceTitle(deviceGroup)" cardClass="device-card">
          <!-- Device settings content: video toggle, auto-connect toggle -->
        </lib-scaling-card>
      }
    </div>
  }
</lib-scaling-card>
```

### Styling Requirements

**Even spacing for device cards** (devices-settings-section.component.scss):
```scss
.devices-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  text-align: center;
  opacity: 0.7;
  
  mat-icon {
    font-size: 3rem;
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
  }
  
  .hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }
}
```

### Device Card Content

Each device card shows:
1. **Device ID** (truncated in title): First 8 chars + "..."
2. **Enable Video toggle**: Bound to `deviceGroup.get('videoSettings.enableVideo')`
3. **Auto-Connect toggle**: Bound to `deviceGroup.get('connectionSettings.autoConnectEnabled')`

Use existing toggle pattern from `video-settings-section.component.html` and `connection-settings-section.component.html`.

---

## 🔨 Task 4: Update SettingsFormService

**File**: `libs/features/settings/src/lib/settings-view/settings-form.service.ts`

### 4a. Update `buildForm()` Method

**Remove**:
- `connectionSettings: FormGroup` (global)
- `videoSettings: FormGroup` (global)

**Add**:
- `knownDevices: FormArray`

### 4b. Add Device FormGroup Factory

```typescript
private createDeviceFormGroup(device: DeviceSettings): FormGroup {
  return this.fb.group({
    deviceId: [device.deviceId, Validators.required],
    videoSettings: this.fb.group({
      enableVideo: [device.videoSettings.enableVideo],
      videoDeviceId: [device.videoSettings.videoDeviceId],
    }),
    connectionSettings: this.fb.group({
      connectionType: [device.connectionSettings.connectionType, Validators.required],
      autoConnectEnabled: [device.connectionSettings.autoConnectEnabled],
    }),
  });
}
```

### 4c. Build KnownDevices FormArray

In `buildForm()`:
```typescript
knownDevices: this.fb.array(
  settings.knownDevices.map(device => this.createDeviceFormGroup(device))
),
```

### 4d. Add Helper Method

```typescript
getKnownDevices(): FormArray {
  const form = this.settingsForm();
  if (!form) throw new Error('Settings form not initialized');
  return form.get('knownDevices') as FormArray;
}
```

### 4e. Update Transformations

Update `settingsToFormValue()` and `formValueToSettings()` to handle `knownDevices` array instead of global settings.

**Remove from both methods**:
- `connectionSettings` handling
- `videoSettings` handling

**Add to both methods**:
- `knownDevices` array mapping

---

## 🔨 Task 5: Update SettingsViewComponent

### 5a. Add Helper Method

```typescript
getKnownDevices(): FormArray {
  return this.formService.getKnownDevices();
}
```

### 5b. Remove Deprecated Methods

Remove these methods (no longer needed):
- `getConnectionSettings()`
- `getVideoSettings()`

### 5c. Remove Deprecated Imports

Remove from imports array:
- `VideoSettingsSectionComponent`
- `ConnectionSettingsSectionComponent`

---

## 🔨 Task 6: Delete Deprecated Components

**Delete these folders entirely**:
- `libs/features/settings/src/lib/settings-view/video-settings-section/`
- `libs/features/settings/src/lib/settings-view/connection-settings-section/`

**Verification**: Run `pnpm nx lint features-settings` to confirm no dangling imports.

---

## 📂 Files Summary

### New Files (4)
- `devices-settings-section.component.ts`
- `devices-settings-section.component.html`
- `devices-settings-section.component.scss`
- `devices-settings-section.component.spec.ts`

### Modified Files (5)
- `player-device-container.component.ts` - Use per-device selector
- `player-device-container.component.spec.ts` - Update mocks
- `settings-form.service.ts` - Add knownDevices FormArray
- `settings-view.component.ts` - Add devices section, remove deprecated
- `settings-view.component.html` - Update navigation and sections

### Deleted Files (8)
- `video-settings-section/video-settings-section.component.ts`
- `video-settings-section/video-settings-section.component.html`
- `video-settings-section/video-settings-section.component.scss`
- `video-settings-section/video-settings-section.component.spec.ts`
- `connection-settings-section/connection-settings-section.component.ts`
- `connection-settings-section/connection-settings-section.component.html`
- `connection-settings-section/connection-settings-section.component.scss`
- `connection-settings-section/connection-settings-section.component.spec.ts`

---

## 🧪 Testing Requirements

### Unit Tests

**PlayerDeviceContainerComponent**:
- Video visibility uses per-device selector
- Returns false when no deviceId

**DevicesSettingsSectionComponent**:
- Renders empty state when no devices
- Renders device cards when devices exist
- Each device shows video toggle and auto-connect toggle
- Changes propagate to form

**SettingsFormService**:
- Creates `knownDevices` FormArray correctly
- Maps devices from Settings model
- Transforms form values back to Settings model

### Test Commands

```bash
pnpm nx test player --watch=false        # Verify 16 failures resolved
pnpm nx test features-settings --watch=false
pnpm nx lint player
pnpm nx lint features-settings
```

---

## ✅ Success Criteria

- [ ] Player tests pass (all 16 failures resolved)
- [ ] Settings feature tests pass
- [ ] Both libraries lint clean
- [ ] Navigation shows "Devices" button (not "Video" or "Connection")
- [ ] Devices section shows all known devices
- [ ] Each device in its own `lib-scaling-card`
- [ ] Devices share space evenly (CSS grid)
- [ ] Empty state shows when no devices connected
- [ ] Toggle changes persist (auto-save)
- [ ] Deprecated components deleted
- [ ] Feature complete

---

## ⚠️ Important Notes

### Selector Invocation Pattern

Per-device selectors return a **function** that returns a **signal**:

```typescript
// Correct: call function, then invoke signal
const enabled = this.settingsStore.enableVideoForDevice(deviceId)();

// Pattern breakdown:
// enableVideoForDevice(deviceId) → returns () => Signal<boolean>
// ...() → invokes signal, returns boolean
```

### Default Values

| Selector | Default | Reason |
|----------|---------|--------|
| `enableVideoForDevice` | `false` | Safe - don't show video unexpectedly |
| `autoConnectForDevice` | `true` | Matches backend default |

### Device ID Display

Truncate long device IDs for readability:
```typescript
getDeviceTitle(deviceGroup: AbstractControl): string {
  const deviceId = deviceGroup.get('deviceId')?.value ?? 'Unknown';
  return deviceId.length > 8 ? `${deviceId.slice(0, 8)}...` : deviceId;
}
```

---

## 📤 Output

Create completion report at: `docs/projects/per-device-settings/reports/PHASE-04-report.md`

Include:
- Tasks completed
- Test results (before/after)
- Files created/modified/deleted
- Any discoveries or blockers

---

## 🔗 Related Documentation

- [Phase 3 Report](./reports/PHASE-03-report.md) - Selector API
- [Master Plan](./master-plan.md)
- [Form Standards](../../FORM_STANDARDS.md)
