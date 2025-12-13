# Phase 1: Storage Infrastructure

## 🎯 Objective

Extend the existing CRT storage layer to support CRUD operations for custom presets, establishing the persistence foundation for user-defined CRT configurations without requiring UI changes. This phase introduces global preset storage with namespace prefixing, validation logic, and type system extensions.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md) - Complete feature overview
- [ ] [CRT Storage Service](../../../../libs/infrastructure/src/lib/crt/crt-storage.service.ts) - Existing storage implementation
- [ ] [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts) - Built-in preset definitions

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Service Standards](../../../SERVICE_STANDARDS.md) - Service implementation patterns
- [ ] [Logging Standards](../../../LOGGING_STANDARDS.md) - Error handling and logging patterns

---

## 📂 File Structure Overview

```
libs/domain/src/lib/
├── contracts/
│   ├── crt-storage.contract.ts              📝 Modified - Add custom preset methods
│   └── index.ts                             📝 Modified - Export new types
├── models/
│   ├── crt-custom-preset.model.ts           ✨ New - CustomPreset interface
│   └── index.ts                             📝 Modified - Export CustomPreset

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.defaults.ts                 📝 Modified - Rename built-in presets with default- prefix
├── crt-settings.interface.ts                📝 Modified - Add preset name type helpers

libs/infrastructure/src/lib/crt/
├── crt-storage.service.ts                   📝 Modified - Add custom preset methods
├── crt-storage.service.spec.ts              📝 Modified - Add custom preset tests
└── crt-validation.ts                        ✨ New - Preset name validation logic
```

---

<details open>
<summary><h3>Task 1: Update Domain Contracts</h3></summary>

**Purpose**: Define domain contracts for custom preset operations, establishing the interface that infrastructure will implement.

**Related Documentation:**

- [Master Plan - Storage Architecture](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#storage-architecture)
- [CRT Storage Contract](../../../../libs/domain/src/lib/contracts/crt-storage.contract.ts)

**Implementation Subtasks:**

- [ ] **Create CustomPreset Model**: Create `crt-custom-preset.model.ts` with `CustomPreset` interface (name, settings, createdAt)
- [ ] **Export CustomPreset**: Add CustomPreset to `models/index.ts` barrel export
- [ ] **Extend ICrtStorage**: Add `saveCustomPreset`, `loadCustomPresets`, `deleteCustomPreset`, `renameCustomPreset` methods
- [ ] **Add Type Guards**: Add `isCustomPresetName` type guard function to contract
- [ ] **Update Exports**: Export new types from `contracts/index.ts`

**Testing Subtask:**

- [ ] **Write Tests**: Test type guards and interface contracts (see Testing section below)

**Key Implementation Notes:**

- CustomPreset interface must include `createdAt` timestamp for future sorting/metadata
- Preset names in CustomPreset are already prefixed with `custom-`
- Storage methods should accept/return CustomPreset objects, not raw settings
- Type guard distinguishes `custom-*` names from built-in names at compile time

**CustomPreset Interface:**

```typescript
interface CustomPreset {
  name: CustomPresetName; // Always starts with 'custom-'
  settings: CrtSettings;
  createdAt: string; // ISO 8601 timestamp
}
```

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] `isCustomPresetName` returns true for names starting with 'custom-'
- [ ] `isCustomPresetName` returns false for built-in preset names
- [ ] `isCustomPresetName` handles edge cases (empty string, null, undefined)
- [ ] CustomPreset interface structure validated in tests

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for type guard testing patterns

</details>

---

<details open>
<summary><h3>Task 2: Rename Built-in Presets</h3></summary>

**Purpose**: Prefix all built-in preset names with `default-` to clearly distinguish them from custom presets and prevent naming conflicts.

**Related Documentation:**

- [Master Plan - Type System Extension](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#type-system-extension)
- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

**Implementation Subtasks:**

- [ ] **Rename CRT_PRESETS Keys**: Change all preset keys to `default-fullscreen-webgl`, `default-fullscreen-css`, etc.
- [ ] **Update CRT_PRESET_LABELS**: Update labels to "Default Full Screen (WebGL)", etc.
- [ ] **Update CrtPresetName Type**: Change type to union of new `default-*` names
- [ ] **Update DEFAULT_CRT_SETTINGS**: Reference `CRT_PRESETS['default-fullscreen-webgl']`
- [ ] **Add BuiltInPresetName Type**: Create `type BuiltInPresetName = keyof typeof CRT_PRESETS`

**Testing Subtask:**

- [ ] **Write Tests**: Update tests referencing old preset names (see Testing section below)

**Key Implementation Notes:**

- This is a breaking change for any code directly referencing preset names
- Search codebase for string literals like `'fullscreen-webgl'` and update to `'default-fullscreen-webgl'`
- CRT_CONFIGS keys don't need renaming (they're separate from preset names)
- TypeScript compiler will catch most references through CrtPresetName type

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] All built-in preset keys start with 'default-'
- [ ] CRT_PRESET_LABELS has matching keys for all presets
- [ ] DEFAULT_CRT_SETTINGS correctly references a valid preset
- [ ] Type system enforces correct preset names

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md)
- Run full test suite to catch references to old preset names

