# Phase 6 Architectural Summary: VideoCaptureComponent Refactor with CRT Effects

## 🎯 Project Context

**Phase Status**: 6 of 7 (Phase 5 completed, Phase 7 is cleanup)  
**Current Task**: Refactor `VideoCaptureComponent` to compose new UI components with CRT effects support  
**Deliverable**: Task handoff document for UI Wizard implementation

---

## 📊 Current State Analysis

### Existing Implementation

**Component**: `VideoCaptureComponent` (Smart Component)  
**Location**: `libs/features/player/src/lib/player-view/player-device-container/video-capture/`

**Current Responsibilities**:
1. ✅ **Keep**: Device enumeration via MediaDevices API
2. ✅ **Keep**: Device selection and stream switching
3. ✅ **Keep**: Settings store integration (video device preferences)
4. ❌ **Delegate**: Video element lifecycle management
5. ❌ **Delegate**: Overlay positioning and hover effects
6. ➕ **Add**: CRT effect state management
7. ➕ **Add**: CRT settings persistence

**Current Structure** (Before Refactor):
```
VideoCaptureComponent
├── Device enumeration logic
├── Stream acquisition (getUserMedia)
├── Video element binding (manual srcObject)
├── Device selector overlay (absolute positioning)
├── Maximize button overlay (absolute positioning)
└── Settings persistence (video device only)
```

**Metrics**:
- **TypeScript**: ~240 lines (device logic + stream management)
- **HTML**: ~52 lines (video element + overlays)
- **SCSS**: ~112 lines (video styles + overlay positioning)

---

## 🏗️ Target Architecture

### Composed Structure (After Refactor)

```
VideoCaptureComponent (Smart - Orchestrator)
├── Device enumeration logic (KEEP)
├── Device selection handling (KEEP)
├── CRT state management (ADD)
├── Settings persistence (EXTEND: video device + CRT prefs)
└── Composed Components:
    └── lib-content-overlay-container
        ├── [content] lib-crt-effect-wrapper (scanlines config)
        │   └── lib-video-stream (receives MediaStream)
        ├── [topOverlay] Device selector dropdown
        └── [rightControls] Control buttons + settings panel
            ├── CRT toggle button
            ├── CRT settings toggle (when enabled)
            ├── Maximize button
            └── lib-crt-settings-panel (conditionally shown)
```

### Slot Mapping

| Current Element | Target Slot | New Component |
|----------------|-------------|---------------|
| `<video>` element | `[content]` | `lib-video-stream` wrapped by `lib-crt-effect-wrapper` |
| Device selector | `[topOverlay]` | Existing `mat-select` dropdown |
| Maximize button | `[rightControls]` | `lib-icon-button` in toolbar |
| *(new)* CRT toggle | `[rightControls]` | `lib-icon-button` |
| *(new)* Settings toggle | `[rightControls]` | `lib-icon-button` |
| *(new)* Settings panel | `[rightControls]` | `lib-crt-settings-panel` |

---

## 🎨 CRT Configuration Design

### Why Scanlines Config?

**Context**: Embedded preview has **less space** than fullscreen dialog, so we exclude screen curvature (most visually demanding effect).

**Configuration Choice**: `CRT_CONFIGS.scanlines`

**What's Included**:
- ✅ Scanlines (horizontal line overlays)
- ✅ Vignette (edge darkening)
- ✅ Color filters (contrast, brightness, saturation)

**What's Excluded**:
- ❌ Screen curvature (requires more space, complex clip-path calculations)

**Configuration Code**:
```typescript
// From libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts
export const CRT_CONFIGS = {
  scanlines: {
    showScanlines: true,    // ✅ Show scanlines controls
    showVignette: true,     // ✅ Show vignette controls
    showCurvature: false,   // ❌ Hide curvature controls
    showColorFilters: true, // ✅ Show color filter controls
  },
};

export const CRT_PRESETS = {
  scanlines: {
    scanlineIntensity: 0.5,
    scanlineThickness: 3,
    scanlineSpacing: 2,
    vignetteStrength: 0,    // Default off (user can enable)
    screenCurvature: 0,     // Always 0 (not available)
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
  },
};
```

### Comparison with VideoDialogComponent

| Feature | VideoDialogComponent | VideoCaptureComponent |
|---------|---------------------|----------------------|
| Config | `CRT_CONFIGS.full` | `CRT_CONFIGS.scanlines` |
| Scanlines | ✅ Yes | ✅ Yes |
| Vignette | ✅ Yes | ✅ Yes |
| Curvature | ✅ Yes | ❌ No (excluded) |
| Color Filters | ✅ Yes | ✅ Yes |
| Context | Fullscreen dialog | Embedded preview |
| Preset | `CRT_PRESETS.full` | `CRT_PRESETS.scanlines` |

