# CRT-CUSTOM-PRESETS-TASK-03-002-PRESET-WORKFLOWS-AND-DIALOGS

## 📋 Task Metadata

**Task ID**: CRT-CUSTOM-PRESETS-TASK-03-002-PRESET-WORKFLOWS-AND-DIALOGS  
**Task Name**: Implement Save, Rename, and Delete Preset Workflows with Dialog Integration  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (5-7 files)

---

## 🎯 Objective

**What**: Implement complete save, rename, and delete workflows for custom presets by wiring up dialog components and connecting them to storage operations. This includes opening dialogs with correct data, handling user confirmation/cancellation, persisting changes via CrtStorageService, and refreshing the preset list.

**Why**: This task completes the custom preset management feature by implementing the full user workflows—users can now save their current CRT settings as named presets, rename existing presets, and delete presets they no longer need with confirmation.

**Success Criteria**:
- [ ] Save preset workflow opens name dialog and persists new preset to storage
- [ ] Rename preset workflow opens name dialog with prefilled value and updates preset name
- [ ] Delete preset workflow opens confirmation dialog and removes preset from storage
- [ ] Name dialog shows correct title ("Save Preset" vs "Rename Preset")
- [ ] Name dialog validates against reserved names (built-in + existing custom)
- [ ] Confirmation dialog shows preset name being deleted
- [ ] Custom presets list refreshes after save/rename/delete operations
- [ ] Dialog visibility signals control when dialogs appear/disappear
- [ ] Dialog components added to template with proper bindings
- [ ] All error scenarios handled gracefully with logging
- [ ] All tests pass with behavioral coverage for complete workflows
- [ ] No TypeScript or linting errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-03-001: Settings panel state and dropdown UI implemented
- CRT-CUSTOM-PRESETS-TASK-02-001 through 02-005: Dialog components created
- CRT-CUSTOM-PRESETS-TASK-01-004: CrtStorageService with save/rename/delete methods

**Dependencies**:
- `@teensyrom-nx/domain` - `CRT_STORAGE`, `CustomCrtPreset`, type guards
- `@teensyrom-nx/ui/components` - `PresetNameDialogComponent`, `ConfirmationDialogComponent`
- State signals from Task 03-001 (`customPresets`, `showNameDialog`, etc.)

**Constraints**:
- Dialog title changes dynamically based on save vs rename context
- Validation must exclude current preset name when renaming (allow keeping same name)
- Delete must handle case where deleted preset was currently active
- Maximum 50 custom presets enforced during save

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Implement workflow methods
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add dialog components
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Add workflow tests

**Files to Review** (for context):
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-03-001-REPORT.md` - Previous task report
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-001-REPORT.md` - Name dialog implementation
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-004-REPORT.md` - Confirmation dialog implementation
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Storage method signatures

---

## 🛠️ Implementation Guidance

### Part 1: Save Preset Workflow

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Error handling, logging patterns
- [State Standards](../../../STATE_STANDARDS.md) - Signal mutation patterns

**Key Requirements**:

1. **Implement `onSaveAsPreset()` Method**:
   - Clear rename flag: `isRenaming.set(false)`
   - Clear dialog preset name: `dialogPresetName.set('')`
   - Open name dialog: `showNameDialog.set(true)`

2. **Implement `onNameDialogConfirmed()` Method**:
   - Branch on `isRenaming()` signal
   - **Save Branch** (when `!isRenaming()`):
     - Check maximum preset limit (50 presets)
     - Call `crtStorage.saveCustomPreset(name, settings())`
     - Refresh custom presets list
     - Close dialog: `showNameDialog.set(false)`
     - Log success message
   - **Rename Branch** (when `isRenaming()`):
     - Handle rename workflow (see Part 2)

3. **Implement `onNameDialogCancelled()` Method**:
   - Close dialog: `showNameDialog.set(false)`
   - Clear dialog data: `dialogPresetName.set('')`, `isRenaming.set(false)`

4. **Implement `refreshCustomPresets()` Method**:
   - Call `crtStorage.loadCustomPresets()`
   - Update `customPresets` signal with loaded data
   - Handle load errors gracefully (log and keep existing list)

5. **Update `getReservedNames()` Method**:
   - When `isRenaming()` is true, exclude current preset name from reserved list
   - This allows user to keep same name when renaming
   - Otherwise, include all built-in and custom names

**Example Implementation**:
```typescript
protected onSaveAsPreset(): void {
  this.isRenaming.set(false);
  this.dialogPresetName.set('');
  this.showNameDialog.set(true);
}

