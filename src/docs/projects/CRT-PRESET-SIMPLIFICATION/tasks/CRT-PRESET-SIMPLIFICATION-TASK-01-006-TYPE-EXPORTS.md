# Task Handoff: Update Type Exports and Interfaces

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-006-TYPE-EXPORTS  
**Task Name**: Update Type Exports and Interfaces  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: Medium  
**Estimated Context Size**: Small (~40 lines reviewed/modified)

---

## 🎯 Objective

**What**: Ensure all TypeScript type exports and interfaces correctly reflect the new preset structure, verifying that `BuiltInPresetName` and related types auto-update from the refactored constants.

**Why**: TypeScript's derived types (`BuiltInPresetName = keyof typeof CRT_PRESETS`) should automatically update when we change the underlying objects. This task verifies that assumption and ensures type guards still work correctly with new preset names.

**Success Criteria**:
- [ ] `BuiltInPresetName` type includes all 4 new preset keys
- [ ] `CustomPresetName` type still works with new structure
- [ ] `AnyPresetName` union type is correct
- [ ] `isBuiltInPreset()` type guard works with new preset names
- [ ] `isCustomPreset()` type guard works with new preset names
- [ ] Barrel exports are correct
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Task 01-001: Domain preset keys updated (4 new keys)
- Task 01-002: UI preset definitions updated (4 new presets)

**Dependencies**:
- `CRT_PRESETS` from UI layer (updated in Task 01-002)
- TypeScript mapped types and template literal types

**Constraints**:
- Types should auto-derive from updated constants (minimal manual changes)
- Type guard functions only check string prefixes ('default-' vs 'custom-') - logic unchanged
- Main goal: verify auto-updating works correctly

---

## 📂 File Scope

**Files to Review**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Type definitions and type guards

**Files to Modify** (only if needed):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Update JSDoc or fix issues
- `libs/ui/components/src/lib/crt-effect-wrapper/index.ts` - Verify barrel exports

**Files to Update Tests**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts` - Update type guard tests

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns

### Current Implementation

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

The file currently contains type definitions derived from CRT_PRESETS:

```typescript
/**
 * Built-in preset names derived from CRT_PRESETS keys.
 * Examples: 'default-fullscreen-css', 'default-image-webgl'
 */
export type BuiltInPresetName = keyof typeof CRT_PRESETS;

/**
 * Custom preset names start with 'custom-' prefix.
 * Examples: 'custom-My Preset', 'custom-Retro Gaming'
 */
export type CustomPresetName = `custom-${string}`;

/**
 * Union of all possible preset names (built-in or custom).
 */
export type AnyPresetName = BuiltInPresetName | CustomPresetName;

/**
 * Type guard to check if preset name is a built-in preset.
 */
export function isBuiltInPreset(name: string): name is BuiltInPresetName {
  return name.startsWith('default-');
}

/**
 * Type guard to check if preset name is a custom preset.
 */
export function isCustomPreset(name: string): name is CustomPresetName {
  return name.startsWith('custom-');
}
```

### Expected Behavior

**BuiltInPresetName Type**:

Since `BuiltInPresetName = keyof typeof CRT_PRESETS`, updating CRT_PRESETS in Task 01-002 should automatically update this type to:

```typescript
type BuiltInPresetName = 
  | 'default-small-css'
  | 'default-small-webgl'
  | 'default-large-css'
  | 'default-large-webgl';
```

**Type Guards**:

The type guard functions check string prefixes:
- `isBuiltInPreset()`: Returns true if name starts with 'default-'
- `isCustomPreset()`: Returns true if name starts with 'custom-'

These functions should work unchanged since new preset names still follow the 'default-' prefix pattern.

### Required Changes

**Likely No Code Changes Needed**:

If CRT_PRESETS was updated correctly in Task 01-002, TypeScript's type system handles the rest automatically. This task is primarily **verification**.

**Update JSDoc (if helpful)**:

Update examples in JSDoc comments to reference new preset names:

```typescript
/**
 * Built-in preset names derived from CRT_PRESETS keys.
 * Examples: 'default-small-css', 'default-large-webgl'
 */
export type BuiltInPresetName = keyof typeof CRT_PRESETS;
```

**Verify Barrel Exports**:

Check `libs/ui/components/src/lib/crt-effect-wrapper/index.ts`:

```typescript
export type { 
  BuiltInPresetName, 
  CustomPresetName, 
  AnyPresetName,
  CrtSettings,
  CrtSettingsConfig,
} from './crt-settings.interface';

