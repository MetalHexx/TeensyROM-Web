# Phase 4: Refactor to Reusable Named Item Dialog

## 🎯 Objective

Transform the `PresetNameDialogComponent` into a truly reusable `NamedItemDialogComponent` that can validate and manage names for any domain entity (presets, playlists, devices, etc.). This refactoring extracts CRT-specific logic, generalizes the component interface, and establishes patterns for reusable validation across the application.

**Why This Matters**: Multiple features need name input with validation (playlists, device configurations, custom themes, etc.). Rather than building separate dialogs for each, we create one battle-tested, accessible, keyboard-friendly component that handles all name-entry scenarios.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md) - Original feature context
- [ ] [Phase 2: UI Dialog Components](./CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md) - Original dialog implementation

**Component Documentation:**

- [ ] [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Reusable component patterns
- [ ] [Scaling Compact Card](../../../../docs/COMPONENT_LIBRARY.md#scaling-compact-card) - Animation wrapper

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component design patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing reusable components
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── named-item-dialog/                        ✨ New folder (renamed from preset-name-dialog)
│   ├── named-item-dialog.component.ts        📝 Renamed & Refactored - Generic dialog
│   ├── named-item-dialog.component.html      📝 Modified - Generic template
│   ├── named-item-dialog.component.scss      📝 Modified - Generic styles
│   ├── named-item-dialog.component.spec.ts   📝 Modified - Generic tests
│   └── index.ts                              📝 Modified - Export renamed component
├── preset-name-dialog/                       ❌ Deleted - No longer needed
└── index.ts                                  📝 Modified - Update exports

libs/features/*/src/                          📝 Modified - Update imports
├── **/*.component.ts                         📝 Multiple files - Update component refs
└── **/*.spec.ts                              📝 Multiple files - Update test refs

docs/
├── COMPONENT_LIBRARY.md                      📝 Modified - Add named-item-dialog entry
└── projects/CRT-CUSTOM-PRESETS/
    └── phases/
        └── **/*.md                           📝 Modified - Update references
```

---

<details open>
<summary><h3>Task 1: Rename and Refactor Component Class</h3></summary>

**Purpose**: Rename `PresetNameDialogComponent` to `NamedItemDialogComponent` and remove CRT-specific assumptions.

**Related Documentation:**

- [Coding Standards](../../../CODING_STANDARDS.md) - Component naming conventions
- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Reusable patterns

**Implementation Subtasks:**

- [ ] **Rename Component File**: Rename `preset-name-dialog.component.ts` → `named-item-dialog.component.ts`
- [ ] **Rename Component Class**: `PresetNameDialogComponent` → `NamedItemDialogComponent`
- [ ] **Update Selector**: `lib-preset-name-dialog` → `lib-named-item-dialog`
- [ ] **Rename Folder**: `preset-name-dialog/` → `named-item-dialog/`
- [ ] **Generalize Inputs**: Update input names and defaults to be domain-agnostic
- [ ] **Update JSDoc**: Remove preset-specific language, describe generic use cases
- [ ] **Update Validation Type**: Keep `PresetNameValidationFn` but rename to `NameValidationFn`

**Testing Subtask:**

- [ ] **Update Tests**: Rename test file and update test descriptions (see Testing section below)

**Key Implementation Notes:**

**Before (CRT-specific):**
```typescript
@Component({
  selector: 'lib-preset-name-dialog',
  // ...
})
export class PresetNameDialogComponent {
  title = input<string>('Save Preset');
  initialValue = input<string>('');
  reservedNames = input<string[]>([]);
  validationFn = input.required<PresetNameValidationFn>();
  
  confirmed = output<string>();
  cancelled = output<void>();
}
```

**After (Generic):**
```typescript
@Component({
  selector: 'lib-named-item-dialog',
  // ...
})
export class NamedItemDialogComponent {
  // Generic title with no default (caller specifies purpose)
  title = input.required<string>();
  
  // Optional subtitle for additional context
  subtitle = input<string>('');
  
  // Initial value for rename/edit scenarios
  initialValue = input<string>('');
  
  // Reserved/existing names to prevent duplicates
  existingNames = input<string[]>([]);
  
  // Generic validation function
  validationFn = input.required<NameValidationFn>();
  
  // Label for save button (e.g., "Save", "Create", "Rename")
  confirmLabel = input<string>('Save');
  
  confirmed = output<string>();
  cancelled = output<void>();
}
```

**Rationale for Changes**:
- `title` now required - forces caller to be explicit about purpose
- `subtitle` added for additional context (e.g., "Enter a unique name for your playlist")
- `existingNames` renamed from `reservedNames` - clearer for non-preset use cases
- `confirmLabel` added - "Save Preset" vs "Create Playlist" vs "Rename Device"
- Character limit (50) remains hardcoded but could be made configurable in future

**Type Rename:**
```typescript
// Before
export type PresetNameValidationFn = (name: string, existingNames: string[]) => string;

// After
export type NameValidationFn = (name: string, existingNames: string[]) => string;

// Keep alias for backward compatibility (remove in future major version)
/** @deprecated Use NameValidationFn instead */
export type PresetNameValidationFn = NameValidationFn;
```

</details>

---

<details open>
<summary><h3>Task 2: Update Template and Styles</h3></summary>

**Purpose**: Generalize template text and styling to remove CRT-specific presentation.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns
- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Template patterns

**Implementation Subtasks:**

- [ ] **Update Template File**: Rename `preset-name-dialog.component.html` → `named-item-dialog.component.html`
- [ ] **Remove Hardcoded Text**: Ensure all text comes from inputs (no "preset" mentions)
- [ ] **Update SCSS File**: Rename `preset-name-dialog.component.scss` → `named-item-dialog.component.scss`
- [ ] **Review Styles**: Ensure styles are generic (no preset-specific classes/colors)
- [ ] **Update Button Text**: Use `confirmLabel()` input instead of hardcoded "Save"
- [ ] **Add Subtitle Display**: Show `subtitle()` if provided

**Testing Subtask:**

- [ ] **Smoke Test**: Verify dialog displays correctly with different input combinations

**Key Template Changes:**

**Before:**
```html
<lib-scaling-compact-card>
  <div class="preset-dialog-header">
    <h2>{{ title() }}</h2>
  </div>
  
  <mat-form-field>
    <mat-label>Preset Name</mat-label>
    <input matInput [(ngModel)]="currentName" (keydown)="onKeyDown($event)" />
  </mat-form-field>
  
  <button mat-raised-button [disabled]="!canSave()" (click)="onSaveClick()">
    Save
  </button>
</lib-scaling-compact-card>
```

**After:**
```html
<lib-scaling-compact-card>
  <div class="dialog-header">
    <h2>{{ title() }}</h2>
    @if (subtitle()) {
      <p class="dialog-subtitle">{{ subtitle() }}</p>
    }
  </div>
  
  <mat-form-field>
    <mat-label>Name</mat-label>
    <input matInput [(ngModel)]="currentName" (keydown)="onKeyDown($event)" />
  </mat-form-field>
  
  <button mat-raised-button [disabled]="!canSave()" (click)="onSaveClick()">
    {{ confirmLabel() }}
  </button>
</lib-scaling-compact-card>
```

**SCSS Changes:**
```scss
// Before: .preset-dialog-header
// After: .dialog-header

.dialog-header {
  text-align: center;
  margin-bottom: 1rem;
  
  h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .dialog-subtitle {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
    opacity: 0.7;
  }
}
```

</details>

---

<details open>
<summary><h3>Task 3: Update CRT Feature to Use Renamed Component</h3></summary>

**Purpose**: Update all CRT feature code to import and use the renamed `NamedItemDialogComponent`.

**Related Documentation:**

- [Phase 3: Settings Panel Integration](./CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md) - Integration context

**Implementation Subtasks:**

- [ ] **Find All Imports**: Search codebase for `PresetNameDialogComponent` imports
- [ ] **Update Component Imports**: Replace with `NamedItemDialogComponent`
- [ ] **Update Component Usage**: Update template references from `lib-preset-name-dialog` → `lib-named-item-dialog`
- [ ] **Update Input Bindings**: Update `[reservedNames]` → `[existingNames]`, add `[title]` and `[confirmLabel]`
- [ ] **Update Test Imports**: Fix test files importing the component
- [ ] **Verify Compilation**: Ensure no TypeScript errors after rename

**Testing Subtask:**

- [ ] **Run Integration Tests**: Verify CRT preset workflows still function correctly

**Key Usage Updates:**

**Before:**
```typescript
import { PresetNameDialogComponent } from '@teensyrom-nx/ui/components';

// In template:
<lib-preset-name-dialog
  [initialValue]="presetName"
  [reservedNames]="existingPresetNames"
  [validationFn]="validatePresetName"
  (confirmed)="onPresetNameConfirmed($event)"
  (cancelled)="onDialogClose()"
/>
```

**After:**
```typescript
import { NamedItemDialogComponent } from '@teensyrom-nx/ui/components';

// In template:
<lib-named-item-dialog
  [title]="'Save Preset'"
  [subtitle]="'Enter a name for your custom CRT preset'"
  [initialValue]="presetName"
  [existingNames]="existingPresetNames"
  [validationFn]="validatePresetName"
  [confirmLabel]="isRename ? 'Rename' : 'Save'"
  (confirmed)="onPresetNameConfirmed($event)"
  (cancelled)="onDialogClose()"
/>
```

**Search Commands:**
```bash
# Find all component references
rg "PresetNameDialogComponent" --type ts

# Find all template references
rg "lib-preset-name-dialog" --type html
rg "lib-preset-name-dialog" --type ts

# Find all type references
rg "PresetNameValidationFn" --type ts
```

</details>

---

<details open>
<summary><h3>Task 4: Update Documentation</h3></summary>

**Purpose**: Document the new reusable component in the component library and update phase documentation.

**Related Documentation:**

- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Component catalog

**Implementation Subtasks:**

- [ ] **Add Component Entry**: Add `NamedItemDialogComponent` to Component Library
- [ ] **Document Inputs**: List all inputs with types and descriptions
- [ ] **Provide Usage Examples**: Show preset, playlist, and device name examples
- [ ] **Document Validation Pattern**: Explain `NameValidationFn` interface
- [ ] **Update Phase Docs**: Update references in Phase 2 and Phase 3 documentation
- [ ] **Update Master Plan**: Note refactoring in master plan's evolution section

**Testing Subtask:**

- [ ] **Review Documentation**: Ensure examples compile and make sense

**Component Library Entry:**

```markdown
### NamedItemDialogComponent

**Selector**: `lib-named-item-dialog`

**Purpose**: Generic dialog for entering and validating names for domain entities (presets, playlists, devices, etc.). Provides real-time validation feedback, character counting, and keyboard navigation.

**Inputs**:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | *required* | Dialog title (e.g., "Save Preset", "Create Playlist") |
| `subtitle` | `string` | `''` | Optional subtitle for additional context |
| `initialValue` | `string` | `''` | Initial name value (for rename scenarios) |
| `existingNames` | `string[]` | `[]` | Array of existing names to prevent duplicates |
| `validationFn` | `NameValidationFn` | *required* | Function that validates name and returns error message or empty string |
| `confirmLabel` | `string` | `'Save'` | Label for confirm button (e.g., "Create", "Rename", "Save") |

**Outputs**:

| Output | Type | Description |
|--------|------|-------------|
| `confirmed` | `string` | Emitted when user confirms with valid name (trimmed) |
| `cancelled` | `void` | Emitted when user cancels dialog |

**Features**:

- ✨ Real-time validation with computed signals
- ✨ Character counter (0/50 max characters)
- ✨ Keyboard navigation (Enter to save, Escape to cancel)
- ✨ Automatic input focus on open
- ✨ Save button disabled when invalid or empty
- ✨ Animated entry/exit via `ScalingCompactCardComponent`

**Usage Examples**:

**CRT Preset Name:**
```typescript
<lib-named-item-dialog
  [title]="'Save Preset'"
  [subtitle]="'Enter a name for your custom CRT preset'"
  [existingNames]="existingPresetNames"
  [validationFn]="validatePresetName"
  (confirmed)="onPresetSaved($event)"
  (cancelled)="onDialogClose()"
/>
```

**Playlist Name:**
```typescript
<lib-named-item-dialog
  [title]="'Create Playlist'"
  [subtitle]="'Choose a unique name for your playlist'"
  [existingNames]="existingPlaylistNames"
  [validationFn]="validatePlaylistName"
  [confirmLabel]="'Create'"
  (confirmed)="onPlaylistCreated($event)"
  (cancelled)="onDialogClose()"
/>
```

**Device Rename:**
```typescript
<lib-named-item-dialog
  [title]="'Rename Device'"
  [initialValue]="currentDeviceName"
  [existingNames]="otherDeviceNames"
  [validationFn]="validateDeviceName"
  [confirmLabel]="'Rename'"
  (confirmed)="onDeviceRenamed($event)"
  (cancelled)="onDialogClose()"
/>
```

**Validation Function Interface:**

```typescript
export type NameValidationFn = (
  name: string,
  existingNames: string[]
) => string; // Returns error message or empty string if valid

// Example implementation:
function validatePlaylistName(name: string, existingNames: string[]): string {
  if (name.trim().length === 0) return 'Playlist name cannot be empty';
  if (name.length > 50) return 'Playlist name must be 50 characters or less';
  if (!/^[a-zA-Z0-9\s-]+$/.test(name)) return 'Only letters, numbers, spaces, and hyphens allowed';
  if (existingNames.some(n => n.toLowerCase() === name.toLowerCase())) {
    return 'A playlist with this name already exists';
  }
  return ''; // Valid
}
```

**Used In**:
- CRT Settings Panel (preset name entry)
- *(Future)* Playlist Manager (playlist creation/rename)
- *(Future)* Device Manager (device rename)

**Component Tree**:
```
NamedItemDialogComponent
└── ScalingCompactCardComponent
    ├── DialogHeader (title + optional subtitle)
    ├── MatFormField (input with validation)
    ├── ValidationMessage (conditionally shown)
    ├── CharacterCounter (e.g., "25/50")
    └── ButtonGroup (confirm + cancel)
```
```

</details>

---

<details open>
<summary><h3>Task 5: Create Example Validation Functions</h3></summary>

**Purpose**: Provide reference validation functions for common use cases to guide future implementations.

**Related Documentation:**

- [Service Standards](../../../SERVICE_STANDARDS.md) - Validation patterns

**Implementation Subtasks:**

- [ ] **Create Validation Examples File**: `libs/ui/components/src/lib/named-item-dialog/validation-examples.ts`
- [ ] **Implement Preset Validator**: Move CRT preset validation to example
- [ ] **Implement Playlist Validator**: Create example for future playlist feature
- [ ] **Implement Device Validator**: Create example for device naming
- [ ] **Add JSDoc Comments**: Document each validator's rules and usage
- [ ] **Export Examples**: Export from barrel file with clear naming

**Testing Subtask:**

- [ ] **Test Each Validator**: Write unit tests for all validation examples

**Validation Examples File:**

```typescript
/**
 * Example validation functions for NamedItemDialogComponent.
 * These demonstrate common validation patterns for different domain entities.
 */

/**
 * Validates CRT preset names.
 * 
 * Rules:
 * - Min 1 character (after trim)
 * - Max 50 characters
 * - Alphanumeric, spaces, hyphens only
 * - Cannot match built-in preset names (case-insensitive)
 * - Cannot match existing custom preset names (case-insensitive)
 * 
 * @example
 * validatePresetName('My Gaming Preset', ['existing-preset']) // ''
 * validatePresetName('fullscreen-webgl', []) // 'This name is reserved...'
 */
export function validatePresetName(
  name: string,
  existingNames: string[]
): string {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return 'Preset name cannot be empty';
  }
  
  if (trimmed.length > 50) {
    return 'Preset name must be 50 characters or less';
  }
  
  if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
    return 'Preset name can only contain letters, numbers, spaces, and hyphens';
  }
  
  const reservedNames = [
    'fullscreen-webgl',
    'fullscreen-css',
    'dialog-webgl',
    'dialog-css',
    'dialog-css-minimalist'
  ];
  
  if (reservedNames.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
    return 'This name is reserved for a built-in preset';
  }
  
  if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
    return 'A preset with this name already exists';
  }
  
  return '';
}

