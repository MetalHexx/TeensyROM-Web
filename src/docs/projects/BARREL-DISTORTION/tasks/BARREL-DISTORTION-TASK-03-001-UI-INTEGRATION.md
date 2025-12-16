# Task Handoff: BARREL-DISTORTION-TASK-03-001-UI-INTEGRATION

## 📋 Task Identity

**Task ID**: BARREL-DISTORTION-TASK-03-001-UI-INTEGRATION  
**Task Name**: Add Barrel Distortion Slider to CRT Settings Panel  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (4 files modified)

---

## 🎯 Objective

**What**: Add a new barrel distortion slider to the `crt-settings-panel` component, positioned between vignette and screen curvature controls in the visual effects group.

**Why**: Complete the barrel distortion feature by providing users with a UI control to adjust distortion intensity. This is the final piece connecting the domain model (Phase 1) and WebGL shader (Phase 2) to the user interface.

**Success Criteria**:
- [ ] `DISTORTION_SLIDER` configuration added to `crt-slider-configs.ts` with correct properties
- [ ] Slider exported from `crt-slider-configs.ts` for component use
- [ ] Distortion slider rendered in template between vignette and curvature sliders
- [ ] Slider respects `config().showDistortion` flag for conditional visibility
- [ ] Slider value changes emit `settingsChange` event with updated `barrelDistortion` value
- [ ] All unit tests pass with new slider tests added
- [ ] Linting passes with no errors
- [ ] No TypeScript compilation errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION: `CrtSettings` interface includes `barrelDistortion` property
- BARREL-DISTORTION-TASK-02-001: WebGL shader implements barrel distortion effect
- BARREL-DISTORTION-TASK-02-002: CrtRenderer binds `barrelDistortion` uniform

**Dependencies**:
- `CrtSettings` interface (domain model) - already includes `barrelDistortion: number`
- `CrtSettingsConfig` interface - already includes `showDistortion: boolean` flag
- Existing slider configurations (`VIGNETTE_SLIDER`, `CURVATURE_SLIDER`) - patterns to follow

**Constraints**:
- Must follow existing slider configuration patterns for consistency
- Slider must use percentage format (0-0.5 mapped to 0%-50%)
- Position must be between vignette and curvature for logical grouping
- Must respect `config().showDistortion` flag for visibility

---

## 📁 File Scope

**Files to Modify**:

1. `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`
   - Add `DISTORTION_SLIDER` constant with `SliderConfig` properties
   - Export new slider constant

2. `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.spec.ts`
   - Add unit tests for `DISTORTION_SLIDER` configuration

3. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
   - Add distortion slider markup between vignette and curvature sliders
   - Wrap slider in `@if (config().showDistortion)` for conditional rendering
   - Update section comment to "Visual Effects (Vignette, Distortion, Curvature)"

4. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`
   - Add unit tests for distortion slider rendering
   - Add unit tests for visibility control via `config.showDistortion` flag
   - Add unit tests for value change emission

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Component logic (should not need changes)
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - `CrtSettings` and `CrtSettingsConfig` interfaces
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - CRT config defaults with `showDistortion` flag

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns and TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable UI components
- [Style Guide](../../../STYLE_GUIDE.md) - Global styles and utilities

### Key Requirements

#### 1. Slider Configuration (crt-slider-configs.ts)

Create `DISTORTION_SLIDER` constant with these properties:
- `key: 'barrelDistortion'` - maps to `CrtSettings.barrelDistortion` property
- `label: 'Barrel Distortion'` - display label above slider
- `min: 0` - minimum distortion (no effect)
- `max: 0.5` - maximum distortion (strong warping)
- `step: 0.01` - fine-grained control
- `format: 'percentage'` - display as percentage (0% to 50%)
- `decimalPlaces: 0` - integer percentage display

**Pattern to Follow**: Copy the exact structure of `VIGNETTE_SLIDER` or `CURVATURE_SLIDER` for consistency.

#### 2. Template Integration (crt-settings-panel.component.html)

**Positioning**:
- Locate the "Vignette & Curvature" section in the template
- Insert distortion slider between vignette slider and curvature slider
- Update section comment to "Visual Effects (Vignette, Distortion, Curvature)"

**Slider Markup**:
- Use the same slider markup pattern as existing sliders (vignette/curvature)
- Bind slider to `DISTORTION_SLIDER` config constant
- Wrap slider in `@if (config().showDistortion)` conditional
- Ensure slider uses `[(ngModel)]` binding to `settings().barrelDistortion`
- Ensure slider emits changes via `(ngModelChange)="onSettingChange('barrelDistortion', $event)"`

**Reference**: Find the vignette slider markup and duplicate its structure for distortion.

#### 3. Testing Requirements

**Slider Config Tests** (crt-slider-configs.spec.ts):
- Test `DISTORTION_SLIDER` has correct `key` property
- Test `DISTORTION_SLIDER` has correct `label` property
- Test `DISTORTION_SLIDER` has correct range (min: 0, max: 0.5)
- Test `DISTORTION_SLIDER` has correct step (0.01)
- Test `DISTORTION_SLIDER` has correct format ('percentage')

**Component Tests** (crt-settings-panel.component.spec.ts):
- Test slider renders when `config.showDistortion` is true
- Test slider is hidden when `config.showDistortion` is false
- Test slider displays correct label ("Barrel Distortion")
- Test slider value changes emit `settingsChange` event
- Test emitted event includes updated `barrelDistortion` value

**Pattern to Follow**: Copy test patterns from vignette or curvature slider tests.

### Anti-Patterns to Avoid

- ❌ Don't create new slider component - use existing Material slider with config
- ❌ Don't modify component TypeScript logic - all changes are config/template only
- ❌ Don't add slider outside the visual effects group - keep it with vignette/curvature
- ❌ Don't hardcode visibility - always use `config().showDistortion` flag
- ❌ Don't use different format than other sliders - follow percentage pattern

---

## 📖 Reference Materials

**Related Documentation**:
- [Barrel Distortion Master Plan](../BARREL-DISTORTION-MASTER-PLAN.md#phase-3) - Phase 3 overview
- [Phase 3 Plan](../phases/BARREL-DISTORTION-PHASE-03-SETTINGS-PANEL-UI.md) - Detailed phase plan
- [Phase 1 Report](../reports/BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION-report.md) - Domain model changes
- [Phase 2 Report](../reports/BARREL-DISTORTION-TASK-02-002-REPORT.md) - Shader implementation

**Related Tasks** (for context):
- BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION: Added `barrelDistortion` to `CrtSettings`
- BARREL-DISTORTION-TASK-02-001: Implemented barrel distortion in fragment shader
- BARREL-DISTORTION-TASK-02-002: Integrated shader with CrtRenderer

**Similar Implementations** (reference patterns):
- `VIGNETTE_SLIDER` config in `crt-slider-configs.ts` - Follow this exact pattern
- Vignette slider markup in `crt-settings-panel.component.html` - Copy markup structure
- Vignette slider tests in `crt-settings-panel.component.spec.ts` - Copy test patterns

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-03-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-03-001-REPORT.md`

---

## 🎯 Behavioral Testing Focus

> Test what users/consumers observe, not implementation details

**Observable Behaviors to Verify**:

1. **Configuration Correctness**:
   - `DISTORTION_SLIDER` has `key: 'barrelDistortion'`
   - Slider has correct range (0 to 0.5) and step (0.01)
   - Slider uses percentage format with 0 decimal places

2. **Template Rendering**:
   - Slider renders in template when `config.showDistortion` is true
   - Slider displays label "Barrel Distortion"
   - Slider is positioned between vignette and curvature sliders

3. **Visibility Control**:
   - Slider is visible when `config.showDistortion = true`
   - Slider is hidden when `config.showDistortion = false`

4. **Value Emission**:
   - Changing slider value emits `settingsChange` event
   - Emitted event contains updated `barrelDistortion` value
   - Value is correctly formatted as percentage

5. **Integration**:
   - Slider value binds to `settings().barrelDistortion`
   - Slider respects min/max/step constraints
   - Slider updates when settings input changes

---

## 💡 Implementation Tips

### Finding the Right Location

1. Open `crt-settings-panel.component.html`
2. Search for "Vignette & Curvature" comment or vignette slider
3. Locate the vignette slider markup block
4. Insert distortion slider markup immediately after vignette slider
5. Curvature slider should come after distortion slider

