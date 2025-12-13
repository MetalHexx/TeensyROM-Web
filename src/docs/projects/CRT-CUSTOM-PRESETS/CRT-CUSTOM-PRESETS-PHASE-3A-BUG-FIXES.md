# Phase 3A: Bug Fixes & Dialog Integration Debugging

## 🎯 Objective

Debug and fix the "Save Current as Preset" functionality that is currently non-functional. While tests pass in isolation, the actual UI interaction fails to open the preset name dialog when clicking the save action in the dropdown menu. This phase focuses on identifying and resolving the root causes preventing the dialog from appearing and accepting user input.

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts          📝 Debug event handlers
│   ├── crt-settings-panel.component.html        📝 Check dialog bindings
│   ├── crt-settings-panel.component.spec.ts     📝 Add integration tests
│   └── crt-settings-panel.component.scss        📝 Check z-index/overlay
├── preset-name-dialog/
│   ├── preset-name-dialog.component.ts          📝 Debug signal reactivity
│   ├── preset-name-dialog.component.html        📝 Check template bindings
│   └── preset-name-dialog.component.spec.ts     📝 Add edge case tests
└── dropdown-menu/
    ├── dropdown-menu.component.ts               📝 Check event propagation
    └── dropdown-menu.component.html             📝 Check click handlers
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Testing Policy:**
>
> - **Test as you fix** - Write reproduction tests first, then fix
> - **Behavioral testing** - Focus on observable UI behaviors
> - **Use browser DevTools** - Inspect DOM, console logs, event listeners
> - See [Testing Standards](../../../TESTING_STANDARDS.md) for approach

> **IMPORTANT - Debugging Strategy:**
>
> 1. **Start with observation** - What happens when you click save?
> 2. **Add logging** - Track signal changes, method calls, event flow
> 3. **Isolate the issue** - Is it event handling, dialog rendering, or validation?
> 4. **Fix incrementally** - Fix one issue at a time, test after each fix
> 5. **Document findings** - Note discoveries for future reference

---

<details open>
<summary><h3>Task 1: Debug Save Action Click Handler</h3></summary>

**Purpose**: Verify that clicking "Save Current as Preset" in the dropdown menu correctly triggers the `onSaveAsPreset()` method and sets the dialog visibility signal.

**Related Documentation:**

- [CRT Settings Panel Component](../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)
- [Dropdown Menu Component](../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts)

**Investigation Steps:**

- [ ] **Add Console Logging**: Add `console.log` statements in `onSaveAsPreset()` to verify method is called
- [ ] **Check Signal State**: Log `showNameDialog()` signal value before and after setting
- [ ] **Test Event Propagation**: Check if dropdown menu item click event reaches component
- [ ] **Inspect DOM**: Use browser DevTools to verify click listener is registered
- [ ] **Check Dropdown Behavior**: Verify dropdown closes/stays open after save click

**Expected Behaviors:**

```typescript
// In onSaveAsPreset():
protected onSaveAsPreset(): void {
  console.log('[CrtSettingsPanel] onSaveAsPreset called');
  console.log('[CrtSettingsPanel] showNameDialog before:', this.showNameDialog());
  
  this.isRenaming.set(false);
  this.dialogPresetName.set('');
  this.showNameDialog.set(true);
  
  console.log('[CrtSettingsPanel] showNameDialog after:', this.showNameDialog());
}
```

**Testing Subtask:**

- [ ] **Write Tests**: Create browser-based test that simulates user clicking save action

**Behaviors to Test:**

- [ ] Clicking "Save Current as Preset" calls `onSaveAsPreset()`
- [ ] `showNameDialog` signal transitions from `false` → `true`
- [ ] `isRenaming` signal is set to `false`
- [ ] `dialogPresetName` signal is cleared
- [ ] Dropdown menu closes after save click (or stays open if dialog overlays)

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 2: Debug Dialog Rendering and Visibility</h3></summary>