protected onNameDialogConfirmed(name: string): void {
  if (this.isRenaming()) {
    this.handleRenamePreset(name);
  } else {
    this.handleSavePreset(name);
  }
}

private handleSavePreset(name: string): void {
  try {
    // Check maximum limit
    if (this.customPresets().length >= 50) {
      console.warn('[CrtSettingsPanel] Maximum preset limit reached (50)');
      // Show user-friendly error (future: toast notification)
      return;
    }
    
    // Save preset
    this.crtStorage.saveCustomPreset(name, this.settings());
    console.log(`[CrtSettingsPanel] Saved custom preset: ${name}`);
    
    // Refresh and close
    this.refreshCustomPresets();
    this.showNameDialog.set(false);
  } catch (error) {
    console.error('[CrtSettingsPanel] Failed to save preset:', error);
    // Future: show error toast
  }
}

protected onNameDialogCancelled(): void {
  this.showNameDialog.set(false);
  this.dialogPresetName.set('');
  this.isRenaming.set(false);
}

private refreshCustomPresets(): void {
  try {
    const presets = this.crtStorage.loadCustomPresets();
    this.customPresets.set(presets);
  } catch (error) {
    console.error('[CrtSettingsPanel] Failed to refresh presets:', error);
    // Keep existing list on error
  }
}

protected getReservedNames(): string[] {
  const builtInNames = CRT_PRESET_KEYS.map(k => k.replace(/^default-/, ''));
  let customNames = this.customPresets().map(p => this.stripCustomPrefix(p.name));
  
  // When renaming, exclude current preset name (allow keeping same name)
  if (this.isRenaming()) {
    const currentName = this.stripCustomPrefix(this.dialogPresetName() as CustomPresetName);
    customNames = customNames.filter(n => n !== currentName);
  }
  
  return [...builtInNames, ...customNames];
}
```

---

### Part 2: Rename Preset Workflow

**Key Requirements**:

1. **Implement `onRenamePreset()` Method**:
   - Set rename flag: `isRenaming.set(true)`
   - Store preset name (with `custom-` prefix): `dialogPresetName.set(presetName)`
   - Open name dialog: `showNameDialog.set(true)`

2. **Implement `handleRenamePreset()` Private Method**:
   - Extract old name from `dialogPresetName()` signal (includes `custom-` prefix)
   - Call `crtStorage.renameCustomPreset(oldName, newName)`
   - Refresh custom presets list
   - Close dialog and clear state
   - Log success message

**Example Implementation**:
```typescript
protected onRenamePreset(presetName: CustomPresetName): void {
  this.isRenaming.set(true);
  this.dialogPresetName.set(presetName);
  this.showNameDialog.set(true);
}

private handleRenamePreset(newName: string): void {
  try {
    const oldName = this.dialogPresetName() as CustomPresetName;
    this.crtStorage.renameCustomPreset(oldName, newName);
    console.log(`[CrtSettingsPanel] Renamed preset: ${oldName} -> custom-${newName}`);
    
    // Refresh and close
    this.refreshCustomPresets();
    this.showNameDialog.set(false);
    this.dialogPresetName.set('');
    this.isRenaming.set(false);
  } catch (error) {
    console.error('[CrtSettingsPanel] Failed to rename preset:', error);
    // Future: show error toast
  }
}
```

---

### Part 3: Delete Preset Workflow

**Key Requirements**:

1. **Implement `onDeletePreset()` Method**:
   - Store preset name: `dialogPresetName.set(presetName)`
   - Open confirmation dialog: `showConfirmDialog.set(true)`

2. **Implement `onDeleteConfirmed()` Method**:
   - Extract preset name from `dialogPresetName()` signal
   - Call `crtStorage.deleteCustomPreset(presetName)`
   - Refresh custom presets list
   - Check if deleted preset was currently active
   - If active, emit `presetSelected` event with default preset (or clear current)
   - Close dialog: `showConfirmDialog.set(false)`
   - Log success message

3. **Implement `onDeleteCancelled()` Method**:
   - Close dialog: `showConfirmDialog.set(false)`
   - Clear dialog data: `dialogPresetName.set('')`

4. **Implement `getConfirmationMessage()` Method**:
   - Extract display name (strip `custom-` prefix)
   - Return formatted message: `"Delete preset '{name}'? This action cannot be undone."`

**Example Implementation**:
```typescript
protected onDeletePreset(presetName: CustomPresetName): void {
  this.dialogPresetName.set(presetName);
  this.showConfirmDialog.set(true);
}

