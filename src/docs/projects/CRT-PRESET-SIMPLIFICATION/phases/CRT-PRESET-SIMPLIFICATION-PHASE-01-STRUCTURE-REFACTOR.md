# Phase 1: Preset Structure Refactoring

## 🎯 Objective

Refactor the CRT preset system from six context-based variants (Fullscreen/Dialog/Image × CSS/WebGL) to four size-based variants (Small/Large × CSS/WebGL). Update domain layer constants, UI layer preset definitions, config objects, and labels. This phase focuses purely on structural changes without modifying component implementations, ensuring a clean foundation for Phase 2.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Complete project overview
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Current CRT system documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable component catalog

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
├── crt-preset-names.const.ts               📝 Modified - Update CRT_PRESET_KEYS to 4 variants
└── index.ts                                📝 Modified - Re-export updated constants

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.defaults.ts                📝 Modified - Update CRT_PRESETS, CRT_CONFIGS, labels
├── crt-settings.interface.ts               📝 Modified - Update type exports if needed
└── index.ts                                📝 Modified - Re-export updated types

libs/ui/components/src/lib/crt-settings-panel/
└── crt-settings-panel.component.ts         📝 Modified - Update imports/exports if needed

Tests:
├── crt-settings.interface.spec.ts          📝 Modified - Update test expectations
├── crt-settings-panel.component.spec.ts    📝 Modified - Update preset dropdown tests
└── (component tests will be updated in Phase 2)
```

---

<details open>
<parameter name="summary"><h3>Task 1: Update Domain Preset Keys</h3></summary>

**Purpose**: Modify the domain layer's `CRT_PRESET_KEYS` constant from six context-based keys to four size-based keys, establishing the foundation for the simplified preset system.

**Related Documentation:**

- [Master Plan - Architecture Overview](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#architecture-overview)
- [Domain Models](../../../../libs/domain/src/lib/models/crt-preset-names.const.ts)

**Implementation Subtasks:**

- [x] **Update CRT_PRESET_KEYS object** in `libs/domain/src/lib/models/crt-preset-names.const.ts`
  - Remove: `FULLSCREEN_CSS`, `FULLSCREEN_WEBGL`, `DIALOG_CSS`, `DIALOG_WEBGL`, `IMAGE_CSS`, `IMAGE_WEBGL`
  - Add: `SMALL_CSS`, `SMALL_WEBGL`, `LARGE_CSS`, `LARGE_WEBGL`
  - Values should be: `default-small-css`, `default-small-webgl`, `default-large-css`, `default-large-webgl`
- [x] **Verify PresetKey type** is correctly derived from updated `CRT_PRESET_KEYS`
- [x] **Update JSDoc comments** to reflect new size-based naming convention
- [x] **Verify barrel export** in `libs/domain/src/lib/models/index.ts` is correct

**Testing Subtask:**

- [x] **Write Tests**: Verify preset key values and types (see Testing section below)

**Key Implementation Notes:**

- Maintain `CRT_PRESET_PREFIX.DEFAULT` unchanged (`'default-'`)
- New keys follow pattern: `${CRT_PRESET_PREFIX.DEFAULT}small-css`, etc.
- All keys must remain string literals for type-safety
- TypeScript's `typeof` ensures `PresetKey` type automatically updates

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [x] **CRT_PRESET_KEYS object has exactly 4 properties** (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL)
- [x] **Each key value starts with 'default-' prefix**
- [x] **PresetKey type includes all four key values**
- [x] **Type guard functions work with new keys** (if any exist referencing old keys)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for unit testing patterns

**✅ Task 1 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-001-COMPLETION.md)

</details>

---

<details open>
<parameter name="summary"><h3>Task 2: Update UI Preset Definitions</h3></summary>

**Purpose**: Refactor `CRT_PRESETS` object in the UI layer to use new key structure with appropriate values inherited from existing IMAGE and FULLSCREEN presets.

**Related Documentation:**

- [Master Plan - Preset Value Inheritance](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#key-design-decisions)
- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [x] **Remove old preset definitions** from `CRT_PRESETS` object (6 presets)
- [x] **Add SMALL_CSS preset** - Inherit values from current `IMAGE_CSS` (scanlineIntensity: 0.3, scanlineSize: 1.5, vignetteStrength: 0.7, screenCurvature: 0, renderMode: 'css')
- [x] **Add SMALL_WEBGL preset** - Inherit values from current `IMAGE_WEBGL` with phosphor pattern
- [x] **Add LARGE_CSS preset** - Inherit values from current `FULLSCREEN_CSS` (scanlineIntensity: 0.6, scanlineSize: 2.5, vignetteStrength: 1.5, screenCurvature: 115, renderMode: 'css')
- [x] **Add LARGE_WEBGL preset** - Inherit values from current `FULLSCREEN_WEBGL` with phosphor pattern
- [x] **Update JSDoc comments** to reflect size-based usage (Small for compact displays, Large for fullscreen)

**Testing Subtask:**

- [x] **Write Tests**: Verify preset objects have required properties and correct values

**Key Implementation Notes:**

- Small presets: No screen curvature (screenCurvature: 0), suitable for compact displays
- Large presets: Include screen curvature (screenCurvature: 115), suitable for fullscreen immersion
- WebGL variants include phosphor patterns (aperture-grille) and phosphorIntensity
- CSS variants set phosphorPattern to 'none' and phosphorIntensity to 0
- All presets include complete CrtSettings structure (no partial objects)

**Critical Type Structure**:

```typescript
// Each preset must satisfy CrtSettings interface
{
  scanlineIntensity: number;
  scanlineSize: number;
  vignetteStrength: number;
  screenCurvature: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  renderMode: 'css' | 'webgl';
  phosphorPattern: 'aperture-grille' | 'none';
  phosphorIntensity: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomRadius: number;
  barrelDistortion: number;
  chromaticAberration: number;
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [x] **Each preset object contains all required CrtSettings properties**
- [x] **Small presets have screenCurvature: 0**
- [x] **Large presets have screenCurvature: 115**
- [x] **CSS presets have renderMode: 'css' and phosphorPattern: 'none'**
- [x] **WebGL presets have renderMode: 'webgl' and phosphorPattern: 'aperture-grille'**
- [x] **CRT_PRESETS object satisfies Record<string, CrtSettings> type constraint**

**Testing Reference:**

- See existing tests in `crt-settings.interface.spec.ts` for patterns

**✅ Task 2 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-002-COMPLETION.md)