</details>

---

<details open>
<summary><h3>Task 3: Create Preset Validation Logic</h3></summary>

**Purpose**: Implement validation rules for custom preset names to ensure uniqueness, prevent conflicts with built-in presets, and enforce character limits.

**Related Documentation:**

- [Master Plan - Validation Logic](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#storage-architecture)
- [Service Standards](../../../SERVICE_STANDARDS.md)

**Implementation Subtasks:**

- [ ] **Create Validation File**: Create `crt-validation.ts` in infrastructure/crt folder
- [ ] **Add Name Length Validation**: Validate min 1 char, max 50 chars
- [ ] **Add Character Validation**: Allow alphanumeric, spaces, hyphens only
- [ ] **Add Reserved Name Check**: Check against all `default-*` built-in preset names
- [ ] **Add Uniqueness Check**: Check against existing custom preset names
- [ ] **Create Validation Result Type**: Return `{ valid: boolean; error?: string }` structure

**Testing Subtask:**

- [ ] **Write Tests**: Test all validation rules and edge cases (see Testing section below)

**Key Implementation Notes:**

- Validation should NOT add `custom-` prefix - that happens in storage service
- Validation checks the user-entered name (without prefix)
- Error messages should be user-friendly and actionable
- Reserved names include: all keys from CRT_PRESETS (stripped of `default-` prefix)

**Validation Function Signature:**

```typescript
function validatePresetName(
  name: string,
  existingCustomNames: string[]
): ValidationResult {
  // Implementation
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] Empty name fails validation with error message
- [ ] Name over 50 chars fails validation
- [ ] Name with invalid characters (e.g., `!@#$`) fails validation
- [ ] Name matching built-in preset fails validation (e.g., "fullscreen-webgl")
- [ ] Name matching existing custom preset fails validation
- [ ] Valid unique name passes validation
- [ ] Validation error messages are specific and helpful

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for validation testing patterns

</details>

---

<details open>
<summary><h3>Task 4: Extend CrtStorageService</h3></summary>

**Purpose**: Implement custom preset CRUD operations in CrtStorageService, adding persistence logic with namespace prefixing and error handling.

**Related Documentation:**

- [Master Plan - Storage Architecture](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#storage-architecture)
- [CRT Storage Service](../../../../libs/infrastructure/src/lib/crt/crt-storage.service.ts)
- [Logging Standards](../../../LOGGING_STANDARDS.md)

**Implementation Subtasks:**

- [ ] **Add saveCustomPreset Method**: Save preset with `custom-` prefix, validate name first
- [ ] **Add loadCustomPresets Method**: Load all custom presets from localStorage
- [ ] **Add deleteCustomPreset Method**: Remove preset by name
- [ ] **Add renameCustomPreset Method**: Rename preset, validate new name
- [ ] **Add hasCustomPreset Method**: Check if specific custom preset exists
- [ ] **Add Maximum Preset Check**: Enforce 50 preset limit in save method
- [ ] **Add Error Logging**: Log all operations using logInfo/logWarn patterns

**Testing Subtask:**

- [ ] **Write Tests**: Test CRUD operations and error handling (see Testing section below)

**Key Implementation Notes:**

- Storage key: `teensyrom_crt_custom_presets` stores array of CustomPreset objects
- All custom preset operations use single localStorage key for atomic updates
- Namespace prefix `custom-` added in save method, NOT by caller
- Validation runs before save/rename using validation logic from Task 3
- Maximum preset limit should provide helpful error message

**Storage Key Pattern:**

```typescript
private readonly CUSTOM_PRESETS_KEY = 'teensyrom_crt_custom_presets';
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] `saveCustomPreset` adds preset to localStorage with `custom-` prefix
- [ ] `saveCustomPreset` runs validation before saving
- [ ] `saveCustomPreset` rejects invalid names with error
- [ ] `saveCustomPreset` enforces 50 preset limit
- [ ] `loadCustomPresets` returns empty array when no presets exist
- [ ] `loadCustomPresets` returns all saved presets correctly
- [ ] `deleteCustomPreset` removes preset from storage
- [ ] `deleteCustomPreset` handles non-existent preset gracefully
- [ ] `renameCustomPreset` updates preset name while preserving settings
- [ ] `renameCustomPreset` validates new name before renaming
- [ ] localStorage errors are caught and logged appropriately

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md)
- See [Service Standards](../../../SERVICE_STANDARDS.md) for error handling patterns

</details>

---

<details open>
<summary><h3>Task 5: Update Type System</h3></summary>

**Purpose**: Extend CRT preset type definitions to support custom presets while maintaining type safety between built-in and user-defined presets.

**Related Documentation:**

- [Master Plan - Type System Extension](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#type-system-extension)
- [CRT Settings Interface](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts)

**Implementation Subtasks:**

- [ ] **Add CustomPresetName Type**: `type CustomPresetName = \`custom-${string}\``
- [ ] **Add AnyPresetName Type**: `type AnyPresetName = BuiltInPresetName | CustomPresetName`
- [ ] **Update CrtPresetName Type**: Change to BuiltInPresetName (for backward compatibility)
- [ ] **Add Type Helpers**: Add `isBuiltInPreset`, `stripCustomPrefix` utility functions
- [ ] **Export New Types**: Export all new types from interface file

**Testing Subtask:**

- [ ] **Write Tests**: Test type guards and utility functions (see Testing section below)

**Key Implementation Notes:**

- Template literal type `custom-${string}` provides compile-time validation
- Type guards should use runtime string checks for `custom-` prefix
- stripCustomPrefix removes `custom-` for display purposes
- Maintain CrtPresetName as alias to BuiltInPresetName for backward compatibility

**Type Helper Signatures:**

```typescript
function isBuiltInPreset(name: string): name is BuiltInPresetName;
function stripCustomPrefix(name: CustomPresetName): string;
```

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] `isBuiltInPreset` returns true for all default-* names
- [ ] `isBuiltInPreset` returns false for custom-* names
- [ ] `stripCustomPrefix` removes 'custom-' prefix correctly
- [ ] `stripCustomPrefix` handles edge cases (already stripped, no prefix)
- [ ] Type system enforces correct usage at compile time

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for utility function testing

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/domain/src/lib/models/crt-custom-preset.model.ts`
- `libs/infrastructure/src/lib/crt/crt-validation.ts`

**Modified Files:**

- `libs/domain/src/lib/contracts/crt-storage.contract.ts`
- `libs/domain/src/lib/contracts/index.ts`
- `libs/domain/src/lib/models/index.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- `libs/infrastructure/src/lib/crt/crt-storage.service.ts`
- `libs/infrastructure/src/lib/crt/crt-storage.service.spec.ts`

**Total**: 2 new files, 7 modified files

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] Domain contracts define custom preset operations
- [ ] Built-in presets renamed with `default-` prefix
- [ ] Preset name validation enforces all rules
- [ ] CrtStorageService implements CRUD operations
- [ ] Type system distinguishes built-in vs custom presets

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All validation rules tested with edge cases
- [ ] CRUD operations tested with success and error paths
- [ ] localStorage error handling tested
- [ ] All tests passing with no failures
- [ ] Test coverage ≥80% for new code

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] All logging follows logging standards
- [ ] Error messages are user-friendly

