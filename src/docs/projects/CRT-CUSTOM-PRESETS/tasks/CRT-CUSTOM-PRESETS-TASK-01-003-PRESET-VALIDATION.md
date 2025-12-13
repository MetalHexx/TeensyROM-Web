# CRT-CUSTOM-PRESETS-TASK-01-003-PRESET-VALIDATION

**Task ID**: CRT-CUSTOM-PRESETS-TASK-01-003-PRESET-VALIDATION  
**Task Name**: Create Preset Name Validation Logic  
**Priority**: High  
**Estimated Context Size**: Small (~3-5 files)

---

## 🎯 Objective

**What**: Implement validation rules for custom preset names to ensure uniqueness, prevent conflicts with built-in presets, enforce character limits, and validate allowed characters. Create a reusable validation function with clear error messages.

**Why**: User-entered preset names must be validated before storage to prevent conflicts, ensure consistency, and provide helpful feedback. Validation logic belongs in the infrastructure layer where storage implementation lives, and needs comprehensive error messages for UI display.

**Success Criteria**:
- [ ] Validation module `crt-validation.ts` created in infrastructure/crt folder
- [ ] Name length validation (min 1 char, max 50 chars)
- [ ] Character validation (alphanumeric, spaces, hyphens only)
- [ ] Reserved name check (prevents conflicts with built-in presets)
- [ ] Uniqueness check (prevents duplicate custom preset names)
- [ ] `ValidationResult` type with `valid` and optional `error` properties
- [ ] User-friendly error messages for all validation failures
- [ ] Comprehensive unit tests covering all validation rules
- [ ] Test baseline established before implementation
- [ ] No TypeScript errors or linting issues

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS - Domain contracts defined
- CRT-CUSTOM-PRESETS-TASK-01-002-RENAME-BUILT-IN-PRESETS - Built-in presets use `default-` prefix

**Dependencies**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - For reserved name list
- `libs/infrastructure/src/lib/crt/` - Validation module location
- Task 4 (Storage Service) will consume this validation logic

**Constraints**:
- Validation checks **user-entered name** (without `custom-` prefix)
- Storage service will add `custom-` prefix AFTER validation passes
- Reserved names are built-in preset names **without** the `default-` prefix
- Error messages must be actionable and user-friendly

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/crt/crt-validation.ts` - Validation logic
- `libs/infrastructure/src/lib/crt/crt-validation.spec.ts` - Unit tests

**Files to Modify**:
- `libs/infrastructure/src/lib/crt/index.ts` - Export validation function (if barrel exists)

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Built-in preset names
- `libs/infrastructure/src/lib/crt/crt-storage.service.ts` - Future consumer of validation

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - General patterns
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Validation testing approach
- [Service Standards](../../../../docs/SERVICE_STANDARDS.md) - Infrastructure patterns

### Key Requirements

#### 1. Establish Test Baseline

**CRITICAL**: Run existing CRT infrastructure tests BEFORE making changes:

```bash
# From workspace root
pnpm nx test infrastructure --watch=false
```

Document any pre-existing failures in technical debt.

#### 2. Create ValidationResult Type

```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string; // Only present when valid === false
}
```

#### 3. Create Validation Function

Function signature:
```typescript
export function validatePresetName(
  name: string,
  existingCustomNames: string[]
): ValidationResult
```

**Validation Rules** (check in this order):

1. **Empty/Whitespace-Only Check**
   - Trim name and check if empty
   - Error: `"Preset name cannot be empty"`

2. **Length Validation**
   - Min: 1 character (after trim)
   - Max: 50 characters
   - Error: `"Preset name must be between 1 and 50 characters"`

3. **Character Validation**
   - Allow: Letters (a-z, A-Z), numbers (0-9), spaces, hyphens
   - Regex: `/^[a-zA-Z0-9\s-]+$/`
   - Error: `"Preset name can only contain letters, numbers, spaces, and hyphens"`

4. **Reserved Name Check**
   - Extract built-in preset base names (strip `default-` prefix)
   - Case-insensitive comparison
   - Reserved names: `fullscreen-webgl`, `fullscreen-css`, `dialog-webgl`, `dialog-css`, `dialog-css-minimalist`
   - Error: `"This name is reserved for a built-in preset"`

5. **Uniqueness Check**
   - Compare against `existingCustomNames` array
   - Case-insensitive comparison
   - Error: `"A preset with this name already exists"`

**Return**: `{ valid: true }` if all checks pass, or `{ valid: false, error: "..." }` on first failure

#### 4. Reserved Names Helper

Create constant for reserved names:
```typescript
const RESERVED_PRESET_NAMES: readonly string[] = [
  'fullscreen-webgl',
  'fullscreen-css',
  'dialog-webgl',
  'dialog-css',
  'dialog-css-minimalist'
] as const;
```

**Rationale**: Hardcoding list keeps validation independent of UI component imports. Update when built-in presets change.

#### 5. Implementation Pattern

```typescript
export function validatePresetName(
  name: string,
  existingCustomNames: string[]
): ValidationResult {
  const trimmedName = name.trim();

  // Rule 1: Empty check
  if (trimmedName.length === 0) {
    return { valid: false, error: "Preset name cannot be empty" };
  }

  // Rule 2: Length check
  // ... implementation

  // Rule 3: Character check
  // ... implementation

  // Rule 4: Reserved name check
  // ... implementation

  // Rule 5: Uniqueness check
  // ... implementation

  return { valid: true };
}
```

---

## 🧪 Testing Requirements

### Test Coverage Required

**Before Implementation**:
- [ ] Run infrastructure test suite and capture baseline

**Unit Tests** (in `crt-validation.spec.ts`):

#### Empty/Whitespace Tests
- [ ] Empty string fails validation
- [ ] Whitespace-only string fails validation
- [ ] String with only spaces fails validation

#### Length Tests
- [ ] 51-character name fails validation
- [ ] 50-character name passes validation (boundary)
- [ ] 1-character name passes validation (boundary)

#### Character Tests
- [ ] Name with special characters (`!@#$%`) fails validation
- [ ] Name with underscores fails validation
- [ ] Name with alphanumeric only passes validation
- [ ] Name with spaces passes validation
- [ ] Name with hyphens passes validation
- [ ] Mixed valid characters pass validation