</details>

---

<details open>
<parameter name="summary"><h3>Task 3: Update Preset Labels</h3></summary>

**Purpose**: Update `CRT_PRESET_LABELS` to provide human-readable names for the new simplified presets in dropdown menus and UI displays.

**Related Documentation:**

- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [x] **Remove old label mappings** for 6 old preset keys
- [x] **Add label for SMALL_CSS**: `'Small (CSS)'`
- [x] **Add label for SMALL_WEBGL**: `'Small (WebGL)'`
- [x] **Add label for LARGE_CSS**: `'Large (CSS)'`
- [x] **Add label for LARGE_WEBGL**: `'Large (WebGL)'`
- [x] **Verify CrtPresetName type** correctly constrains label keys
- [x] **Update JSDoc comment** to reflect usage in dropdown menus

**Testing Subtask:**

- [x] **Write Tests**: Verify label keys match CRT_PRESET_KEYS

**✅ Task 3 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-003-COMPLETION.md)

**Key Implementation Notes:**

- Labels should be concise and self-explanatory
- Format: `Size (RenderMode)` for consistency
- Type safety ensures every preset key has a corresponding label
- Labels are used by settings panel dropdown component

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [x] **CRT_PRESET_LABELS has exactly 4 entries**
- [x] **Each label key matches a CRT_PRESET_KEYS value**
- [x] **Label values are human-readable strings**
- [x] **No orphaned labels for old preset keys**