### Slider Markup Pattern

The existing sliders use this pattern:
```html
@if (config().showSomething) {
  <div class="slider-container">
    <label>{{ SLIDER_CONFIG.label }}</label>
    <mat-slider [min]="SLIDER_CONFIG.min" [max]="SLIDER_CONFIG.max" [step]="SLIDER_CONFIG.step">
      <input matSliderThumb [(ngModel)]="settings().property" (ngModelChange)="onSettingChange('property', $event)">
    </mat-slider>
    <span class="slider-value">{{ formatSliderValue(settings().property, SLIDER_CONFIG) }}</span>
  </div>
}
```

Follow this exact pattern for distortion slider, replacing:
- `config().showSomething` → `config().showDistortion`
- `SLIDER_CONFIG` → `DISTORTION_SLIDER`
- `settings().property` → `settings().barrelDistortion`
- `'property'` → `'barrelDistortion'`

### Testing Pattern

The existing tests use this pattern:
```typescript
it('should render slider when config flag is true', () => {
  component.config.set({ ...component.config(), showSomething: true });
  fixture.detectChanges();
  
  const slider = fixture.debugElement.query(By.css('.slider-container'));
  expect(slider).toBeTruthy();
});
```

Follow this pattern for distortion slider tests, using `showDistortion` flag.

---

## 🚀 Getting Started

### Step 1: Establish Baseline
```bash
# Run existing tests to establish baseline
pnpm nx test ui-components --testFile=crt-settings-panel.component.spec.ts --run
pnpm nx test ui-components --testFile=crt-slider-configs.spec.ts --run
```

### Step 2: Add Slider Configuration
1. Open `crt-slider-configs.ts`
2. Add `DISTORTION_SLIDER` constant (copy `VIGNETTE_SLIDER` pattern)
3. Export the constant
4. Add tests in `crt-slider-configs.spec.ts`

### Step 3: Update Template
1. Open `crt-settings-panel.component.html`
2. Find vignette slider block
3. Duplicate vignette slider markup
4. Modify for distortion (change references to `DISTORTION_SLIDER` and `barrelDistortion`)
5. Update section comment

### Step 4: Add Component Tests
1. Open `crt-settings-panel.component.spec.ts`
2. Find vignette slider tests
3. Duplicate test structure for distortion slider
4. Modify assertions for `showDistortion` flag and `barrelDistortion` property

### Step 5: Verify
```bash
# Run tests
pnpm nx test ui-components --testFile=crt-settings-panel.component.spec.ts
pnpm nx test ui-components --testFile=crt-slider-configs.spec.ts

# Run linting
pnpm nx lint ui-components

# Build to verify no TypeScript errors
pnpm nx build ui-components
```

---

## ⚠️ Critical Reminders

1. **Follow Existing Patterns**: This task is 95% copy-paste from vignette slider. Don't reinvent anything.

2. **Config Flag**: Always check `config().showDistortion` - this controls visibility.

3. **Property Name**: It's `barrelDistortion` (camelCase) in code, not `barrel-distortion`.

4. **Range**: 0 to 0.5, not 0 to 1. This matches the domain model and shader implementation.

5. **Format**: Percentage format, 0 decimal places. So 0.25 displays as "25%".

6. **Test First**: Run baseline tests before making changes to understand current state.

7. **Test Incrementally**: Test after each file change, don't wait until the end.

8. **Mark Progress**: Check off subtasks in the phase plan as you complete them.

---

## 📞 Questions or Blockers?

If you encounter issues:

1. **Config Flag Missing**: Verify `CrtSettingsConfig` includes `showDistortion` (should exist from Phase 1)
2. **Property Not Found**: Verify `CrtSettings` includes `barrelDistortion` (should exist from Phase 1)
3. **Tests Failing**: Check existing vignette/curvature slider tests for patterns
4. **Template Errors**: Ensure you're using Angular 19 control flow syntax (`@if`, not `*ngIf`)

Report any blockers in your completion report with details about what was attempted and what failed.

---

**Good luck! This is a straightforward task if you follow the existing patterns. When in doubt, copy from vignette slider.**
