# Phase 6 Task Handoff: Refactor VideoCaptureComponent

## 📋 Task Identity

**Task ID**: `TASK-06-001-VIDEO-CAPTURE-REFACTOR`  
**Task Name**: Refactor VideoCaptureComponent to Compose New UI Components with CRT Effects  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4-6 files)

---

## 🎯 Objective

**What**: Refactor `VideoCaptureComponent` to compose the new UI components (`lib-video-stream`, `lib-content-overlay-container`, `lib-crt-effect-wrapper`, `lib-crt-settings-panel`) for the embedded video preview with **CRT effects support**.

**Why**: Validates component reusability in a simpler context (embedded preview with limited CRT options) and provides consistent CRT experience across both preview and dialog views.

**Success Criteria**:
- [ ] Component uses `lib-video-stream` for video display
- [ ] Component uses `lib-content-overlay-container` with slot architecture
- [ ] Component uses `lib-crt-effect-wrapper` with `scanlines` config (vignette + scanlines, no curvature)
- [ ] Right controls toolbar includes: CRT toggle, CRT settings toggle, maximize button
- [ ] CRT settings panel shows only scanlines, vignette, and color filter controls
- [ ] Device enumeration and selection continues to work
- [ ] Stream attachment is delegated to `lib-video-stream`
- [ ] Template reduced to composed component structure
- [ ] SCSS reduced by removing delegated styles
- [ ] All tests pass with component updates

---

## 📚 Context & Dependencies

### Prerequisites Completed
- **Phase 1**: `lib-video-stream` component created
- **Phase 2**: `lib-crt-effect-wrapper` component created
- **Phase 3**: `lib-content-overlay-container` with 9-slot layout created
- **Phase 4**: `lib-crt-settings-panel` component created
- **Phase 5**: `VideoDialogComponent` successfully refactored using all new components

### Dependencies
- `@teensyrom-nx/ui/components` - All new UI components
- `@teensyrom-nx/application` - SettingsStore (persist device/CRT preferences)
- Angular Material - Dialog, Select, Form Field
- Browser MediaDevices API - Video capture enumeration

### Constraints
- **Must maintain device enumeration logic** - Smart component responsibility
- **Must maintain settings persistence** - Store integration for device + CRT preferences
- **CRT effects limited to scanlines config** - No screen curvature (different from dialog view)
- **Must maintain existing responsive behavior** - Width/height constraints at different breakpoints

---

## 🗂️ File Scope

### Files to Modify

**Component Files**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
  - Add CRT state management (enabled signal, settings signal, showControls signal)
  - Add imports for new components
  - Remove `afterNextRender` stream attachment (delegated to `lib-video-stream`)
  - Keep device enumeration and selection logic
  - Add CRT toggle/settings handlers

- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.html`
  - Replace entire template with `lib-content-overlay-container` structure
  - Use slots: content (video with CRT wrapper), topOverlay (device selector), rightControls (CRT + maximize buttons)
  - Follow VideoDialogComponent slot pattern

- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.scss`
  - Remove video element styles (delegated to `lib-video-stream`)
  - Remove overlay positioning (delegated to `lib-content-overlay-container`)
  - Add right controls wrapper positioning (similar to VideoDialogComponent pattern)
  - Keep component-specific sizing and responsive styles

