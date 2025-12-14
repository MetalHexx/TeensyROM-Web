# Task Handoff: Update Domain Preset Keys

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-001-DOMAIN-PRESET-KEYS  
**Task Name**: Update Domain Preset Keys  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: High (Foundation task - blocks all other Phase 1 tasks)  
**Estimated Context Size**: Small (~50 lines modified)

---

## 🎯 Objective

**What**: Modify the domain layer's `CRT_PRESET_KEYS` constant from six context-based keys to four size-based keys.

**Why**: Establishes the foundation for the simplified preset system. Domain layer defines the source of truth for preset identifiers, and all other code imports these constants via type-safe references.

**Success Criteria**:
- [ ] `CRT_PRESET_KEYS` contains exactly 4 properties (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL)
- [ ] All key values use 'default-' prefix and follow kebab-case naming
- [ ] `PresetKey` type correctly derives from updated keys
- [ ] JSDoc comments reflect new size-based naming convention
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- None (first task in Phase 1)

**Dependencies**:
- TypeScript strict mode enabled
- Domain layer follows Clean Architecture constraints (no external dependencies)

**Constraints**:
- Must maintain `CRT_PRESET_PREFIX.DEFAULT` unchanged (`'default-'`)
- Keys must be string literals for type-safety
- Cannot break barrel export pattern (`index.ts`)

---

## 📂 File Scope

**Files to Modify**:
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Update CRT_PRESET_KEYS object (remove 6 old keys, add 4 new keys)
- `libs/domain/src/lib/models/index.ts` - Verify barrel export (should not need changes)

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Shows how preset keys are consumed (will be updated in later tasks)

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions, constant naming
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing approach
- [Domain Model Refactor](../../../features/DOMAIN_MODEL_REFACTOR.md) - Domain layer patterns

### Current Implementation

**File**: `libs/domain/src/lib/models/crt-preset-names.const.ts`

The file currently contains:

```typescript
export const CRT_PRESET_PREFIX = {
  DEFAULT: 'default-',
  CUSTOM: 'custom-',
} as const;

export const CRT_PRESET_KEYS = {
  FULLSCREEN_CSS: `${CRT_PRESET_PREFIX.DEFAULT}fullscreen-css`,
  FULLSCREEN_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}fullscreen-webgl`,
  DIALOG_CSS: `${CRT_PRESET_PREFIX.DEFAULT}dialog-css`,
  DIALOG_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}dialog-webgl`,
  IMAGE_CSS: `${CRT_PRESET_PREFIX.DEFAULT}image-css`,
  IMAGE_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}image-webgl`,
} as const;

export type PresetKey = (typeof CRT_PRESET_KEYS)[keyof typeof CRT_PRESET_KEYS];
```

### Required Changes

**Update CRT_PRESET_KEYS**:

Remove all 6 existing keys and replace with 4 new size-based keys:

- `SMALL_CSS` → `'default-small-css'`
- `SMALL_WEBGL` → `'default-small-webgl'`
- `LARGE_CSS` → `'default-large-css'`
- `LARGE_WEBGL` → `'default-large-webgl'`

**Key Pattern**:
```typescript
SMALL_CSS: `${CRT_PRESET_PREFIX.DEFAULT}small-css`
```

**Update JSDoc**:

Change documentation from context-based (fullscreen/dialog/image) to size-based (small/large) naming:

```typescript
/**
 * Built-in CRT preset identifiers using size-based naming.
 * 
 * Small presets: Optimized for compact displays (thumbnails, video-capture)
 * Large presets: Optimized for fullscreen displays (video-dialog, fullscreen images)
 * 
 * Each variant has CSS and WebGL sub-variants for render mode compatibility.
 */
```

**Verify PresetKey Type**:

The `PresetKey` type should automatically update to include the new keys. No manual changes needed - TypeScript's mapped type handles this.

### Anti-Patterns to Avoid

- ❌ **Don't hardcode strings** - Use template literals with `CRT_PRESET_PREFIX.DEFAULT`
- ❌ **Don't change CRT_PRESET_PREFIX** - It's used throughout the codebase
- ❌ **Don't add runtime logic** - This is a pure constant definition file
- ❌ **Don't add new exports** - Keep surface area minimal (only constants and type)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Create/update tests in `libs/domain/src/lib/models/crt-preset-names.const.spec.ts`:

1. **Verify key count**: CRT_PRESET_KEYS has exactly 4 properties
2. **Verify key names**: Properties are SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL
3. **Verify key values**: All values start with 'default-' prefix
4. **Verify key format**: All values follow 'default-{size}-{mode}' pattern
5. **Verify PresetKey type**: Type includes all four string literal values

**Test Pattern Example**:

```typescript
describe('CRT_PRESET_KEYS', () => {
  it('should have exactly 4 preset keys', () => {
    expect(Object.keys(CRT_PRESET_KEYS)).toHaveLength(4);
  });

  it('should have size-based key names', () => {
    expect(CRT_PRESET_KEYS.SMALL_CSS).toBeDefined();
    expect(CRT_PRESET_KEYS.SMALL_WEBGL).toBeDefined();
    expect(CRT_PRESET_KEYS.LARGE_CSS).toBeDefined();
    expect(CRT_PRESET_KEYS.LARGE_WEBGL).toBeDefined();
  });

  it('should use default prefix for all keys', () => {
    Object.values(CRT_PRESET_KEYS).forEach(key => {
      expect(key).toMatch(/^default-/);
    });
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors
- [ ] Barrel export (`index.ts`) re-exports constants correctly

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-001-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed (from Phase 1 document)
2. ✅ All testing subtasks completed
3. 📝 Test results (pass/fail summary)
4. 📝 Any discoveries or issues encountered
5. 📝 Changes made to files (brief summary)

**Handoff to Next Task**:

After completion, Phase 1 Task 2 (Update UI Preset Definitions) can begin. That task depends on these updated domain constants.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Project overview

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Domain Model Refactor](../../../features/DOMAIN_MODEL_REFACTOR.md)

**Related Files**:
- Current file: `libs/domain/src/lib/models/crt-preset-names.const.ts`
- Consumer example: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start  
**Next Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-002-UI-PRESET-DEFINITIONS
