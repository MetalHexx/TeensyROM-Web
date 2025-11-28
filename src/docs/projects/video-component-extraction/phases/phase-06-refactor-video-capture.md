# Phase 6: Refactor VideoCaptureComponent

## 🎯 Objective

Refactor `VideoCaptureComponent` to compose the new UI components for the embedded preview. Validates reusability of components in a simpler context (no CRT effects, just video with overlay controls).

---

## 📚 Required Reading

**Feature Documentation:**
- [ ] [Master Plan](../master-plan.md) - Target architecture and component composition
- [ ] [Phase 1 Report](../reports/phase-01-report.md) - `lib-video-stream` component
- [ ] [Phase 3 Report](../reports/phase-03-report.md) - `lib-content-overlay-container` with 9 slots
- [ ] [Phase 5 Plan](./phase-05-refactor-video-dialog.md) - Dialog refactor (should be complete)

**Current Implementation:**
- [ ] `libs/features/player/.../video-capture/video-capture.component.ts`
- [ ] `libs/features/player/.../video-capture/video-capture.component.html`
- [ ] `libs/features/player/.../video-capture/video-capture.component.scss`

---

## 🔄 Before/After Architecture

### Current Structure
```html
<div class="video-capture-container">
  <video #captureVideoElement autoplay playsinline muted></video>
  <div class="device-selector-overlay"><!-- dropdown --></div>
  <div class="maximize-button-overlay"><!-- button --></div>
</div>
```

### Target Structure (Composed Components)
```html
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <!-- Content: Video stream (no CRT effects for preview) -->
  <lib-video-stream content 
    [stream]="captureStream()" 
    [showLoadingState]="true"
    (streamReady)="onStreamReady()">
  </lib-video-stream>
  
  <!-- Top overlay: Device selector -->
  <div topOverlay class="device-selector">
    <mat-select [value]="selectedDeviceId()" (selectionChange)="onDeviceSelect($event)">
      @for (device of videoDevices(); track device.deviceId) {
        <mat-option [value]="device.deviceId">{{ device.label }}</mat-option>
      }
    </mat-select>
  </div>
  
  <!-- Right controls: Maximize button -->
  <lib-icon-button rightControls 
    icon="open_in_full" 
    ariaLabel="Open in dialog"
    (buttonClick)="openDialog()">
  </lib-icon-button>
</lib-content-overlay-container>
```

---

## 📂 Files Modified

```
libs/features/player/src/lib/player-view/player-device-container/video-capture/
├── video-capture.component.ts               📝 Simplify stream attachment
├── video-capture.component.html             📝 Compose new components
└── video-capture.component.scss             📝 Remove video/overlay styles
```

---

<details open>
<summary><h3>Task 1: Update Template to Use New Components</h3></summary>

**Purpose**: Use new components for video display with overlay controls.

**Implementation Subtasks:**
- [ ] Replace `<video>` element with `<lib-video-stream>` in `[content]` slot
- [ ] Use `<lib-content-overlay-container>` as root container
- [ ] Move device selector to `[topOverlay]` slot
- [ ] Move maximize button to `[rightControls]` slot
- [ ] Keep device enumeration logic in smart component

**Slot Mapping:**

| Current Element | Target Slot | Content |
|-----------------|-------------|---------|
| `<video>` | `[content]` | `lib-video-stream` |
| Device selector | `[topOverlay]` | `mat-select` dropdown |
| Maximize button | `[rightControls]` | `lib-icon-button` |

**Testing Subtask:**
- [ ] Verify video displays in content slot

</details>

---

<details open>
<summary><h3>Task 2: Simplify Component Logic</h3></summary>

**Purpose**: Delegate video display while keeping domain logic.

**Implementation Subtasks:**
- [ ] Remove `afterNextRender` stream attachment (now in `lib-video-stream`)
- [ ] Keep device enumeration logic (MediaDevices API calls)
- [ ] Keep device selection handling
- [ ] Keep dialog opening logic (passes stream to VideoDialogComponent)
- [ ] Update stream signal to pass directly to `lib-video-stream`

**Keep in Smart Component:**
- `enumerateDevices()` - device discovery
- `onDeviceSelect()` - device switching
- `openDialog()` - opens VideoDialogComponent with stream
- Store integration for settings persistence

**Delegate to Dumb Components:**
- Video element management → `lib-video-stream`
- Overlay positioning → `lib-content-overlay-container`

**Testing Subtask:**
- [ ] Verify device switching updates stream

</details>

---

<details open>
<summary><h3>Task 3: Update Imports</h3></summary>

**Purpose**: Add new component imports.

**Implementation Subtasks:**
- [ ] Add imports for new components:
  - `VideoStreamComponent`
  - `ContentOverlayContainerComponent`
- [ ] Keep existing imports:
  - `IconButtonComponent`
  - `MatSelectModule`

**Testing Subtask:**
- [ ] Verify no import errors

</details>

---

<details open>
<summary><h3>Task 4: Migrate SCSS and Test</h3></summary>

**Purpose**: Remove delegated styles, verify functionality.

**Implementation Subtasks:**
- [ ] Remove video element styling (now in `lib-video-stream`)
- [ ] Remove overlay positioning (now in `lib-content-overlay-container`)
- [ ] Keep container sizing and any device-selector specific styles

**Manual Testing Checklist:**
- [ ] Video capture preview displays correctly
- [ ] Device selector dropdown works
- [ ] Device switching updates video stream
- [ ] Maximize button opens dialog
- [ ] Dialog receives same stream
- [ ] Hover reveals controls

**Testing Subtask:**
- [ ] All existing tests pass (with updates for new structure)

</details>

---

## 🗂️ Files Modified

**Modified Files:**
- `libs/features/player/.../video-capture/video-capture.component.ts`
- `libs/features/player/.../video-capture/video-capture.component.html`
- `libs/features/player/.../video-capture/video-capture.component.scss`
- `libs/features/player/.../video-capture/video-capture.component.spec.ts` (test updates)

---

## 🧪 Testing Summary

**Testing Philosophy:** Validate reusability in simpler context.

**Test Categories:**

| Category | Tests |
|----------|-------|
| Device Enumeration | Devices listed, selection works |
| Stream Display | Video shows via composed component |
| Dialog Integration | Maximize opens dialog with stream |
| Overlay Behavior | Hover reveals device selector and button |

**Reference:** See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## ✅ Success Criteria

- [ ] Device enumeration and switching works
- [ ] Maximize opens dialog with same stream
- [ ] Uses `lib-video-stream` for display
- [ ] Uses `lib-content-overlay-container` for layout
- [ ] All tests pass
- [ ] No visual regressions

---

## 📊 Metrics

**Estimated Size:** Small-Medium (3 files, moderate changes)

**Dependencies:** Phase 5 validates architecture works

**Expected Improvements:**
- Template: Simplified to composed structure
- SCSS: Reduced by removing video/overlay styles
- Component logic: Slightly simplified (stream attachment delegated)

---

## 📝 Notes

**Reusability Validation**

This phase validates that `lib-video-stream` and `lib-content-overlay-container` work correctly in a simpler context:
- No CRT effects needed (just plain video)
- Fewer overlay slots used
- Different controls (device selector vs toolbars)

If Phase 5 and Phase 6 both work, the components are truly reusable.

**No CRT Effects**

Unlike `VideoDialogComponent`, the capture preview doesn't need CRT effects. This demonstrates that `lib-video-stream` can be used standalone without `lib-crt-effect-wrapper`.
