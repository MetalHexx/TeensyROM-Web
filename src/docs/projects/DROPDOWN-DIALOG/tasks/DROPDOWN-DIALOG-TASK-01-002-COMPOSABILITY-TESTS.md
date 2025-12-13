# Task Handoff: Composability Validation & Integration Tests

## 📋 Task Identity

**Task ID**: DROPDOWN-DIALOG-TASK-01-002-COMPOSABILITY-TESTS  
**Task Name**: Validate Composability with Existing Dialog Components  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Validation)  
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Validate that dropdown dialog can successfully wrap existing dialog components (`lib-preset-name-dialog` and `lib-confirmation-dialog`) without requiring any modifications to those components. Add integration tests proving composability.

**Why**: The core value proposition of dropdown dialog is composability—wrapping existing components without changes. This task proves that promise and catches integration issues early before CRT settings panel integration.

**Success Criteria**:
- [ ] Can wrap `lib-preset-name-dialog` in test harness
- [ ] Can wrap `lib-confirmation-dialog` in test harness
- [ ] Dialog components work identically inside dropdown-dialog as standalone
- [ ] Events propagate correctly (confirmed, cancelled)
- [ ] Form interactions work (input fields, buttons)
- [ ] Multiple instances don't interfere
- [ ] Integration tests passing with >90% coverage

---

## 🔗 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-01-001-CORE-COMPONENT - Dropdown dialog component exists and unit tests pass

**Dependencies**:
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.ts` - Component to test
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts` - Target for wrapping
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.ts` - Target for wrapping

**Constraints**:
- Cannot modify preset-name-dialog component
- Cannot modify confirmation-dialog component
- Must prove identical behavior when wrapped vs standalone
- Integration tests must use real components, not mocks

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.integration.spec.ts` - Integration tests

**Files to Modify**:
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.spec.ts` - Add composability test suite

**Files to Review** (for context):
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.spec.ts` - Understand dialog behaviors
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.spec.ts` - Understand dialog behaviors

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing approach
- [Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component test patterns

### Key Requirements

**1. Test Harness Component**

Create a test host component that wraps dialog in dropdown-dialog:

```typescript
@Component({
  standalone: true,
  imports: [DropdownDialogComponent, PresetNameDialogComponent],
  template: `
    <lib-dropdown-dialog #dialog>
      <button (click)="dialog.open()">Open</button>
      <div dialog-content>
        <lib-preset-name-dialog
          [title]="title"
          [initialValue]="initialValue"
          [reservedNames]="reservedNames"
          [validationFn]="validationFn"
          (confirmed)="onConfirmed($event)"
          (cancelled)="onCancelled()">
        </lib-preset-name-dialog>
      </div>
    </lib-dropdown-dialog>
  `
})
class PresetDialogTestHost {
  title = 'Test Dialog';
  initialValue = '';
  reservedNames: string[] = [];
  validationFn = (name: string, reserved: string[]) => '';
  confirmedValue: string | null = null;
  cancelledCalled = false;
  
  onConfirmed(value: string) {
    this.confirmedValue = value;
  }
  
