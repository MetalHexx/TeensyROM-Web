# CRT-CUSTOM-PRESETS-TASK-01-002-RENAME-BUILT-IN-PRESETS

**Task ID**: CRT-CUSTOM-PRESETS-TASK-01-002-RENAME-BUILT-IN-PRESETS  
**Task Name**: Rename Built-in Presets with Default Prefix  
**Priority**: High  
**Estimated Context Size**: Medium (~10-15 files)

---

## 🎯 Objective

**What**: Prefix all built-in CRT preset names with `default-` to clearly distinguish them from custom presets and prevent naming conflicts. Update all references throughout the codebase.

**Why**: Custom presets use the `custom-` prefix. By adding `default-` to built-in presets, we create a clear namespace separation that prevents users from accidentally overwriting built-in presets and enables the type system to distinguish preset categories at compile time.

**Success Criteria**:
- [ ] All built-in preset keys in `CRT_PRESETS` renamed with `default-` prefix
- [ ] All `CRT_PRESET_LABELS` updated to match new keys
- [ ] `CrtPresetName` type updated to reflect new `default-*` union
- [ ] `DEFAULT_CRT_SETTINGS` references correct `default-*` preset
- [ ] `BuiltInPresetName` type created as `keyof typeof CRT_PRESETS`
- [ ] All hardcoded string references in codebase updated
- [ ] All component/store references updated
- [ ] All tests updated and passing
- [ ] Test baseline established before changes
- [ ] No TypeScript errors or linting issues

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS - Domain contracts defined

**Dependencies**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Preset definitions
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Type definitions
- All components/stores/tests that reference preset names

**Constraints**:
- This is a **breaking change** - requires comprehensive search and replace
- Type system must catch remaining references through `CrtPresetName` type
- Maintain alphabetical ordering in preset definitions
- Preserve all existing preset configurations (only names change)

---

## 📂 File Scope

**Core Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Rename all preset keys
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Update types

**Search Required** (find all references to update):
- Pattern: `'fullscreen-webgl'`, `'fullscreen-css'`, `'dialog-webgl'`, `'dialog-css'`, `'dialog-css-minimalist'`
- Target files: Components, stores, services, tests, documentation

**Files to Review** (for context):
- `libs/application/src/lib/crt/crt-store.ts` - May reference preset names
- `libs/features/*/src/**/*.ts` - Search for preset references
- Test files: `**/*.spec.ts` - Update test data

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - General patterns
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Test approach
- [Component Library](../../../../docs/COMPONENT_LIBRARY_CRT.md) - CRT component standards

### Key Requirements

#### 1. Establish Test Baseline

**CRITICAL**: Run full test suite BEFORE making any changes:

```bash
# From workspace root
pnpm nx test --all --watch=false
```

Document any pre-existing failures in technical debt (`docs/features/TECHNICAL_DEBT.md`) to distinguish them from changes introduced by this task.

#### 2. Update CRT_PRESETS Keys

In `crt-settings.defaults.ts`:
- Rename `fullscreen-webgl` → `default-fullscreen-webgl`
- Rename `fullscreen-css` → `default-fullscreen-css`
- Rename `dialog-webgl` → `default-dialog-webgl`
- Rename `dialog-css` → `default-dialog-css`
- Rename `dialog-css-minimalist` → `default-dialog-css-minimalist`

**Preserve**: All settings objects remain identical - ONLY the keys change

#### 3. Update CRT_PRESET_LABELS

Update label keys and display text:
- `'default-fullscreen-webgl': 'Default Full Screen (WebGL)'`
- `'default-fullscreen-css': 'Default Full Screen (CSS)'`
- etc.

**Pattern**: Add "Default" prefix to display labels for consistency

#### 4. Update Type Definitions

In `crt-settings.interface.ts`:

```typescript
// Update CrtPresetName to new union
export type CrtPresetName = 
  | 'default-fullscreen-webgl'
  | 'default-fullscreen-css'
  | 'default-dialog-webgl'
  | 'default-dialog-css'
  | 'default-dialog-css-minimalist';

// Add new type alias
export type BuiltInPresetName = keyof typeof CRT_PRESETS;
```

