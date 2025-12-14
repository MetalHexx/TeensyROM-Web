# Task Handoff: Update Default CRT Settings Reference

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-005-DEFAULT-SETTINGS  
**Task Name**: Update Default CRT Settings Reference  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: Low  
**Estimated Context Size**: Small (~10 lines modified)

---

## 🎯 Objective

**What**: Update `DEFAULT_CRT_SETTINGS` constant to point to the new LARGE_WEBGL preset, maintaining the existing default behavior (fullscreen WebGL experience).

**Why**: This constant serves as the fallback when no CRT settings are provided. By pointing it to the new LARGE_WEBGL preset (which has identical values to the old FULLSCREEN_WEBGL), we maintain consistent default behavior throughout the refactoring.

**Success Criteria**:
- [ ] `DEFAULT_CRT_SETTINGS` references `CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]`
- [ ] Constant maintains same values as old FULLSCREEN_WEBGL preset
- [ ] JSDoc comment is clear about purpose
- [ ] Export is correct in module barrel
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Task 01-001: Domain preset keys updated (LARGE_WEBGL key exists)
- Task 01-002: UI preset definitions updated (LARGE_WEBGL preset defined)

**Dependencies**:
- `CRT_PRESET_KEYS` from domain layer
- `CRT_PRESETS` from UI layer

**Constraints**:
- Must maintain same values as old FULLSCREEN_WEBGL (no behavior change)
- Simple reference update (one line change)

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update DEFAULT_CRT_SETTINGS constant

**Files to Review** (for context):
- Components using DEFAULT_CRT_SETTINGS as fallback (see where it's imported)

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns

### Current Implementation

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

The file currently contains:

```typescript
export const DEFAULT_CRT_SETTINGS: CrtSettings = 
  CRT_PRESETS[CRT_PRESET_KEYS.FULLSCREEN_WEBGL];
```

This constant is used as a fallback when:
- No saved settings exist for a component
- Settings fail to load from storage
- Component needs a sensible default

### Required Changes

**Update Reference**:

Change from old FULLSCREEN_WEBGL to new LARGE_WEBGL:

```typescript
export const DEFAULT_CRT_SETTINGS: CrtSettings = 
  CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL];
```

**Update JSDoc (if exists)**:

```typescript
/**
 * Default CRT settings used as fallback when no saved settings exist.
 * 
 * Uses LARGE_WEBGL preset for best visual quality:
 * - Full screen curvature and scanlines
 * - WebGL rendering with phosphor patterns
 * - Strong vignette for immersion
 * 
 * Components may override this with their own defaults.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = 
  CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL];
```

**Verify Export**:

Check that `DEFAULT_CRT_SETTINGS` is exported in barrel file:

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/index.ts
export { DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';
```

### Anti-Patterns to Avoid

- ❌ **Don't copy values inline** - Keep it as a reference to CRT_PRESETS
- ❌ **Don't change to a different preset** - Must stay equivalent to old FULLSCREEN_WEBGL
- ❌ **Don't modify the values** - Phase 3 handles value tuning
- ❌ **Don't remove the constant** - Other code depends on it as a fallback

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Update/create tests in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts`:

1. **Verify reference**: DEFAULT_CRT_SETTINGS equals CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]
2. **Verify structure**: DEFAULT_CRT_SETTINGS is a valid CrtSettings object
3. **Verify properties**: Has all required CrtSettings properties
4. **Verify WebGL mode**: renderMode is 'webgl'
5. **Verify curvature**: screenCurvature is 115 (large preset characteristic)

**Test Pattern Example**:

```typescript
describe('DEFAULT_CRT_SETTINGS', () => {
  it('should reference LARGE_WEBGL preset', () => {
    expect(DEFAULT_CRT_SETTINGS).toBe(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]);
  });

  it('should be a valid CrtSettings object', () => {
    expect(DEFAULT_CRT_SETTINGS).toBeDefined();
    expect(typeof DEFAULT_CRT_SETTINGS).toBe('object');
  });

  it('should have WebGL render mode', () => {
    expect(DEFAULT_CRT_SETTINGS.renderMode).toBe('webgl');
  });

  it('should have large preset characteristics', () => {
    expect(DEFAULT_CRT_SETTINGS.screenCurvature).toBe(115);
    expect(DEFAULT_CRT_SETTINGS.phosphorPattern).toBe('aperture-grille');
  });

  it('should have all required CrtSettings properties', () => {
    const requiredProps = ['scanlineIntensity', 'scanlineSize', 'vignetteStrength',
                           'screenCurvature', 'renderMode', 'phosphorPattern',
                           'contrast', 'brightness', 'saturation', 'hue',
                           'bloomEnabled', 'bloomIntensity', 'bloomRadius',
                           'barrelDistortion', 'chromaticAberration'];
    
    requiredProps.forEach(prop => {
      expect(DEFAULT_CRT_SETTINGS).toHaveProperty(prop);
    });
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors
- [ ] Export is available from barrel file

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-005-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed
2. ✅ All testing subtasks completed
3. ✅ Test results (pass/fail summary)
4. 📝 Verification that values match old FULLSCREEN_WEBGL
5. 📝 Any discoveries or issues encountered

**Handoff to Next Task**:

After completion, Task 01-006 (Update Type Exports and Interfaces) can begin. Default settings constant is now updated.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Project overview

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)

**Related Files**:
- Current file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- Barrel export: `libs/ui/components/src/lib/crt-effect-wrapper/index.ts`
- Domain keys: `libs/domain/src/lib/models/crt-preset-names.const.ts`

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start (after Tasks 01-001 and 01-002 complete)  
**Next Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-006-TYPE-EXPORTS