protected onDeleteConfirmed(): void {
  try {
    const presetName = this.dialogPresetName() as CustomPresetName;
    this.crtStorage.deleteCustomPreset(presetName);
    console.log(`[CrtSettingsPanel] Deleted custom preset: ${presetName}`);
    
    // Check if deleted preset was active
    if (this.currentPresetName() === presetName) {
      // Reset to default preset
      const defaultPreset = CRT_PRESET_KEYS[0];
      this.presetSelected.emit(defaultPreset);
      console.log('[CrtSettingsPanel] Deleted active preset, reset to default');
    }
    
    // Refresh and close
    this.refreshCustomPresets();
    this.showConfirmDialog.set(false);
    this.dialogPresetName.set('');
  } catch (error) {
    console.error('[CrtSettingsPanel] Failed to delete preset:', error);
    // Future: show error toast
  }
}

protected onDeleteCancelled(): void {
  this.showConfirmDialog.set(false);
  this.dialogPresetName.set('');
}

protected getConfirmationMessage(): string {
  const displayName = this.stripCustomPrefix(this.dialogPresetName() as CustomPresetName);
  return `Delete preset '${displayName}'? This action cannot be undone.`;
}
```

---

### Part 4: Add Dialog Components to Template

**Standards to Follow**:
- [Component Library](../../../COMPONENT_LIBRARY.md) - Dialog component patterns

**Key Requirements**:

1. **Import Dialog Components**:
   - Add `PresetNameDialogComponent` to component imports
   - Add `ConfirmationDialogComponent` to component imports

2. **Add Preset Name Dialog to Template**:
   - Use `@if` with `showNameDialog()` signal
   - Bind `[title]` to dynamic value based on `isRenaming()` signal
   - Bind `[initialValue]` to `stripCustomPrefix(dialogPresetName())`
   - Bind `[reservedNames]` to `getReservedNames()`
   - Bind `[validationFn]` to validation function from domain (imported from Phase 1)
   - Bind `(confirmed)` to `onNameDialogConfirmed($event)`
   - Bind `(cancelled)` to `onNameDialogCancelled()`

3. **Add Confirmation Dialog to Template**:
   - Use `@if` with `showConfirmDialog()` signal
   - Bind `[title]` to `'Delete Preset'`
   - Bind `[message]` to `getConfirmationMessage()`
   - Bind `[confirmLabel]` to `'Delete'`
   - Bind `[cancelLabel]` to `'Cancel'`
   - Bind `(confirmed)` to `onDeleteConfirmed()`
   - Bind `(cancelled)` to `onDeleteCancelled()`

4. **Position Dialogs**:
   - Dialogs should overlay the settings panel
   - Use existing dialog overlay patterns from component library
   - Ensure proper z-index stacking

**Template Example**:
```html
<!-- Existing settings panel content -->

<!-- Preset Name Dialog -->
@if (showNameDialog()) {
  <lib-preset-name-dialog
    [title]="isRenaming() ? 'Rename Preset' : 'Save Preset'"
    [initialValue]="stripCustomPrefix(dialogPresetName() as CustomPresetName)"
    [reservedNames]="getReservedNames()"
    [validationFn]="validatePresetName"
    (confirmed)="onNameDialogConfirmed($event)"
    (cancelled)="onNameDialogCancelled()">
  </lib-preset-name-dialog>
}

<!-- Confirmation Dialog -->
@if (showConfirmDialog()) {
  <lib-confirmation-dialog
    [title]="'Delete Preset'"
    [message]="getConfirmationMessage()"
    [confirmLabel]="'Delete'"
    [cancelLabel]="'Cancel'"
    (confirmed)="onDeleteConfirmed()"
    (cancelled)="onDeleteCancelled()">
  </lib-confirmation-dialog>
}
```

---

### Part 5: Import Validation Function

**Key Requirements**:

1. **Import Preset Name Validator**:
   - Import `validateCustomPresetName` from domain contracts (created in Phase 1)
   - Store as protected property for template binding
   - Type: `PresetNameValidationFn`

2. **Validation Function Usage**:
   - Passed to name dialog via `[validationFn]` input
   - Validates preset name length (3-50 chars)
   - Checks for special characters
   - Reserved name checking handled by dialog (via `reservedNames` input)

**Example Import**:
```typescript
import { validateCustomPresetName } from '@teensyrom-nx/domain';

