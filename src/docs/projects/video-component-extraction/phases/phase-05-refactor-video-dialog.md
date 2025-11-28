# Phase 5: Refactor VideoDialogComponent

## 🎯 Objective

Refactor `VideoDialogComponent` to compose the new UI components while preserving all existing functionality. This validates the architecture with the more complex use case first.

---

## 📚 Required Reading

**Feature Documentation:**
- [ ] [Master Plan](../master-plan.md) - Target architecture and component composition
- [ ] [Phase 1 Report](../reports/phase-01-report.md) - `lib-video-stream` component
- [ ] [Phase 2 Report](../reports/phase-02-report.md) - `lib-crt-effect-wrapper` and presets
- [ ] [Phase 3 Report](../reports/phase-03-report.md) - `lib-content-overlay-container` with 9 slots
- [ ] [Phase 4 Plan](./phase-04-crt-settings-panel.md) - `lib-crt-settings-panel` (must be complete)

**Current Implementation:**
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.ts` - Current smart component
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.html` - 167 lines to simplify
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.scss` - CRT styles to remove

---

## 🔄 Before/After Architecture

### Current Structure (Tightly Coupled)
```html
<div class="video-container">
  <div class="video-wrapper" [class.crt-effect]="..." [style.--scanline-...]="...">
    <video #dialogVideoElement autoplay playsinline muted></video>
  </div>
  <div class="crt-controls-overlay"><!-- 8 inline sliders --></div>
  <div class="filter-toolbar-overlay"><!-- toolbar --></div>
  <div class="player-toolbar-overlay"><!-- toolbar --></div>
  <div class="video-controls"><!-- buttons --></div>
</div>
```

### Target Structure (Composed Components)
```html
<lib-content-overlay-container #overlayContainer
  [showOverlaysOnHover]="true"
  [overlayTransitionMs]="300"
  (fullscreenChange)="onFullscreenChange($event)">
  
  <!-- Content: Video with CRT effects -->
  <lib-crt-effect-wrapper content [settings]="crtSettings()" [enabled]="isCrtEnabled()">
    <lib-video-stream [stream]="data.stream" (streamReady)="onStreamReady()"></lib-video-stream>
  </lib-crt-effect-wrapper>
  
  <!-- Top overlay: Filter toolbar -->
  <lib-filter-toolbar topOverlay [deviceId]="data.deviceId"></lib-filter-toolbar>
  
  <!-- Bottom overlay: Player toolbar -->
  <lib-player-toolbar bottomOverlay [deviceId]="data.deviceId"></lib-player-toolbar>
  
  <!-- Top-right corner: Close button -->
  <lib-icon-button topRightCorner icon="close" (buttonClick)="onClose()"></lib-icon-button>
  
  <!-- Left controls: CRT settings panel (conditional) -->
  @if (isCrtEnabled()) {
    <lib-crt-settings-panel leftControls
      [settings]="crtSettings()"
      [visible]="showCrtControls()"
      (settingsChange)="onCrtSettingsChange($event)"
      (resetRequested)="onResetSettings()">
    </lib-crt-settings-panel>
  }
  
  <!-- Right controls: Control buttons -->
  <div rightControls class="control-buttons">
    <lib-compact-card-layout cardClass="glassy-card">
      @if (isCrtEnabled()) {
        <lib-icon-button icon="tune" (buttonClick)="toggleCrtControls()"></lib-icon-button>
      }
      <lib-icon-button icon="tv" [class.active]="isCrtEnabled()" (buttonClick)="toggleCrtEffect()"></lib-icon-button>
      <lib-icon-button [icon]="isFullscreen() ? 'fullscreen_exit' : 'fullscreen'" 
        (buttonClick)="toggleFullscreen()"></lib-icon-button>
    </lib-compact-card-layout>
  </div>