/**
 * Validates playlist names.
 * 
 * Rules:
 * - Min 1 character (after trim)
 * - Max 100 characters (longer than presets)
 * - Alphanumeric, spaces, hyphens, underscores allowed
 * - Cannot match existing playlist names (case-insensitive)
 */
export function validatePlaylistName(
  name: string,
  existingNames: string[]
): string {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return 'Playlist name cannot be empty';
  }
  
  if (trimmed.length > 100) {
    return 'Playlist name must be 100 characters or less';
  }
  
  if (!/^[a-zA-Z0-9\s-_]+$/.test(trimmed)) {
    return 'Playlist name can only contain letters, numbers, spaces, hyphens, and underscores';
  }
  
  if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
    return 'A playlist with this name already exists';
  }
  
  return '';
}

/**
 * Validates device names.
 * 
 * Rules:
 * - Min 1 character (after trim)
 * - Max 30 characters (shorter for display purposes)
 * - Alphanumeric, spaces, hyphens only
 * - Cannot match existing device names (case-insensitive)
 */
export function validateDeviceName(
  name: string,
  existingNames: string[]
): string {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return 'Device name cannot be empty';
  }
  
  if (trimmed.length > 30) {
    return 'Device name must be 30 characters or less';
  }
  
  if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
    return 'Device name can only contain letters, numbers, spaces, and hyphens';
  }
  
  if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
    return 'A device with this name already exists';
  }
  
  return '';
}
```

**Testing Example:**

```typescript
// validation-examples.spec.ts
describe('Validation Examples', () => {
  describe('validatePresetName', () => {
    it('rejects empty name', () => {
      expect(validatePresetName('', [])).toContain('cannot be empty');
    });
    
    it('rejects reserved names', () => {
      expect(validatePresetName('fullscreen-webgl', [])).toContain('reserved');
    });
    
    it('accepts valid unique name', () => {
      expect(validatePresetName('My Preset', [])).toBe('');
    });
  });
  
  // ... more tests
});
```

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/ui/components/src/lib/named-item-dialog/validation-examples.ts` (new)
- `libs/ui/components/src/lib/named-item-dialog/validation-examples.spec.ts` (new)

