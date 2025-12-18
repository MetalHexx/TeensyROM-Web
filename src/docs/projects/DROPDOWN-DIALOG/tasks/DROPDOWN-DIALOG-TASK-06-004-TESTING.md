# Task: DROPDOWN-DIALOG-TASK-06-004-TESTING

## 📋 Task Identity

**Task ID**: `DROPDOWN-DIALOG-TASK-06-004-TESTING`
**Task Name**: Comprehensive Testing of Dialog Separation Refactor
**Assigned To**: Clean Coder (UI Wizard)
**Agent Chatmode**: `.github/copilot-modes/clean-coder.prompt.md`
**Priority**: High
**Estimated Context Size**: Medium (test file updates, behavioral coverage)

---

## 🎯 Objective

**What**: Update and expand the CRT settings panel unit test suite to comprehensively test the refactored dialog behavior, ensuring all save/rename/delete workflows function correctly with the new dropdown-dialog coordination.

**Why**: The refactor changed how dialogs appear (siblings vs inline) and how state is coordinated (explicit dropdown open/close). Tests must verify the new behavior, including dropdown state transitions, dialog positioning, and complete user workflows.

**Success Criteria**:
- [ ] All existing unit tests pass with updated assertions
- [ ] New tests verify dropdown closes when dialogs open
- [ ] New tests verify dropdown reopens when dialogs close
- [ ] New tests verify complete save/rename/delete workflows
- [ ] New tests verify dialogs are never visible simultaneously with dropdown
- [ ] Test coverage remains >= 80% (or improves)
- [ ] No console errors or warnings during test runs

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Template structure changed
- DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT: State coordination implemented
- DROPDOWN-DIALOG-TASK-06-003-POSITIONING: Positioning styles added

**Dependencies**:
- Updated component implementation (all previous tasks completed)
- Angular testing utilities (`TestBed`, `ComponentFixture`, etc.)
- Jest/Vitest test framework

**Constraints**:
- Follow behavioral testing principles (test observable outcomes, not implementation)
- Mock only external dependencies (dialog components can be real or mocked)
- Focus on user-facing behaviors and state transitions

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Update and expand test suite

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Implementation to test
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Template structure

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Behavioral testing principles
- [Smart Component Testing](../../../../docs/SMART_COMPONENT_TESTING.md) - Component testing patterns

**Test Categories to Cover**:

### 1. Template Structure Tests (Update Existing)

Verify template changes from Task 06-001:

```typescript
describe('Template Structure', () => {
  it('should render dialogs as siblings of dropdown, not children', () => {
    // Query for dialogs outside dropdown element
    // Verify they exist at the correct level
  });
  
  it('should render dropdown-content without dialog conditionals', () => {
    // Query dropdown-content element
    // Verify it only contains menu items, no dialogs
  });
  
  it('should use independent @if conditionals for each dialog', () => {
    // Verify showNameDialog and showConfirmDialog control visibility independently
  });
});
```

### 2. Dropdown State Coordination Tests (New)

Verify state transitions from Task 06-002:

```typescript
describe('Dropdown and Dialog Coordination', () => {
  let dropdownComponent: jasmine.SpyObj<DropdownMenuComponent>;
  
  beforeEach(() => {
    // Mock dropdown component with spy methods
    dropdownComponent = jasmine.createSpyObj('DropdownMenuComponent', ['open', 'close', 'isOpen']);
    // Inject into component fixture
  });
  
  it('should close dropdown when opening save dialog', () => {
    component.onSaveAsPreset();
    expect(dropdownComponent.close).toHaveBeenCalled();
    expect(component.showNameDialog()).toBe(true);
  });
  
  it('should close dropdown when opening rename dialog', () => {
    component.onRenamePreset('custom-test');
    expect(dropdownComponent.close).toHaveBeenCalled();
    expect(component.showNameDialog()).toBe(true);
  });
  
  it('should close dropdown when opening delete dialog', () => {
    component.onDeletePreset('custom-test');
    expect(dropdownComponent.close).toHaveBeenCalled();
    expect(component.showConfirmDialog()).toBe(true);
  });
  
  it('should reopen dropdown when confirming name dialog', () => {
    component.showNameDialog.set(true);
    component.onNameDialogConfirmed('New Preset');
    expect(dropdownComponent.open).toHaveBeenCalled();
    expect(component.showNameDialog()).toBe(false);
  });
  
  it('should reopen dropdown when cancelling name dialog', () => {
    component.showNameDialog.set(true);
    component.onNameDialogCancelled();
    expect(dropdownComponent.open).toHaveBeenCalled();
    expect(component.showNameDialog()).toBe(false);
  });
  
  it('should reopen dropdown when confirming delete', () => {
    component.showConfirmDialog.set(true);
    component.onDeleteConfirmed();
    expect(dropdownComponent.open).toHaveBeenCalled();
  });
  
  it('should reopen dropdown when cancelling delete', () => {
    component.showConfirmDialog.set(true);
    component.onDeleteCancelled();
    expect(dropdownComponent.open).toHaveBeenCalled();
  });
  
  it('should never show dropdown and dialogs simultaneously', () => {
    // Test that signals are mutually exclusive in practice
    // (conceptual test - may not be directly testable)
  });
});
```

