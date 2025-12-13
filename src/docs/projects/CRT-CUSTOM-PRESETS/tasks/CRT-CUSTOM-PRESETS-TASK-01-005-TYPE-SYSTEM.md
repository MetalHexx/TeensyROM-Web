# CRT-CUSTOM-PRESETS-TASK-01-005-TYPE-SYSTEM

**Task ID**: CRT-CUSTOM-PRESETS-TASK-01-005-TYPE-SYSTEM  
**Task Name**: Update Type System for Custom Presets  
**Priority**: Medium  
**Estimated Context Size**: Small (~4-6 files)

---

## 🎯 Objective

**What**: Extend CRT preset type definitions to support custom presets with template literal types, creating type-safe distinction between built-in (`default-*`) and custom (`custom-*`) presets, plus utility functions for type guards and prefix manipulation.

**Why**: TypeScript's type system can enforce preset namespace separation at compile time using template literal types. By adding `CustomPresetName`, `AnyPresetName`, and utility functions, we enable type-safe preset handling throughout the application and catch naming conflicts during development.

**Success Criteria**:
- [ ] `CustomPresetName` type defined as template literal `custom-${string}`
- [ ] `AnyPresetName` type combines built-in and custom preset types
- [ ] `CrtPresetName` maintained as alias to `BuiltInPresetName` (backward compatibility)
- [ ] `isBuiltInPreset` type guard function implemented
- [ ] `stripCustomPrefix` utility function implemented
- [ ] All new types exported from interface file
- [ ] Unit tests verify type guards and utilities
- [ ] Test baseline established before implementation
- [ ] No TypeScript errors or linting issues

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS - `CustomPresetName` type alias created (ready for refinement)
- CRT-CUSTOM-PRESETS-TASK-01-002-RENAME-BUILT-IN-PRESETS - `BuiltInPresetName` type available

**Dependencies**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Type definitions
- `libs/domain/src/lib/models/crt-custom-preset.model.ts` - May need to update `CustomPresetName` type

**Constraints**:
- Must maintain backward compatibility with `CrtPresetName` type
- Template literal type requires TypeScript 4.1+
- Type guards must provide runtime string validation
- Utility functions must handle edge cases gracefully

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Add types and utilities
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts` - Create/update tests
- `libs/domain/src/lib/models/crt-custom-preset.model.ts` - Update `CustomPresetName` type (if needed)

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Built-in preset names
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Usage of preset name types

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Type guard testing
- [Domain Standards](../../../../docs/features/CLEAN_ARCHITECTURE.md) - Type placement

### Key Requirements

#### 1. Establish Test Baseline

**CRITICAL**: Run existing UI component tests BEFORE making changes:

```bash
# From workspace root
pnpm nx test ui-components --watch=false
```

Document any pre-existing failures in technical debt.

#### 2. Update CustomPresetName in Domain Layer

In `libs/domain/src/lib/models/crt-custom-preset.model.ts`:

**Current**:
```typescript
export type CustomPresetName = string;
```

**Update to**:
```typescript
export type CustomPresetName = `custom-${string}`;
```

This enforces the `custom-` prefix at compile time.

#### 3. Add Type Definitions in UI Layer

In `crt-settings.interface.ts`, add these type definitions:

```typescript
// Template literal type for custom presets
export type CustomPresetName = `custom-${string}`;

// Union type for any preset (built-in or custom)
export type AnyPresetName = BuiltInPresetName | CustomPresetName;

// Maintain backward compatibility
export type CrtPresetName = BuiltInPresetName;
```

**Note**: We define `CustomPresetName` in both domain and UI layers. Domain layer uses it in model, UI layer uses it in type definitions. This is acceptable duplication for layer isolation.

#### 4. Implement isBuiltInPreset Type Guard

```typescript
/**
 * Type guard to check if a preset name is a built-in preset.
 * Built-in presets start with 'default-'.
 * @param name - Preset name to check
 * @returns True if name is a built-in preset, false otherwise
 */
export function isBuiltInPreset(name: string): name is BuiltInPresetName {
  return name.startsWith('default-');
}
```

**Key Points**:
- Returns `name is BuiltInPresetName` for type narrowing
- Simple string check - built-in presets always start with `default-`
- Runtime validation matches compile-time type system

#### 5. Implement stripCustomPrefix Utility

```typescript
/**
 * Removes the 'custom-' prefix from a custom preset name for display purposes.
 * Returns the original string if it doesn't start with 'custom-'.
 * @param name - Custom preset name to strip prefix from
 * @returns Name without 'custom-' prefix
 * @example
 * stripCustomPrefix('custom-My Preset') // returns 'My Preset'
 * stripCustomPrefix('My Preset') // returns 'My Preset' (no prefix)
 */
export function stripCustomPrefix(name: string): string {
  return name.startsWith('custom-') ? name.slice(7) : name;
}
```

**Key Points**:
- Handles both prefixed and non-prefixed strings gracefully
- Used for display in UI (show "My Preset" instead of "custom-My Preset")
- Pure function with no side effects

#### 6. Optional: Add isCustomPreset Type Guard

```typescript
/**
 * Type guard to check if a preset name is a custom preset.
 * Custom presets start with 'custom-'.
 * @param name - Preset name to check
 * @returns True if name is a custom preset, false otherwise
 */
