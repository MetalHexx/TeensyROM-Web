# Task Handoff: Update Preset Labels

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-003-PRESET-LABELS  
**Task Name**: Update Preset Labels  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: Medium  
**Estimated Context Size**: Small (~30 lines modified)

---

## 🎯 Objective

**What**: Update `CRT_PRESET_LABELS` to provide human-readable names for the new simplified presets in dropdown menus and UI displays.

**Why**: Users see these labels in the CRT settings panel dropdown. Clear, consistent labeling helps users understand the difference between Small/Large and CSS/WebGL variants.

**Success Criteria**:
- [ ] `CRT_PRESET_LABELS` contains exactly 4 entries matching new preset keys
- [ ] Labels follow consistent format: "Size (RenderMode)"
- [ ] No orphaned labels for old preset keys
- [ ] Type safety ensures every preset key has a corresponding label
- [ ] JSDoc comments reflect usage in dropdown menus
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Task 01-001: Domain preset keys updated (CRT_PRESET_KEYS has 4 keys)
- Task 01-002: UI preset definitions updated (CRT_PRESETS has 4 presets)

**Dependencies**:
- `CRT_PRESET_KEYS` from domain layer
- `CrtPresetName` type from UI layer (derives from CRT_PRESET_KEYS)

**Constraints**:
- Label keys must match CRT_PRESET_KEYS values exactly
- Labels must be concise and self-explanatory
- Type constraint ensures no missing or extra labels

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update CRT_PRESET_LABELS object

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Component that displays these labels in dropdown
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Preset key constants

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT system documentation

### Current Implementation

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

The file currently contains a `CRT_PRESET_LABELS` object with 6 entries mapping old preset keys to display labels. Example structure:

```typescript
export const CRT_PRESET_LABELS: Record<string, string> = {
  [CRT_PRESET_KEYS.FULLSCREEN_CSS]: 'Fullscreen (CSS)',
  [CRT_PRESET_KEYS.FULLSCREEN_WEBGL]: 'Fullscreen (WebGL)',
  // ... 4 more old labels
};
```

### Required Changes

**Remove Old Labels**:

Delete all 6 existing label mappings for old preset keys.

**Add New Labels**:

Create 4 new label mappings following consistent format:

```typescript
export const CRT_PRESET_LABELS: Record<string, string> = {
  [CRT_PRESET_KEYS.SMALL_CSS]: 'Small (CSS)',
  [CRT_PRESET_KEYS.SMALL_WEBGL]: 'Small (WebGL)',
  [CRT_PRESET_KEYS.LARGE_CSS]: 'Large (CSS)',
  [CRT_PRESET_KEYS.LARGE_WEBGL]: 'Large (WebGL)',
};
```

**Label Format**:
- **Size First**: "Small" or "Large" - primary differentiator
- **Render Mode in Parentheses**: "(CSS)" or "(WebGL)" - technical detail
- **Consistent Capitalization**: Title case for size, uppercase for render mode acronyms

**Update JSDoc**:

```typescript
/**
 * Human-readable labels for built-in CRT presets.
 * 
 * Used in settings panel dropdown and UI displays to show user-friendly
 * names instead of technical preset keys.
 * 
 * Format: "Size (RenderMode)"
 * - Small: Optimized for compact displays
 * - Large: Optimized for fullscreen displays
 * - CSS/WebGL: Render mode variant
 */
```

**Type Safety**:

The type constraint `Record<string, string>` can be strengthened to ensure all preset keys have labels:

```typescript
export const CRT_PRESET_LABELS: Record<PresetKey, string> = {
  // TypeScript will enforce that all PresetKey values are present
};
```

### Anti-Patterns to Avoid

- ❌ **Don't use inconsistent casing** - Stick to "Small (CSS)" format
- ❌ **Don't add explanatory text** - Keep labels concise (dropdown space is limited)
- ❌ **Don't hardcode preset keys** - Import from domain layer
- ❌ **Don't leave old labels** - Clean removal of all 6 old entries

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Update/create tests in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts`:

1. **Verify label count**: CRT_PRESET_LABELS has exactly 4 entries
2. **Verify label keys**: All keys match CRT_PRESET_KEYS values
3. **Verify label format**: All labels follow "Size (RenderMode)" pattern
4. **Verify completeness**: Every preset key has a corresponding label
5. **Verify no orphans**: No labels exist for non-existent preset keys

**Test Pattern Example**:

```typescript
describe('CRT_PRESET_LABELS', () => {
  it('should have exactly 4 labels', () => {
    expect(Object.keys(CRT_PRESET_LABELS)).toHaveLength(4);
  });

  it('should have labels for all preset keys', () => {
    Object.values(CRT_PRESET_KEYS).forEach(key => {
      expect(CRT_PRESET_LABELS[key]).toBeDefined();
      expect(typeof CRT_PRESET_LABELS[key]).toBe('string');
    });
  });

  it('should follow consistent format "Size (RenderMode)"', () => {
    const formatRegex = /^(Small|Large) \((CSS|WebGL)\)$/;
    
    Object.values(CRT_PRESET_LABELS).forEach(label => {
      expect(label).toMatch(formatRegex);
    });
  });

  it('should not have orphaned labels', () => {
    const validKeys = Object.values(CRT_PRESET_KEYS);
    
    Object.keys(CRT_PRESET_LABELS).forEach(key => {
      expect(validKeys).toContain(key);
    });
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors
- [ ] Labels appear correctly in settings panel dropdown (visual verification)

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-003-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed
2. ✅ All testing subtasks completed
3. 📝 Test results (pass/fail summary)
4. 📝 Label format verification
5. 📝 Any discoveries or issues encountered

**Handoff to Next Task**:

After completion, Task 01-004 (Simplify CRT Configs) can begin. Labels are now ready for UI consumption.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Project overview

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)

**Related Files**:
- Current file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- Consumer: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- Domain keys: `libs/domain/src/lib/models/crt-preset-names.const.ts`

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start (after Tasks 01-001 and 01-002 complete)  
**Next Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-004-SIMPLIFY-CONFIGS
