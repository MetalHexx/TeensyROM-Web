# Phase 4 Task Handoff: CRT Settings Panel Component

## 🎯 Subagent Task Assignment

---

### INPUT_DOC

**Task ID**: TASK-04-001-CRT-SETTINGS-PANEL  
**Task Name**: Create `lib-crt-settings-panel` Presentation Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4-8 files)

---

## 📝 Objective

**What**: Create a standalone CRT settings panel component (`lib-crt-settings-panel`) that provides slider controls for all 8 CRT effect parameters, with preset selection and reset functionality.

**Why**: Extract the inline CRT slider controls from `VideoDialogComponent` into a reusable, independently testable presentation component. This panel will be composed into the `leftControls` slot of `lib-content-overlay-container` (created in Phase 3).

**Success Criteria**:
- [ ] Component created with `settings` input and `settingsChange` output
- [ ] All 8 CRT parameter sliders with correct min/max/step ranges
- [ ] Preset selector works with `CRT_PRESETS` (full, filtersOnly, scanlines, none)
- [ ] Reset button emits `resetRequested` event
- [ ] Compact vertical layout suitable for side panel slot
- [ ] All unit tests pass (~15-20 tests)
- [ ] Component exported from `libs/ui/components`
- [ ] Documentation added to `COMPONENT_LIBRARY.md`

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- ✅ Phase 1: `lib-video-stream` component - [Phase 1 Report](../reports/phase-01-report.md)
- ✅ Phase 2: `lib-crt-effect-wrapper` with `CrtSettings` interface and `CRT_PRESETS` - [Phase 2 Report](../reports/phase-02-report.md)
- ✅ Phase 3: `lib-content-overlay-container` with 9 named slots including `leftControls` - [Phase 3 Report](../reports/phase-03-report.md)

**Dependencies**:
- `CrtSettings` interface from Phase 2: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- `CRT_PRESETS` and `DEFAULT_CRT_SETTINGS` from Phase 2: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- Angular Material `MatSliderModule` for slider controls
- `FormsModule` for `[(ngModel)]` two-way binding
- `CompactCardLayoutComponent` for container styling

**Constraints**:
- Component must be pure presentation (no store dependencies)
- Must work within `leftControls` slot of overlay container
- Must emit full `CrtSettings` object on changes (not individual properties)
- Should match existing CRT controls styling from video-dialog

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Component class
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Template with sliders
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Compact styling
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Behavioral tests

**Files to Modify**:
- `libs/ui/components/src/index.ts` - Add export
- `docs/COMPONENT_LIBRARY.md` - Add documentation entry

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - CrtSettings interface
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Presets and defaults
- `libs/features/player/.../video-dialog/video-dialog.component.html` (lines 25-89) - Current inline sliders
- `libs/ui/components/src/lib/content-overlay-container/` - Phase 3 component for integration context

---

## 🛠️ Implementation Guidance

### Component API

```typescript
// Signal inputs
settings = input.required<CrtSettings>();
visible = input<boolean>(true);

// Outputs
settingsChange = output<CrtSettings>();
resetRequested = output<void>();
presetSelected = output<keyof typeof CRT_PRESETS>();
```

### Slider Configurations

Extract these from current video-dialog implementation:

| Parameter | Property | Min | Max | Step | Label | Display Format |
|-----------|----------|-----|-----|------|-------|----------------|
| Scanline Intensity | `scanlineIntensity` | 0 | 0.5 | 0.01 | "Scanline Intensity" | 2 decimals |
| Scanline Thickness | `scanlineThickness` | 1 | 4 | 1 | "Scanline Thickness" | px suffix |
| Scanline Gap | `scanlineSpacing` | 1 | 8 | 1 | "Scanline Gap" | px suffix |
| Vignette | `vignetteStrength` | 0 | 2 | 0.05 | "Vignette" | 2 decimals |
| Screen Curvature | `screenCurvature` | 0 | 115 | 5 | "Screen Curvature" | px suffix |
| Contrast | `contrast` | 0.8 | 1.5 | 0.05 | "Contrast" | 2 decimals |
| Brightness | `brightness` | 0.8 | 1.5 | 0.05 | "Brightness" | 2 decimals |
| Saturation | `saturation` | 0.8 | 1.5 | 0.05 | "Saturation" | 2 decimals |

### Change Emission Pattern