</lib-content-overlay-container>
```

---

## 📂 Files Modified

```
libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/
├── video-dialog.component.ts                📝 Simplify: remove stream binding, delegate fullscreen
├── video-dialog.component.html              📝 Major refactor: compose new components
└── video-dialog.component.scss              📝 Reduce: remove ~400 lines of CRT/overlay styles
```

---

<details open>
<summary><h3>Task 1: Update Template to Use New Components</h3></summary>

**Purpose**: Replace inline implementation with composed components.

**Implementation Subtasks:**
- [ ] Replace `<video>` element with `<lib-video-stream [stream]="data.stream">`
- [ ] Wrap video-stream with `<lib-crt-effect-wrapper [settings]="crtSettings()" [enabled]="isCrtEnabled()">`
- [ ] Replace root container with `<lib-content-overlay-container>`
- [ ] Map existing overlays to 9-slot architecture (see mapping below)
- [ ] Replace inline CRT sliders with `<lib-crt-settings-panel>` in `leftControls` slot

**Slot Mapping:**

| Current Element | Target Slot | Content |
|-----------------|-------------|---------|
| `.video-wrapper` | `[content]` | `lib-crt-effect-wrapper` > `lib-video-stream` |
| `.filter-toolbar-overlay` | `[topOverlay]` | `lib-filter-toolbar` |
| `.player-toolbar-overlay` | `[bottomOverlay]` | `lib-player-toolbar` |
| `.close-button` | `[topRightCorner]` | `lib-icon-button` |
| `.crt-controls-overlay` | `[leftControls]` | `lib-crt-settings-panel` |
| `.right-controls-card` | `[rightControls]` | CRT toggle, fullscreen buttons |

**Testing Subtask:**
- [ ] Verify all slots render correctly in composed structure

</details>

---

<details open>
<summary><h3>Task 2: Simplify Component Logic</h3></summary>

**Purpose**: Delegate to child components, reduce local state.

**Implementation Subtasks:**
- [ ] Remove `afterNextRender` stream attachment (now in `lib-video-stream`)
- [ ] Remove `setupFullscreenListener` (now in `lib-content-overlay-container`)
- [ ] Convert individual CRT signals to single `crtSettings` signal of type `CrtSettings`
- [ ] Add `onCrtSettingsChange(settings: CrtSettings)` handler
- [ ] Add `@ViewChild` reference to `lib-content-overlay-container` for fullscreen methods
- [ ] Keep dialog-specific logic: `onClose()`, dialog data handling

**Before (individual signals):**
```typescript
scanlineIntensity = signal<number>(0.50);
scanlineThickness = signal<number>(3);
// ... 6 more signals
```

**After (single CrtSettings signal):**
```typescript
crtSettings = signal<CrtSettings>(DEFAULT_CRT_SETTINGS);

