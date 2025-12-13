# CRT-CUSTOM-PRESETS-TASK-01-004-STORAGE-SERVICE

**Task ID**: CRT-CUSTOM-PRESETS-TASK-01-004-STORAGE-SERVICE  
**Task Name**: Extend CrtStorageService with Custom Preset Operations  
**Priority**: High  
**Estimated Context Size**: Medium (~6-10 files)

---

## 🎯 Objective

**What**: Implement custom preset CRUD operations in `CrtStorageService`, adding persistence logic with `custom-` namespace prefixing, validation integration, 50-preset limit enforcement, and comprehensive error handling.

**Why**: The storage service is the single source of truth for CRT preset persistence. By implementing custom preset operations here, we complete the storage foundation and enable UI components to save, load, rename, and delete user-defined presets with full validation and error handling.

**Success Criteria**:
- [ ] `saveCustomPreset` method implemented with validation and prefix handling
- [ ] `loadCustomPresets` method loads all custom presets from localStorage
- [ ] `deleteCustomPreset` method removes preset by name
- [ ] `renameCustomPreset` method updates preset name with validation
- [ ] `hasCustomPreset` method checks preset existence
- [ ] 50-preset limit enforced in save method
- [ ] All operations use single localStorage key: `teensyrom_crt_custom_presets`
- [ ] Error logging follows logging standards
- [ ] Comprehensive unit tests for CRUD operations and error cases
- [ ] Test baseline established before implementation
- [ ] No TypeScript errors or linting issues

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-01-001-DOMAIN-CONTRACTS - Domain contracts defined
- CRT-CUSTOM-PRESETS-TASK-01-002-RENAME-BUILT-IN-PRESETS - Built-in presets use `default-` prefix
- CRT-CUSTOM-PRESETS-TASK-01-003-PRESET-VALIDATION - Validation logic available

**Dependencies**:
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - `ICrtStorage` interface to implement
- `libs/domain/src/lib/models/crt-custom-preset.model.ts` - `CustomCrtPreset` model
- `libs/infrastructure/src/lib/crt/crt-validation.ts` - `validatePresetName` function
- `libs/utils/src/lib/logging/logger.service.ts` - Logging service

**Constraints**:
- Use single localStorage key for all presets (atomic updates)
- Add `custom-` prefix in storage service, not before validation
- Maintain existing device-scoped CRT settings operations (don't break them)
- Follow logging standards for all operations

---

## 📂 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/crt/crt-storage.service.ts` - Add custom preset methods
- `libs/infrastructure/src/lib/crt/crt-storage.service.spec.ts` - Add custom preset tests

**Files to Review** (for context):
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Interface to implement
- `libs/infrastructure/src/lib/crt/crt-validation.ts` - Validation function to use
- `libs/utils/src/lib/logging/logger.service.ts` - Logging patterns

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Service Standards](../../../../docs/SERVICE_STANDARDS.md) - Service implementation patterns
- [Logging Standards](../../../../docs/LOGGING_STANDARDS.md) - Error handling and logging
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Service testing approach
- [Store Testing](../../../../docs/STORE_TESTING.md) - State testing patterns (if applicable)

### Key Requirements

#### 1. Establish Test Baseline

**CRITICAL**: Run existing CrtStorageService tests BEFORE making changes:

```bash
# From workspace root
pnpm nx test infrastructure --testPathPattern=crt-storage --watch=false
```

Document any pre-existing failures in technical debt.

#### 2. Add Storage Key Constant

```typescript
private readonly CUSTOM_PRESETS_KEY = 'teensyrom_crt_custom_presets';
private readonly MAX_CUSTOM_PRESETS = 50;
```

#### 3. Implement saveCustomPreset Method

**Signature**:
```typescript
saveCustomPreset(name: string, settings: CrtSettings): void
```