export { 
  isBuiltInPreset, 
  isCustomPreset 
} from './crt-settings.interface';
```

### Anti-Patterns to Avoid

- ❌ **Don't manually redefine BuiltInPresetName** - Let TypeScript derive it from CRT_PRESETS
- ❌ **Don't change type guard logic** - Prefix checking still works with new names
- ❌ **Don't add new types** - Existing type structure is sufficient
- ❌ **Don't break backward compatibility** - CustomPresetName still works unchanged

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Update tests in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts`:

1. **Verify BuiltInPresetName includes new keys**:
   - Test that 'default-small-css' is assignable to BuiltInPresetName
   - Test that 'default-large-webgl' is assignable to BuiltInPresetName
   
2. **Verify old keys are rejected**:
   - Test that 'default-fullscreen-css' causes TypeScript error (compile-time check)
   
3. **Verify type guards with new names**:
   - `isBuiltInPreset('default-small-css')` returns true
   - `isBuiltInPreset('custom-My Preset')` returns false
   - `isCustomPreset('custom-My Preset')` returns true
   - `isCustomPreset('default-large-webgl')` returns false

4. **Verify CustomPresetName unchanged**:
   - 'custom-My Preset' is still valid CustomPresetName

**Test Pattern Example**:

```typescript
describe('BuiltInPresetName type', () => {
  it('should include new preset keys', () => {
    const smallCss: BuiltInPresetName = 'default-small-css';
    const smallWebGL: BuiltInPresetName = 'default-small-webgl';
    const largeCss: BuiltInPresetName = 'default-large-css';
    const largeWebGL: BuiltInPresetName = 'default-large-webgl';
    
    // If TypeScript compiles, these assignments are valid
    expect(smallCss).toBeDefined();
    expect(smallWebGL).toBeDefined();
    expect(largeCss).toBeDefined();
    expect(largeWebGL).toBeDefined();
  });
});

describe('Type Guards', () => {
  describe('isBuiltInPreset', () => {
    it('should return true for new built-in preset names', () => {
      expect(isBuiltInPreset('default-small-css')).toBe(true);
      expect(isBuiltInPreset('default-small-webgl')).toBe(true);
      expect(isBuiltInPreset('default-large-css')).toBe(true);
      expect(isBuiltInPreset('default-large-webgl')).toBe(true);
    });

    it('should return false for custom preset names', () => {
      expect(isBuiltInPreset('custom-My Preset')).toBe(false);
    });

    it('should return false for old preset names', () => {
      expect(isBuiltInPreset('default-fullscreen-css')).toBe(false);
    });
  });

  describe('isCustomPreset', () => {
    it('should return true for custom preset names', () => {
      expect(isCustomPreset('custom-My Preset')).toBe(true);
      expect(isCustomPreset('custom-Retro Gaming')).toBe(true);
    });

    it('should return false for built-in preset names', () => {
      expect(isCustomPreset('default-small-css')).toBe(false);
      expect(isCustomPreset('default-large-webgl')).toBe(false);
    });
  });
});

describe('AnyPresetName type', () => {
  it('should accept both built-in and custom preset names', () => {
    const builtIn: AnyPresetName = 'default-small-css';
    const custom: AnyPresetName = 'custom-My Preset';
    
    expect(builtIn).toBeDefined();
    expect(custom).toBeDefined();
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors
- [ ] Type guards work correctly with new preset names
- [ ] Old preset names are no longer valid BuiltInPresetName values

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-006-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed
2. ✅ All testing subtasks completed
3. ✅ Test results (pass/fail summary)
4. 📝 Verification that BuiltInPresetName auto-updated correctly
5. 📝 Type guard behavior verification
6. 📝 Any discoveries or issues encountered
7. 📝 **Phase 1 Complete** (this is the final task)

**Handoff to Phase 2**:

After completion, **Phase 1 is complete**. Phase 2 (Component Implementation) can begin. All structural refactoring of preset system is done.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Project overview
- [Phase 2 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md) - Next phase

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)

**Related Files**:
- Current file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- Barrel export: `libs/ui/components/src/lib/crt-effect-wrapper/index.ts`
- Test file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts`

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start (after Tasks 01-001 and 01-002 complete)  
**Next Phase**: Phase 2 - Component Implementation (after Phase 1 complete)
