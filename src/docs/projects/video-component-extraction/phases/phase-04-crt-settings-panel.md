# Phase 4: CRT Settings Panel Component

## ✅ COMPLETED

**Status**: Implemented with enhanced flexibility via unified configuration model.

## 🎯 Objective

Extract CRT settings sliders into standalone `lib-crt-settings-panel` component. Makes settings UI reusable and independently testable, composable into the `leftControls` slot of `lib-content-overlay-container`.

---

## 📝 Implementation Decisions (Deviations from Original Plan)

### 🔄 Enhanced: Unified Configuration Model

**Original Plan**: Settings panel would show all 8 sliders unconditionally.

**What We Implemented**: Added `CrtSettingsConfig` interface with feature flags (`showScanlines`, `showVignette`, `showCurvature`, `showColorFilters`) that both `lib-crt-effect-wrapper` and `lib-crt-settings-panel` share.

**Rationale**: 
- Not all use cases need all settings (e.g., terminal might only want scanlines + color filters)
- Both components should work cohesively with the same configuration
- Feature flags provide flexibility without breaking changes

**New Exports**:
- `CrtSettingsConfig` - Interface for feature flags
- `CRT_CONFIGS` - Preset configs matching `CRT_PRESETS` (full, filtersOnly, scanlines, none)
- `DEFAULT_CRT_CONFIG` - Default with all features enabled

### 🔄 Enhanced: CrtEffectWrapper Updated

The `lib-crt-effect-wrapper` component was updated to:
- Accept a new `config: CrtSettingsConfig` input
- Use `effectiveSettings` computed signal that respects both settings and config
- Disabled effect groups apply neutral values (0 for overlays, 1 for filters)

---

## 📚 Required Reading

**Feature Documentation:**
- [x] [Master Plan](../master-plan.md) - Overall architecture and Phase 3 decisions
- [x] [Phase 2 Report](../reports/phase-02-report.md) - `CrtSettings` interface and `CRT_PRESETS`
- [x] [Phase 3 Report](../reports/phase-03-report.md) - 9-slot architecture and focus-within behavior