export function isCustomPreset(name: string): name is CustomPresetName {
  return name.startsWith('custom-');
}
```

This complements `isBuiltInPreset` and provides symmetry.

#### 7. Update Exports

Ensure all new types and functions are exported from `crt-settings.interface.ts` and any relevant barrel files.

---

## 🧪 Testing Requirements

### Test Coverage Required

**Before Implementation**:
- [ ] Run UI component test suite and capture baseline

**Unit Tests** (in `crt-settings.interface.spec.ts`):

#### isBuiltInPreset Tests
- [ ] Returns true for `'default-fullscreen-webgl'`
- [ ] Returns true for all built-in preset names
- [ ] Returns false for `'custom-My Preset'`
- [ ] Returns false for `'fullscreen-webgl'` (no prefix)
- [ ] Returns false for empty string
- [ ] Type narrowing works correctly (TypeScript compilation test)

#### isCustomPreset Tests (if implemented)
- [ ] Returns true for `'custom-My Preset'`
- [ ] Returns true for `'custom-'` (edge case: empty name after prefix)
- [ ] Returns false for `'default-fullscreen-webgl'`
- [ ] Returns false for `'My Preset'` (no prefix)
- [ ] Returns false for empty string

#### stripCustomPrefix Tests
- [ ] Removes `'custom-'` prefix correctly: `'custom-Test'` → `'Test'`
- [ ] Handles name with no prefix: `'Test'` → `'Test'`
- [ ] Handles empty string: `''` → `''`
- [ ] Handles `'custom-'` with no suffix: `'custom-'` → `''`
- [ ] Preserves spaces: `'custom-My Preset'` → `'My Preset'`
- [ ] Preserves hyphens in name: `'custom-My-Preset'` → `'My-Preset'`
- [ ] Case-sensitive (doesn't strip `'Custom-'`): `'Custom-Test'` → `'Custom-Test'`

#### Type System Tests
- [ ] `CustomPresetName` type enforces `custom-` prefix at compile time
- [ ] `AnyPresetName` accepts both built-in and custom names
- [ ] `CrtPresetName` still works for backward compatibility

**Testing Standards Reference**:
- See [Testing Standards](../../../../docs/TESTING_STANDARDS.md) for utility function testing
- Use Vitest `describe`, `it`, `expect` structure

---

## ⚠️ Anti-Patterns to Avoid

1. **Regex Overkill**: Don't use complex regex - simple `startsWith` is sufficient
2. **Mutation**: Don't modify input strings - return new values
3. **Type Casting**: Don't use `as` assertions - let type guards do the work
4. **Missing Edge Cases**: Handle empty strings, no-prefix cases, edge cases gracefully
5. **Case Sensitivity**: Prefix checks are case-sensitive by design (`custom-` not `Custom-`)

---

## 📊 Expected File Impact

**Modified Files**:
- `crt-settings.interface.ts` - Add ~40 lines (types + utilities)
- `crt-settings.interface.spec.ts` - Add ~150 lines (comprehensive tests)
- `crt-custom-preset.model.ts` - Update 1 line (type refinement)

**Total**: 3 modified files, ~190 lines added/changed

**Complexity**: Low - type definitions and simple utilities

---

## 🔗 Integration Points

**Upstream Dependencies**:
- ✅ Task 1 (Domain Contracts) completed - `CustomPresetName` type alias exists
- ✅ Task 2 (Built-in Presets Renamed) completed - `BuiltInPresetName` type exists

**Downstream Consumers**:
- 🔄 Phase 2 (UI Dialogs): Will use `stripCustomPrefix` for display
- 🔄 Phase 3 (Settings Panel): Will use type guards for preset categorization
- 🔄 Application stores: May use `AnyPresetName` for type safety

**Type System Benefits**:
- Compile-time validation of preset names
- IntelliSense shows valid preset name patterns
- Type guards enable runtime validation matching compile-time types

---

## 🚦 Next Steps After Completion

1. Verify all type tests pass
2. Confirm TypeScript compilation succeeds with new types
3. Test type narrowing in TypeScript playground/IDE
4. Document any type system edge cases in completion report
5. **Phase 1 Complete** - Storage infrastructure ready for Phase 2 (UI Dialogs)

---

## 📝 Notes

**Template Literal Types**: TypeScript's template literal types (`custom-${string}`) provide compile-time validation. The type system knows `'custom-Test'` is valid but `'Test'` is not.

**Type Guard Pattern**: Type guards bridge compile-time and runtime. `isCustomPreset` checks the string at runtime and narrows the TypeScript type automatically.

**Display vs Storage**: `stripCustomPrefix` is for UI display only. Storage always uses full names with prefixes (`custom-*`, `default-*`).

**Backward Compatibility**: Maintaining `CrtPresetName` as alias to `BuiltInPresetName` ensures existing code using `CrtPresetName` continues to work without changes.

**Future Enhancement**: Consider adding `addCustomPrefix(name: string): CustomPresetName` utility if needed in Phase 3 for symmetry.