**Renamed Files:**

- `preset-name-dialog/preset-name-dialog.component.ts` → `named-item-dialog/named-item-dialog.component.ts`
- `preset-name-dialog/preset-name-dialog.component.html` → `named-item-dialog/named-item-dialog.component.html`
- `preset-name-dialog/preset-name-dialog.component.scss` → `named-item-dialog/named-item-dialog.component.scss`
- `preset-name-dialog/preset-name-dialog.component.spec.ts` → `named-item-dialog/named-item-dialog.component.spec.ts`
- `preset-name-dialog/index.ts` → `named-item-dialog/index.ts`

**Modified Files:**

- `libs/ui/components/src/lib/index.ts` - Update exports
- `libs/features/*/src/**/*.component.ts` - Update imports (multiple files)
- `libs/features/*/src/**/*.spec.ts` - Update test imports (multiple files)
- `docs/COMPONENT_LIBRARY.md` - Add component entry
- `docs/projects/CRT-CUSTOM-PRESETS/phases/*.md` - Update references

**Deleted Folders:**

- `libs/ui/components/src/lib/preset-name-dialog/` (renamed to `named-item-dialog/`)

**Total**: ~2 new files, ~20-30 modified files, 1 folder renamed

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] Component renamed to `NamedItemDialogComponent` with generic interface
- [ ] All CRT feature code updated to use renamed component
- [ ] Component works identically to original implementation
- [ ] New inputs (`title`, `subtitle`, `confirmLabel`) functional
- [ ] Validation examples created for preset, playlist, and device names