**Implementation Steps**:
1. Load existing custom presets from storage
2. **Validate name** using `validatePresetName(name, existingNames)`
3. If validation fails, throw error with validation message
4. Check preset limit (50) - throw error if exceeded
5. Add `custom-` prefix to create full preset name
6. Create `CustomCrtPreset` object with current timestamp
7. Update or insert preset in array (update if name exists, insert if new)
8. Save updated array to localStorage
9. Log operation success/failure

**Error Cases**:
- Invalid name: Throw `Error(validation.error)`
- Limit exceeded: Throw `Error("Maximum of 50 custom presets reached. Please delete unused presets.")`
- localStorage error: Catch, log warning, re-throw

#### 4. Implement loadCustomPresets Method

**Signature**:
```typescript
loadCustomPresets(): CustomCrtPreset[]
```

**Implementation Steps**:
1. Retrieve JSON from `CUSTOM_PRESETS_KEY`
2. If null/undefined, return empty array
3. Parse JSON to `CustomCrtPreset[]`
4. Handle parse errors - log warning and return empty array
5. Return parsed array

**Error Handling**:
- Missing key: Return `[]` (not an error)
- Parse error: Log warning, return `[]`
- localStorage unavailable: Log warning, return `[]`

#### 5. Implement deleteCustomPreset Method

**Signature**:
```typescript
deleteCustomPreset(name: CustomPresetName): void
```

**Implementation Steps**:
1. Validate name includes `custom-` prefix (type guard or runtime check)
2. Load existing presets
3. Filter out preset with matching name
4. Save updated array back to localStorage
5. Log operation

**Note**: Don't throw error if preset doesn't exist - deletion is idempotent

#### 6. Implement renameCustomPreset Method

**Signature**:
```typescript
renameCustomPreset(oldName: CustomPresetName, newName: string): void
```

**Implementation Steps**:
1. Load existing presets
2. Find preset with `oldName` - throw error if not found
3. Extract existing custom names (excluding `oldName`)
4. **Validate `newName`** using `validatePresetName(newName, existingNames)`
5. If validation fails, throw error with validation message
6. Update preset name to `custom-${newName}`
7. Preset keeps existing settings and `createdAt` timestamp
8. Save updated array to localStorage
9. Log operation

**Error Cases**:
- Old name not found: Throw `Error("Preset not found: ${oldName}")`
- Invalid new name: Throw `Error(validation.error)`
- localStorage error: Catch, log, re-throw

#### 7. Implement hasCustomPreset Method

**Signature**:
```typescript
hasCustomPreset(name: CustomPresetName): boolean
```