**Test File**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`
  - Update tests for new component structure
  - Add tests for CRT toggle, settings panel visibility
  - Verify composed components render correctly

### Files to Review (Context Only)

**Completed Phase Reports** (for reference, not immediate context):
- `docs/projects/video-component-extraction/reports/phase-05-report.md` - VideoDialogComponent refactor patterns and lessons learned
- `docs/projects/video-component-extraction/reports/phase-04-report.md` - CRT settings panel API
- `docs/projects/video-component-extraction/reports/phase-03-report.md` - Overlay container slot architecture
- `docs/projects/video-component-extraction/reports/phase-02-report.md` - CRT wrapper configuration patterns

**Reference Implementations**:
- `libs/features/player/.../video-dialog/video-dialog.component.ts` - Reference for CRT state management pattern
- `libs/features/player/.../video-dialog/video-dialog.component.html` - Reference for slot architecture usage
- `libs/features/player/.../video-dialog/video-dialog.component.scss` - Reference for right controls positioning

**Component Libraries**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - CRT_CONFIGS and CRT_PRESETS
- `libs/ui/components/src/index.ts` - Exports from ui/components library

---

## 🏗️ Implementation Guidance

### Standards to Follow
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - Angular 19 patterns, signals, standalone components
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Behavioral testing approach
- [Component Library](../../../docs/COMPONENT_LIBRARY.md) - UI component usage patterns
- [Style Guide](../../../docs/STYLE_GUIDE.md) - Global styles and utility classes

### Key Requirements

#### 1. Template Structure (Target Architecture)

Replace current template with composed components:

```html
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <!-- Content slot: CRT wrapper around video stream -->
  <lib-crt-effect-wrapper content
    [settings]="crtSettings()"
    [config]="crtConfig"
    [enabled]="isCrtEnabled()">
    <lib-video-stream 
      [stream]="currentStream()" 
      [objectFit]="'contain'">
    </lib-video-stream>
  </lib-crt-effect-wrapper>

  <!-- Top overlay: Device selector -->
  <div topOverlay class="device-selector">
    <mat-form-field appearance="outline">
      <mat-label>Video Device</mat-label>
      <mat-select 
        [value]="selectedDevice()"
        (selectionChange)="onDeviceSelected($event.value)">
        @for (device of devices(); track device.deviceId) {
          <mat-option [value]="device.deviceId">
            {{ device.label }}
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  </div>

  <!-- Right controls: CRT toggle, settings toggle, maximize -->
  <div rightControls class="right-controls-wrapper">
    <lib-compact-card-layout cardClass="glassy-card">
      <!-- CRT toggle button -->
      <lib-icon-button
        [icon]="isCrtEnabled() ? 'tv' : 'tv_off'"
        ariaLabel="Toggle CRT effect"
        (buttonClick)="toggleCrtEffect()">
      </lib-icon-button>

      <!-- CRT settings toggle (only when CRT enabled) -->
      @if (isCrtEnabled()) {
        <lib-icon-button
          icon="tune"
          ariaLabel="CRT settings"
          (buttonClick)="toggleCrtControls()">
        </lib-icon-button>
      }

      <!-- Maximize button -->
      <lib-icon-button
        icon="fullscreen"
        ariaLabel="Open in dialog"
        (buttonClick)="openVideoDialog()">
      </lib-icon-button>
    </lib-compact-card-layout>

    <!-- CRT settings panel (conditionally shown) -->
    @if (isCrtEnabled() && showCrtControls()) {
      <lib-crt-settings-panel
        [settings]="crtSettings()"
        [config]="crtConfig"
        (settingsChange)="onCrtSettingsChange($event)"
        (resetRequested)="onCrtReset()"
        (presetSelected)="onCrtPresetSelected($event)">
      </lib-crt-settings-panel>
    }
  </div>
</lib-content-overlay-container>
```

#### 2. TypeScript Changes

**Add CRT State Management**:
```typescript
// CRT configuration - scanlines + vignette (no curvature)
readonly crtConfig = CRT_CONFIGS.scanlines;

// CRT state signals
private isCrtEnabled = signal<boolean>(true);
private crtSettings = signal<CrtSettings>(CRT_PRESETS.scanlines);
private showCrtControls = signal<boolean>(false);
```

**Add CRT Event Handlers**:
- `toggleCrtEffect()` - Toggle CRT enabled state, persist to settings
- `toggleCrtControls()` - Toggle settings panel visibility
- `onCrtSettingsChange(settings: CrtSettings)` - Update settings signal
- `onCrtReset()` - Reset to default preset (`CRT_PRESETS.scanlines`)
- `onCrtPresetSelected(preset: string)` - Apply preset from settings panel

**Keep Existing Logic**:
- Device enumeration (`enumerateVideoDevices()`)
- Device selection (`onDeviceSelected()`, `switchToDevice()`)
- Dialog opening (`openVideoDialog()`)
- Settings store integration (device preferences + CRT preferences)

**Remove**:
- `afterNextRender` hook for stream attachment (delegated to `lib-video-stream`)
- Manual video element `srcObject` assignment (delegated)
- `viewChild` for video element (no longer needed)

#### 3. SCSS Changes

**Remove Delegated Styles**:
```scss
// ❌ Remove - now in lib-video-stream
.video-stream {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: #000;
}

// ❌ Remove - now in lib-content-overlay-container
.device-selector {
  position: absolute;
  top: 8px;
  left: 8px;
  // ... overlay positioning
}

.maximize-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  // ... overlay positioning
}
```

**Keep/Add Styles**:
```scss
// ✅ Keep - component sizing
:host {
  display: block;
  width: 520px;
  height: 390px;
  flex-shrink: 0;
}

