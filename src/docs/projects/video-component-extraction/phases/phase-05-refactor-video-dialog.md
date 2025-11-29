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
- [ ] [Phase 4 Report](../reports/phase-04-report.md) - `lib-crt-settings-panel` with **unified config model** (CRITICAL)

**Current Implementation:**
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.ts` - Current smart component
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.html` - 167 lines to simplify
- [ ] `libs/features/player/.../video-dialog/video-dialog.component.scss` - CRT styles to remove

---

## 🔄 Slot Migration Summary

The VideoDialogComponent has 6 distinct UI regions that must be migrated to the 9-slot architecture:

### Complete Slot Mapping

| Current Element | Target Slot | New Component | Notes |
|-----------------|-------------|---------------|-------|
| `.video-wrapper` + `<video>` | `content` | `lib-crt-effect-wrapper` wrapping `lib-video-stream` | Pass `config` to wrapper |
| `.filter-toolbar-overlay` | `topOverlay` | `lib-filter-toolbar` (existing) | Already a component, just move to slot |
| `.player-toolbar-overlay` | `bottomOverlay` | `lib-player-toolbar` (existing) | Already a component, just move to slot |
| `.close-button` | `topRightCorner` | `lib-icon-button` | Use `icon="close"` |
| `.crt-controls-overlay` (8 sliders) | `leftControls` | `lib-crt-settings-panel` | Pass same `config` as wrapper |
| `.right-controls-card` | `rightControls` | Card with icon buttons | CRT toggle, settings toggle, fullscreen |

### Unused Slots (Available for Future)
- `topLeftCorner` - not used in video dialog
- `bottomLeftControls` - not used in video dialog  
- `bottomRightControls` - not used in video dialog

### Key Migration Points

1. **Toolbars**: `lib-filter-toolbar` and `lib-player-toolbar` already exist - just add slot attribute
2. **Close Button**: Move from inline div to `lib-icon-button` with `topRightCorner` attribute
3. **Right Controls**: Group CRT toggle, settings toggle, and fullscreen button in card
4. **Unified Config**: Same `config` input to both `lib-crt-effect-wrapper` AND `lib-crt-settings-panel`

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
<summary><h3>Task 1: Migrate Template to Slot Architecture</h3></summary>

**Purpose**: Move all 6 UI regions to appropriate slots in `lib-content-overlay-container`.

**Subtasks:**
- [ ] Use `lib-content-overlay-container` as root (replaces `.video-container`)
- [ ] Migrate all 6 elements per slot mapping table above
- [ ] Ensure `config` is passed to both wrapper and settings panel
- [ ] Keep existing toolbar components - just add slot attributes

**Verification:**
- [ ] All overlays appear in correct positions
- [ ] Hover-to-reveal behavior works for all slots
- [ ] Close button in top-right corner
- [ ] Right controls slide in from right side

</details>

---

<details open>
<summary><h3>Task 2: Simplify Component Logic</h3></summary>

**Purpose**: Delegate to child components, reduce local state.

**Implementation Subtasks:**
- [ ] Remove `afterNextRender` stream attachment (now in `lib-video-stream`)
- [ ] Remove `setupFullscreenListener` (now in `lib-content-overlay-container`)
- [ ] Convert individual CRT signals to single `crtSettings` signal of type `CrtSettings`
- [ ] Add `crtConfig` signal of type `CrtSettingsConfig` (use `CRT_CONFIGS.full`)
- [ ] Add `@ViewChild` reference to `lib-content-overlay-container` for fullscreen methods
- [ ] Keep dialog-specific logic: `onClose()`, dialog data handling

**Key Consolidation:**
- Replace 8 individual CRT signals → single `crtSettings` signal of type `CrtSettings`
- Add `crtConfig` signal using `CRT_CONFIGS.full` for full video dialog experience
- Settings panel outputs update the signal directly (no handler methods needed)

**Verification:**
- [ ] CRT settings changes propagate to wrapper
- [ ] Same config passed to both wrapper and panel

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
- [ ] Add imports for Phase 4 types and constants:
  - `CrtSettings`, `CrtSettingsConfig` (types)
  - `DEFAULT_CRT_SETTINGS`, `CRT_PRESETS` (settings presets)
  - `CRT_CONFIGS`, `DEFAULT_CRT_CONFIG` (feature flag configs)
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
- [ ] **NEW**: Same `config` passed to both `lib-crt-effect-wrapper` and `lib-crt-settings-panel`
- [ ] **NEW**: Uses `CRT_CONFIGS.full` for full video dialog CRT experience
- [ ] SCSS reduced by ~400+ lines
- [ ] All unit tests pass (updated for new structure)
- [ ] Visual appearance matches before refactor
- [ ] Fullscreen works via overlay container
- [ ] CRT settings work via settings panel
- [ ] Preset selection works via `presetSelected` output

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