### 3. Complete Workflow Tests (New/Updated)

Verify end-to-end user workflows:

```typescript
describe('Complete Workflows', () => {
  it('should complete save workflow: click → close dropdown → show dialog → confirm → reopen dropdown', () => {
    // Simulate save button click
    // Verify dropdown closes
    // Verify dialog shows
    // Simulate confirm
    // Verify dialog closes
    // Verify dropdown reopens
  });
  
  it('should complete rename workflow with preset name pre-filled', () => {
    // Simulate rename button click for preset
    // Verify dialog initial value matches preset name
    // Simulate confirm with new name
    // Verify rename logic executes
    // Verify dropdown reopens
  });
  
  it('should complete delete workflow with confirmation', () => {
    // Simulate delete button click
    // Verify confirmation dialog shows
    // Simulate confirm
    // Verify delete logic executes
    // Verify dropdown reopens
  });
  
  it('should handle cancel without persisting changes', () => {
    // Test that cancelling dialogs doesn't save/rename/delete
    // Verify dropdown reopens
    // Verify state unchanged
  });
});
```

### 4. Positioning Tests (New)

Verify positioning from Task 06-003:

```typescript
describe('Dialog Positioning', () => {
  it('should apply positioning styles to dialog container', () => {
    // Query dialog container element
    // Verify position, z-index, top/left/right styles
  });
  
  it('should show dialog container when dialogs are visible', () => {
    component.showNameDialog.set(true);
    fixture.detectChanges();
    // Verify dialog container has 'visible' class or style
  });
  
  it('should hide dialog container when no dialogs are visible', () => {
    component.showNameDialog.set(false);
    component.showConfirmDialog.set(false);
    fixture.detectChanges();
    // Verify dialog container hidden
  });
});
```

### 5. Regression Tests (Update Existing)

Ensure existing functionality still works:

- Preset selection still works
- Custom preset CRUD operations still work
- Slider changes still emit correctly
- Panel open/close still works
- All signal bindings intact

**Key Testing Patterns**:

1. **Mock Dropdown Component**: Use Jasmine/Jest spies to verify `open()` and `close()` calls
2. **Signal Verification**: Check signal values before/after method calls
3. **Template Queries**: Use `fixture.debugElement.query()` to verify structure
4. **Event Simulation**: Trigger button clicks and verify state changes
5. **Change Detection**: Call `fixture.detectChanges()` after state changes

**Anti-Patterns to Avoid**:
- ❌ Don't test implementation details (private methods, internal state)
- ❌ Don't duplicate tests (consolidate similar tests)
- ❌ Don't skip edge cases (null/undefined, empty arrays, etc.)
- ❌ Don't write brittle tests (avoid hard-coded delays, tight coupling)

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Template structure tests verify sibling positioning
- [ ] Dropdown state coordination tests verify open/close calls
- [ ] Workflow tests verify complete save/rename/delete flows
- [ ] Positioning tests verify dialog container styles
- [ ] Regression tests verify existing functionality intact
- [ ] Edge case tests (cancel, empty states, errors)

**Behavioral Expectations**:

All behaviors from Phase 6 success criteria should be tested:
- Save/rename/delete trigger dropdown close and dialog show
- Confirm/cancel trigger dialog close and dropdown reopen
- Dialogs positioned correctly (via styles)
- No simultaneous visibility of dropdown and dialogs

**Code Coverage Target**:
- Maintain or improve existing coverage (>=80%)
- All new code paths covered (save/rename/delete flows)
- All state transitions tested

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-06-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 📖 Reference Materials

**Related Documentation**:
- [Phase 6 Plan](../phases/DROPDOWN-DIALOG-PHASE-06-DIALOG-SEPARATION.md#task-4-update-tests-and-verify-behavior) - Task context
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Behavioral testing principles
- [Smart Component Testing](../../../../docs/SMART_COMPONENT_TESTING.md) - Component testing patterns

**Related Tasks**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Template changes to test
- DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT: State coordination to test
- DROPDOWN-DIALOG-TASK-06-003-POSITIONING: Positioning to test

**Reports from Previous Tasks**:
- Review all Task 06-001, 06-002, and 06-003 reports for implementation details and edge cases

---

## ✅ Definition of Done

- [ ] All existing unit tests pass
- [ ] New tests cover dropdown state coordination
- [ ] New tests cover complete workflows (save/rename/delete)
- [ ] New tests cover positioning behavior
- [ ] No test failures or console errors
- [ ] Code coverage >= 80% (or improved)
- [ ] Tests follow behavioral testing principles
- [ ] Tests are maintainable and not brittle
- [ ] Report saved to output location with coverage metrics