**Testing Requirements:**

- [ ] All existing tests updated and passing
- [ ] Validation example tests written and passing
- [ ] Integration tests verify CRT preset workflows still work
- [ ] Component compiles without TypeScript errors
- [ ] No broken imports or references in codebase

**Documentation Requirements:**

- [ ] Component Library entry created with usage examples
- [ ] All phase documentation references updated
- [ ] Validation function interface documented
- [ ] Migration notes added to phase documentation

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] Component remains fully accessible (keyboard nav, ARIA labels)
- [ ] Component maintains existing animation behavior

**Ready for Future Use:**

- [ ] Component interface is intuitive and self-documenting
- [ ] Validation pattern is clear and easy to replicate
- [ ] Examples cover common use cases
- [ ] Component is truly domain-agnostic

---

## 📝 Notes & Considerations

### Design Decisions

**Why Not Make Character Limit Configurable?**

Current implementation hardcodes 50-character limit. We could add `maxLength` input, but:
- 50 chars is reasonable for most "name" use cases
- Keeping it simple reduces cognitive load
- Can add configurability later if needed
- Most validation functions will have their own limits anyway

**Backward Compatibility**

Keeping `PresetNameValidationFn` as deprecated alias allows gradual migration. Remove in next major version after all callsites updated.

**Validation Function Location**

