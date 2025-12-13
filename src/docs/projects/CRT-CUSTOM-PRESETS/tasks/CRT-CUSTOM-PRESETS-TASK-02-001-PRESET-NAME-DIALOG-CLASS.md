# Task Handoff: Preset Name Dialog Component Class

**Task ID**: CRT-CUSTOM-PRESETS-TASK-02-001-PRESET-NAME-DIALOG-CLASS  
**Task Name**: Create Preset Name Dialog Component Class  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (~3 files)

---

## 🎯 Objective

**What**: Create the TypeScript component class for the preset name entry dialog with real-time validation, computed signals for UI state, and keyboard navigation support.

**Why**: This dialog provides the primary UI for users to name custom presets with immediate feedback on validation errors, ensuring quality user experience during preset creation and renaming workflows.

**Success Criteria**:
- [ ] `PresetNameDialogComponent` class created as standalone component
- [ ] Input properties defined: `title`, `initialValue`, `reservedNames`
- [ ] Output events defined: `confirmed`, `cancelled`
- [ ] Computed signals implemented: `validationError`, `remainingChars`, `canSave`
- [ ] Validation logic integrated from Phase 1 utilities
- [ ] Keyboard handlers implemented (Enter to confirm, Escape to cancel)
- [ ] Component compiles without TypeScript errors
- [ ] All behavioral tests pass (15+ tests expected)

---

## 📋 Prerequisites Completed

- ✅ **CRT-CUSTOM-PRESETS-TASK-01-005-TYPE-SYSTEM**: Type guards and utility functions available
- ✅ **CRT-CUSTOM-PRESETS-TASK-01-003-PRESET-VALIDATION**: Validation functions implemented
- ✅ **Phase 1 Complete**: Storage infrastructure and type system ready

---

## 📦 Dependencies

**Angular Packages**:
- `@angular/core` - Component, input(), output(), signal(), computed()
- `@angular/material/button` - Material button components
- `@angular/material/form-field` - Material form field
- `@angular/material/input` - Material input directive
- `@angular/material/icon` - Material icons

**Internal Dependencies**:
- `@teensyrom-nx/ui/components` - `lib-scaling-compact-card`, `lib-icon-button`
- Type guards and utilities from Phase 1 (import from appropriate locations)

**Constraints**:
- Must be standalone component (no NgModule)
- Must use signal-based inputs/outputs (Angular 19 pattern)
- Must follow Clean Architecture - no direct service injection
- Validation logic passed via inputs, not embedded

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts` - Component class

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Similar dialog patterns
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Validation utilities (Phase 1)

**Files to Modify** (in future tasks):
- None (template and styles are separate tasks)

---

## 🔧 Implementation Guidance

### Component Structure

```typescript
import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCompactCardComponent } from '../scaling-compact-card';
import { IconButtonComponent } from '../icon-button';

@Component({
  selector: 'lib-preset-name-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    ScalingCompactCardComponent,
    IconButtonComponent,
  ],
  templateUrl: './preset-name-dialog.component.html',
  styleUrl: './preset-name-dialog.component.scss',
})
export class PresetNameDialogComponent {
  // Input properties
  title = input<string>('Save Preset');
  initialValue = input<string>('');
  reservedNames = input<string[]>([]);
  
  // Output events
  confirmed = output<string>();
  cancelled = output<void>();
  
  // Component state
  currentName = signal<string>(''); // Initialize with initialValue in ngOnInit
  
  // Computed signals
  validationError = computed<string>(() => {
    // Call validation function from Phase 1
    // Return error message or empty string
  });
  
  remainingChars = computed<string>(() => {
    // Calculate 50 - currentName().length
    // Format as "X/50"
  });
  
  canSave = computed<boolean>(() => {
    // Check: no validation error AND name not empty (after trim)
  });
  
  // Lifecycle hooks
  ngOnInit(): void {
    // Initialize currentName with initialValue
  }
  
  // Event handlers
  onSaveClick(): void {
    if (!this.canSave()) return;
    this.confirmed.emit(this.currentName().trim());
  }
  
  onCancelClick(): void {
    this.cancelled.emit();
  }
  
  onKeyDown(event: KeyboardEvent): void {
    // Handle Enter (save if valid) and Escape (cancel)
  }
}
```

### Key Requirements

1. **Signal-Based Inputs**:
   - Use `input<T>()` for all input properties
   - Default values provided: `title = input<string>('Save Preset')`
   - Read via `this.title()` in methods

2. **Validation Integration**:
   - Import validation function from Phase 1 utilities
   - Call in `validationError` computed signal
   - Pass `currentName()`, `reservedNames()` as parameters
   - Return error message string or empty string for valid

3. **Character Counter Logic**:
   - Max length is 50 characters
   - Format: "25/50" (current/max)
   - Computed from `currentName().length`

4. **Can Save Logic**:
   - Must have: `validationError() === ''`
   - Must have: `currentName().trim() !== ''`
   - Both conditions required

5. **Keyboard Navigation**:
   - Enter key: call `onSaveClick()` if `canSave()` is true
   - Escape key: call `onCancelClick()`
   - Attach to form field or container element

6. **Initial Value Handling**:
   - In `ngOnInit()`, set `this.currentName.set(this.initialValue())`
   - This supports rename scenario where existing name is pre-filled

### Validation Function Usage

Phase 1 created validation utilities. Import and use them:

```typescript
// Example (adjust import path as needed)
import { validatePresetName } from '../crt-effect-wrapper/crt-settings.interface';