onCrtSettingsChange(settings: CrtSettings) {
  this.crtSettings.set(settings);
}
```

**Testing Subtask:**
- [ ] Verify CRT settings changes propagate correctly

</details>

---

<details open>
<summary><h3>Task 3: Migrate SCSS</h3></summary>

**Purpose**: Remove styles now handled by composed components.

**Implementation Subtasks:**
- [ ] Remove all CRT effect styles (scanlines, vignette, curvature, filters) - now in `lib-crt-effect-wrapper`
- [ ] Remove overlay positioning/animation styles - now in `lib-content-overlay-container`
- [ ] Remove hover-reveal behavior styles - now in `lib-content-overlay-container`
- [ ] Keep only dialog-specific overrides (if any)

**Expected Reduction:** ~400+ lines removed

**Remaining Styles (if any):**
- Dialog-specific sizing/padding
- Material dialog overrides
- Z-index adjustments for mat-dialog context

**Testing Subtask:**
- [ ] Visual comparison: ensure CRT effects appear identical

</details>

---

<details open>
<summary><h3>Task 4: Update Imports and Providers</h3></summary>

**Purpose**: Add new component imports to the standalone component.

**Implementation Subtasks:**
- [ ] Add imports for new components:
  - `VideoStreamComponent`
  - `CrtEffectWrapperComponent`
  - `ContentOverlayContainerComponent`
  - `CrtSettingsPanelComponent`
- [ ] Keep existing imports:
  - `IconButtonComponent`
  - `CompactCardLayoutComponent`
  - `PlayerToolbarComponent`
  - `FilterToolbarComponent`
  - `MatSliderModule`, `FormsModule` (can remove if no longer needed)

**Testing Subtask:**
- [ ] Verify no import errors

</details>

---

<details open>
<summary><h3>Task 5: Verify and Test</h3></summary>

**Purpose**: Ensure no regressions in functionality.

**Manual Testing Checklist:**
- [ ] Dialog opens with video stream playing
- [ ] CRT effects apply correctly (scanlines, vignette, curvature, filters)
- [ ] CRT toggle button enables/disables effects
- [ ] CRT settings panel slides in from left
- [ ] All 8 CRT sliders adjust effects in real-time
- [ ] Filter toolbar appears on hover (top)
- [ ] Player toolbar appears on hover (bottom)
- [ ] Fullscreen toggle works
- [ ] Close button closes dialog
- [ ] Hover-to-reveal behavior works for all overlays

**Automated Testing:**
- [ ] Update/fix existing component tests for new structure
- [ ] Test that CRT settings signal updates correctly
- [ ] Test fullscreen delegation to overlay container

**Testing Subtask:**
- [ ] All existing tests pass (with updates for new structure)

</details>

---

## 🗂️ Files Modified

**Modified Files:**
- `libs/features/player/.../video-dialog/video-dialog.component.ts`
- `libs/features/player/.../video-dialog/video-dialog.component.html`
- `libs/features/player/.../video-dialog/video-dialog.component.scss`
- `libs/features/player/.../video-dialog/video-dialog.component.spec.ts` (test updates)

---

## 🧪 Testing Summary

**Testing Philosophy:** Ensure all existing functionality works through composition.

**Test Categories:**

| Category | Tests |
|----------|-------|
| Dialog Lifecycle | Opens, closes, passes stream |
| CRT Effects | Toggle, settings changes, visual effects |
| Fullscreen | Enter, exit, button state |
| Overlay Behavior | Hover reveal, focus persistence |
| Toolbar Integration | Filter and player toolbars visible and functional |

**Reference:** See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## ✅ Success Criteria

- [ ] All existing functionality preserved (no regressions)
- [ ] Template uses composed components instead of inline implementation
- [ ] Component logic simplified (delegated to children)
- [ ] SCSS reduced by ~400+ lines
- [ ] All unit tests pass (updated for new structure)
- [ ] Visual appearance matches before refactor
- [ ] Fullscreen works via overlay container
- [ ] CRT settings work via settings panel

---

## 📊 Metrics

**Estimated Size:** Medium (3 files, significant changes)

**Dependencies:** Phases 1-4 must be complete

**Expected Improvements:**
- Template: ~167 lines → ~40 lines (75% reduction)
- SCSS: ~550 lines → ~100 lines (80% reduction)
- Component logic: ~150 lines → ~80 lines (45% reduction)

---

## 📝 Notes

**Migration Strategy: Incremental**

Rather than rewriting everything at once:
1. First, wrap existing video element with `lib-content-overlay-container`
2. Then, replace video element with `lib-video-stream`
3. Then, add `lib-crt-effect-wrapper`
4. Then, replace inline sliders with `lib-crt-settings-panel`
5. Finally, remove deprecated styles

This allows testing at each step.

**Fullscreen Delegation**

The overlay container now manages fullscreen. The dialog component should:
1. Get a `@ViewChild` reference to the container
2. Call `container.enterFullscreen()` / `container.exitFullscreen()`
3. Listen to `(fullscreenChange)` event to update local state
