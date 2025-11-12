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

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General Coding standards
- [ ] [Form Standards](../../FORM_STANDARDS.md) -  Form building and validation patterns
- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Form styling conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Backend Validation Reference:**

- [ ] [SaveSettings Validation Models](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Backend validators to match

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

**Purpose**: Create the root reactive FormGroup with nested section groups in the settings view component following the form component tree pattern.

**Related Documentation:**

- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - FormGroup creation and passing patterns
- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Smart container → section components pattern
- [SaveSettings Backend Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Validation rules to match

**Implementation Subtasks:**

- [ ] Import ReactiveFormsModule into settings-view component
- [ ] Inject FormBuilder using `inject(FormBuilder)`
- [ ] Create root FormGroup with nested section groups (player, fileTransfer, search, app)
- [ ] Add form controls with validators matching backend SaveSettingsModels.cs
- [ ] Initialize form values from `settingsStore.settings()` signal
- [ ] Use effect() to rebuild form when settings load from store
- [ ] Apply TypeScript typing for form structure (consider NonNullableFormBuilder)

**Testing Subtask:**

- [ ] Write Form Structure Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Follow [Form Component Tree](../../FORM_COMPONENT_TREE.md) pattern for hierarchy
- Nested FormGroups mirror domain model structure (Settings → sections)
- Initialize with current store values, rebuild on settings load
- Validators must match backend validation in SaveSettingsModels.cs
- Use `patchValue()` with `{ emitEvent: false }` to prevent unnecessary updates
- Consider using Angular's `NonNullableFormBuilder` for stricter typing

**Testing Focus for Task 1:**

> Test **form structure and initialization** - verify FormGroup hierarchy matches domain model.

**Behaviors to Test (Vitest):**

- [ ] Root FormGroup contains four section FormGroups (player, fileTransfer, search, app)
- [ ] Each section has correct controls with proper types
- [ ] Form initializes with values from settingsStore.settings()
- [ ] Form rebuilds when store settings change
- [ ] Validators applied correctly per backend rules
- [ ] Form structure matches Settings domain model

</details>

<details open>
<summary><h3>Task 2: Create Player Settings Section Component</h3></summary>

**Purpose**: Create a presentational component that receives the player FormGroup and renders Material form fields.

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Section component pattern
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - FormGroup input pattern
- [SaveSettings Backend Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Validation constraints

**Implementation Subtasks:**

- [ ] Generate player-settings component with Angular CLI
- [ ] Add FormGroup input using `input<FormGroup>()` signal
- [ ] Import ReactiveFormsModule and Angular Material form modules
- [ ] Add mat-card wrapper for consistent card styling (see player-view pattern)
- [ ] Create Material form fields: MatSelect (repeat mode), MatSlider (timer), MatCheckbox (auto-advance, launch)
- [ ] Bind controls using `formControlName` directives
- [ ] Add descriptive labels and help text for each field
- [ ] Add inline validation error messages
- [ ] Apply consistent form styling per Style Guide

**Testing Subtask:**

- [ ] Write Component Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Component is **presentational** (no store dependency)
- Receives FormGroup via input signal from parent
- Uses Angular Material components for consistency
- Mat-card wrapper provides section context (follow player-view pattern)
- Validation messages should be user-friendly
- Repeat mode options: "Off", "Single", "All" (match backend enum)

**Testing Focus for Task 2:**

> Test **form field rendering and binding** - verify component correctly displays form controls.

**Behaviors to Test (Vitest):**

- [ ] Component renders when FormGroup provided
- [ ] All form controls present (repeat mode select, timer slider, checkboxes)
- [ ] Controls bound to correct FormGroup controls via formControlName
- [ ] Validation errors display when controls invalid
- [ ] Component updates when FormGroup values change
- [ ] No direct store dependency (accepts FormGroup input only)

</details>

<details open>
<summary><h3>Task 3: Create File Transfer Settings Section Component</h3></summary>

**Purpose**: Create presentational component for file transfer settings with FormArray handling for watch folders.

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Section component with dynamic controls
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - FormArray patterns
- [SaveSettings Backend Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Watch folders validation

**Implementation Subtasks:**

- [ ] Generate file-transfer-settings component
- [ ] Add FormGroup input for file transfer section
- [ ] Add mat-card wrapper for section context
- [ ] Create MatCheckbox for watchFoldersEnabled
- [ ] Create MatCheckbox for autoLaunchTransferred
- [ ] Add FormArray for watch folders (dynamic list)
- [ ] Create add/remove buttons for watch folder entries
- [ ] Add MatFormField with MatInput for each folder path
- [ ] Handle FormArray additions/removals
- [ ] Add path validation per backend rules

**Testing Subtask:**

- [ ] Write Component Tests with FormArray scenarios (see Testing section)

**Key Implementation Notes:**

- FormArray allows dynamic watch folder list
- Add/remove functionality modifies FormArray
- Each folder path needs validation (non-empty, valid path format)
- Consider max folder limit if backend has constraint
- Disable folder list when watchFoldersEnabled is false

**Testing Focus for Task 3:**

> Test **FormArray dynamic behavior** - adding/removing watch folders.

**Behaviors to Test (Vitest):**

- [ ] Component renders with empty FormArray
- [ ] Add button inserts new FormControl into FormArray
- [ ] Remove button deletes FormControl from FormArray
- [ ] Each folder path has validation
- [ ] Folder list disabled when watchFoldersEnabled unchecked
- [ ] FormArray changes reflected in parent FormGroup

</details>

<details open>
<summary><h3>Task 4: Create Search Settings Section Component</h3></summary>

**Purpose**: Create search settings section with nested search weights sub-component.

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Nested section components
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - Nested FormGroup patterns
- [SaveSettings Backend Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Search validation rules

**Implementation Subtasks:**

- [ ] Generate search-settings component
- [ ] Add FormGroup input for search section
- [ ] Add mat-card wrapper
- [ ] Create MatCheckbox for enableMetadataSearch
- [ ] Create MatCheckbox for showHiddenFiles
- [ ] Create MatChips or MatFormField for stopWords array
- [ ] Include search-weights sub-component (pass weights FormGroup)
- [ ] Handle stopWords array input/validation
- [ ] Add descriptive labels and help text

**Testing Subtask:**

- [ ] Write Component Tests including nested weights component (see Testing section)

**Key Implementation Notes:**

- Search weights becomes nested sub-component receiving weights FormGroup
- Stop words array needs dynamic add/remove functionality
- Consider MatChipList for stopWords management
- Nested FormGroup for weights passed to search-weights component

**Testing Focus for Task 4:**

> Test **nested component composition** - search settings with weights sub-component.

**Behaviors to Test (Vitest):**

- [ ] Component renders with search FormGroup
- [ ] Checkboxes bind to enableMetadataSearch and showHiddenFiles
- [ ] Stop words array can be modified
- [ ] Nested search-weights component receives weights FormGroup
- [ ] Changes in sub-component reflected in parent FormGroup

</details>

<details open>
<summary><h3>Task 5: Create Search Weights Sub-Component</h3></summary>

**Purpose**: Create granular component for search weight sliders (titleWeight, composerWeight, authorWeight).

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Leaf-level form components
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - Sub-component patterns
- [SaveSettings Backend Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Weight constraints

**Implementation Subtasks:**

- [ ] Generate search-weights component
- [ ] Add FormGroup input for weights (titleWeight, composerWeight, authorWeight)
- [ ] Create three MatSlider controls (range 0-1, step 0.1)
- [ ] Bind sliders to FormGroup controls
- [ ] Add labels showing current values
- [ ] Add descriptive help text for each weight
- [ ] Apply validation per backend rules

**Testing Subtask:**

- [ ] Write Component Tests for weight sliders (see Testing section)

**Key Implementation Notes:**

- Weights are decimal values 0.0 to 1.0
- Sliders provide visual feedback for weight adjustment
- Labels should display current decimal value
- Consider adding "reset to defaults" button
- Validation ensures 0 ≤ value ≤ 1

**Testing Focus for Task 5:**

> Test **slider binding and value display** - verify weight controls work correctly.

**Behaviors to Test (Vitest):**

- [ ] Component renders with weights FormGroup
- [ ] Three sliders present (title, composer, author)
- [ ] Sliders bound to correct FormGroup controls
- [ ] Value labels update when sliders change
- [ ] Validation prevents out-of-range values
- [ ] Changes reflected in parent FormGroup

</details>

<details open>
<summary><h3>Task 6: Create App Settings Section Component</h3></summary>

**Purpose**: Create simple app settings section component (currently just setupCompleted flag).

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Simple section component
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - Basic form patterns

**Implementation Subtasks:**

- [ ] Generate app-settings component
- [ ] Add FormGroup input for app section
- [ ] Add mat-card wrapper
- [ ] Create MatCheckbox for setupCompleted
- [ ] Add descriptive label
- [ ] Apply consistent styling

**Testing Subtask:**

- [ ] Write Component Tests (see Testing section)

**Key Implementation Notes:**

- Currently only setupCompleted field
- Future app settings would be added here
- Simple presentational component pattern

**Testing Focus for Task 6:**

> Test **basic form binding** - verify simple checkbox component.

**Behaviors to Test (Vitest):**

- [ ] Component renders with app FormGroup
- [ ] Setup completed checkbox present and bound
- [ ] Checkbox reflects FormGroup value
- [ ] Changes update FormGroup

</details>

<details open>
<summary><h3>Task 7: Integrate Section Components into Settings View</h3></summary>

**Purpose**: Update settings-view template to pass section FormGroups to new child components.

**Related Documentation:**

- [Form Component Tree](../../FORM_COMPONENT_TREE.md) - Parent-child form passing pattern
- [Coding Standards - Reactive Forms](../../CODING_STANDARDS.md#reactive-forms) - FormGroup passing

**Implementation Subtasks:**

- [ ] Update settings-view.component.html
- [ ] Add section component selectors
- [ ] Pass section FormGroups via inputs: `[formGroup]="form.controls.player"`
- [ ] Maintain card layout structure from Phase 5
- [ ] Ensure responsive layout preserved
- [ ] Remove placeholder read-only content

**Testing Subtask:**

- [ ] Update Settings View Tests to verify form integration (see Testing section)

**Key Implementation Notes:**

- Each section component receives its FormGroup slice
- Parent retains root FormGroup ownership
- Section components remain presentational
- Layout structure from Phase 5 maintained

**Testing Focus for Task 7:**

> Test **form composition** - parent passing FormGroups to children.

**Behaviors to Test (Vitest):**

- [ ] Settings view creates root FormGroup
- [ ] Each section component receives correct FormGroup slice
- [ ] Changes in section components update root FormGroup
- [ ] Form validity reflects all section validations
- [ ] Parent can access all form values via root FormGroup

</details>

---

## ✅ Success Criteria

> All criteria must be met before proceeding to Phase 7.

**Form Architecture:**

- [ ] Root FormGroup created in settings-view with nested section groups
- [ ] Four section components created (player, file-transfer, search, app)
- [ ] Search weights sub-component created and integrated
- [ ] FormArray implemented for watch folders
- [ ] All components receive FormGroups via input signals

**Validation:**

- [ ] Validators match backend SaveSettingsModels.cs rules
- [ ] Inline validation error messages display
- [ ] Form validity reflects all section validations
- [ ] Invalid forms prevent submission (Phase 7)

**Component Structure:**

- [ ] Settings-view is smart container (owns FormGroup)
- [ ] Section components are presentational (receive FormGroup)
- [ ] No store dependencies in section components
- [ ] Clean separation following Form Component Tree pattern

**User Experience:**

- [ ] Material form components consistent with app design
- [ ] Cards provide section context (following player-view pattern)
- [ ] Form fields have descriptive labels and help text
- [ ] Responsive layout maintained from Phase 5

**Testing:**

- [ ] All components have Vitest unit tests
- [ ] Form structure tests verify correct hierarchy
- [ ] FormArray tests cover dynamic behavior
- [ ] Component tests verify form binding
- [ ] No test failures introduced

---

## 🧪 Testing Summary

> Comprehensive testing at form and component layers.

**Test Distribution:**

- **Form Structure Tests**: 10 tests (settings-view FormGroup creation)
- **Component Tests**: 48 tests (8 tests per section component)
- **Integration Tests**: 12 tests (settings-view with section components)
- **Total**: **70 tests**

**Testing Tools:**

- **Framework**: Vitest for all unit and component tests
- **Component Testing**: Angular Testing Library patterns per [Smart Component Testing](../../SMART_COMPONENT_TESTING.md)
- **Form Testing**: Test FormGroup structure, validation, and binding behaviors

**Key Testing Patterns:**

1. **Form Structure Testing** (settings-view):
   - Verify FormGroup hierarchy (root → sections)
   - Test form initialization from store
   - Verify validators applied correctly

2. **Component Testing** (all section components):
   - Test component renders with FormGroup input
   - Verify form controls present and bound
   - Test validation error display
   - Verify changes update FormGroup

3. **FormArray Testing** (file-transfer-settings):
   - Test dynamic add/remove of FormControls
   - Verify FormArray changes reflected in parent
   - Test validation on array items

4. **Integration Testing** (settings-view + sections):
   - Test parent-child FormGroup passing
   - Verify form composition works correctly
   - Test form validity aggregation

**Coverage Goals:**

- **Unit Tests**: 100% of form building logic
- **Component Tests**: 100% of template bindings and interactions
- **Behavioral Focus**: Test observable outcomes, not implementation

---

## 🎯 Estimated Effort

**Total Phase Time**: 4-5 hours

**Task Breakdown:**

- Task 1 (Root FormGroup): 45 minutes
- Task 2 (Player Settings): 30 minutes  
- Task 3 (File Transfer Settings): 45 minutes
- Task 4 (Search Settings): 30 minutes
- Task 5 (Search Weights): 30 minutes
- Task 6 (App Settings): 20 minutes
- Task 7 (Integration): 30 minutes
- Testing: 60 minutes

**Milestone**: Forms architecture complete, ready for auto-save (Phase 7).