// ✅ Add - right controls wrapper (similar to VideoDialogComponent)
.right-controls-wrapper {
  position: relative; // Or absolute if needed
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// ✅ Keep - responsive behavior
@media (max-width: 500px) {
  :host {
    width: 100%;
    flex-shrink: 1;
  }
}
```

#### 4. Import Updates

**Add Imports**:
```typescript
import {
  VideoStreamComponent,
  ContentOverlayContainerComponent,
  CrtEffectWrapperComponent,
  CrtSettingsPanelComponent,
  CompactCardLayoutComponent,
  IconButtonComponent,
  CRT_CONFIGS,
  CRT_PRESETS,
  CrtSettings,
} from '@teensyrom-nx/ui/components';
```

**Remove Imports**:
```typescript
// ❌ Remove if no longer needed
import { ScalingCompactCardComponent } from '@teensyrom-nx/ui/components';
```

#### 5. Settings Store Integration

**Persist CRT Preferences**:
- Use `SettingsStore.updateDeviceCrtEnabled()` when toggling CRT
- Use `SettingsStore.updateDeviceCrtSettings()` when changing CRT settings
- Load initial CRT state from `SettingsStore.crtEnabledForDevice(deviceId)()`
- Load initial CRT settings from `SettingsStore.crtSettingsForDevice(deviceId)()`

**Pattern**:
```typescript
toggleCrtEffect(): void {
  const newState = !this.isCrtEnabled();
  this.isCrtEnabled.set(newState);
  
  // Persist to settings store
  this.settingsStore.updateDeviceCrtEnabled({
    deviceId: this.deviceId(),
    enabled: newState,
  });
}
```

### Anti-Patterns to Avoid

**❌ Don't**:
- Use `CRT_CONFIGS.full` (includes curvature which we don't want in embedded preview)
- Implement video element lifecycle management (delegated to `lib-video-stream`)
- Add backdrop-filter to empty overlay slots (Phase 5 lesson)
- Use `calc()` with CSS custom properties for transitions (Phase 5 lesson)
- Apply CRT effects to container instead of video content (Phase 5 lesson)

**✅ Do**:
- Use `CRT_CONFIGS.scanlines` for limited CRT controls
- Use `CRT_PRESETS.scanlines` for default settings
- Let `lib-video-stream` manage the MediaStream
- Apply backdrop-filter to actual content elements (settings panel)
- Use direct time values for CSS transitions
- Pass `contentAspectRatio` to CRT wrapper if aspect ratio issues arise

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests** (Vitest):
- [ ] Component creation with default state
- [ ] Device enumeration and selection
- [ ] CRT toggle updates state
- [ ] CRT settings panel visibility toggle
- [ ] CRT settings changes update signal
- [ ] CRT reset restores default preset
- [ ] Maximize button opens dialog with stream
- [ ] Composed components render correctly
- [ ] Slot architecture used correctly
- [ ] Settings store integration (CRT + device preferences)

**Behavioral Expectations**:
- Device selector dropdown populates with available devices
- Selecting device switches video stream
- CRT toggle button shows enabled/disabled state
- Settings panel appears/disappears on toggle
- Settings changes apply to CRT wrapper
- Maximize opens VideoDialogComponent with same stream
- CRT preferences persist to SettingsStore

**Testing Reference**:
- See [Testing Standards](../../../docs/TESTING_STANDARDS.md) for behavioral testing patterns
- See Phase 5 report for VideoDialogComponent test structure (similar patterns)
- Use `CUSTOM_ELEMENTS_SCHEMA` for shallow testing of composed components

---

## 📊 Reference Materials

### Related Documentation

**Phase Reports** (available for reference if needed):
- [Phase 5 Report](../reports/phase-05-report.md) - VideoDialogComponent refactor with 7 post-implementation fixes
  - Fix 1: CSS transition syntax
  - Fix 2: Backdrop filter artifacts
  - Fix 3: Toolbar layout strategies
  - Fix 4: Video objectFit (`contain` for players)
  - Fix 5: CRT clip-path for aspect ratio containment
  - Fix 6: Component-specific spacing adjustments
  - Fix 7: Transparent container backgrounds

**Related Components**:
- [Phase 4 Report](../reports/phase-04-report.md) - CRT settings panel API and configuration
- [Phase 3 Report](../reports/phase-03-report.md) - Content overlay container slot system
- [Master Plan](../master-plan.md) - Overall composability architecture

**Standards**:
- [Coding Standards](../../../docs/CODING_STANDARDS.md)
- [Testing Standards](../../../docs/TESTING_STANDARDS.md)
- [Component Library](../../../docs/COMPONENT_LIBRARY.md)
- [Style Guide](../../../docs/STYLE_GUIDE.md)

### Configuration Reference

```typescript
// CRT configuration for embedded preview (no curvature)
import { CRT_CONFIGS, CRT_PRESETS } from '@teensyrom-nx/ui/components';

readonly crtConfig = CRT_CONFIGS.scanlines; // Shows: scanlines, vignette, color filters
const defaultSettings = CRT_PRESETS.scanlines; // Matching preset
```

**Available Configs**:
- `CRT_CONFIGS.full` - All effects (scanlines, vignette, curvature, filters) - **NOT FOR THIS TASK**
- `CRT_CONFIGS.scanlines` - ✅ **USE THIS** - Scanlines, vignette, filters (no curvature)
- `CRT_CONFIGS.filtersOnly` - Only color filters (no overlays)
- `CRT_CONFIGS.none` - No effects (pass-through)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-component-extraction/reports/phase-06-report.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Report Should Include**:
- Summary of changes (template, TypeScript, SCSS reductions)
- Files modified with line count changes
- Test results (count, categories, all passing)
- Technical decisions made during implementation
- Any issues discovered and how they were resolved
- Comparison with Phase 5 patterns
- Lessons learned specific to embedded preview context
- Next steps recommendations

**Return Value**: File path when complete: `docs/projects/video-component-extraction/reports/phase-06-report.md`

---

## 🎯 Success Checklist

Before considering this task complete, verify:

- [ ] Template uses `lib-content-overlay-container` with slot architecture
- [ ] Video displayed via `lib-video-stream` component
- [ ] CRT effects applied via `lib-crt-effect-wrapper` with `scanlines` config
- [ ] Right controls include CRT toggle, settings toggle, maximize button
- [ ] CRT settings panel uses `CRT_CONFIGS.scanlines` (no curvature controls)
- [ ] Device enumeration and selection works
- [ ] Stream switching updates video
- [ ] CRT toggle persists to SettingsStore
- [ ] CRT settings changes persist to SettingsStore
- [ ] Maximize button opens dialog with same stream
- [ ] Template reduced from ~50 lines to ~40 lines (composed structure)
- [ ] SCSS reduced by removing delegated styles (~60 lines removed)
- [ ] All unit tests pass
- [ ] No visual regressions
- [ ] Hover reveals device selector and right controls
- [ ] Settings panel appears/disappears correctly

---

## 💡 Implementation Tips

1. **Start with VideoDialogComponent as reference** - Follow the same CRT state management pattern
2. **Use scanlines config consistently** - Both wrapper and settings panel need `CRT_CONFIGS.scanlines`
3. **Test device switching early** - Ensure `lib-video-stream` receives stream updates correctly
4. **Leverage Phase 5 lessons** - Avoid the 7 fixes by applying patterns from start
5. **Keep smart component logic** - Device enumeration, settings persistence stay in this component
6. **Test CRT persistence** - Verify settings store integration works for CRT preferences

---

## 🤝 Handoff Complete

Worker subagent: Please read this handoff document thoroughly, execute the refactor following the architectural patterns from Phase 5, and save your completion report to the specified OUTPUT_DOC location.

**Key Difference from Phase 5**: This is an embedded preview with limited CRT controls (no curvature), validating component reusability in a simpler context.

**Critical Requirement**: Right controls toolbar must include CRT toggle + CRT settings toggle + maximize button (same as dialog view, but with scanlines config instead of full config).