// In validationError computed:
validationError = computed<string>(() => {
  const name = this.currentName();
  const reserved = this.reservedNames();
  return validatePresetName(name, reserved); // Returns error message or ''
});
```

**Note**: Check actual function name and signature from Phase 1 task reports. It may be named differently or require different parameters.

---

## 🧪 Testing Requirements

### Test Coverage Required

**File**: `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.spec.ts`

**Behavioral Expectations** (15+ tests):

**Input/Output Tests**:
- [ ] Component initializes with default title "Save Preset"
- [ ] Component displays custom title when provided via input
- [ ] `currentName` initializes to empty string
- [ ] `currentName` initializes to `initialValue` when provided
- [ ] `reservedNames` input passes to validation

**Validation Signal Tests**:
- [ ] `validationError` returns error for empty name
- [ ] `validationError` returns error for invalid characters
- [ ] `validationError` returns error for reserved names
- [ ] `validationError` returns error for name over 50 chars
- [ ] `validationError` returns empty string for valid name

**Character Counter Tests**:
- [ ] `remainingChars` shows "0/50" for empty name
- [ ] `remainingChars` shows "10/50" for 10-character name
- [ ] `remainingChars` shows "50/50" for 50-character name

**Can Save Logic Tests**:
- [ ] `canSave` is false when name is empty
- [ ] `canSave` is false when validation error exists
- [ ] `canSave` is true when name is valid and non-empty

**Event Emission Tests**:
- [ ] `onSaveClick()` emits `confirmed` with trimmed name when `canSave` is true
- [ ] `onSaveClick()` does not emit when `canSave` is false
- [ ] `onCancelClick()` emits `cancelled` event

**Keyboard Navigation Tests**:
- [ ] Enter key triggers save when name is valid
- [ ] Enter key does nothing when name is invalid
- [ ] Escape key triggers cancel

### Testing Approach

Use Angular Testing Library or standard TestBed approach:

```typescript
describe('PresetNameDialogComponent', () => {
  let component: PresetNameDialogComponent;
  let fixture: ComponentFixture<PresetNameDialogComponent>;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresetNameDialogComponent], // Standalone component
    }).compileComponents();
    
    fixture = TestBed.createComponent(PresetNameDialogComponent);
    component = fixture.componentInstance;
  });
  
  it('should initialize with default title', () => {
    expect(component.title()).toBe('Save Preset');
  });
  
  // ... more tests
});
```

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing approach

---

## 📚 Related Documentation

**Planning Documents**:
- [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md)
- [Phase 2: UI Dialog Components](../phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Phase 1 Reports** (context):
- [Task 1-5 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-005-REPORT.md) - Type system and utility functions
- [Task 1-3 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-003-REPORT.md) - Validation logic

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Angular component patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component-specific testing
- [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable component reference

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-02-002-PRESET-NAME-DIALOG-TEMPLATE: Template implementation (next)
- CRT-CUSTOM-PRESETS-TASK-02-003-PRESET-NAME-DIALOG-STYLES: Styling (after template)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 🎯 Anti-Patterns to Avoid

❌ **Don't inject services** - This is a presentational component, validation passed via inputs  
❌ **Don't embed validation logic** - Use Phase 1 utility functions  
❌ **Don't use `@Input()` / `@Output()` decorators** - Use signal-based `input()` / `output()`  
❌ **Don't use `*ngIf` / `*ngFor`** - Use `@if` / `@for` control flow (Angular 19)  
❌ **Don't forget keyboard navigation** - Enter/Escape keys are critical UX  
❌ **Don't skip initialization** - Set `currentName` from `initialValue` in `ngOnInit()`  

---

## 💡 Implementation Tips

1. **Start with minimal class structure** - Get compilation working first
2. **Add computed signals incrementally** - Test each one as you add it
3. **Mock validation function initially** - Can return empty string, then integrate real one
4. **Test keyboard handlers thoroughly** - Easy to miss edge cases
5. **Use fixture.detectChanges()** - Required to trigger signal updates in tests

---

**Ready to implement?** Create the component class with all signals, handlers, and comprehensive tests. Focus on behavioral testing - what users observe, not implementation details.