**Standards & Guidelines:**
- [x] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing component patterns
- [x] [Coding Standards](../../../CODING_STANDARDS.md) - Angular 19 patterns
- [x] [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach

**Reference Implementation:**
- [x] Current video-dialog CRT controls at `libs/features/player/.../video-dialog/video-dialog.component.html` lines 25-89

---

## 🔗 Integration with Phase 3

The settings panel will be composed in the `leftControls` slot of `lib-content-overlay-container`:

```html
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <!-- Content and other overlays -->
  
  <lib-crt-settings-panel leftControls
    [settings]="crtSettings()"
    [config]="CRT_CONFIGS.scanlines"
    [visible]="showCrtControls()"
    (settingsChange)="onCrtSettingsChange($event)"
    (resetRequested)="onResetSettings()">
  </lib-crt-settings-panel>
</lib-content-overlay-container>
```

**Key Behaviors from Phase 3:**
- Panel slides in from left edge when `visible` is true
- Panel stays visible while user interacts with sliders (`:focus-within`)
- Panel slides out when `visible` becomes false and sliders lose focus

---

## 📂 File Structure

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.interface.ts            📝 Updated - Added CrtSettingsConfig interface
│   ├── crt-settings.defaults.ts             📝 Updated - Added CRT_CONFIGS, DEFAULT_CRT_CONFIG
│   ├── crt-effect-wrapper.component.ts      📝 Updated - Added config input, effectiveSettings computed
│   ├── crt-effect-wrapper.component.html    📝 Updated - Uses effectiveSettings()
│   └── crt-effect-wrapper.component.spec.ts 📝 Updated - Config feature flag tests
├── crt-settings-panel/                      ✨ New folder
│   ├── crt-settings-panel.component.ts      ✨ New - Component with settings, config, visible inputs
│   ├── crt-settings-panel.component.html    ✨ New - Conditional sliders based on config
│   ├── crt-settings-panel.component.scss    ✨ New - Extracted styling from video-dialog
│   └── crt-settings-panel.component.spec.ts ✨ New - 24 behavioral tests

libs/ui/components/src/index.ts              📝 Updated - Added CrtSettingsPanelComponent export
docs/COMPONENT_LIBRARY.md                    📝 Updated - CRT Effect System section with both components
```

---

<details>
<summary><h3>✅ Task 1: Create Settings Panel Component</h3></summary>

**Purpose**: Standalone panel containing all 8 CRT sliders with proper ranges matching current implementation.

**Implementation Subtasks:**
- [x] Create component with signal inputs: `settings: CrtSettings`, `config: CrtSettingsConfig`, `visible: boolean`
- [x] Create outputs: `settingsChange`, `resetRequested`, `presetSelected`
- [x] Add header with title "CRT Effect"
- [x] Add all 8 sliders with labels, values, and proper min/max/step ranges
- [x] Import and use Angular Material `MatSliderModule`
- [x] **NEW**: Conditionally render sliders based on `config` input

**Slider Configurations** (from current video-dialog):

| Parameter | Min | Max | Step | Display |
|-----------|-----|-----|------|---------|
| Scanline Intensity | 0 | 0.5 | 0.01 | 2 decimals |
| Scanline Thickness | 1 | 4 | 1 | px suffix |
| Scanline Gap | 1 | 8 | 1 | px suffix |
| Vignette | 0 | 2 | 0.05 | 2 decimals |
| Screen Curvature | 0 | 115 | 5 | px suffix |
| Contrast | 0.8 | 1.5 | 0.05 | 2 decimals |
| Brightness | 0.8 | 1.5 | 0.05 | 2 decimals |
| Saturation | 0.8 | 1.5 | 0.05 | 2 decimals |

**Testing Subtask:**
- [x] **Write Tests**: Component creation, input binding, output emission (24 tests)

</details>

---

<details>
<summary><h3>✅ Task 2: Implement Change Emission Pattern</h3></summary>

**Purpose**: Emit updated settings on each slider change for real-time preview.

**Implementation Subtasks:**
- [x] On slider change, emit full `CrtSettings` object with updated value
- [x] Use spread operator to preserve unchanged values: `{ ...currentSettings, [key]: newValue }`
- [x] Debounce not needed - sliders provide their own throttling

**Implementation Notes:**
- Sliders use `[(ngModel)]` for local binding, then emit on `input` event
- Parent manages state - this component is pure presentation

**Testing Subtask:**
- [x] **Write Tests**: Slider change emits correct settings, multiple sliders work independently

**Behaviors to Test:**
- [x] Changing scanline intensity emits updated CrtSettings
- [x] Changing multiple values preserves other settings
- [x] Settings input updates slider positions

</details>

---

<details>
<summary><h3>✅ Task 3: Add Preset and Reset Controls</h3></summary>

**Purpose**: Quick access to preset configurations and reset to defaults.

**Implementation Subtasks:**
- [x] Add preset dropdown/button group for `CRT_PRESETS` (full, filtersOnly, scanlines, none)
- [x] Emit `presetSelected` with preset name when user selects a preset
- [x] Add reset button that emits `resetRequested`
- [x] Parent can handle reset by providing `DEFAULT_CRT_SETTINGS`

**Implementation Notes:**
- Keep controls compact - this panel will be in a side slot
- Icon-only buttons with tooltips for space efficiency

**Testing Subtask:**
- [x] **Write Tests**: Reset button emits, preset selection emits

**Behaviors to Test:**
- [x] Reset button emits `resetRequested` event
- [x] Preset buttons emit correct preset name

</details>

---

<details>
<summary><h3>✅ Task 4: Style for Side Panel Slot</h3></summary>

**Purpose**: Compact vertical layout suitable for `leftControls` slot.

**Implementation Subtasks:**
- [x] Use `lib-compact-card-layout` as container with `glassy-card` class
- [x] Stack sliders vertically with minimal padding
- [x] Slider labels on left, values on right (3-column grid)
- [x] Match current video-dialog styling (extracted from reference implementation)
- [x] Ensure sliders are full width for easy interaction

**Styling Considerations:**
- Panel slides in from left, so left edge should have no rounded corners
- Panel height should fit within overlay area (may need scroll for small screens)
- Use CSS variables for consistent spacing

**Testing Subtask:**
- [x] **Write Tests**: Component renders with all expected elements

</details>

---

<details>
<summary><h3>✅ Task 5: Document and Export</h3></summary>

**Purpose**: Add to component library documentation and export from barrel.

**Implementation Subtasks:**
- [x] Export component from `libs/ui/components/src/index.ts`
- [x] Add entry to `COMPONENT_LIBRARY.md` with:
  - Properties table (settings, config, visible)
  - Events table (settingsChange, resetRequested, presetSelected)
  - Usage examples (standalone, with overlay container)
  - Cohesive usage with `lib-crt-effect-wrapper`
- [x] **NEW**: Updated CrtEffectWrapper docs with config input

**Testing Subtask:**
- [x] Verify export works: `import { CrtSettingsPanelComponent } from '@teensyrom-nx/ui/components'`

</details>

---

## 🗂️ Files Modified or Created

**New Files:**
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

**Modified Files:**
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Added CrtSettingsConfig
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Added CRT_CONFIGS, DEFAULT_CRT_CONFIG
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Added config input
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html` - Uses effectiveSettings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts` - Config tests
- `libs/ui/components/src/index.ts` - New exports
- `docs/COMPONENT_LIBRARY.md` - CRT Effect System section

---

## 🧪 Testing Summary

**Testing Philosophy:** Behavioral testing - test what users observe, not implementation details.

**Test Categories:**

| Category | Tests |
|----------|-------|
| Component Creation | Creates with default/provided settings |
| Input Binding | Settings input updates slider values |
| Config-Based Rendering | Config flags control which sliders show |
| Output Emission | Slider changes emit updated settings |
| Preset Selection | Preset buttons emit correct preset |
| Reset | Reset button emits resetRequested |
| Rendering | Sliders render based on config flags |

**Actual Test Count:** 24 tests for CrtSettingsPanelComponent + 10 new tests for CrtEffectWrapper config

**Reference:** See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## ✅ Success Criteria

- [x] All 8 sliders functional with correct ranges (when config enables them)
- [x] `settings` input binds to slider values
- [x] `config` input controls which slider groups are shown
- [x] `settingsChange` output emits on slider changes
- [x] Preset selector works with all 4 presets
- [x] Reset button emits `resetRequested`
- [x] Compact styling suitable for side panel slot
- [x] All tests pass (357 total), lint passes
- [x] Component exported from `libs/ui/components`
- [x] Documentation added to `COMPONENT_LIBRARY.md`
- [x] **NEW**: CrtEffectWrapper updated with config support
- [x] **NEW**: Both components share cohesive configuration model

---

## 📊 Metrics

**Actual Size:** 
- 4 new files (CrtSettingsPanel)
- 5 modified files (CrtEffectWrapper + interface + defaults + barrel + docs)

**Dependencies:** 
- Phase 2 (CrtSettings interface, CRT_PRESETS, DEFAULT_CRT_SETTINGS)
- Phase 3 (leftControls slot in lib-content-overlay-container)

**Actual Test Count:** 
- CrtSettingsPanelComponent: 24 tests
- CrtEffectWrapperComponent: 29 tests (10 new for config)
- Total ui-components: 357 tests passing

---

## 📝 Notes

**Design Decision: Visible Input vs Conditional Rendering**

The parent component controls visibility via `[visible]` input rather than `@if`. This allows:
- Slide animation to work (element must exist to animate)
- Focus-within to persist visibility during interaction
- Simpler state management in parent

**Design Decision: Emit Full Settings Object**

Rather than emitting individual property changes, we emit the complete `CrtSettings` object. This:
- Simplifies parent state management
- Matches the `CrtSettings` interface pattern from Phase 2
- Allows parent to apply changes atomically

**Design Decision: Unified Configuration Model (NEW)**

Both `lib-crt-effect-wrapper` and `lib-crt-settings-panel` share the same `CrtSettingsConfig` interface. This:
- Ensures consistency between effects applied and controls shown
- Allows flexible use cases (scanlines only, filters only, full control)
- Uses feature flags (showScanlines, showVignette, showCurvature, showColorFilters)
- `CRT_CONFIGS` presets match `CRT_PRESETS` for easy pairing

