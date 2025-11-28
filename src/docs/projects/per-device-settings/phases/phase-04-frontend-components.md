# Phase 4: Frontend Components

## 🎯 Objective

Update UI components to use per-device settings. Replace global video/connection settings sections with per-device settings. Update `PlayerDeviceContainerComponent` to use per-device video enablement.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - High-level feature plan
- [ ] [Phase 3 Report](../reports/TASK-03-report.md) - Application layer changes (when available)

**Standards & Guidelines:**

- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling conventions
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable component patterns
- [ ] [Form Standards](../../../FORM_STANDARDS.md) - Reactive form patterns

---

## 📂 File Structure Overview

```
libs/features/settings/src/lib/
├── settings-view/
│   └── settings-view.component.ts/html       📝 Modified - Update tabs/content
├── components/
│   ├── device-settings-section/              ✨ New - Per-device settings
│   │   ├── device-settings-section.component.ts
│   │   ├── device-settings-section.component.html
│   │   └── device-settings-section.component.scss
│   ├── video-settings-section/               🗑️ Delete - Replaced by device section
│   └── connection-settings-section/          🗑️ Delete - Replaced by device section
├── services/
│   └── settings-form.service.ts              📝 Modified - knownDevices FormArray

libs/features/player/src/lib/
├── player-device-container/
│   └── player-device-container.component.ts  📝 Modified - Per-device enableVideo
```

---

## 📋 Implementation Guidelines

> **Code Reference Policy**: Show component structure and key bindings. Reference patterns from existing components.

> **Testing Policy**: Smart component testing with behavioral focus.

---

<details open>
<summary><h3>Task 1: Update PlayerDeviceContainerComponent for Per-Device Video</h3></summary>

**Purpose**: Update the player device container to check video enablement for the specific connected device, not globally.

**Related Documentation:**

- [Phase 3 - enableVideoForDevice selector](./phase-03-frontend-application.md)

**Implementation Subtasks:**

- [ ] **Inject DeviceStore**: Get current device ID from DeviceStore
- [ ] **Use Per-Device Selector**: Replace `settingsStore.enableVideo()` with `settingsStore.enableVideoForDevice(deviceId)`
- [ ] **Handle Device ID Changes**: Reactively update when connected device changes

**Current Code (to replace):**

```typescript
// player-device-container.component.ts
readonly enableVideo = this.settingsStore.enableVideo();
```

**Updated Code:**

```typescript
// player-device-container.component.ts
// Inject DeviceStore to get current device ID
readonly deviceId = this.deviceStore.connectedDeviceId();

// Create computed signal that reacts to device ID changes
readonly enableVideo = computed(() => {
  const id = this.deviceId();
  if (!id) return false;
  return this.settingsStore.enableVideoForDevice(id)();
});
```

**Key Implementation Notes:**

- Need to import `DeviceStore` if not already injected
- `enableVideo` becomes a computed signal that depends on current device
- When device changes, video enablement updates automatically

**Testing Subtask:**

- [ ] **Write Unit Tests**: enableVideo returns false when no device connected
- [ ] **Write Unit Tests**: enableVideo returns device's setting when connected

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] No device connected → enableVideo = false
- [ ] Device connected with enableVideo=true → returns true
- [ ] Device connected with enableVideo=false → returns false
- [ ] Device change → enableVideo updates reactively

</details>

---

<details open>
<summary><h3>Task 2: Create DeviceSettingsSectionComponent</h3></summary>

**Purpose**: Create a new component that displays settings for a single device, including video and connection settings.

**Implementation Subtasks:**

- [ ] **Create Component Files**: Use Angular generator or manual creation
- [ ] **Define Inputs**: Accept device FormGroup from parent
- [ ] **Create Template**: Layout with video enable toggle and auto-connect toggle
- [ ] **Add Styling**: Follow existing section component patterns

**Component Structure:**

```typescript
// device-settings-section.component.ts
@Component({
  selector: 'lib-device-settings-section',
  standalone: true,
  imports: [ReactiveFormsModule, MatSlideToggleModule, MatCardModule, MatExpansionModule],
  templateUrl: './device-settings-section.component.html',
  styleUrl: './device-settings-section.component.scss',
})
export class DeviceSettingsSectionComponent {
  // Device FormGroup from parent
  deviceForm = input.required<FormGroup>();
  
  // Device ID for display (readonly)
  deviceId = computed(() => this.deviceForm().get('deviceId')?.value ?? '');
  
  // Convenience accessors
  videoSettingsForm = computed(() => this.deviceForm().get('videoSettings') as FormGroup);
  connectionSettingsForm = computed(() => this.deviceForm().get('connectionSettings') as FormGroup);
}
```