export class CrtSettingsPanelComponent {
  // Make validation function accessible to template
  protected readonly validatePresetName = validateCustomPresetName;
  
  // ... rest of component
}
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:

### Save Preset Workflow Tests

- [ ] Clicking "Save Current as Preset" opens name dialog
- [ ] Name dialog shows "Save Preset" title
- [ ] Name dialog initialValue is empty string
- [ ] Name dialog reservedNames includes built-in and custom names
- [ ] Valid name saves preset successfully via storage service
- [ ] Custom presets list updates after save
- [ ] Name dialog closes after successful save
- [ ] Save respects 50 preset maximum limit
- [ ] Error logged if save fails
- [ ] Cancel button closes dialog without saving

### Rename Preset Workflow Tests

- [ ] Clicking rename button opens name dialog
- [ ] Name dialog shows "Rename Preset" title
- [ ] Name dialog initialValue is preset name (without custom- prefix)
- [ ] Name dialog reservedNames excludes current preset name
- [ ] Valid new name renames preset successfully via storage service
- [ ] Custom presets list updates with new name after rename
- [ ] Preset settings unchanged after rename
- [ ] Name dialog closes after successful rename
- [ ] Error logged if rename fails
- [ ] Cancel button closes dialog without renaming

### Delete Preset Workflow Tests

- [ ] Clicking delete button opens confirmation dialog
- [ ] Confirmation message includes preset name (without custom- prefix)
- [ ] Confirm button deletes preset from storage
- [ ] Custom presets list updates after deletion
- [ ] Confirmation dialog closes after deletion
- [ ] If active preset deleted, presetSelected event emitted with default
- [ ] If non-active preset deleted, current preset unchanged
- [ ] Cancel button closes dialog without deleting
- [ ] Error logged if delete fails

### Dialog Integration Tests

- [ ] Name dialog only renders when showNameDialog is true
- [ ] Confirmation dialog only renders when showConfirmDialog is true
- [ ] Dialogs receive correct input bindings
- [ ] Dialog confirmed events trigger correct methods
- [ ] Dialog cancelled events close dialogs
- [ ] Multiple dialogs cannot be open simultaneously

### Edge Cases

- [ ] Saving preset with same name as existing custom preset updates it
- [ ] Renaming to same name succeeds (no-op but valid)
- [ ] Deleting last custom preset shows empty state correctly
- [ ] Storage errors handled gracefully without crashing component

**Behavioral Expectations**:
- Complete workflows execute from user action to storage persistence
- Dialogs provide clear feedback and validation
- Error scenarios don't break the UI or leave inconsistent state
- Custom preset list always stays synchronized with storage

**Testing Reference**:
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 🔗 Related Documentation

**Planning Documents**:
- [Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#phase-3-settings-panel-integration)
- [Phase 3 Plan](../phases/CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md)

**Implementation Reports**:
- [Task 03-001 Report](../reports/CRT-CUSTOM-PRESETS-TASK-03-001-REPORT.md) - State and dropdown UI
- [Task 01-003 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-003-REPORT.md) - Validation implementation
- [Task 01-004 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-004-REPORT.md) - Storage service methods

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library](../../../COMPONENT_LIBRARY.md)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-03-002-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete

---

## 💡 Implementation Notes

### Anti-Patterns to Avoid

- ❌ Don't validate preset names in component - use validation function from domain
- ❌ Don't mutate `customPresets` array directly - use `set()` method
- ❌ Don't ignore errors - log them and inform user (future: toast notifications)
- ❌ Don't leave dialogs open on error - close them to reset state
- ❌ Don't allow save when at preset limit - check and warn user

### Key Integration Points

- Validation function imported from domain contracts (Phase 1)
- Storage methods from CrtStorageService (Phase 1)
- Dialog components from Phase 2
- State signals from Task 03-001

### User Experience Considerations

- Name dialog title changes based on context (save vs rename)
- Reserved names exclude current name when renaming (UX improvement)
- Confirmation message clearly states action is destructive and permanent
- Deleting active preset gracefully resets to default
- Maximum preset limit prevents localStorage bloat

### Future Enhancements

- Toast notifications for success/error feedback
- Undo delete functionality (requires recycle bin pattern)
- Preset export/import for sharing
- Preset reordering via drag-and-drop