Validation logic stays in infrastructure/domain layers (e.g., `crt-validation.ts`). The `validation-examples.ts` file is for reference only - actual validators live in their respective feature modules.

### Migration Impact

**Low-Risk Refactoring**: Since component was just created in Phase 2, impact is minimal:
- Only CRT feature uses it currently
- No external dependencies
- Straightforward rename operation
- Tests catch any issues immediately

**Future Benefits**:
- Playlist feature can reuse immediately
- Device rename feature can reuse
- Settings/theme naming can reuse
- Consistent validation UX across app

### Alternative Considered

**Keep Both Components**: Could keep `PresetNameDialogComponent` and create separate `NamedItemDialogComponent`, but:
- Creates maintenance burden (two similar components)
- Violates DRY principle
- Original component is too new to have widespread usage
- Refactoring now is cleaner than maintaining two versions

---

## 📚 Related Documentation

- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Component catalog
- [Phase 2: UI Dialog Components](./CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md) - Original implementation
- [Coding Standards](../../../CODING_STANDARDS.md) - Component design patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing reusable components

---

## 🎯 Definition of Done

- [ ] All 5 tasks completed with subtasks checked off
- [ ] Component renamed and refactored successfully
- [ ] All CRT feature code updated and tested
- [ ] Documentation complete in Component Library
- [ ] Validation examples created with tests
- [ ] All tests passing (unit, integration, e2e)
- [ ] No TypeScript or linting errors
- [ ] Code review completed
- [ ] Migration notes documented

**Estimated Effort**: 6-8 hours (1-2 implementation sessions)

**Dependencies**: Phase 2 must be complete (original dialog implemented)

**Risks**: Low - straightforward refactoring with minimal usage footprint