---

## 🔧 Implementation Details

### TypeScript Changes

**Add CRT State Management**:
```typescript
// Configuration (matches settings panel)
readonly crtConfig = CRT_CONFIGS.scanlines;

// State signals
private isCrtEnabled = signal<boolean>(true);
private crtSettings = signal<CrtSettings>(CRT_PRESETS.scanlines);
private showCrtControls = signal<boolean>(false);
```

**Add CRT Event Handlers**:
```typescript
toggleCrtEffect(): void {
  const newState = !this.isCrtEnabled();
  this.isCrtEnabled.set(newState);
  this.settingsStore.updateDeviceCrtEnabled({
    deviceId: this.deviceId(),
    enabled: newState,
  });
}

toggleCrtControls(): void {
  this.showCrtControls.update(v => !v);
}

onCrtSettingsChange(settings: CrtSettings): void {
  this.crtSettings.set(settings);
  this.settingsStore.updateDeviceCrtSettings({
    deviceId: this.deviceId(),
    settings,
  });
}

onCrtReset(): void {
  this.crtSettings.set(CRT_PRESETS.scanlines);
  // Also persist reset
}

onCrtPresetSelected(preset: string): void {
  const presetSettings = CRT_PRESETS[preset as keyof typeof CRT_PRESETS];
  if (presetSettings) {
    this.crtSettings.set(presetSettings);
    // Also persist
  }
}
```

**Remove**:
- `afterNextRender` hook (stream attachment now in `lib-video-stream`)
- Manual video element `srcObject` assignment
- `viewChild<ElementRef<HTMLVideoElement>>` (no longer needed)

**Keep**:
- Device enumeration logic
- Device selection handling
- Settings store integration
- Dialog opening logic

### Template Changes

**Before** (~52 lines):
```html
<lib-scaling-compact-card>
  <div class="video-wrapper">
    <div class="device-selector"><!-- dropdown --></div>
    <div class="maximize-button"><!-- button --></div>
    <video #videoElement autoplay playsinline muted></video>
  </div>
</lib-scaling-compact-card>
```

**After** (~40-45 lines):
```html
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <lib-crt-effect-wrapper content
    [settings]="crtSettings()"
    [config]="crtConfig"
    [enabled]="isCrtEnabled()">
    <lib-video-stream [stream]="currentStream()"></lib-video-stream>
  </lib-crt-effect-wrapper>

  <div topOverlay class="device-selector">
    <mat-select><!-- devices --></mat-select>
  </div>

  <div rightControls class="right-controls-wrapper">
    <lib-compact-card-layout cardClass="glassy-card">
      <lib-icon-button icon="tv" (buttonClick)="toggleCrtEffect()"></lib-icon-button>
      @if (isCrtEnabled()) {
        <lib-icon-button icon="tune" (buttonClick)="toggleCrtControls()"></lib-icon-button>
      }
      <lib-icon-button icon="fullscreen" (buttonClick)="openVideoDialog()"></lib-icon-button>
    </lib-compact-card-layout>

    @if (isCrtEnabled() && showCrtControls()) {
      <lib-crt-settings-panel
        [settings]="crtSettings()"
        [config]="crtConfig"
        (settingsChange)="onCrtSettingsChange($event)">
      </lib-crt-settings-panel>
    }
  </div>
</lib-content-overlay-container>
```

### SCSS Changes

**Remove** (~60 lines delegated):
```scss
// ❌ Remove - now in lib-video-stream
.video-stream { /* video element styles */ }

// ❌ Remove - now in lib-content-overlay-container
.device-selector { /* overlay positioning */ }
.maximize-button { /* overlay positioning */ }
```

**Keep/Add** (~50 lines):
```scss
// ✅ Keep - component sizing
:host {
  display: block;
  width: 520px;
  height: 390px;
}

// ✅ Add - right controls wrapper
.right-controls-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// ✅ Keep - responsive behavior
@media (max-width: 500px) { /* ... */ }
```

**Expected Reduction**: ~112 lines → ~50 lines (~55% reduction)

---

## 📊 Comparison: Phase 5 vs Phase 6

### Similarities (Architecture Reuse)

