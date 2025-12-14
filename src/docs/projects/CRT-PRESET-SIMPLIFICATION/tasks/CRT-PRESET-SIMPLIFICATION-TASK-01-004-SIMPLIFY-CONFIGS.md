# Task Handoff: Simplify CRT Configs

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-004-SIMPLIFY-CONFIGS  
**Task Name**: Simplify CRT Configs  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: Medium  
**Estimated Context Size**: Medium (~60 lines modified)

---

## 🎯 Objective

**What**: Reduce `CRT_CONFIGS` from four variants (full, standard, small, none) to three meaningful variants (small, large, none) that match actual component usage patterns.

**Why**: The current `standard` and `small` configs are identical (both hide curvature), causing confusion and config drift. Simplifying to size-based naming (small/large) aligns with the new preset system and eliminates redundancy.

**Success Criteria**:
- [ ] `CRT_CONFIGS` contains exactly 3 entries (small, large, none)
- [ ] `small` config has `showCurvature: false` (all other controls visible)
- [ ] `large` config has `showCurvature: true` (all controls visible)
- [ ] `none` config has all show properties set to false
- [ ] JSDoc comments clarify usage contexts
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Task 01-001: Domain preset keys updated
- Task 01-002: UI preset definitions updated
- Task 01-003: Preset labels updated

**Dependencies**:
- `CrtSettingsConfig` interface from UI layer (unchanged)
- Components consuming configs (will be updated in Phase 2)

**Constraints**:
- Config structure must match `CrtSettingsConfig` interface
- Only change config keys and values, not the interface itself
- Components using old config keys will break (Phase 2 fixes this)

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update CRT_CONFIGS object

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - CrtSettingsConfig interface
- Component files that reference configs (updated in Phase 2):
  - `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
  - `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
  - `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT system documentation

### Current Implementation

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

The file currently contains a `CRT_CONFIGS` object with 4 entries:

```typescript
export const CRT_CONFIGS = {
  full: {
    showScanlines: true,
    showVignette: true,
    showCurvature: true,      // Only 'full' shows curvature
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
  standard: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,     // 'standard' hides curvature
    // ... all true except curvature
  },
  small: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,     // 'small' hides curvature (IDENTICAL to 'standard')
    // ... all true except curvature
  },
  none: {
    // All properties false
  },
};
```

**Problem**: `standard` and `small` are identical - this is config drift.

### Required Changes

**Remove Redundant Configs**:

Delete `full` and `standard` entries.

**Keep and Rename**:

- Keep `small` config unchanged (showCurvature: false)
- Rename `full` to `large` (showCurvature: true)
- Keep `none` config unchanged (all false)

**New Structure**:

```typescript
export const CRT_CONFIGS: Record<string, CrtSettingsConfig> = {
  small: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,              // Hide curvature for compact displays
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
  large: {
    showScanlines: true,
    showVignette: true,
    showCurvature: true,               // Show curvature for fullscreen displays
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
  none: {
    showScanlines: false,
    showVignette: false,
    showCurvature: false,
    showColorFilters: false,
    showPhosphor: false,
    showBloom: false,
    showDistortion: false,
    showChromaticAberration: false,
  },
};
```

**Update JSDoc**:

```typescript
/**
 * CRT settings panel configuration variants.
 * 
 * Controls which sliders and controls are visible in the settings panel.
 * 
 * - small: For compact displays (file-image, video-capture)
 *   - Hides curvature control (not relevant for small displays)
 *   - Shows all other controls
 * 
 * - large: For fullscreen displays (video-dialog)
 *   - Shows all controls including curvature
 *   - Full immersive CRT experience
 * 
 * - none: Completely hides settings panel
 *   - All controls disabled
 *   - Edge case for completely static CRT effects
 */
```

**Component Impact Note**:

Add a comment noting that Phase 2 will update component references:

```typescript
/**
 * NOTE: Components currently reference old config keys ('full', 'standard').
 * Phase 2 will update all component references to use 'small' and 'large'.
 */
```

### Anti-Patterns to Avoid

- ❌ **Don't modify the interface** - Only change the config object, not `CrtSettingsConfig` type
- ❌ **Don't create new configs** - Only rename and remove existing ones
- ❌ **Don't change property semantics** - `showCurvature: false` still means "hide curvature slider"
- ❌ **Don't fix component references here** - Phase 2 handles component updates

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Update/create tests in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts`:

1. **Verify config count**: CRT_CONFIGS has exactly 3 entries
2. **Verify config keys**: Keys are 'small', 'large', 'none'
3. **Verify small config**: showCurvature is false, all others true
4. **Verify large config**: all show properties are true
5. **Verify none config**: all show properties are false
6. **Verify complete structure**: Each config has all CrtSettingsConfig properties

**Test Pattern Example**:

```typescript
describe('CRT_CONFIGS', () => {
  it('should have exactly 3 config variants', () => {
    expect(Object.keys(CRT_CONFIGS)).toHaveLength(3);
  });

  it('should have small, large, and none variants', () => {
    expect(CRT_CONFIGS.small).toBeDefined();
    expect(CRT_CONFIGS.large).toBeDefined();
    expect(CRT_CONFIGS.none).toBeDefined();
  });

  it('should hide curvature in small config', () => {
    expect(CRT_CONFIGS.small.showCurvature).toBe(false);
    
    // But other controls should be visible
    expect(CRT_CONFIGS.small.showScanlines).toBe(true);
    expect(CRT_CONFIGS.small.showVignette).toBe(true);
  });

  it('should show all controls in large config', () => {
    const allTrue = Object.values(CRT_CONFIGS.large).every(val => val === true);
    expect(allTrue).toBe(true);
  });

  it('should hide all controls in none config', () => {
    const allFalse = Object.values(CRT_CONFIGS.none).every(val => val === false);
    expect(allFalse).toBe(true);
  });

  it('should have complete CrtSettingsConfig structure', () => {
    const requiredProps = ['showScanlines', 'showVignette', 'showCurvature',
                           'showColorFilters', 'showPhosphor', 'showBloom',
                           'showDistortion', 'showChromaticAberration'];
    
    Object.values(CRT_CONFIGS).forEach(config => {
      requiredProps.forEach(prop => {
        expect(config).toHaveProperty(prop);
      });
    });
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors for config definitions
- [ ] Components using old config keys show TypeScript errors (expected, Phase 2 fixes)

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-004-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed
2. ✅ All testing subtasks completed
3. 📝 Test results (pass/fail summary)
4. 📝 Config count verification (4 → 3 reduction)
5. 📝 Component TypeScript errors noted (expected for Phase 2)
6. 📝 Any discoveries or issues encountered

**Handoff to Next Task**:

After completion, Task 01-005 (Update Default CRT Settings Reference) can begin. Configs are now simplified and ready for component integration in Phase 2.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Config drift resolution rationale

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)

**Related Files**:
- Current file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- Interface: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- Components (updated in Phase 2): file-image, video-capture, video-dialog components

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start (after Tasks 01-001 through 01-003 complete)  
**Next Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-005-DEFAULT-SETTINGS