**Implementation Steps**:
1. Load custom presets
2. Return `presets.some(p => p.name === name)`
3. Return `false` on any error (don't throw)

#### 8. Add Error Logging

Follow logging standards:
- `logInfo`: Successful save/rename/delete operations
- `logWarn`: Parse errors, missing keys, limit warnings
- `logError`: localStorage failures, unexpected errors

**Example**:
```typescript
this.logger.logInfo('CrtStorageService', 'Saved custom preset', { name: fullName });
this.logger.logWarn('CrtStorageService', 'Failed to parse custom presets', { error });
```

#### 9. Helper Method (Optional)

Consider adding private helper for reading/writing preset array:
```typescript
private readCustomPresets(): CustomCrtPreset[]
private writeCustomPresets(presets: CustomCrtPreset[]): void
```

This reduces duplication across CRUD methods.

---

## 🧪 Testing Requirements

### Test Coverage Required

**Before Implementation**:
- [ ] Run storage service test suite and capture baseline

**Unit Tests** (add to `crt-storage.service.spec.ts`):

#### saveCustomPreset Tests
- [ ] Saves new preset with `custom-` prefix added
- [ ] Updates existing preset if name matches (overwrite behavior)
- [ ] Adds ISO 8601 timestamp to `createdAt`
- [ ] Validates name before saving
- [ ] Throws error on invalid name
- [ ] Throws error when 50-preset limit reached
- [ ] Logs success on save
- [ ] Handles localStorage write errors gracefully

#### loadCustomPresets Tests
- [ ] Returns empty array when no presets exist
- [ ] Returns all saved presets correctly
- [ ] Parses preset array with correct structure
- [ ] Returns empty array on parse error
- [ ] Logs warning on parse failure
- [ ] Handles localStorage unavailable

#### deleteCustomPreset Tests
- [ ] Removes preset from storage
- [ ] Handles non-existent preset gracefully (no error)
- [ ] Preserves other presets when deleting one
- [ ] Updates localStorage correctly
- [ ] Logs operation

#### renameCustomPreset Tests
- [ ] Updates preset name while preserving settings
- [ ] Preserves `createdAt` timestamp
- [ ] Validates new name before renaming
- [ ] Throws error on invalid new name
- [ ] Throws error if old name not found
- [ ] Prevents duplicate names
- [ ] Logs success

#### hasCustomPreset Tests
- [ ] Returns true for existing preset
- [ ] Returns false for non-existent preset
- [ ] Returns false (not throw) on storage errors

#### Integration Tests
- [ ] Save → Load → Verify preset persisted
- [ ] Save → Rename → Load → Verify new name
- [ ] Save multiple → Delete one → Load → Verify correct count
- [ ] Save 50 presets → Attempt 51st → Verify error

**Testing Standards Reference**:
- See [Testing Standards](../../../../docs/TESTING_STANDARDS.md) for service testing patterns
- Mock localStorage using Vitest mocks
- Use `beforeEach` to reset localStorage state

---

## ⚠️ Anti-Patterns to Avoid

1. **Prefix Timing**: Don't add `custom-` prefix before validation - add it AFTER
2. **Silent Failures**: Don't catch and swallow errors - log and re-throw
3. **Multiple Keys**: Don't use separate localStorage keys per preset - use single array
4. **Missing Validation**: Don't skip validation in save/rename operations
5. **Mutation**: Don't mutate loaded arrays - create new array on updates
6. **Missing Logging**: Don't skip logging for debugging/monitoring

---

## 📊 Expected File Impact

**Modified Files**:
- `crt-storage.service.ts` - Add ~200 lines (5 methods + helpers)
- `crt-storage.service.spec.ts` - Add ~400 lines (comprehensive tests)

**Total**: 2 modified files, ~600 lines added

**Complexity**: Medium - straightforward CRUD with validation and error handling

---

## 🔗 Integration Points

**Upstream Dependencies**:
- ✅ Task 1 (Domain Contracts) completed
- ✅ Task 2 (Built-in Presets Renamed) completed
- ✅ Task 3 (Validation Logic) completed

**Downstream Consumers**:
- 🔄 Phase 2: UI dialogs will call these methods
- 🔄 Phase 3: Settings panel will integrate CRUD operations
- 🔄 Application stores may wrap these service methods

**Injection Token**: Service should already be bound to `CRT_STORAGE` injection token from domain layer.

---

## 🚦 Next Steps After Completion

1. Verify all storage tests pass (including baseline tests)
2. Manual test in browser console:
   ```typescript
   service.saveCustomPreset('Test', settings);
   service.loadCustomPresets();
   service.renameCustomPreset('custom-Test', 'Updated');
   service.deleteCustomPreset('custom-Updated');
   ```
3. Document any edge cases in completion report
4. Proceed to Task 5 (Type System refinement)

---

## 📝 Notes

**localStorage Key Design**: Using a single key with JSON array provides:
- Atomic updates (read-modify-write in one operation)
- Simple enumeration (load once, get all presets)
- Reduced localStorage fragmentation

**Timestamp Format**: Use `new Date().toISOString()` for consistent ISO 8601 timestamps across all presets.

**Overwrite Behavior**: When saving a preset with an existing name, the old preset is overwritten (settings updated, timestamp refreshed). This is intentional - "save" means "save current state as this name".

**Future Enhancement**: Consider adding a `modifiedAt` timestamp separate from `createdAt` to track edits.
