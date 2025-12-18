# Phase 6: CRT Settings Panel Dialog Separation

## 🎯 Objective

Refactor the CRT settings panel preset dialogs to display as independent positioned overlays rather than inline within the dropdown menu content. When users trigger save/rename/delete actions, the dropdown menu should close and the respective dialog should appear in the same position. Upon dialog completion (confirm/cancel), the dropdown menu should reopen automatically.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [DROPDOWN-DIALOG Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Original feature plan and completed phases
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing dropdown and dialog components

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Component styling patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts                 📝 Modified - Refactor dialog state management
├── crt-settings-panel.component.html               📝 Modified - Move dialogs outside dropdown
├── crt-settings-panel.component.scss               📝 Modified - Update positioning styles (if needed)
└── crt-settings-panel.component.spec.ts            📝 Modified - Update tests for new behavior

libs/ui/components/src/lib/preset-name-dialog/
└── preset-name-dialog.component.ts                 📄 Review - Ensure compatible with new usage

libs/ui/components/src/lib/confirmation-dialog/
└── confirmation-dialog.component.ts                📄 Review - Ensure compatible with new usage

libs/ui/components/src/lib/dropdown-menu/
└── dropdown-menu.component.ts                      📄 Review - Understand open/close API
```

---

<details open>
<summary><h3>Task 1: Refactor Template Structure</h3></summary>

**Purpose**: Move the dialog components from inside the dropdown-content slot to sibling elements of the dropdown menu, and wire up positioning to anchor them to the preset button.

**Related Documentation:**
- [CRT Settings Panel HTML](libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html) - Current implementation

**Implementation Subtasks:**

- [ ] **Move `lib-preset-name-dialog`**: Extract from dropdown-content and place as sibling to `lib-dropdown-menu`
- [ ] **Move `lib-confirmation-dialog`**: Extract from dropdown-content and place as sibling to `lib-dropdown-menu`
- [ ] **Add positioning attributes**: Ensure dialogs position relative to the preset button trigger
- [ ] **Update conditional rendering**: Remove `@if/@else if/@else` structure from dropdown-content, replace with standalone conditionals outside dropdown
- [ ] **Verify dropdown-content structure**: Ensure dropdown-content only contains the preset menu items (no dialogs)

**Testing Subtask:**

- [ ] **Write Tests**: Test template structure and dialog positioning (see Testing section below for details)

**Key Implementation Notes:**

- Dialogs should be positioned absolutely, anchored to the same trigger as the dropdown (the preset icon button)
- Use CSS or inline styles to position dialogs at the same coordinates as the dropdown menu origin
- Maintain existing dialog components without modification (same inputs/outputs)

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - verify template structure changes without breaking functionality

**Behaviors to Test:**

- [ ] **Template Structure**: Dialogs are siblings of dropdown, not children of dropdown-content
- [ ] **Conditional Rendering**: Dialogs show/hide based on state signals independent of dropdown content
- [ ] **Trigger Element**: Preset button reference is accessible for positioning

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for component testing patterns
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component interaction testing

</details>

---

<details open>
<summary><h3>Task 2: Implement Dialog State Management</h3></summary>

**Purpose**: Update the component TypeScript to manage dropdown open/close behavior when switching between dropdown menu and dialogs.

**Related Documentation:**
- [Dropdown Menu API](libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts) - Programmatic open/close methods

**Implementation Subtasks:**

- [ ] **Close dropdown on dialog open**: When `onSaveAsPreset()`, `onRenamePreset()`, or `onDeletePreset()` is called, explicitly close the dropdown
- [ ] **Reopen dropdown on dialog close**: When `onNameDialogCancelled()`, `onNameDialogConfirmed()`, `onDeleteCancelled()`, or `onDeleteConfirmed()` is called, reopen the dropdown
- [ ] **Remove dropdown.open() calls from dialog triggers**: Remove existing `presetDropdown()?.open()` calls from save/rename/delete handlers (they were workarounds)
- [ ] **Add dropdown.close() calls**: Call `presetDropdown()?.close()` when opening dialogs
- [ ] **Add dropdown.open() calls**: Call `presetDropdown()?.open()` when closing dialogs (confirm/cancel)

**Testing Subtask:**

- [ ] **Write Tests**: Test dropdown state transitions (see Testing section below for details)

**Key Implementation Notes:**

- Use the `presetDropdown` viewChild reference to call `open()` and `close()` methods programmatically
- Ensure state transitions are clean: dropdown closes BEFORE dialog opens, dropdown opens AFTER dialog closes
- Consider adding a small delay (e.g., `setTimeout`) if needed for smooth visual transitions

**Testing Focus for Task 2:**

> Focus on **behavioral testing** - verify dropdown and dialog state coordination

**Behaviors to Test:**

- [ ] **Save Flow**: Clicking "Save as preset" closes dropdown and shows name dialog
- [ ] **Rename Flow**: Clicking rename button closes dropdown and shows name dialog with preset name
- [ ] **Delete Flow**: Clicking delete button closes dropdown and shows confirmation dialog
- [ ] **Confirm Dialog Close**: Confirming name dialog reopens dropdown
- [ ] **Cancel Dialog Close**: Cancelling any dialog reopens dropdown
- [ ] **No Simultaneous Visibility**: Dropdown and dialogs are never visible at the same time

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing patterns
- Mock `DropdownMenuComponent` methods (`open()`, `close()`, `isOpen()`) in tests

</details>

---

<details open>
<summary><h3>Task 3: Add Dialog Positioning</h3></summary>

**Purpose**: Ensure dialogs appear anchored to the preset button in the same position where the dropdown menu was displayed.

**Related Documentation:**
- [Style Guide](../../../STYLE_GUIDE.md) - Positioning patterns

**Implementation Subtasks:**

- [ ] **Add positioning wrapper**: Wrap dialogs in a positioned container if needed (may use `position: absolute` with `top`/`left` calculations)
- [ ] **Calculate anchor position**: Derive position from preset button element (may need `ViewChild` or existing reference)
- [ ] **Match dropdown positioning**: Ensure dialogs appear in the exact same location as the dropdown menu origin
- [ ] **Handle viewport edges**: Ensure dialogs don't overflow viewport (may inherit from dropdown positioning logic)
- [ ] **Add z-index**: Ensure dialogs appear above other content (consistent with dropdown z-index)

**Testing Subtask:**

- [ ] **Write Tests**: Verify positioning behavior (see Testing section below for details)

**Key Implementation Notes:**

- Recommendation: Use absolute positioning anchored to the preset button
- Consider reusing dropdown positioning logic if possible (e.g., CDK overlay positioning if dropdown uses it)
- Dialogs should appear where the dropdown was, maintaining spatial consistency

**Critical CSS Pattern** (only if needed):

```scss
.dialog-container {
  position: absolute;
  top: var(--anchor-top);
  left: var(--anchor-left);
  z-index: 1000; // Match dropdown z-index
}
```

**Testing Focus for Task 3:**

> Focus on **behavioral testing** - verify dialogs appear in correct position

**Behaviors to Test:**

- [ ] **Position Calculation**: Dialog container has correct `top` and `left` values relative to preset button
- [ ] **Z-Index**: Dialogs appear above other panel content
- [ ] **Viewport Awareness**: Dialogs don't overflow visible area (if applicable)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for component testing
- May need to mock or stub positioning calculations in unit tests

</details>

---

<details open>
<summary><h3>Task 4: Update Tests and Verify Behavior</h3></summary>

**Purpose**: Update existing unit tests to reflect the new behavior where dialogs are independent of dropdown content, and verify all interactions work correctly.

**Related Documentation:**
- [CRT Settings Panel Tests](libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts) - Existing test suite

**Implementation Subtasks:**

- [ ] **Update template assertions**: Modify tests checking dropdown-content structure to expect dialogs as siblings
- [ ] **Add dialog open/close tests**: Verify dropdown closes when dialogs open
- [ ] **Add dialog confirm/cancel tests**: Verify dropdown reopens when dialogs close
- [ ] **Update state transition tests**: Verify `showNameDialog()` and `showConfirmDialog()` signals control dialog visibility independent of dropdown
- [ ] **Verify no regressions**: Ensure all existing preset save/rename/delete behaviors still work
- [ ] **Add visual regression tests** (if applicable): Capture snapshots of dialog positioning

**Testing Subtask:**

- [ ] **Write Tests**: Comprehensive tests for refactored behavior (see Testing section below for details)

**Key Implementation Notes:**

- Focus on behavioral outcomes, not implementation details
- Use Angular testing utilities to verify dropdown component method calls (`close()`, `open()`)
- Mock dialog components if needed to isolate CRT settings panel behavior

**Testing Focus for Task 4:**

> Focus on **behavioral testing** - verify complete user workflows

**Behaviors to Test:**

- [ ] **Save Workflow**: User clicks "Save as preset" → dropdown closes → name dialog appears → user confirms → dropdown reopens
- [ ] **Rename Workflow**: User clicks rename → dropdown closes → name dialog with preset name appears → user confirms → dropdown reopens
- [ ] **Delete Workflow**: User clicks delete → dropdown closes → confirmation dialog appears → user confirms → preset deleted → dropdown reopens
- [ ] **Cancel Behaviors**: User can cancel any dialog and dropdown reopens without changes
- [ ] **No Visual Conflicts**: Dialogs and dropdown never both visible simultaneously

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for comprehensive behavioral testing
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component interaction patterns

</details>

---

## ✅ Phase Completion Criteria

**All subtasks completed** (checked off in tasks above)

**Functional Requirements:**

- [ ] Clicking "Save as preset" closes dropdown and shows name dialog
- [ ] Clicking rename button closes dropdown and shows name dialog with current name
- [ ] Clicking delete button closes dropdown and shows confirmation dialog
- [ ] Confirming name dialog saves/renames preset and reopens dropdown
- [ ] Cancelling name dialog discards changes and reopens dropdown
- [ ] Confirming delete dialog removes preset and reopens dropdown
- [ ] Cancelling delete dialog keeps preset and reopens dropdown
- [ ] Dialogs appear in the same position as the dropdown menu (anchored to preset button)

**Technical Requirements:**

- [ ] Dialogs are siblings of dropdown menu in template, not children of dropdown-content
- [ ] Component TypeScript explicitly closes dropdown before opening dialogs
- [ ] Component TypeScript explicitly reopens dropdown after dialogs close
- [ ] No simultaneous visibility of dropdown and dialogs
- [ ] Positioning logic correctly anchors dialogs to preset button

**Testing Requirements:**

- [ ] All existing unit tests pass
- [ ] New unit tests cover dialog open/close flows
- [ ] New unit tests verify dropdown state coordination
- [ ] No console errors or warnings
- [ ] Visual verification shows smooth transitions

**Code Quality:**

- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] Tests follow [Testing Standards](../../../TESTING_STANDARDS.md)
- [ ] No deprecated APIs or workarounds
- [ ] Clear comments explaining state management logic

---

## 📝 Discoveries During Implementation

_(This section will be filled in by the Clean Coder as they work through the implementation)_

---

## 🚧 Blockers

_(This section will be filled in by the Clean Coder if any blockers arise)_

---

## 🎯 Success Metrics

**User Experience:**
- Smooth visual transitions when switching between dropdown and dialogs
- No jarring layout shifts or flickers
- Dialogs appear where users expect them (where dropdown was)

**Code Quality:**
- Reduced complexity in template conditional logic
- Clear separation of concerns (dropdown for menu, standalone for dialogs)
- Maintainable state management with explicit transitions

**Maintainability:**
- Easy to understand which state controls which UI element
- Dialog components remain reusable and unmodified
- Dropdown component usage follows best practices