**Testing Reference:**

- Simple object structure test, verify keys and value formats

</details>

---

<details open>
<parameter name="summary"><h3>Task 4: Simplify CRT Configs</h3></summary>

**Purpose**: Reduce `CRT_CONFIGS` from four variants (full, standard, small, none) to three meaningful variants (small, large, none) that match actual component usage patterns.

**Related Documentation:**

- [Master Plan - Config Drift Resolution](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#design-considerations)
- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [x] **Remove `standard` config** (was identical to `small`, causing confusion)
- [x] **Keep `small` config** - showCurvature: false (all other controls visible)
- [x] **Rename `full` to `large`** - showCurvature: true (all controls visible)
- [x] **Keep `none` config** - all controls hidden (edge case for disabled settings panel)
- [x] **Update JSDoc comments** to clarify usage (small for compact displays, large for fullscreen)
- [x] **Verify type constraint** `Record<string, CrtSettingsConfig>` is satisfied

**Testing Subtask:**

- [x] **Write Tests**: Verify config structure and property values

**Key Implementation Notes:**

- `small` config: Hides curvature slider (not relevant for compact displays like thumbnails)
- `large` config: Shows all sliders including curvature (fullscreen contexts where curvature makes sense)
- `none` config: Rarely used, but maintained for completeness (completely hides settings panel controls)
- Component usage: file-image and video-capture use `small`, video-dialog uses `large`

**Critical Type Structure**:

```typescript
// CrtSettingsConfig controls which sliders appear in settings panel
{
  showScanlines: boolean;
  showVignette: boolean;
  showCurvature: boolean;
  showColorFilters: boolean;
  showPhosphor: boolean;
  showBloom: boolean;
  showDistortion: boolean;
  showChromaticAberration: boolean;
}
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [x] **CRT_CONFIGS has exactly 3 entries** (small, large, none)
- [x] **small config has showCurvature: false**
- [x] **large config has showCurvature: true**
- [x] **none config has all properties set to false**
- [x] **All other showX properties are true for small and large configs**

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for object structure tests

**✅ Task 4 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-004-COMPLETION.md)

</details>

---

<details open>
<parameter name="summary"><h3>Task 5: Update Default CRT Settings Reference</h3></summary>

**Purpose**: Update `DEFAULT_CRT_SETTINGS` constant to point to the new LARGE_WEBGL preset, maintaining the existing default behavior (fullscreen WebGL experience).

**Related Documentation:**

- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [x] **Update DEFAULT_CRT_SETTINGS** from `CRT_PRESETS[CRT_PRESET_KEYS.FULLSCREEN_WEBGL]` to `CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]`
- [x] **Verify export** is correct in module barrel
- [x] **Update JSDoc comment** if needed

**Testing Subtask:**

- [x] **Write Tests**: Verify DEFAULT_CRT_SETTINGS references correct preset

**Key Implementation Notes:**

- This constant is used as fallback when no settings are provided
- LARGE_WEBGL maintains the same values as old FULLSCREEN_WEBGL (no behavior change)
- Simple one-line change but important for maintaining defaults

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [x] **DEFAULT_CRT_SETTINGS equals CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]**
- [x] **DEFAULT_CRT_SETTINGS is a valid CrtSettings object**

**✅ Task 5 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-005-COMPLETION.md)

**Testing Reference:**

- Simple equality check, verify object reference

</details>

---

<details open>
<parameter name="summary"><h3>Task 6: Update Type Exports and Interfaces</h3></summary>

**Purpose**: Ensure all TypeScript type exports and interfaces correctly reflect the new preset structure, updating `BuiltInPresetName` and related types.

**Related Documentation:**

- [CRT Settings Interface](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts)
- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [x] **Verify BuiltInPresetName type** is correctly derived from `CRT_PRESETS` keys
- [x] **Check CustomPresetName type** still works with new structure
- [x] **Verify AnyPresetName union type** is correct
- [x] **Update barrel exports** in `index.ts` files if needed
- [x] **Review isBuiltInPreset() type guard** - should work unchanged
- [x] **Review isCustomPreset() type guard** - should work unchanged

**Testing Subtask:**

- [x] **Write Tests**: Verify type guards work with new preset names

**Key Implementation Notes:**

- `BuiltInPresetName` is derived from `keyof typeof CRT_PRESETS` - auto-updated ✅
- `CustomPresetName` uses template literal type with 'custom-' prefix - unchanged ✅
- Type guards check string prefixes ('default-' vs 'custom-') - unchanged logic ✅
- Main risk: Ensuring components using old preset names are caught by TypeScript ✅

**Testing Focus for Task 6:**

**Behaviors to Test:**

- [x] **isBuiltInPreset() returns true for 'default-small-css'**
- [x] **isBuiltInPreset() returns false for 'custom-My Preset'**
- [x] **isCustomPreset() returns true for 'custom-My Preset'**
- [x] **isCustomPreset() returns false for 'default-large-webgl'**
- [x] **BuiltInPresetName type includes all 4 new preset keys**

**✅ Task 6 Status: COMPLETE** - See [Completion Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-006-COMPLETION.md)

**Testing Reference:**

- See `crt-settings.interface.spec.ts` for existing type guard tests

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**

- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Update CRT_PRESET_KEYS (6 keys → 4 keys)
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update CRT_PRESETS, CRT_PRESET_LABELS, CRT_CONFIGS, DEFAULT_CRT_SETTINGS
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts` - Update test expectations
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Update preset dropdown tests

