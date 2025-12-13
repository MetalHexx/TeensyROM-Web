# Phase 3: CRT Settings Panel Integration

## 🎯 Objective

Integrate dropdown dialog component into CRT settings panel, replacing inline dialog rendering with positioned overlay dialogs for preset name and confirmation dialogs.

**Success Definition**: CRT settings panel uses dropdown dialog for both preset name and confirmation dialogs, with dialogs appearing in the same position as the dropdown menu trigger, and all existing tests passing.

---

## 📚 Required Reading

**Feature Documentation**:
- [ ] [Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Project context
- [ ] [Phase 1 Document](./DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md) - Dropdown dialog API
- [ ] [CRT Settings Panel](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts) - Current implementation

**Standards & Guidelines**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing
- [ ] [Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component test patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts       📝 Modified - Add dropdown dialog usage
│   ├── crt-settings-panel.component.html     📝 Modified - Wrap dialogs
│   └── crt-settings-panel.component.spec.ts  📝 Modified - Update tests
├── dropdown-dialog/
│   └── dropdown-dialog.component.ts          📝 Reference - API and usage patterns
├── preset-name-dialog/
│   └── preset-name-dialog.component.ts       📝 No changes - Used as-is
└── confirmation-dialog/
    └── confirmation-dialog.component.ts      📝 No changes - Used as-is
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Add Dropdown Dialog for Preset Name</h3></summary>

**Purpose**: Wrap the preset name dialog with dropdown dialog to enable positioned overlay rendering.

**Related Documentation**:
- [CRT Settings Panel Template](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html#L17-L27)
- [Dropdown Dialog API](./DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md)

**Implementation Subtasks**:

- [ ] **Import DropdownDialogComponent**: Add to CRT settings panel imports array
- [ ] **Add Template Reference**: Create `#nameDialog` template reference variable
- [ ] **Wrap Preset Dialog**: Wrap `lib-preset-name-dialog` in `lib-dropdown-dialog`
- [ ] **Update Open Logic**: Call `nameDialog.open()` instead of setting signal
- [ ] **Update Close Logic**: Call `nameDialog.close()` in confirmed/cancelled handlers
- [ ] **Remove Conditional Rendering**: No longer need `@if (showNameDialog())` wrapper

**Testing Subtask**:
- [ ] **Write Tests**: Verify dialog opens positioned correctly (see Testing section)

**Key Implementation Notes**:
- Trigger element should be the "Save as Preset" menu item
- Dialog opens when user clicks "Save as Preset"
- Dialog closes on confirm or cancel
- Position should match dropdown menu trigger

**Template Pattern**:
```html
<lib-dropdown-dialog #nameDialog>
  <lib-dropdown-menu-item (itemClick)="nameDialog.open()">
    Save as Preset
  </lib-dropdown-menu-item>
  
  <div dialog-content>
    <lib-preset-name-dialog
      [title]="dialogTitle()"
      [initialValue]="dialogInitialValue()"
      [reservedNames]="reservedNames()"
      [validationFn]="validationFn"
      (confirmed)="onNameConfirmed($event); nameDialog.close()"
      (cancelled)="nameDialog.close()">
    </lib-preset-name-dialog>
  </div>
</lib-dropdown-dialog>
```

**Testing Focus for Task 1**:

**Behaviors to Test**:
- [ ] Clicking "Save as Preset" opens name dialog
- [ ] Dialog positioned near dropdown trigger
- [ ] Confirming closes dialog and saves preset
- [ ] Canceling closes dialog without saving
- [ ] Dialog overlay disposed correctly

**Testing Reference**:
- See [Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 2: Add Dropdown Dialog for Confirmation</h3></summary>

**Purpose**: Wrap the confirmation dialog with dropdown dialog for positioned overlay rendering when deleting presets.

**Related Documentation**:
- [CRT Settings Panel Template](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html#L28-L37)
- [Dropdown Dialog API](./DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md)

**Implementation Subtasks**:

- [ ] **Add Template Reference**: Create `#confirmDialog` template reference variable
- [ ] **Wrap Confirmation Dialog**: Wrap `lib-confirmation-dialog` in `lib-dropdown-dialog`
- [ ] **Update Open Logic**: Call `confirmDialog.open()` when delete clicked
- [ ] **Update Close Logic**: Call `confirmDialog.close()` in confirmed/cancelled handlers
- [ ] **Handle Trigger Context**: Open dialog relative to delete button in dropdown menu
- [ ] **Remove Conditional Rendering**: No longer need `@else if (showConfirmDialog())` wrapper

**Testing Subtask**:
- [ ] **Write Tests**: Verify dialog opens positioned correctly (see Testing section)

**Key Implementation Notes**:
- Trigger element is the delete icon button in custom preset row
- Dialog opens when user clicks delete icon
- Dialog closes on confirm (deletes preset) or cancel
- Position should be near delete button

**Template Pattern**:
```html
<!-- Inside custom preset item -->
<lib-dropdown-dialog #confirmDialog>
  <lib-icon-button
    icon="delete"
    (buttonClick)="setDeleteTarget(preset.name); confirmDialog.open()">
  </lib-icon-button>
  
  <div dialog-content>
    <lib-confirmation-dialog
      title="Delete Preset"
      [message]="getDeleteMessage()"
      confirmLabel="Delete"
      cancelLabel="Cancel"
      (confirmed)="onDeleteConfirmed(); confirmDialog.close()"
      (cancelled)="confirmDialog.close()">
    </lib-confirmation-dialog>
  </div>
</lib-dropdown-dialog>
```

**Testing Focus for Task 2**:

**Behaviors to Test**:
- [ ] Clicking delete icon opens confirmation dialog
- [ ] Dialog positioned near delete button
- [ ] Confirming deletes preset and closes dialog
- [ ] Canceling closes dialog without deleting
- [ ] Multiple custom presets each have own dialog instance

**Testing Reference**:
- See [Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 3: Update State Management and Event Handlers</h3></summary>

**Purpose**: Refactor CRT settings panel state to work with dropdown dialog's programmatic API instead of conditional rendering signals.

**Related Documentation**:
- [CRT Settings Panel Component](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts#L100-L150)

**Implementation Subtasks**:

- [ ] **Remove showNameDialog Signal**: No longer needed for conditional rendering
- [ ] **Remove showConfirmDialog Signal**: No longer needed for conditional rendering
- [ ] **Update onSaveAsPreset**: Open dialog programmatically instead of setting signal
- [ ] **Update onRenamePreset**: Open dialog with pre-filled values programmatically
- [ ] **Update onDeletePreset**: Open confirmation dialog programmatically
- [ ] **Simplify Event Handlers**: Remove signal reset logic (dialog handles close)

**Testing Subtask**:
- [ ] **Write Tests**: Verify state management works correctly (see Testing section)

**Key Implementation Notes**:
- Dropdown dialog manages its own open/close state
- Component just calls `open()` and `close()` methods
- Event handlers simplified (no more signal juggling)

**Refactoring Pattern**:
```typescript
// Before
onSaveAsPreset(): void {
  this.showNameDialog.set(true);
}

// After
onSaveAsPreset(dialog: DropdownDialogComponent): void {
  dialog.open();
}
```

**Testing Focus for Task 3**:

**Behaviors to Test**:
- [ ] Save preset flow works end-to-end
- [ ] Rename preset flow works with pre-filled data
- [ ] Delete preset flow works with confirmation
- [ ] State transitions correctly between dialogs
- [ ] No memory leaks from unclosed overlays

**Testing Reference**:
- See [Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 4: Update CRT Settings Panel Tests</h3></summary>

**Purpose**: Update existing tests to work with new dropdown dialog integration and add tests for new positioning behavior.

**Related Documentation**:
- [CRT Settings Panel Tests](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts)
- [Component Testing](../../../SMART_COMPONENT_TESTING.md)

**Implementation Subtasks**:

- [ ] **Update Test Selectors**: Change from signal-based to dialog component selectors
- [ ] **Update Dialog Open Tests**: Test `.open()` calls instead of signal changes
- [ ] **Update Dialog Close Tests**: Verify overlay disposal
- [ ] **Add Positioning Tests**: Verify dialogs positioned relative to triggers
- [ ] **Add Integration Tests**: Test full preset save/rename/delete flows
- [ ] **Fix Broken Tests**: Address any tests broken by refactoring

**Testing Subtask**:
- [ ] **Verify All Tests Pass**: Run full test suite

**Key Implementation Notes**:
- Use `fixture.debugElement.query()` to find dialog components
- Test overlay creation with CDK TestBed utilities
- Verify positioning relative to trigger elements
- Test both normal and fullscreen contexts

**Test Update Example**:
```typescript
// Before
it('should show name dialog when signal set', () => {
  component.showNameDialog.set(true);
  fixture.detectChanges();
  const dialog = fixture.nativeElement.querySelector('lib-preset-name-dialog');
  expect(dialog).toBeTruthy();
});

// After
it('should open name dialog in overlay', () => {
  const dialogComponent = fixture.debugElement.query(
    By.directive(DropdownDialogComponent)
  );
  dialogComponent.componentInstance.open();
  fixture.detectChanges();
  
  const overlay = document.querySelector('.cdk-overlay-pane');
  expect(overlay).toBeTruthy();
  expect(overlay.querySelector('lib-preset-name-dialog')).toBeTruthy();
});
```

**Testing Focus for Task 4**:

**Behaviors to Test**:
- [ ] All existing test scenarios still pass
- [ ] Dialog open/close behaviors verified
- [ ] Positioning relative to triggers verified
- [ ] Integration flows work end-to-end
- [ ] No test coverage decrease

**Testing Reference**:
- See [Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

## 🗂️ Files Modified or Created

**New Files**: None (all modifications)

**Modified Files**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] All implementation tasks completed
- [ ] Preset name dialog wrapped in dropdown dialog
- [ ] Confirmation dialog wrapped in dropdown dialog
- [ ] State management simplified
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements**:
- [ ] All CRT settings panel tests pass
- [ ] Dialog positioning tests added
- [ ] Integration tests verify full flows
- [ ] No test coverage decrease
- [ ] Visual regression testing complete

**Quality Checks**:
- [ ] No TypeScript errors or warnings
- [ ] Linting passes (`pnpm nx lint`)
- [ ] No console errors in browser
- [ ] Component builds successfully

**User Experience**:
- [ ] Dialogs appear in same position as dropdown menu
- [ ] No visual jumps or layout shifts
- [ ] Smooth transitions between menu and dialogs
- [ ] Backdrop click closes dialogs correctly

**Ready for Phase 4**:
- [ ] All success criteria met
- [ ] Integration complete and tested
- [ ] Ready for documentation phase

---

## 📝 Notes & Considerations

### Design Decisions

**Decision 1: Trigger Element Approach**
- Use menu items and icon buttons as triggers
- Dropdown dialog positions relative to clicked element
- Provides intuitive visual connection

**Decision 2: State Simplification**
- Remove conditional rendering signals
- Dropdown dialog manages own state
- Simpler component logic

**Decision 3: Event Handler Updates**
- Pass dialog reference to handlers
- Handlers call `open()` directly
- Less indirection, clearer code

### Implementation Constraints

**Constraint 1: No Dialog Component Changes**
- Preset name dialog unchanged
- Confirmation dialog unchanged
- Only wrapping in dropdown dialog

**Constraint 2: Existing Tests**
- Must update tests to work with new structure
- Cannot skip test updates
- All scenarios must still be covered

### Integration Patterns

**Pattern 1: Save/Rename Flow**
```
User clicks menu item
→ nameDialog.open()
→ Overlay appears positioned near trigger
→ User enters name
→ User confirms
→ onConfirmed handler fires
→ nameDialog.close()
→ Overlay disposed
```

**Pattern 2: Delete Flow**
```
User clicks delete icon
→ confirmDialog.open()
→ Overlay appears positioned near icon
→ User clicks confirm
→ onConfirmed handler fires
→ Preset deleted
→ confirmDialog.close()
→ Overlay disposed
```

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

---

## 💡 Agent Implementation Guide

### Before Starting Integration

**Ask Clarifying Questions**:

1. **Template Structure**: Should dialogs be siblings to menu or nested inside?
2. **State Management**: Keep any existing signals or remove all conditional logic?
3. **Testing**: Update existing tests or write new parallel tests?

### While Integrating

**Step-by-Step Approach**:
1. Start with preset name dialog (simpler)
2. Test thoroughly before moving to confirmation
3. Update tests incrementally
4. Verify visually after each change

**Testing Strategy**:
- Run tests after each task
- Use `--watch` mode for rapid feedback
- Test in browser to verify positioning

### Key Integration Tips

1. **Trigger Detection**: Make sure first child is the clickable trigger
2. **Event Handlers**: Update to call `dialog.open()` instead of setting signals
3. **Close Handlers**: Add `dialog.close()` to confirmed/cancelled events
4. **Test Updates**: Change selectors from signal-based to component-based

### Remember

- **No changes** to preset-name-dialog or confirmation-dialog
- **All tests** must pass after integration
- **Visual verification** important for positioning
- **State simplified** by removing conditional rendering