**Template Structure:**

```html
<!-- device-settings-section.component.html -->
<mat-expansion-panel>
  <mat-expansion-panel-header>
    <mat-panel-title>
      Device: {{ deviceId() | slice:0:8 }}...
    </mat-panel-title>
  </mat-expansion-panel-header>
  
  <div class="device-settings-content">
    <!-- Video Settings -->
    <div class="setting-row">
      <span class="setting-label">Enable Video</span>
      <mat-slide-toggle [formControl]="videoSettingsForm().get('enableVideo')">
      </mat-slide-toggle>
    </div>
    
    <!-- Connection Settings -->
    <div class="setting-row">
      <span class="setting-label">Auto-Connect</span>
      <mat-slide-toggle [formControl]="connectionSettingsForm().get('autoConnectEnabled')">
      </mat-slide-toggle>
    </div>
  </div>
</mat-expansion-panel>
```

**Key Implementation Notes:**

- Uses expansion panel for collapsible device sections
- Device ID truncated for display (first 8 chars + ellipsis)
- FormGroup passed from parent enables reactive form handling

**Testing Subtask:**

- [ ] **Write Unit Tests**: Component renders with device form
- [ ] **Write Unit Tests**: Toggle changes propagate to form

</details>

---

<details open>
<summary><h3>Task 3: Update SettingsFormService for knownDevices</h3></summary>

**Purpose**: Update the form service to handle the new `knownDevices` array structure instead of global video/connection settings.

**Implementation Subtasks:**

- [ ] **Remove Global Form Groups**: Remove `videoSettings` and `connectionSettings` from root form
- [ ] **Add knownDevices FormArray**: Create FormArray for device settings
- [ ] **Create Device FormGroup Factory**: Method to create FormGroup for a device
- [ ] **Update createSettingsForm**: Initialize with knownDevices from settings

**Updated Form Structure:**

```typescript
// settings-form.service.ts

// Factory method for device FormGroup
private createDeviceFormGroup(device: DeviceSettings): FormGroup {
  return this.fb.group({
    deviceId: [device.deviceId],
    videoSettings: this.fb.group({
      enableVideo: [device.videoSettings.enableVideo],
    }),
    connectionSettings: this.fb.group({
      autoConnectEnabled: [device.connectionSettings.autoConnectEnabled],
    }),
  });
}

// Updated createSettingsForm
createSettingsForm(settings: Settings): FormGroup {
  const deviceFormGroups = settings.knownDevices.map(d => this.createDeviceFormGroup(d));
  
  return this.fb.group({
    // ... other settings (playerSettings, searchSettings, etc.)
    knownDevices: this.fb.array(deviceFormGroups),
  });
}
```

**Key Implementation Notes:**

- `knownDevices` is a FormArray of FormGroups
- Each FormGroup has `deviceId`, `videoSettings`, `connectionSettings`
- Form structure mirrors backend model for easy serialization

**Testing Subtask:**

- [ ] **Write Unit Tests**: Form creates correct structure from settings
- [ ] **Write Unit Tests**: knownDevices FormArray has correct length
- [ ] **Write Unit Tests**: Device values correctly bound

</details>

---

<details open>
<summary><h3>Task 4: Update SettingsViewComponent</h3></summary>

**Purpose**: Update the settings view to display per-device settings instead of global video/connection sections.

**Implementation Subtasks:**

- [ ] **Remove Old Sections**: Remove video-settings-section and connection-settings-section
- [ ] **Add Device List**: Loop through knownDevices and render device-settings-section
- [ ] **Update Navigation/Tabs**: Adjust tabs if needed for new structure

**Updated Template:**

```html
<!-- settings-view.component.html (relevant section) -->

<!-- Per-Device Settings -->
<section class="settings-section">
  <h2>Device Settings</h2>
  <p class="section-description">
    Configure settings for each known TeensyROM device
  </p>
  
  @if (knownDevicesArray().length === 0) {
    <p class="no-devices">No devices have been connected yet.</p>
  } @else {
    @for (deviceGroup of knownDevicesArray().controls; track deviceGroup.get('deviceId')?.value) {
      <lib-device-settings-section [deviceForm]="deviceGroup" />
    }
  }
</section>
```

**Component Updates:**

```typescript
// settings-view.component.ts

// Helper to access FormArray
knownDevicesArray = computed(() => {
  const form = this.formService.form();
  return form?.get('knownDevices') as FormArray ?? new FormArray([]);
});
```

**Key Implementation Notes:**