  onCancelled() {
    this.cancelledCalled = true;
  }
}
```

**2. Preset Name Dialog Composability Tests**

Test scenarios to validate:

```typescript
describe('DropdownDialog with PresetNameDialog', () => {
  describe('Content Projection', () => {
    it('should render preset dialog in overlay');
    it('should show dialog title');
    it('should pre-fill initial value');
    it('should display form field and buttons');
  });
  
  describe('Form Interactions', () => {
    it('should allow typing in input field');
    it('should show validation errors');
    it('should enable save button when valid');
    it('should disable save button when invalid');
  });
  
  describe('Event Propagation', () => {
    it('should emit confirmed event with value');
    it('should emit cancelled event');
    it('should not modify dialog component behavior');
  });
  
  describe('Lifecycle Integration', () => {
    it('should open dialog on button click');
    it('should close dialog on confirm');
    it('should close dialog on cancel');
    it('should dispose overlay after close');
  });
});
```

**3. Confirmation Dialog Composability Tests**

Test scenarios to validate:

```typescript
describe('DropdownDialog with ConfirmationDialog', () => {
  describe('Content Projection', () => {
    it('should render confirmation dialog in overlay');
    it('should show title and message');
    it('should show confirm and cancel buttons');
  });
  
  describe('Button Interactions', () => {
    it('should emit confirmed on confirm button click');
    it('should emit cancelled on cancel button click');
    it('should handle keyboard events (Enter/Escape)');
  });
  
  describe('Multiple Instances', () => {
    it('should handle multiple confirmation dialogs');
    it('should not interfere with each other');
    it('should dispose overlays independently');
  });
});
```

**4. Identical Behavior Validation**

Compare wrapped vs standalone behavior:

```typescript
describe('Behavior Parity', () => {
  it('preset dialog validation works same inside dropdown-dialog', () => {
    // Test validation with same inputs
    // Compare results standalone vs wrapped
  });
  
  it('preset dialog character counter works same', () => {
    // Test character limit behavior
  });
  
  it('confirmation dialog keyboard shortcuts work same', () => {
    // Test Enter and Escape keys
  });
});
```

**5. Integration Test Helpers**

Create helper functions for common operations:

```typescript
// Helper to open dialog and get overlay element
function openDialogAndGetOverlay(
  fixture: ComponentFixture<any>
): HTMLElement {
  const button = fixture.nativeElement.querySelector('button');
  button.click();
  fixture.detectChanges();
  return document.querySelector('.cdk-overlay-pane') as HTMLElement;
}

// Helper to get dialog element from overlay
function getDialogFromOverlay(
  overlayElement: HTMLElement,
  selector: string
): HTMLElement {
  return overlayElement.querySelector(selector) as HTMLElement;
}