**No New Files**: This phase only refactors existing structures.

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Test Execution Commands

**Running Tests:**

```powershell
# Run tests for UI components library
pnpm nx test ui-components

# Run tests in watch mode during development
pnpm nx test ui-components --watch

# Run all tests
pnpm nx run-many --target=test --all
```

### Expected Test Updates

**Domain Layer Tests:**
- Verify `CRT_PRESET_KEYS` has exactly 4 properties with correct values
- Verify `PresetKey` type includes new keys

**UI Layer Tests:**
- Verify `CRT_PRESETS` object has 4 presets with complete CrtSettings structures
- Verify `CRT_PRESET_LABELS` has matching keys and readable values
- Verify `CRT_CONFIGS` has 3 configs (small, large, none) with correct properties
- Verify `DEFAULT_CRT_SETTINGS` references LARGE_WEBGL
- Verify type guards work with new preset names

**Settings Panel Tests:**
- Update tests that reference old preset names in dropdown expectations
- Verify preset selection emits correct new preset keys

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage maintained or improved

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint ui-components`)
- [ ] Code formatting is consistent
- [ ] No console errors when running application

**Documentation:**

- [ ] Inline code comments added for complex logic
- [ ] JSDoc comments updated for changed constants/types

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Components still compile (even though they use old preset keys - Phase 2 will fix)
- [ ] Ready to proceed to Phase 2 (Component Implementation)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Preset Value Inheritance**: Small presets inherit from IMAGE (subtle effects), Large presets inherit from FULLSCREEN (strong effects with curvature)
- **Config Consolidation**: Removed duplicate `standard` config that was identical to `small`, reducing confusion
- **Backward Compatibility**: Old preset keys may still exist in saved settings - they'll continue working until users switch to new presets

### Implementation Constraints

- **No Component Changes**: This phase only updates preset definitions, components continue using old key references (Phase 2 fixes)
- **Type Safety**: TypeScript will catch any hardcoded references to old preset keys in components
- **Test Isolation**: Focus on testing preset structure, not component behavior

### Phase Transition Notes

- **Components Will Show Errors**: After this phase, components importing old preset keys will have TypeScript errors - this is expected
- **Phase 2 Resolution**: Next phase updates all component references to new preset keys
- **No Functional Breaking**: The refactored presets are structurally compatible with existing CrtSettings interface

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>