- Shows message when no devices exist
- Uses @for with track by deviceId for efficient updates
- Each device-settings-section gets its own FormGroup

**Testing Subtask:**

- [ ] **Write Unit Tests**: Shows "no devices" message when empty
- [ ] **Write Unit Tests**: Renders correct number of device sections
- [ ] **Write Unit Tests**: Passes FormGroup to each device section

</details>

---

<details open>
<summary><h3>Task 5: Delete Deprecated Components</h3></summary>

**Purpose**: Remove the old global video-settings-section and connection-settings-section components.

**Implementation Subtasks:**

- [ ] **Delete video-settings-section folder**: Remove entire folder
- [ ] **Delete connection-settings-section folder**: Remove entire folder
- [ ] **Update Barrel Exports**: Remove from feature's index.ts if exported

**Files to Delete:**

- `libs/features/settings/src/lib/components/video-settings-section/`
- `libs/features/settings/src/lib/components/connection-settings-section/`

**Key Implementation Notes:**

- Ensure no other components reference these before deleting
- If exported publicly, update lib barrel exports

**Testing Subtask:**

- [ ] **Compile Check**: Feature library compiles without deleted components

</details>

---

<details open>
<summary><h3>Task 6: Integration Testing</h3></summary>

**Purpose**: Verify the complete settings flow works end-to-end.

**Implementation Subtasks:**

- [ ] **Manual Integration Test**: Verify settings view renders known devices
- [ ] **Manual Integration Test**: Verify toggle changes persist
- [ ] **Manual Integration Test**: Verify player uses correct per-device video setting

**Integration Test Scenarios:**

| Scenario | Expected Behavior |
|----------|-------------------|
| No devices connected | Settings view shows "No devices" message |
| One device connected | Settings view shows one device section |
| Enable video for device | Player shows video for that device |
| Disable video for device | Player hides video for that device |
| Toggle auto-connect | Setting persists through save |

**Testing Subtask:**

- [ ] **Manual Testing**: Complete flow works as expected
- [ ] **E2E Test**: Consider adding Cypress test for settings flow

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/features/settings/src/lib/components/device-settings-section/device-settings-section.component.ts`
- `libs/features/settings/src/lib/components/device-settings-section/device-settings-section.component.html`
- `libs/features/settings/src/lib/components/device-settings-section/device-settings-section.component.scss`

**Modified Files:**

- `libs/features/settings/src/lib/services/settings-form.service.ts`
- `libs/features/settings/src/lib/settings-view/settings-view.component.ts`
- `libs/features/settings/src/lib/settings-view/settings-view.component.html`
- `libs/features/player/src/lib/player-device-container/player-device-container.component.ts`

**Removed Files:**

- `libs/features/settings/src/lib/components/video-settings-section/` (entire folder)
- `libs/features/settings/src/lib/components/connection-settings-section/` (entire folder)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

**Test Categories:**

| Task | Test Type | Key Behaviors |
|------|-----------|---------------|
| Task 1 | Unit | PlayerDeviceContainer uses per-device video |
| Task 2 | Unit | DeviceSettingsSection renders form |
| Task 3 | Unit | SettingsFormService creates correct structure |
| Task 4 | Unit | SettingsView renders device list |
| Task 5 | Compile | No references to deleted components |
| Task 6 | Integration | End-to-end flow works |

**Test Execution:**

```bash
pnpm nx test features-settings
pnpm nx test features-player
pnpm nx lint
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] `PlayerDeviceContainerComponent` uses per-device video enablement
- [ ] `DeviceSettingsSectionComponent` displays device settings
- [ ] `SettingsFormService` creates knownDevices FormArray
- [ ] Settings view shows all known devices with their settings
- [ ] Global video/connection sections removed

**Testing Requirements:**

- [ ] All component unit tests pass
- [ ] Feature libraries compile
- [ ] Lint passes

**Quality Checks:**

- [ ] No TypeScript errors
- [ ] Components follow existing patterns
- [ ] Styling consistent with other settings sections

**Ready for Deployment:**

- [ ] All phases complete
- [ ] Manual integration testing passed
- [ ] Feature works end-to-end

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### UI/UX Notes

- Device IDs are GUIDs - truncate for display (first 8 chars)
- Expansion panels allow collapsing devices for cleaner view
- "No devices" message provides clear feedback when empty

### Migration Notes

- Users must delete old Settings.json (no automatic migration)
- On first run with new code, knownDevices will be empty
- Devices are added to knownDevices during discovery/connection

### Future Enhancements

- Add device display names (deferred per user request)
- Add device removal UI (deferred per user request)
- Consider device reordering in settings list

</details>