**Purpose**: Verify that the preset name dialog component renders in the DOM when `showNameDialog` signal is `true` and is visible to the user (not hidden by z-index, opacity, or positioning issues).

**Related Documentation:**

- [Preset Name Dialog Component](../../../libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts)
- [Scaling Compact Card Component](../../../libs/ui/components/src/lib/scaling-compact-card/scaling-compact-card.component.ts)

**Investigation Steps:**

- [ ] **Check Template Binding**: Verify `@if (showNameDialog())` in template works correctly
- [ ] **Inspect DOM**: Use browser DevTools Elements tab to check if `<lib-preset-name-dialog>` exists
- [ ] **Check Z-Index**: Verify dialog overlay is above other components
- [ ] **Check Positioning**: Verify dialog is positioned in viewport (not off-screen)
- [ ] **Check Opacity**: Verify dialog is not transparent or hidden
- [ ] **Check Animation**: Verify scaling animation doesn't prevent interaction

**Expected Template Structure:**

```html
<!-- Preset Name Dialog -->
@if (showNameDialog()) {
  <lib-preset-name-dialog
    [title]="isRenaming() ? 'Rename Preset' : 'Save Preset'"
    [initialValue]="getDialogInitialValue()"
    [reservedNames]="getReservedNames()"
    [validationFn]="dialogValidationFn"
    (confirmed)="onNameDialogConfirmed($event)"
    (cancelled)="onNameDialogCancelled()">
  </lib-preset-name-dialog>
}
```

**Testing Subtask:**

- [ ] **Write Tests**: Create tests that verify dialog DOM presence and visibility

**Behaviors to Test:**

- [ ] Dialog component renders when `showNameDialog` is `true`
- [ ] Dialog is not rendered when `showNameDialog` is `false`
- [ ] Dialog has correct z-index and positioning
- [ ] Dialog animation completes and element is interactive
- [ ] Dialog input field receives focus on open

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- Use `fixture.nativeElement.querySelector('lib-preset-name-dialog')` in tests

</details>

---

<details open>
<summary><h3>Task 3: Debug Validation Function Binding</h3></summary>

**Purpose**: Verify that the `validationFn` input to `PresetNameDialogComponent` is correctly bound and returns expected validation results.

**Related Documentation:**