**Ready for Next Phase:**

- [ ] Storage layer fully functional
- [ ] No known bugs in persistence logic
- [ ] Type system enforces preset name safety
- [ ] Ready for UI component development

---

## 📝 Notes & Considerations

### Design Decisions

- **Single localStorage Key**: Using one key (`teensyrom_crt_custom_presets`) with JSON array simplifies enumeration and provides atomic updates
- **Namespace Prefix**: `custom-` prefix prevents conflicts and enables TypeScript template literal type checking
- **50 Preset Limit**: Reasonable limit to prevent localStorage bloat while allowing ample customization
- **Validation at Service Layer**: Validation in service (not contract) keeps domain clean while ensuring consistent enforcement

### Implementation Constraints

- **Breaking Change**: Renaming built-in presets requires updating all references in codebase
- **localStorage Quota**: Browser localStorage has ~5-10MB limit; 50 presets uses negligible space
- **No Migration**: Existing device-scoped CRT settings remain unchanged

### Future Enhancements

- **Preset Import/Export**: Could add JSON export/import for sharing between browsers
- **Preset Validation Schema**: Could use Zod or similar for runtime validation
- **Preset Metadata**: Could add tags, descriptions, or thumbnail images

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

---

## 💡 Testing Strategy Summary

**Unit Tests:**
- Validation logic: All rules and edge cases
- Type guards: Runtime type checking accuracy
- CRUD operations: Success paths and error handling
- localStorage mocking: Test without actual browser storage

**Integration Tests:**
- Complete workflow: save → load → rename → delete
- Error scenarios: Invalid names, quota exceeded, parse errors
- Cross-browser compatibility: localStorage behavior differences