On any slider change, emit the complete updated settings:

```typescript
onSliderChange(property: keyof CrtSettings, value: number) {
  this.settingsChange.emit({
    ...this.settings(),
    [property]: value
  });
}
```

### Preset Buttons

Add compact preset buttons or dropdown:

```typescript
onPresetSelect(presetName: keyof typeof CRT_PRESETS) {
  this.presetSelected.emit(presetName);
  this.settingsChange.emit(CRT_PRESETS[presetName]);
}
```

---

## 🎨 Styling Requirements

### Layout Structure

```
┌─────────────────────────────┐
│ CRT Effect                  │  ← Header
├─────────────────────────────┤
│ [Full][Filters][Scan][None] │  ← Preset buttons (compact)
├─────────────────────────────┤
│ Scanline Intensity   [0.50] │  ← Slider row
│ ━━━━━━━━━○━━━━━━━━━━━━━━━━━ │
├─────────────────────────────┤
│ Scanline Thickness     [3px]│
│ ━━━━━━━━━━━━━━━━○━━━━━━━━━━ │
├─────────────────────────────┤
│ ... 6 more sliders ...      │
├─────────────────────────────┤
│ [Reset to Defaults]         │  ← Reset button
└─────────────────────────────┘
```

### CSS Considerations

- Use `lib-compact-card-layout` with `glassy-card` class for container
- Match existing video-dialog CRT panel styling
- 3-column grid: label | slider | value
- Compact padding for side panel use
- No left border radius (slides in from left edge)

---

## 🧪 Testing Requirements

### Test Coverage Required

**Component Creation (3 tests)**:
- [ ] Should create successfully with required settings input
- [ ] Should have default visible as true
- [ ] Should render header with "CRT Effect" text

**Input Binding (4 tests)**:
- [ ] Should update slider values when settings input changes
- [ ] Each of 8 sliders reflects correct setting value
- [ ] Should handle settings with non-default values

**Output Emission (4 tests)**:
- [ ] Should emit settingsChange when slider value changes
- [ ] Emitted settings should contain all 8 properties
- [ ] Changed property should have new value
- [ ] Unchanged properties should preserve their values

**Preset Selection (4 tests)**:
- [ ] Should emit presetSelected with 'full' when full preset clicked
- [ ] Should emit settingsChange with CRT_PRESETS.full values
- [ ] Should work for all 4 presets (full, filtersOnly, scanlines, none)

**Reset Functionality (2 tests)**:
- [ ] Should emit resetRequested when reset button clicked
- [ ] Reset button should be visible and clickable

**Rendering (3 tests)**:
- [ ] Should render all 8 slider controls
- [ ] Should render preset buttons/dropdown
- [ ] Should render reset button

### Behavioral Expectations

- Slider changes emit immediately (no debounce needed)
- Parent manages state - component is pure presentation
- Focus on sliders should prevent overlay from hiding (tested in Phase 3)

---

## 📋 Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - Angular 19 patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Component Library](../../../COMPONENT_LIBRARY.md) - Existing component patterns

### Key Requirements

1. **Angular 19 Conventions**: Use `input()`, `output()` signal APIs
2. **Standalone Component**: No NgModule, self-contained imports
3. **Pure Presentation**: No injected services, no store access
4. **Accessibility**: Label sliders properly, keyboard navigation works

### Anti-Patterns to Avoid

- ❌ Don't inject any stores or services
- ❌ Don't manage settings state internally (parent owns state)
- ❌ Don't emit individual property changes (emit full object)
- ❌ Don't use `@Input()` / `@Output()` decorators (use signals)

---

## 📎 Reference Materials

**Related Documentation**:
- [Master Plan](../master-plan.md#pattern-4-settings-as-inputs) - Settings pattern
- [Phase 2 Report](../reports/phase-02-report.md) - CrtSettings interface details
- [Phase 3 Report](../reports/phase-03-report.md) - Integration with leftControls slot
- [Phase 4 Plan](../phases/phase-04-crt-settings-panel.md) - Detailed phase plan

**Similar Implementations**:
- Current inline sliders: `libs/features/player/.../video-dialog/video-dialog.component.html` lines 25-89
- `lib-compact-card-layout` usage examples in `COMPONENT_LIBRARY.md`

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/video-component-extraction/reports/phase-04-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/video-component-extraction/reports/phase-04-report.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