| Aspect | Phase 5 (VideoDialog) | Phase 6 (VideoCapture) |
|--------|----------------------|------------------------|
| Base Container | `lib-content-overlay-container` | `lib-content-overlay-container` |
| Video Display | `lib-video-stream` | `lib-video-stream` |
| CRT Wrapper | `lib-crt-effect-wrapper` | `lib-crt-effect-wrapper` |
| Settings Panel | `lib-crt-settings-panel` | `lib-crt-settings-panel` |
| Right Controls | Compact card with buttons | Compact card with buttons |
| State Pattern | Signals for CRT state | Signals for CRT state |

### Key Differences

| Aspect | Phase 5 (VideoDialog) | Phase 6 (VideoCapture) |
|--------|----------------------|------------------------|
| **CRT Config** | `CRT_CONFIGS.full` | `CRT_CONFIGS.scanlines` |
| **Curvature** | ✅ Included | ❌ Excluded |
| **Context** | Fullscreen dialog | Embedded preview |
| **Overlays Used** | 6 slots (topOverlay, bottomOverlay, topRightCorner, leftControls, rightControls) | 2 slots (topOverlay, rightControls) |
| **Complexity** | High (toolbars, dialog lifecycle) | Medium (device selector, simpler controls) |
| **Settings Panel Position** | Left controls slot | Right controls slot (below buttons) |
| **Additional Logic** | Dialog close, fullscreen toggle | Device enumeration, stream switching |

---

## 🎓 Lessons from Phase 5 Applied

### Post-Implementation Fixes to Avoid

From the Phase 5 report, we learned **7 critical lessons**. Here's how we apply them proactively:

1. **CSS Transitions**: Use direct time values (`250ms`), not `calc()` with custom properties
   - ✅ Applied: Use standard transition values in styles

2. **Backdrop Filter Artifacts**: Apply to content elements, not empty positioned containers
   - ✅ Applied: Settings panel has backdrop-filter, not wrapper

3. **Toolbar Layout Strategies**: Full-width toolbars use different positioning than centered overlays
   - ✅ Applied: Device selector is centered overlay; controls are positioned stack

4. **Video objectFit**: Use `contain` for players to preserve full frame
   - ✅ Applied: Pass `objectFit: 'contain'` to `lib-video-stream`

5. **CRT Clip-Path**: Calculate visible content area based on aspect ratios
   - ℹ️ Monitor: May need `contentAspectRatio` input if issues arise

6. **Component-Specific Spacing**: Use `::ng-deep` in consumer for positioning tweaks
   - ✅ Applied: Document in handoff for any needed adjustments

7. **Transparent Container Backgrounds**: Prevent black artifact visibility
   - ✅ Applied: Ensure video-stream container has transparent background

---

## 🧪 Testing Strategy

### Test Categories

**Component Creation** (5 tests):
- Component creates successfully
- Default CRT enabled state
- Uses `CRT_CONFIGS.scanlines` for config
- Has default CRT settings
- Device enumeration initializes

**Device Management** (4 tests):
- Devices listed from MediaDevices API
- Device selection switches stream
- Selected device persists to settings store
- Stream switching updates video

**CRT Toggle** (3 tests):
- Toggle updates CRT enabled state
- Toggle persists to settings store
- Toggle button shows correct icon

**CRT Settings Panel** (5 tests):
- Settings toggle shows/hides panel
- Settings button only shows when CRT enabled
- Panel receives scanlines config (not full)
- Settings changes update signal
- Settings changes persist to store

**CRT Presets** (2 tests):
- Reset restores scanlines preset
- Preset selection applies correct values

**Dialog Integration** (2 tests):
- Maximize button opens VideoDialogComponent
- Dialog receives current stream

**Composed Components** (4 tests):
- Renders `lib-content-overlay-container`
- Renders `lib-crt-effect-wrapper`
- Renders `lib-video-stream`
- Renders `lib-crt-settings-panel` when visible

**Total**: ~25 tests expected

---

## 📁 File Impact Summary

### Files Modified

| File | Before | After | Change |
|------|--------|-------|--------|
| `video-capture.component.ts` | ~240 lines | ~280 lines | +40 lines (CRT state) |
| `video-capture.component.html` | ~52 lines | ~45 lines | -7 lines (composed) |
| `video-capture.component.scss` | ~112 lines | ~50 lines | -62 lines (delegated) |

**Net Change**: +40 TypeScript (CRT feature), -69 template/styles (composition wins)

### New Functionality Added

- ✅ CRT effect toggle (enable/disable)
- ✅ CRT settings panel (scanlines, vignette, color filters)
- ✅ CRT settings persistence to SettingsStore
- ✅ CRT preset support (scanlines preset)
- ✅ Right controls toolbar matching dialog pattern