- [CRT Settings Panel validation adapter](../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts#L183)
- [Infrastructure validation function](../../../libs/infrastructure/src/lib/crt/crt-preset-validation.ts)

**Investigation Steps:**

- [ ] **Check Function Binding**: Verify `dialogValidationFn` is defined and callable
- [ ] **Test Function Execution**: Log validation results in `PresetNameDialogComponent`
- [ ] **Check Type Compatibility**: Verify return type matches `PresetNameValidationFn` signature
- [ ] **Test Reserved Names**: Verify `getReservedNames()` returns correct list
- [ ] **Test Edge Cases**: Empty string, duplicate names, special characters

**Current Implementation:**

```typescript
// In CrtSettingsPanelComponent (line 183):
protected readonly dialogValidationFn: PresetNameValidationFn = (name: string, existingNames: string[]) => {
  const result = this.validatePresetNameFn()(name, existingNames);
  return result.error ?? '';
};
```

**Expected Validation Behaviors:**

- Empty name → Error: "Preset name is required"
- Duplicate name → Error: "Preset name already exists"
- Too long (>50 chars) → Error: "Name too long (max 50)"
- Valid name → Empty string (no error)

**Testing Subtask:**

- [ ] **Write Tests**: Create tests that verify validation function works correctly

**Behaviors to Test:**

- [ ] Validation function is called when user types
- [ ] Error messages update in real-time
- [ ] Save button is disabled when validation fails
- [ ] Save button is enabled when validation passes
- [ ] Character counter updates as user types

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 4: Debug Dialog Confirmation Flow</h3></summary>

**Purpose**: Verify that when user enters a valid preset name and clicks Save, the `confirmed` event emits correctly and the parent component receives the name to save.

**Related Documentation:**

- [Dialog confirmed event](../../../libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts#L119)
- [Parent event handler](../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts#L450)

**Investigation Steps:**

- [ ] **Check Event Emission**: Log `confirmed.emit()` in `PresetNameDialogComponent`
- [ ] **Check Event Binding**: Verify `(confirmed)="onNameDialogConfirmed($event)"` in template
- [ ] **Test Save Button**: Verify `canSave` computed signal enables button correctly
- [ ] **Test Name Trimming**: Verify emitted name is trimmed (no leading/trailing spaces)
- [ ] **Test Storage Call**: Verify `crtStorage.saveCustomPreset()` is called with correct params

**Expected Event Flow:**

```
User types "My Preset" in input field
  ↓
currentName signal updates to "My Preset"
  ↓
validationError computed signal returns "" (valid)
  ↓
canSave computed signal returns true
  ↓
Save button becomes enabled
  ↓
User clicks Save button
  ↓
onSaveClick() emits confirmed event with "My Preset"
  ↓
Parent onNameDialogConfirmed("My Preset") is called
  ↓
handleSavePreset("My Preset") saves to storage
  ↓
Dialog closes (showNameDialog.set(false))
```

**Testing Subtask:**

- [ ] **Write Tests**: Create end-to-end test for complete save workflow

**Behaviors to Test:**

- [ ] Save button click emits confirmed event
- [ ] Emitted name is trimmed correctly
- [ ] Parent handler receives correct name
- [ ] Storage service is called with correct parameters
- [ ] Dialog closes after successful save
- [ ] Custom presets list refreshes

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 5: Fix Identified Issues and Add Console Logging</h3></summary>

**Purpose**: Apply fixes for any issues discovered in Tasks 1-4 and add comprehensive console logging for production debugging.

**Related Documentation:**

- [Logging Standards](../../../LOGGING_STANDARDS.md)
- [Error Handling Patterns](../../../CODING_STANDARDS.md#error-handling)

**Implementation Subtasks:**

- [ ] **Fix Event Propagation**: Ensure dropdown menu item clicks don't prevent dialog opening
- [ ] **Fix Dialog Z-Index**: Ensure dialog overlays all other content
- [ ] **Fix Signal Reactivity**: Ensure template re-renders when signals change
- [ ] **Fix Validation Binding**: Ensure validation function is correctly passed and called
- [ ] **Add Console Logs**: Add comprehensive logging for production debugging
- [ ] **Add Error Handling**: Add try-catch blocks and user-friendly error messages

**Testing Subtask:**

- [ ] **Write Tests**: Create regression tests for all fixed issues

**Key Implementation Notes:**

- Add `console.log` statements at key points in save workflow
- Use consistent log prefixes: `[CrtSettingsPanel]`, `[PresetNameDialog]`
- Log signal state changes: before and after updates
- Log event emissions and receptions
- Add error boundaries with descriptive messages

**Console Logging Example:**

```typescript
protected onSaveAsPreset(): void {
  console.log('[CrtSettingsPanel] Save action clicked');
  console.log('[CrtSettingsPanel] Current state:', {
    showNameDialog: this.showNameDialog(),
    isRenaming: this.isRenaming(),
    customPresetsCount: this.customPresets().length
  });
  
  this.isRenaming.set(false);
  this.dialogPresetName.set('');
  this.showNameDialog.set(true);
  
  console.log('[CrtSettingsPanel] Dialog opened');
}
```

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] All previously failing scenarios now pass
- [ ] Console logs appear in expected order
- [ ] Error messages are user-friendly
- [ ] No console errors or warnings
- [ ] Feature works in all scenarios (save, rename, delete)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**Modified Files:**

- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts`
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.spec.ts`
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` (if needed)

**New Files:**

- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-3A-001-REPORT.md` (Debug report)
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-3A-005-REPORT.md` (Fix report)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users observe, not implementation
> - **Test as you debug** - write reproduction tests before fixing
> - **Test through public APIs** - use component methods and event emitters
> - **Mock at boundaries** - mock storage service, not internal methods

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md)
> - **Component testing**: [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list
- **Behaviors to Test**: Observable outcomes to verify
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run tests for CRT settings panel
pnpm nx test ui-components --watch --testNamePattern="CrtSettingsPanelComponent"

# Run tests for preset name dialog
pnpm nx test ui-components --watch --testNamePattern="PresetNameDialogComponent"

# Run all UI component tests
pnpm nx test ui-components --watch=false
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] Clicking "Save Current as Preset" opens the preset name dialog
- [ ] Dialog appears visually above all other content
- [ ] User can type preset name and see real-time validation
- [ ] Save button is disabled when validation fails
- [ ] Save button is enabled when validation passes
- [ ] Clicking Save button saves preset to storage
- [ ] Dialog closes after successful save
- [ ] Custom presets list updates with new preset
- [ ] Clicking Cancel button closes dialog without saving
- [ ] Feature works consistently across all usage scenarios

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside debugging and fixes
- [ ] All tests passing with no failures
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint ui-components`)
- [ ] No console errors in browser when using feature
- [ ] Console logs help with debugging (can be removed after verification)
- [ ] Code formatting is consistent

**Documentation:**

- [ ] Discoveries documented in task completion reports
- [ ] Root cause analysis included in reports
- [ ] Fix recommendations documented for similar issues
- [ ] Console logs documented for future debugging

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Feature verified working in production build
- [ ] Ready to proceed with Phase 4 tasks

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Known Issues (Pre-Fix)

- **Issue 1**: "Save Current as Preset" click does nothing
- **Symptom**: Dialog does not appear when save action is clicked
- **Hypothesis**: Event propagation issue, signal binding issue, or z-index problem
- **Impact**: Users cannot create custom presets

### Investigation Findings

> **Add notes here during debugging**

- **Finding 1**: [To be added during Task 1]
- **Finding 2**: [To be added during Task 2]
- **Finding 3**: [To be added during Task 3]

### Root Cause Analysis

> **Add analysis here after debugging**

- **Primary Cause**: [To be determined]
- **Contributing Factors**: [To be determined]
- **Fix Applied**: [To be determined]

### Future Enhancements

- **Enhancement 1**: Add toast notifications for save success/failure
- **Enhancement 2**: Add keyboard shortcut (Ctrl+S) to open save dialog
- **Enhancement 3**: Add preset import/export functionality

### Related Issues

- Phase 3 Task 3: Save preset workflow implementation
- Phase 3 Task 4: Integration testing

</details>

---

## 💡 Debugging Workflow Summary

**Step-by-Step Approach:**

1. **Reproduce the issue** - Click save in UI, confirm nothing happens
2. **Add logging** - Add console.log statements in `onSaveAsPreset()`
3. **Check signal state** - Verify `showNameDialog` signal changes
4. **Inspect DOM** - Use DevTools to check if dialog element exists
5. **Check event flow** - Verify event propagation from dropdown to component
6. **Test validation** - Verify validation function returns expected results
7. **Fix identified issues** - Apply targeted fixes one at a time
8. **Test each fix** - Verify fix works before moving to next issue
9. **Clean up logging** - Remove or reduce logging after verification
10. **Write regression tests** - Ensure issue doesn't reoccur

**Expected Timeline:**

- Task 1 (Click Handler): 1-2 hours
- Task 2 (Dialog Rendering): 1-2 hours
- Task 3 (Validation): 1 hour
- Task 4 (Confirmation Flow): 1 hour
- Task 5 (Fixes & Logging): 2-3 hours
- **Total**: 6-9 hours

---

## 📚 Related Documentation

- **Master Plan**: [CRT-CUSTOM-PRESETS-MASTER-PLAN.md](./CRT-CUSTOM-PRESETS-MASTER-PLAN.md)
- **Phase 2**: [CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md](./phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)
- **Phase 3**: [CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md](./phases/CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Smart Component Testing**: [SMART_COMPONENT_TESTING.md](../../SMART_COMPONENT_TESTING.md)