#### 5. Update DEFAULT_CRT_SETTINGS Reference

Change:
```typescript
// Before
export const DEFAULT_CRT_SETTINGS = CRT_PRESETS['fullscreen-webgl'];

// After
export const DEFAULT_CRT_SETTINGS = CRT_PRESETS['default-fullscreen-webgl'];
```

#### 6. Search and Update Codebase

**Search Strategy**: Use grep/ripgrep to find all string literal references:

```bash
# Search for preset name literals
rg "'(fullscreen-webgl|fullscreen-css|dialog-webgl|dialog-css|dialog-css-minimalist)'" --type ts
```

**Critical Files to Check**:
- **Stores**: `libs/application/src/lib/crt/crt-store.ts`
- **Components**: `libs/features/*/src/**/*.component.ts`
- **Services**: `libs/infrastructure/src/lib/crt/*.service.ts`
- **Tests**: All `*.spec.ts` files

**Update Each Reference**:
- String literals: `'fullscreen-webgl'` → `'default-fullscreen-webgl'`
- Type annotations using old names
- Test data and mock objects

#### 7. Update Documentation

Check these docs for preset name references:
- `docs/COMPONENT_LIBRARY_CRT.md`
- `docs/projects/CRT-CUSTOM-PRESETS/CRT-CUSTOM-PRESETS-MASTER-PLAN.md`
- Phase documentation (if it references specific preset names)

---

## 🧪 Testing Requirements

### Test Coverage Required

**Before Implementation**:
- [ ] Run full test suite and capture baseline
- [ ] Document any pre-existing failures in technical debt

**After Implementation**:
- [ ] All tests updated to use new `default-*` names
- [ ] Test suite runs with no new failures
- [ ] TypeScript compilation succeeds (catches type errors)
- [ ] Manual smoke test: Open CRT settings, verify presets load correctly

**Key Test Areas**:
- Preset selection in UI components
- Default preset loading on app startup
- Preset switching functionality
- Type safety in stores/services

**Testing Standards Reference**:
- See [Testing Standards](../../../../docs/TESTING_STANDARDS.md) for migration testing patterns
- Follow [Store Testing](../../../../docs/STORE_TESTING.md) if updating stores

---

## ⚠️ Anti-Patterns to Avoid

1. **Partial Updates**: Don't miss string literal references - search comprehensively
2. **Test Skipping**: Don't skip baseline testing - critical for distinguishing issues
3. **Type Bypassing**: Don't use `as any` to bypass type errors - fix the references
4. **Documentation Lag**: Don't forget to update docs referencing old names
5. **Breaking Saved State**: Consider user localStorage may have old preset names saved (note for Task 4)

---

## 📊 Expected File Impact

**Estimated Changes**:
- 2 core files modified (definitions, types)
- 5-10 component/store files updated
- 10-20 test files updated
- 2-3 documentation files updated

**Total**: ~20-35 files

**Complexity**: Medium - mechanical but requires thoroughness

---

## 🔗 Integration Points

**Upstream Dependencies**:
- ✅ Task 1 (Domain Contracts) completed

**Downstream Consumers**:
- 🔄 Task 3 (Validation Logic): Will use `BuiltInPresetName` type for reserved name checks
- 🔄 Task 4 (Storage Service): Will reference updated preset system
- 🔄 Task 5 (Type System): Will build on `BuiltInPresetName` type

---

## 🚦 Next Steps After Completion

1. Verify all tests pass with new preset names
2. Confirm TypeScript compilation succeeds
3. Document any edge cases discovered in completion report
4. Proceed to Task 3 (Validation Logic)

---

## 📝 Notes

**Migration Strategy**: This is a one-way change. Once merged, all preset references in the codebase will use `default-*` names. Users' saved custom presets (in future tasks) will use `custom-*` prefix, creating clear namespace separation.

**Rollback Plan**: If issues arise, revert is straightforward - reverse the string replacements. However, thorough testing before merge is preferred.

**Future-Proofing**: The `BuiltInPresetName` type provides a single source of truth for valid built-in preset names, making future preset additions easier to type-check.
