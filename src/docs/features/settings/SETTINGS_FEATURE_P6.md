# Phase 6: Reactive Forms & Section Components

## 🎯 Objective

Implement reactive forms architecture with decomposed section components. Each settings section (Player, FileTransfer, Search, App) becomes a child component receiving its FormGroup as input, creating a clean hierarchy for form management. This phase transforms the read-only view from Phase 5 into an interactive form while maintaining clean component boundaries and proper validation.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 5 Completion](./SETTINGS_FEATURE_P5.md) - Settings view and card layout (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Component and form patterns
- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Form styling conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Angular Documentation:**

- Angular Reactive Forms Guide - Form building and validation
- Angular Material Form Fields - Material form components

---

## 📂 File Structure Overview

> New section components and form architecture.

```
libs/features/settings/src/lib/
├── settings-view/
│   ├── settings-view.component.ts            📝 Modified - Add FormGroup building
│   ├── settings-view.component.html          📝 Modified - Pass FormGroups to sections
│   └── settings-view.component.spec.ts       📝 Modified - Add form tests
└── components/
    ├── player-settings/
    │   ├── player-settings.component.ts      ✨ New - Player section form
    │   ├── player-settings.component.html    ✨ New - Player form template
    │   ├── player-settings.component.scss    ✨ New - Player form styles
    │   └── player-settings.component.spec.ts ✨ New - Player form tests
    ├── file-transfer-settings/
    │   ├── file-transfer-settings.component.ts ✨ New - File transfer form
    │   ├── file-transfer-settings.component.html ✨ New
    │   ├── file-transfer-settings.component.scss ✨ New
    │   └── file-transfer-settings.component.spec.ts ✨ New
    ├── search-settings/
    │   ├── search-settings.component.ts      ✨ New - Search section form
    │   ├── search-settings.component.html    ✨ New
    │   ├── search-settings.component.scss    ✨ New
    │   └── search-settings.component.spec.ts ✨ New
    ├── search-weights/
    │   ├── search-weights.component.ts       ✨ New - Search weights sub-section
    │   ├── search-weights.component.html     ✨ New
    │   ├── search-weights.component.scss     ✨ New
    │   └── search-weights.component.spec.ts  ✨ New
    └── app-settings/
        ├── app-settings.component.ts         ✨ New - App section form
        ├── app-settings.component.html       ✨ New
        ├── app-settings.component.scss       ✨ New
        └── app-settings.component.spec.ts    ✨ New
```

---

<details open>
<summary><h3>Task 1: Build Root FormGroup in Settings View</h3></summary>

**Purpose**: Create the root reactive FormGroup with nested section groups in the settings view component. This establishes the form hierarchy that will be passed down to child components.

**Related Documentation:**

- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - Form patterns
- Angular Reactive Forms - FormBuilder and FormGroup

**Implementation Subtasks:**

- [ ] **Import ReactiveFormsModule**: Add to component imports
- [ ] **Inject FormBuilder**: Use `inject(FormBuilder)` for form creation
- [ ] **Create root FormGroup**: Build form with nested groups for each section
- [ ] **Create player FormGroup**: Add controls for repeatMode, sidTimerSeconds, sidAutoAdvance, launchOnStartup
- [ ] **Create fileTransfer FormGroup**: Add controls for watchFoldersEnabled, watchFolders, autoLaunchTransferred
- [ ] **Create search FormGroup**: Add controls for weights (nested group), stopWords, enableMetadataSearch, showHiddenFiles
- [ ] **Create app FormGroup**: Add control for setupCompleted
- [ ] **Initialize form values**: Populate controls with current settings from store
- [ ] **Add form validation**: Apply validators matching backend rules

**Testing Subtask:**

- [ ] **Write Form Building Tests**: Test FormGroup structure (see Testing section)

**Key Implementation Notes:**

- Use `FormBuilder` for cleaner form creation syntax
- Nested groups mirror domain model structure
- Initialize controls with values from `settingsStore.settings()`
- Validators should match backend validation (see Phase 1 backend plan)
- Consider using `NonNullableFormBuilder` for type safety
- Form should rebuild when settings load (effect pattern)

**Form Building Pattern** (structure only):

```typescript
export class SettingsViewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SettingsStore);
  
  form = this.fb.group({
    player: this.fb.group({
      repeatMode: ['Off', Validators.required],
      sidTimerSeconds: [180, [Validators.required, Validators.min(1)]],
      sidAutoAdvance: [false],
      launchOnStartup: [false]
    }),
    fileTransfer: this.fb.group({
      watchFoldersEnabled: [false],
      watchFolders: this.fb.array([]),
      autoLaunchTransferred: [false]
    }),
    // ... other sections
  });
  
  ngOnInit() {
    // Initialize form with store values
    effect(() => {
      const settings = this.store.settings();
      this.form.patchValue(settings, { emitEvent: false });
    });
  }
}
```

**Testing Focus for Task 1:**

> Focus on **form structure** - ensure FormGroup hierarchy is correct.

**Behaviors to Test:**

- [ ] Root FormGroup has four section groups
- [ ] Each section has correct controls
- [ ] Form initializes with store values
- [ ] Form updates when store settings change
- [ ] Validators are applied correctly
- [ ] Form structure matches domain model

</details>

<details open>
<summary><h3>Task 2: Create Player Settings Component</h3></summary>

**Purpose**: Create a presentational component for the player settings section that receives a FormGroup input and renders Material form fields for player configuration.

**Related Documentation:**

- [Coding Standards - Component Inputs](../../CODING_STANDARDS.md#component-inputs) - Input pattern
- Angular Material Form Fields - Material form components

**Implementation Subtasks:**

- [ ] **Generate component**: Create player-settings component
- [ ] **Add FormGroup input**: Accept player FormGroup via `input<FormGroup>()`
- [ ] **Add Material form fields**: MatSelect for repeat mode, MatSlider for timer, MatCheckbox for auto-advance and launch
- [ ] **Bind form controls**: Use `formControlName` directives
- [ ] **Add labels**: Descriptive labels for each field
- [ ] **Add validation messages**: Error messages for invalid inputs
- [ ] **Style form**: Apply consistent spacing and alignment

**Testing Subtask:**

- [ ] **Write Component Tests**: Test form field rendering and binding (see Testing section)

**Key Implementation Notes:**

- Component is presentational (no store dependency)
- Receives FormGroup via input signal
- Uses Material form components for consistency
- Validation messages should be user-friendly
- Consider using MatSlider for timer (visual feedback)
- Repeat mode uses MatSelect with options: Off, Single, All

**Component Structure** (reference only):

```typescript
@Component({
  selector: 'lib-player-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatCheckboxModule
  ],
  templateUrl: './player-settings.component.html'
})
export class PlayerSettingsComponent {
  formGroup = input.required<FormGroup>();
  
  repeatModeOptions = ['Off', 'Single', 'All'];
}
```

**Testing Focus for Task 2:**

> Focus on **form rendering** - ensure controls display and bind correctly.

**Behaviors to Test:**

- [ ] Component renders all player form fields
- [ ] Form controls bind to FormGroup correctly
- [ ] Validation errors display for invalid inputs
- [ ] Labels are descriptive and clear
- [ ] Repeat mode select shows all options
- [ ] Timer slider has appropriate min/max/step

</details>

<details open>
<summary><h3>Task 3: Create File Transfer Settings Component</h3></summary>

**Purpose**: Create a component for file transfer settings including watch folder management with add/remove functionality.

**Related Documentation:**

- [Coding Standards - Form Arrays](../../CODING_STANDARDS.md#form-arrays) - FormArray patterns
- Angular Reactive Forms - FormArray for dynamic lists

**Implementation Subtasks:**

- [ ] **Generate component**: Create file-transfer-settings component
- [ ] **Add FormGroup input**: Accept fileTransfer FormGroup
- [ ] **Add watch folders enabled checkbox**: MatCheckbox for toggle
- [ ] **Add watch folders list**: Display FormArray items
- [ ] **Add folder input field**: MatInput for new folder path
- [ ] **Add "Add Folder" button**: Button to add folder to array
- [ ] **Add remove buttons**: Button for each folder to remove it
- [ ] **Add auto-launch checkbox**: MatCheckbox for auto-launch transferred
- [ ] **Add validation**: Path format validation for folders

**Testing Subtask:**

- [ ] **Write Component Tests**: Test FormArray manipulation (see Testing section)

**Key Implementation Notes:**

- Use FormArray for watch folders list (dynamic)
- Add/remove buttons manipulate the FormArray
- Consider path validation (platform-specific)
- Disable folder list when watchFoldersEnabled is false
- Show empty state when no folders configured
- Consider file browser dialog (future enhancement)

**Testing Focus for Task 3:**

> Focus on **dynamic list management** - ensure FormArray works correctly.

**Behaviors to Test:**

- [ ] Adding folder appends to FormArray
- [ ] Removing folder removes from FormArray
- [ ] Watch folders disabled when toggle is off
- [ ] Validation applies to folder paths
- [ ] Empty state displays when no folders
- [ ] All form controls bind correctly

</details>

<details open>
<summary><h3>Task 4: Create Search Settings Component</h3></summary>

**Purpose**: Create a component for search settings that includes a sub-component for search weights (nested form group).

**Related Documentation:**

- [Coding Standards - Component Composition](../../CODING_STANDARDS.md#component-composition) - Nested components

**Implementation Subtasks:**

- [ ] **Generate component**: Create search-settings component
- [ ] **Add FormGroup input**: Accept search FormGroup
- [ ] **Add metadata search checkbox**: MatCheckbox for enableMetadataSearch
- [ ] **Add hidden files checkbox**: MatCheckbox for showHiddenFiles
- [ ] **Add stop words textarea**: MatInput multiline for stop words array
- [ ] **Add SearchWeights sub-component**: Pass weights FormGroup
- [ ] **Parse stop words**: Convert textarea string to/from array
- [ ] **Add validation**: Validate stop words format

**Testing Subtask:**

- [ ] **Write Component Tests**: Test component with nested weights component (see Testing section)

**Key Implementation Notes:**

- Stop words displayed as comma-separated text
- Parse textarea to array on blur (split by comma/newline)
- Consider chips component for stop words (future enhancement)
- SearchWeights component handles nested form group
- Provide help text explaining search options

**Testing Focus for Task 4:**

> Focus on **nested forms** - ensure parent-child form relationship works.

**Behaviors to Test:**

- [ ] Checkboxes bind to form controls
- [ ] Stop words textarea converts to/from array
- [ ] SearchWeights component receives correct FormGroup
- [ ] Changes in SearchWeights propagate to parent form
- [ ] Validation works across nested forms

</details>

<details open>
<summary><h3>Task 5: Create Search Weights Sub-Component</h3></summary>

**Purpose**: Create a sub-component for managing search weight values with sliders for each weight property.

**Related Documentation:**

- [Coding Standards - Presentational Components](../../CODING_STANDARDS.md#presentational-components) - Presentational patterns

**Implementation Subtasks:**

- [ ] **Generate component**: Create search-weights component
- [ ] **Add FormGroup input**: Accept weights FormGroup
- [ ] **Add name weight slider**: MatSlider with min 0, max 5, step 0.1
- [ ] **Add composer weight slider**: MatSlider configuration
- [ ] **Add author weight slider**: MatSlider configuration
- [ ] **Add year weight slider**: MatSlider configuration
- [ ] **Add filePath weight slider**: MatSlider configuration
- [ ] **Display current values**: Show numeric value next to each slider
- [ ] **Add reset button**: Reset weights to defaults

**Testing Subtask:**

- [ ] **Write Component Tests**: Test sliders bind to weights FormGroup (see Testing section)

**Key Implementation Notes:**

- Use MatSlider for intuitive weight adjustment
- Display numeric value for precision
- Consider preset weight configurations (future)
- Weights typically range 0-5, step 0.1
- Provide explanation of how weights affect search

**Testing Focus for Task 5:**

> Focus on **slider controls** - ensure weight adjustments work.

**Behaviors to Test:**

- [ ] All sliders render with correct min/max/step
- [ ] Sliders bind to weights FormGroup controls
- [ ] Numeric values update when sliders change
- [ ] Reset button restores default weights
- [ ] Changes propagate to parent search FormGroup

</details>

<details open>
<summary><h3>Task 6: Create App Settings Component</h3></summary>

**Purpose**: Create a simple component for application settings (currently just setup completed status).

**Related Documentation:**

- [Coding Standards - Simple Components](../../CODING_STANDARDS.md#simple-components) - Minimal component patterns

**Implementation Subtasks:**

- [ ] **Generate component**: Create app-settings component
- [ ] **Add FormGroup input**: Accept app FormGroup
- [ ] **Add setupCompleted checkbox**: MatCheckbox for setup completion
- [ ] **Add explanation text**: Describe what setup completion means
- [ ] **Consider reset setup**: Button to reset setup wizard (future)

**Testing Subtask:**

- [ ] **Write Component Tests**: Test simple form rendering (see Testing section)

**Key Implementation Notes:**

- This section may be minimal initially
- Extensible for future app-level settings
- Setup completed typically set programmatically
- Consider hiding from UI if not user-configurable
- May add more settings later (theme, language, etc.)

**Testing Focus for Task 6:**

> Focus on **simple rendering** - ensure basic form works.

**Behaviors to Test:**

- [ ] Checkbox renders and binds correctly
- [ ] Explanation text is clear
- [ ] Form control updates parent form
- [ ] Component is extensible for future settings

</details>

<details open>
<summary><h3>Task 7: Integrate Section Components into View</h3></summary>

**Purpose**: Update the settings view component to pass section FormGroups to the new child components, completing the form hierarchy.

**Related Documentation:**

- [Coding Standards - Component Communication](../../CODING_STANDARDS.md#component-communication) - Input/output patterns

**Implementation Subtasks:**

- [ ] **Import section components**: Add to settings view imports
- [ ] **Replace static content**: Remove read-only displays from Phase 5
- [ ] **Add section components**: Place components in scaling cards
- [ ] **Pass FormGroups**: Bind section FormGroups to component inputs
- [ ] **Wire form changes**: Subscribe to form valueChanges (Phase 7 will use this)
- [ ] **Add dirty indicator**: Show visual indicator when form is dirty

**Testing Subtask:**

- [ ] **Write Integration Tests**: Test complete form hierarchy (see Testing section)

**Key Implementation Notes:**

- Each scaling card contains a section component
- Pass FormGroup via component input signal
- Form valueChanges will trigger auto-save in Phase 7
- Dirty indicator uses form.dirty property
- Consider disabling form during save operation

**Template Integration** (structure only):

```html
<lib-scaling-card title="Player Settings">
  <lib-player-settings [formGroup]="form.controls.player" />
</lib-scaling-card>

<lib-scaling-card title="File Transfer">
  <lib-file-transfer-settings [formGroup]="form.controls.fileTransfer" />
</lib-scaling-card>

<!-- ... other sections -->
```

**Testing Focus for Task 7:**

> Focus on **form integration** - ensure parent-child form communication works.

**Behaviors to Test:**

- [ ] Section components render within scaling cards
- [ ] FormGroups pass to child components correctly
- [ ] Changes in child forms update parent form
- [ ] Parent form dirty state reflects child changes
- [ ] Form validation propagates from children
- [ ] Complete form is functional end-to-end

</details>

<details open>
<summary><h3>Task 8: Add Form Validation</h3></summary>

**Purpose**: Implement comprehensive form validation matching backend validation rules, with user-friendly error messages displayed inline.

**Related Documentation:**

- [Coding Standards - Validation](../../CODING_STANDARDS.md#validation) - Validation patterns
- Backend Settings Plan - Validation rules reference

**Implementation Subtasks:**

- [ ] **Add required validators**: Mark required fields
- [ ] **Add range validators**: Min/max for numeric fields (e.g., timer > 0)
- [ ] **Add pattern validators**: Path format validation for folders
- [ ] **Add custom validators**: Complex validation logic (e.g., weight ranges)
- [ ] **Add error messages**: User-friendly messages for each validator
- [ ] **Style error states**: Red text, field highlighting
- [ ] **Prevent invalid saves**: Disable save when form invalid (Phase 7)

**Testing Subtask:**

- [ ] **Write Validation Tests**: Test all validation rules (see Testing section)

**Key Implementation Notes:**

- Validation rules must match backend exactly
- Display errors inline below fields (Material pattern)
- Show errors on blur or submit, not while typing
- Consider async validators for backend checks (future)
- Validation messages should guide user to fix issues

**Validation Example** (pattern only):

```typescript
// In form building
sidTimerSeconds: [180, [
  Validators.required,
  Validators.min(1),
  Validators.max(3600)
]],

// In template
@if (form.controls.player.controls.sidTimerSeconds.hasError('min')) {
  <mat-error>Timer must be at least 1 second</mat-error>
}
@if (form.controls.player.controls.sidTimerSeconds.hasError('max')) {
  <mat-error>Timer cannot exceed 3600 seconds (1 hour)</mat-error>
}
```

**Testing Focus for Task 8:**

> Focus on **validation behavior** - ensure all rules work correctly.

**Behaviors to Test:**

- [ ] Required fields show error when empty
- [ ] Min/max validators trigger appropriately
- [ ] Pattern validators catch invalid formats
- [ ] Error messages display correctly
- [ ] Form invalid when any control invalid
- [ ] Validation doesn't block valid values

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Root Form Created**: Settings view has complete FormGroup hierarchy
- [ ] **Section Components Built**: All 4 section components implemented
- [ ] **Sub-Component Built**: SearchWeights component functional
- [ ] **Form Hierarchy Works**: FormGroups pass correctly parent→child
- [ ] **All Fields Render**: Every settings field has Material form control
- [ ] **Form Binding Works**: Changes in form update values correctly
- [ ] **Validation Applied**: All backend validation rules implemented
- [ ] **Error Messages Display**: Validation errors show inline with helpful text
- [ ] **Dirty State Tracking**: Form knows when user has unsaved changes
- [ ] **All Tests Pass**: Component and integration tests pass
- [ ] **TypeScript Compiles**: No compilation errors

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **form functionality and component integration**:

1. **Form Structure Tests**: Verify FormGroup hierarchy
2. **Component Tests**: Test each section component renders correctly
3. **Binding Tests**: Verify form controls bind to FormGroup
4. **Validation Tests**: Test all validation rules
5. **Integration Tests**: Test complete form hierarchy works

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | Form structure |
| Task 2-6 | Unit | Section component rendering |
| Task 7 | Integration | Parent-child form communication |
| Task 8 | Unit | Validation rules |

### Testing Standards Reference

- Follow [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) for component patterns
- Use [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing
- Test form behavior, not implementation details
- Mock store for component tests

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 5 - Settings View & Card Layout](./SETTINGS_FEATURE_P5.md)
- **Next Phase**: [Phase 7 - Auto-Save & Change Detection](./SETTINGS_FEATURE_P7.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Backend Validation**: [Basic Settings Endpoint Plan](./BASIC_SETTINGS_ENDPOINT_PLAN.md)
- **Angular Forms**: Angular Reactive Forms Documentation

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 6-8 hours_
