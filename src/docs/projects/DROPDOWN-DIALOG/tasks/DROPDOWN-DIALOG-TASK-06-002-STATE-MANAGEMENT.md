# Task: DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT

## 📋 Task Identity

**Task ID**: `DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT`
**Task Name**: Implement Dropdown and Dialog State Coordination
**Assigned To**: Clean Coder (UI Wizard)
**Agent Chatmode**: `.github/copilot-modes/clean-coder.prompt.md`
**Priority**: High
**Estimated Context Size**: Medium (1 primary file with multiple methods, testing complexity)

---

## 🎯 Objective

**What**: Update the CRT settings panel component TypeScript to explicitly close the dropdown when opening dialogs, and reopen the dropdown when dialogs close (confirm or cancel).

**Why**: Currently, the dropdown remains open while dialogs are shown inline. With dialogs now as siblings (from Task 06-001), we need to coordinate their visibility: dropdown should close when dialog opens, and reopen when dialog closes, creating smooth state transitions.

**Success Criteria**:
- [ ] Clicking "Save as preset" closes the dropdown and shows name dialog
- [ ] Clicking rename button closes the dropdown and shows name dialog with preset name
- [ ] Clicking delete button closes the dropdown and shows confirmation dialog
- [ ] Confirming name dialog closes dialog and reopens dropdown
- [ ] Cancelling name dialog closes dialog and reopens dropdown
- [ ] Confirming delete dialog closes dialog and reopens dropdown
- [ ] Cancelling delete dialog closes dialog and reopens dropdown
- [ ] Dropdown and dialogs are never visible simultaneously
- [ ] All existing unit tests pass after updates

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Dialogs moved to sibling positions

**Dependencies**:
- `DropdownMenuComponent` API: `open()`, `close()`, `isOpen()` methods
- `presetDropdown` viewChild reference (already exists in component)

**Constraints**:
- DO NOT modify dialog components
- DO NOT modify dropdown menu component
- Remove existing workaround calls to `presetDropdown()?.open()` from dialog trigger handlers
- Maintain all existing functionality (save, rename, delete behaviors)

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Update dialog trigger and completion handlers
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Update tests for state coordination

**Files to Review** (for context):
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Understand `open()`, `close()`, `isOpen()` API

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - TypeScript patterns
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Behavioral testing

**Current Handler Implementations** (Lines 530-600):

The following methods currently have workaround logic that opens the dropdown to show dialogs inline:

- `onSaveAsPreset()` - Lines 530-555
- `onRenamePreset(presetName)` - Lines 576-583
- `onDeletePreset(presetName)` - Lines 590-597

**Current Dialog Completion Handlers** (Lines 630-690):

- `onNameDialogConfirmed(name)` - Lines 630-635
- `onNameDialogCancelled()` - Lines 643-647
- `onDeleteConfirmed()` - Lines 656-680
- `onDeleteCancelled()` - Lines 687-690

**Key Requirements**:

### 1. Update Dialog Trigger Handlers

For `onSaveAsPreset()`, `onRenamePreset()`, and `onDeletePreset()`:

- **Remove existing `presetDropdown()?.open()` calls** (these were workarounds for inline rendering)
- **Add `presetDropdown()?.close()` call** at the start of each handler
- **Set dialog visibility signal** after closing dropdown
- **Keep all other logic unchanged** (state setup, validation, etc.)

**Pattern Example**:
```typescript
protected onSaveAsPreset(): void {
  // Close dropdown before showing dialog
  this.presetDropdown()?.close();
  
  // Set up dialog state
  this.isRenaming.set(false);
  this.dialogPresetName.set('');
  this.showNameDialog.set(true);
}
```

### 2. Update Dialog Completion Handlers

For `onNameDialogConfirmed()`, `onNameDialogCancelled()`, `onDeleteConfirmed()`, and `onDeleteCancelled()`:

- **Add `presetDropdown()?.open()` call** before or after closing dialog signal
- **Keep all other logic unchanged** (save/rename/delete operations, state cleanup)

**Pattern Example**:
```typescript
protected onNameDialogCancelled(): void {
  this.showNameDialog.set(false);
  this.dialogPresetName.set('');
  this.isRenaming.set(false);
  
  // Reopen dropdown after dialog closes
  this.presetDropdown()?.open();
}
```

### 3. Timing Considerations

- **Synchronous calls are sufficient**: No need for `setTimeout` unless visual glitches occur
- **Close before show**: Always close dropdown BEFORE setting dialog visibility signal to `true`
- **Open after hide**: Always set dialog visibility signal to `false` BEFORE reopening dropdown (or immediately after)

### 4. Console Logging Cleanup

Remove debug console.log statements from handlers (present in lines 531-555):
- Remove console logs from `onSaveAsPreset()` unless needed for debugging

**Anti-Patterns to Avoid**:
- ❌ Don't change existing save/rename/delete business logic
- ❌ Don't modify dialog component APIs
- ❌ Don't add delays unless absolutely necessary for visual smoothness
- ❌ Don't remove error handling or validation logic

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests verify dropdown closes when dialogs open
- [ ] Unit tests verify dropdown reopens when dialogs close (confirm)
- [ ] Unit tests verify dropdown reopens when dialogs close (cancel)
- [ ] Unit tests verify dropdown and dialogs are never visible simultaneously

**Behavioral Expectations**:

1. **Save Flow**:
   - User clicks "Save as preset" → `presetDropdown().close()` called → `showNameDialog` set to true → dropdown not visible, dialog visible
   - User confirms dialog → preset saved → `showNameDialog` set to false → `presetDropdown().open()` called → dialog not visible, dropdown visible

2. **Rename Flow**:
   - User clicks rename button → dropdown closes → dialog shows with current name
   - User confirms → preset renamed → dialog closes → dropdown reopens

3. **Delete Flow**:
   - User clicks delete button → dropdown closes → confirmation dialog shows
   - User confirms → preset deleted → dialog closes → dropdown reopens

4. **Cancel Flows**:
   - User cancels any dialog → dialog closes → dropdown reopens → no changes persisted

**Testing Approach**:
- Mock `DropdownMenuComponent` with spy methods for `open()`, `close()`, `isOpen()`
- Verify spy methods called in correct sequence
- Test state transitions (signal values before/after method calls)
- Verify existing business logic still executes correctly

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-06-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 📖 Reference Materials

**Related Documentation**:
- [Phase 6 Plan](../phases/DROPDOWN-DIALOG-PHASE-06-DIALOG-SEPARATION.md#task-2-implement-dialog-state-management) - Task context
- [Dropdown Menu Component](libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts) - API reference

**Related Tasks**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Completed - dialogs are now siblings
- DROPDOWN-DIALOG-TASK-06-003-POSITIONING: Next - will add dialog positioning

**Reports from Previous Tasks**:
- Review Task 06-001 report for any structural considerations discovered

---

## ✅ Definition of Done

- [ ] `onSaveAsPreset()` closes dropdown before showing dialog
- [ ] `onRenamePreset()` closes dropdown before showing dialog
- [ ] `onDeletePreset()` closes dropdown before showing dialog
- [ ] `onNameDialogConfirmed()` reopens dropdown after closing dialog
- [ ] `onNameDialogCancelled()` reopens dropdown after closing dialog
- [ ] `onDeleteConfirmed()` reopens dropdown after closing dialog
- [ ] `onDeleteCancelled()` reopens dropdown after closing dialog
- [ ] All existing business logic preserved (save/rename/delete still work)
- [ ] Unit tests verify dropdown state coordination
- [ ] No console errors or warnings
- [ ] Report saved to output location