// Helper to simulate user input
function typeIntoInput(
  input: HTMLInputElement,
  value: string,
  fixture: ComponentFixture<any>
): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}
```

### Anti-Patterns to Avoid

❌ **Don't modify dialog components** - They must work as-is  
❌ **Don't mock dialogs** - Use real components for integration tests  
❌ **Don't skip event testing** - Event propagation is critical  
❌ **Don't test implementation** - Test observable behavior only  
❌ **Don't ignore overlay lifecycle** - Verify proper cleanup

### Code Detail Level

Integration tests should:
- Use real dialog components with real templates
- Interact with DOM elements like users would
- Verify events using spy patterns or test properties
- Check overlay presence and disposal
- Validate form interactions (typing, validation, submission)

Focus on user-observable behavior, not internal implementation details.

---

## 🧪 Testing Requirements

### Test Coverage Required

**Integration Tests - Preset Name Dialog**:
- [ ] Dialog renders in overlay when opened
- [ ] Title displayed correctly
- [ ] Initial value pre-filled in input
- [ ] User can type into input field
- [ ] Validation errors display
- [ ] Character counter updates
- [ ] Save button enables/disables correctly
- [ ] Confirmed event emits with entered value
- [ ] Cancelled event emits
- [ ] Dialog closes after confirm
- [ ] Dialog closes after cancel
- [ ] Overlay disposed properly

**Integration Tests - Confirmation Dialog**:
- [ ] Dialog renders in overlay when opened
- [ ] Title and message displayed
- [ ] Confirm button works
- [ ] Cancel button works
- [ ] Enter key triggers confirm
- [ ] Escape key triggers cancel
- [ ] Confirmed event emits
- [ ] Cancelled event emits
- [ ] Dialog closes after confirm
- [ ] Dialog closes after cancel

**Integration Tests - Multiple Instances**:
- [ ] Two preset dialogs can coexist
- [ ] Opening one doesn't affect the other
- [ ] Each has independent overlay
- [ ] Closing one doesn't close the other

**Behavior Parity Tests**:
- [ ] Validation logic identical
- [ ] Event emissions identical
- [ ] Keyboard handling identical
- [ ] Visual rendering identical (when comparing DOM)

### Behavioral Expectations

**What users/consumers observe**:
- Dialog components work exactly the same inside dropdown-dialog
- No loss of functionality when wrapped
- Events propagate correctly to parent
- Form interactions feel natural
- Multiple dialogs work independently

**Edge cases to handle**:
- Empty initial values
- Reserved names validation
- Long text in confirmation message
- Rapid open/close cycles
- Multiple confirmations in sequence

---

## 📚 Reference Materials

### Related Documentation

- [Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Composability goals
- [Phase 1 Plan](../phases/DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md) - Integration requirements
- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration test patterns

### Related Tasks

- DROPDOWN-DIALOG-TASK-01-001-CORE-COMPONENT - Foundation (must be complete)
- DROPDOWN-DIALOG-TASK-03-001-CRT-INTEGRATION - Will use validated patterns

### Key Architectural Decisions

**Decision 1: Real Components in Tests**
- Use actual dialog components, not mocks
- Proves real-world composability
- Catches integration issues early

**Decision 2: User-Centric Test Approach**
- Interact with DOM like users would
- Click buttons, type text, press keys
- Verify observable outcomes

**Decision 3: Behavior Parity Validation**
- Compare wrapped vs standalone behavior
- Ensure no functionality loss
- Validate event propagation

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-01-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete

---

## 💡 Implementation Notes

### Getting Started

1. **Review Dialog Components**: Understand their APIs and behaviors
2. **Create Test Host**: Build component that wraps dialogs
3. **Write Preset Tests**: Start with preset-name-dialog (more complex)
4. **Write Confirmation Tests**: Then confirmation-dialog (simpler)
5. **Add Parity Tests**: Compare wrapped vs standalone
6. **Verify Coverage**: Ensure >90% coverage of integration scenarios

### Testing Strategy

**Test Structure**:
```typescript
describe('DropdownDialog Integration', () => {
  describe('with PresetNameDialog', () => {
    // Preset-specific tests
  });
  
  describe('with ConfirmationDialog', () => {
    // Confirmation-specific tests
  });
  
  describe('Behavior Parity', () => {
    // Comparison tests
  });
});
```

**DOM Interaction Pattern**:
```typescript
// Open dialog
const button = fixture.nativeElement.querySelector('button');
button.click();
fixture.detectChanges();

// Get dialog from overlay
const overlay = document.querySelector('.cdk-overlay-pane');
const dialog = overlay.querySelector('lib-preset-name-dialog');

// Interact with dialog
const input = dialog.querySelector('input');
input.value = 'Test Name';
input.dispatchEvent(new Event('input'));
fixture.detectChanges();

// Verify behavior
expect(component.confirmedValue).toBe('Test Name');
```

### Key Integration Points

**With Preset Name Dialog**:
- Must handle validation function
- Must handle reserved names
- Must handle initial value pre-fill
- Must emit confirmed with trimmed value

**With Confirmation Dialog**:
- Must handle title and message
- Must handle keyboard shortcuts
- Must emit confirmed/cancelled correctly

### Success Validation

Before marking complete:
- [ ] All integration tests passing
- [ ] Test coverage >90%
- [ ] Can wrap both dialog types successfully
- [ ] No modifications to dialog components needed
- [ ] Events propagate correctly
- [ ] Multiple instances work independently

---

## 🎯 Completion Checklist

When you've finished this task:

- [ ] Integration test file created
- [ ] All test scenarios implemented
- [ ] Tests pass with good coverage
- [ ] Behavior parity validated
- [ ] No dialog component modifications
- [ ] Completion report written
- [ ] Report saved to specified location

---

## 🤝 Questions Before Starting?

If anything is unclear:
1. Which dialog component should be tested first?
2. How detailed should behavior parity tests be?
3. Should tests include visual regression checks?
4. Are there specific edge cases to prioritize?

Clarify early to ensure comprehensive validation!

---

**Task Status**: Ready to assign  
**Expected Effort**: 3-4 hours  
**Blocking Issues**: Requires Task 01-001 complete  
**Ready to Begin**: ✅ After Task 01-001