### Functionality Preserved

- ✅ Device enumeration
- ✅ Device selection and switching
- ✅ Video device preference persistence
- ✅ Maximize to dialog
- ✅ Responsive behavior
- ✅ Error states (permission denied, no devices)

---

## 🚀 Execution Plan

### Step 1: Setup (UI Wizard)
1. Read task handoff document thoroughly
2. Review Phase 5 report (reference only, not immediate context)
3. Understand CRT_CONFIGS.scanlines vs CRT_CONFIGS.full
4. Review current VideoCaptureComponent implementation

### Step 2: Template Refactor
1. Replace root with `lib-content-overlay-container`
2. Wrap video in `lib-crt-effect-wrapper` and use `lib-video-stream`
3. Move device selector to `topOverlay` slot
4. Create right controls wrapper with buttons + settings panel
5. Apply slot architecture patterns from Phase 5

### Step 3: TypeScript Refactor
1. Add CRT state signals (enabled, settings, showControls)
2. Add crtConfig constant using `CRT_CONFIGS.scanlines`
3. Add CRT event handlers (toggle, settings change, reset, preset)
4. Update imports for new components
5. Remove afterNextRender and video element viewChild
6. Integrate SettingsStore for CRT preferences

### Step 4: SCSS Refactor
1. Remove video element styles
2. Remove overlay positioning styles
3. Add right-controls-wrapper positioning
4. Keep component sizing and responsive styles
5. Add any component-specific adjustments (::ng-deep if needed)

### Step 5: Testing
1. Update test file for new structure
2. Add CRT-specific tests (toggle, settings, persistence)
3. Verify all tests pass
4. Manual testing in browser (device switching, CRT effects)

### Step 6: Report
1. Document changes and metrics
2. Note any issues discovered and resolutions
3. Compare with Phase 5 patterns
4. Provide lessons learned and recommendations

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] Device enumeration and selection works
- [ ] CRT effects apply to video (scanlines config)
- [ ] CRT toggle persists to settings store
- [ ] CRT settings panel shows correct controls
- [ ] Settings changes persist to store
- [ ] Maximize opens dialog with same stream
- [ ] Hover reveals overlays

**Technical Requirements**:
- [ ] Uses `CRT_CONFIGS.scanlines` (not full)
- [ ] Uses slot architecture correctly
- [ ] Template reduced to composed structure
- [ ] SCSS reduced by delegating styles
- [ ] All tests pass
- [ ] No visual regressions

**Code Quality**:
- [ ] Follows Phase 5 architectural patterns
- [ ] Avoids Phase 5 post-implementation fixes
- [ ] Clean separation of concerns
- [ ] Proper settings store integration

---

## 📋 Next Steps After Phase 6

### Immediate
1. **Execute Phase 6** - UI Wizard implements refactor
2. **Review Phase 6 Report** - Validate success criteria met
3. **Compare with Phase 5** - Assess component reusability validation

### Phase 7 (Cleanup)
1. Remove any unused code from refactor
2. Update documentation
3. Create E2E tests for video capture workflow
4. Final review and project closeout

### Future Enhancements (Post-Project)
1. Add dynamic aspect ratio detection for CRT clip-path
2. Add keyboard shortcuts for CRT controls
3. Add more CRT presets (vintage, arcade, etc.)
4. Consider persisting CRT settings globally vs per-device

---

## 🎯 Key Takeaways

### Why This Phase Matters

**Validation of Reusability**: Phase 5 proved the components work in a complex scenario (fullscreen dialog with full CRT). Phase 6 proves they work in a simpler scenario (embedded preview with limited CRT). This validates true component reusability.

**Configuration Flexibility**: Using different configs (`scanlines` vs `full`) demonstrates the config system works as designed—same components, different capabilities based on context.

**Pattern Consistency**: Following the same architectural patterns from Phase 5 ensures maintainability and reduces cognitive load for future developers.

### Success Metrics

If Phase 6 completes successfully:
- ✅ Components proven reusable across contexts
- ✅ Configuration system validated (scanlines vs full)
- ✅ Template/SCSS reduction demonstrated again
- ✅ CRT effects available in embedded preview
- ✅ Consistent user experience (CRT in preview + dialog)
- ✅ Ready for Phase 7 cleanup and project closeout

---

**Document Version**: 1.0  
**Created**: November 28, 2025  
**Status**: Ready for Implementation  
**Next Action**: Hand off to UI Wizard for execution
