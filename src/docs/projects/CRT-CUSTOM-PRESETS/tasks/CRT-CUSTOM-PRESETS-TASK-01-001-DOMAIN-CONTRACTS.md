# CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS

**Task ID**: CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS  
**Task Name**: Update Domain Contracts for Custom Presets  
**Priority**: High  
**Estimated Context Size**: Small (~5-8 files)

---

## 🎯 Objective

**What**: Define domain contracts and models for custom preset operations, establishing the interface that infrastructure will implement. This includes creating the `CustomPreset` model, extending `ICrtStorage` with CRUD methods, and adding type guards.

**Why**: Domain contracts provide the foundation for custom preset storage. By defining these interfaces first, we establish a clear boundary between domain logic and infrastructure implementation, enabling type-safe development and testability.

**Success Criteria**:
- [ ] `CustomPreset` interface created with name, settings, and createdAt properties
- [ ] `ICrtStorage` extended with custom preset methods (save, load, delete, rename)
- [ ] Type guard `isCustomPresetName` implemented and tested
- [ ] All new types exported from domain barrel files
- [ ] Unit tests verify type guard behavior
- [ ] No TypeScript errors or linting issues

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Existing CRT settings system (CrtSettings interface, CRT_PRESETS, CrtStorageService)
- Phase 0: Master plan and architectural decisions documented

**Dependencies**:
- `libs/domain/src/lib/models/crt-settings.model.ts` - CrtSettings interface
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - ICrtStorage interface
- None of the other Phase 1 tasks depend on this - can be done independently

**Constraints**:
- Must maintain backward compatibility with existing CrtSettings interface
- Preset names must allow template literal type validation (`custom-${string}`)
- Type system should enforce compile-time safety for preset name distinctions

---

## 📂 File Scope

**Files to Create**:
- `libs/domain/src/lib/models/crt-custom-preset.model.ts` - CustomPreset interface definition

**Files to Modify**:
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Add custom preset method signatures
- `libs/domain/src/lib/contracts/index.ts` - Export new methods and types
- `libs/domain/src/lib/models/index.ts` - Export CustomPreset

**Files to Review** (for context):
- `libs/domain/src/lib/models/crt-settings.model.ts` - Existing CrtSettings structure
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Current storage interface
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Built-in preset structure

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - General patterns
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Test approach
- [Domain Standards](../../../../docs/features/CLEAN_ARCHITECTURE.md) - Domain layer rules

**Key Requirements**:

### 1. CustomPreset Model

Create `crt-custom-preset.model.ts` with:
- Interface name: `CustomPreset`
- Property `name`: Type `CustomPresetName` (will be `custom-${string}`)
- Property `settings`: Type `CrtSettings` (reuse existing interface)
- Property `createdAt`: Type `string` (ISO 8601 timestamp)
- Add JSDoc comments explaining each property

**Reference**: See existing model pattern in `crt-settings.model.ts`

### 2. Extend ICrtStorage Contract

Add these method signatures to `ICrtStorage` interface:

```typescript
/**
 * Save a custom preset with the given name and settings.
 * Name should include 'custom-' prefix.
 * @throws Error if preset limit (50) exceeded or validation fails
 */
saveCustomPreset(name: string, settings: CrtSettings): void;

/**
 * Load all custom presets from storage.
 * @returns Array of custom presets, empty array if none exist
 */
loadCustomPresets(): CustomPreset[];

/**
 * Delete a custom preset by name.
 * @param name - Preset name with 'custom-' prefix
 */
deleteCustomPreset(name: CustomPresetName): void;

/**
 * Rename a custom preset.
 * @param oldName - Current preset name with 'custom-' prefix
 * @param newName - New name without 'custom-' prefix (will be added by implementation)
 * @throws Error if new name invalid or conflicts
 */
renameCustomPreset(oldName: CustomPresetName, newName: string): void;

/**
 * Check if a specific custom preset exists.
 * @param name - Preset name with 'custom-' prefix
 */
hasCustomPreset(name: CustomPresetName): boolean;
```

### 3. Add Type Guard Function

Add to `crt-storage.contract.ts`:

```typescript
/**
 * Type guard to check if a preset name is a custom preset.
 * Custom presets always start with 'custom-' prefix.
 */
export function isCustomPresetName(name: string): name is CustomPresetName {
  return typeof name === 'string' && name.startsWith('custom-');
}
```

**Note**: The `CustomPresetName` type will be defined as `` type CustomPresetName = `custom-${string}` `` but that will be added in a later task (Task 5). For now, just use `string` and we'll refine the typing later.

### 4. Update Exports

**In `contracts/index.ts`**: Export new methods from ICrtStorage interface (they're part of the interface, so export happens automatically when interface exports)

**In `models/index.ts`**: Add:
```typescript
export * from './crt-custom-preset.model';
```

**Anti-Patterns to Avoid**:
- Don't add implementation logic in domain layer - interfaces only
- Don't add validation logic here - that belongs in infrastructure
- Don't couple CustomPreset to any specific storage mechanism
- Don't add complex computed properties to the model

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests for `isCustomPresetName` type guard in `crt-storage.contract.spec.ts`

**Behavioral Expectations**:

Create `libs/domain/src/lib/contracts/crt-storage.contract.spec.ts`:

```typescript
describe('isCustomPresetName', () => {
  it('should return true for names starting with custom-', () => {
    expect(isCustomPresetName('custom-my-preset')).toBe(true);
    expect(isCustomPresetName('custom-')).toBe(true);
  });

  it('should return false for built-in preset names', () => {
    expect(isCustomPresetName('default-fullscreen-webgl')).toBe(false);
    expect(isCustomPresetName('fullscreen-webgl')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isCustomPresetName('')).toBe(false);
    expect(isCustomPresetName('Custom-preset')).toBe(false); // case sensitive
  });
});
```

**Test execution**: Run `npx nx test domain` to verify tests pass

---

## 📚 Reference Materials

**Related Documentation**:
- [Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#type-system-extension) - Type system architecture
- [Phase 1 Plan](../phases/CRT-CUSTOM-PRESETS-PHASE-01-STORAGE-INFRASTRUCTURE.md#task-1-update-domain-contracts) - Detailed task breakdown
- [Existing CRT Storage Contract](../../../../libs/domain/src/lib/contracts/crt-storage.contract.ts) - Current implementation pattern

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-01-005-TYPE-SYSTEM: Will refine CustomPresetName type with template literal
- CRT-CUSTOM-PRESETS-TASK-01-004-STORAGE-SERVICE: Will implement these contracts

**Design Decisions from Master Plan**:
- Custom presets use `custom-` namespace prefix to prevent conflicts with built-in presets
- Storage key pattern: single `teensyrom_crt_custom_presets` key with JSON array
- Maximum 50 custom presets to prevent localStorage bloat
- Presets include timestamp for future sorting/metadata features

---

## 📤 Output

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**What to include in your report**:
- Files created and modified (with git diff or summary)
- Test results showing isCustomPresetName type guard passing
- Any discoveries or issues encountered
- Confirmation that all success criteria met
- Recommendations for next steps (if any)

---

## ✅ Definition of Done

- [ ] `CustomPreset` interface created with all required properties
- [ ] JSDoc comments added to interface and properties
- [ ] `ICrtStorage` interface extended with 5 new method signatures
- [ ] JSDoc comments added to new methods
- [ ] `isCustomPresetName` type guard implemented
- [ ] Type guard unit tests written and passing
- [ ] All new types exported from barrel files
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors or warnings
- [ ] Completion report created at specified output location