#### Reserved Name Tests
- [ ] Exact match to built-in name fails (`fullscreen-webgl`)
- [ ] Case-insensitive match fails (`FULLSCREEN-WEBGL`, `Fullscreen-WebGL`)
- [ ] Each built-in preset name fails validation (5 tests)
- [ ] Non-reserved name passes validation

#### Uniqueness Tests
- [ ] Exact match to existing custom name fails
- [ ] Case-insensitive match to existing name fails (`My Preset` vs `my preset`)
- [ ] Unique name with no conflicts passes validation
- [ ] Empty `existingCustomNames` array allows any valid name

#### Edge Cases
- [ ] Name with leading/trailing spaces passes after trim
- [ ] Very long name (60+ chars) fails validation
- [ ] Name with mixed case reserved word fails

**Testing Standards Reference**:
- See [Testing Standards](../../../../docs/TESTING_STANDARDS.md) for validation testing patterns
- Use Vitest `describe`, `it`, `expect` structure
- Group tests by validation rule category

---

## ⚠️ Anti-Patterns to Avoid

1. **UI Coupling**: Don't import UI components or CRT_PRESETS constant - use hardcoded reserved names
2. **Case-Sensitive Comparison**: Always use `.toLowerCase()` for name comparisons
3. **Prefix Confusion**: Validation checks user-entered names WITHOUT `custom-` prefix
4. **Vague Errors**: Error messages must explain what's wrong and how to fix it
5. **Order Matters**: Check rules in specified order - fail fast on first violation

---

## 📊 Expected File Impact

**New Files**:
- 1 implementation file (`crt-validation.ts`) - ~80 lines
- 1 test file (`crt-validation.spec.ts`) - ~250 lines

**Modified Files**:
- Barrel export if applicable

**Total**: 2 new files, potentially 1 modified

**Complexity**: Low - pure validation logic with no dependencies

---

## 🔗 Integration Points

**Upstream Dependencies**:
- ✅ Task 1 (Domain Contracts) completed
- ✅ Task 2 (Built-in Presets Renamed) completed

**Downstream Consumers**:
- 🔄 Task 4 (Storage Service): Will call `validatePresetName` before saving/renaming

**Integration Note**: Storage service will:
1. Call validation with user-entered name
2. If `valid === false`, return error to caller
3. If `valid === true`, add `custom-` prefix and save

---

## 🚦 Next Steps After Completion

1. Verify all validation tests pass
2. Confirm edge cases are covered
3. Document any special cases in completion report
4. Proceed to Task 4 (Storage Service implementation)

---

## 📝 Notes

**Design Decision - Hardcoded Reserved Names**: We intentionally duplicate the built-in preset list rather than importing it to:
- Avoid circular dependencies (infrastructure importing from UI)
- Keep validation logic independent and testable
- Make validation fast (no module loading overhead)

**Future Enhancement**: Consider extracting reserved names to a shared constant if preset list grows significantly (>10 presets).

**Error Message Philosophy**: Error messages should:
- State what's wrong clearly
- Suggest how to fix it when possible
- Use consistent, friendly tone
- Be actionable by the user
