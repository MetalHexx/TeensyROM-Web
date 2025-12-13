# Phase 2: UI Dialog Components

## 🎯 Objective

Create reusable dialog components for preset name entry and deletion confirmation, using `lib-scaling-compact-card` for consistent presentation and following established component patterns. These dialogs provide the UI foundation for custom preset management workflows.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md) - Complete feature overview
- [ ] [Phase 1: Storage Infrastructure](./CRT-CUSTOM-PRESETS-PHASE-01-STORAGE-INFRASTRUCTURE.md) - Storage layer foundation

**Component Documentation:**

- [ ] [Scaling Compact Card Component](../../../../docs/COMPONENT_LIBRARY.md#scaling-compact-card) - Container component reference
- [ ] [Icon Button Component](../../../../docs/COMPONENT_LIBRARY.md#icon-button) - Button component reference
- [ ] [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - General component patterns

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns and utility classes
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── preset-name-dialog/
│   ├── preset-name-dialog.component.ts          ✨ New - Name entry dialog
│   ├── preset-name-dialog.component.html        ✨ New - Dialog template
│   ├── preset-name-dialog.component.scss        ✨ New - Dialog styles
│   ├── preset-name-dialog.component.spec.ts     ✨ New - Dialog tests
│   └── index.ts                                 ✨ New - Barrel export
├── confirmation-dialog/
│   ├── confirmation-dialog.component.ts         ✨ New - Confirmation dialog
│   ├── confirmation-dialog.component.html       ✨ New - Dialog template
│   ├── confirmation-dialog.component.scss       ✨ New - Dialog styles
│   ├── confirmation-dialog.component.spec.ts    ✨ New - Dialog tests
│   └── index.ts                                 ✨ New - Barrel export
└── index.ts                                     📝 Modified - Export new components
```

---

<details open>
<summary><h3>Task 1: Create Preset Name Dialog Component</h3></summary>

**Purpose**: Build a dialog component for entering/editing custom preset names with real-time validation feedback and keyboard navigation.

**Related Documentation:**

- [Master Plan - UI Component Structure](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#ui-component-structure)
- [Scaling Compact Card](../../../../docs/COMPONENT_LIBRARY.md#scaling-compact-card)

**Implementation Subtasks:**

- [ ] **Create Component Class**: Create `PresetNameDialogComponent` with standalone imports
- [ ] **Add Input Properties**: `title`, `initialValue`, `reservedNames` inputs
- [ ] **Add Output Events**: `confirmed` output emitting string, `cancelled` output
- [ ] **Add Validation Signal**: `validationError` computed signal with error message
- [ ] **Add Character Counter**: `remainingChars` computed signal showing `X/50`
- [ ] **Implement Validation**: Use validation logic from Phase 1
- [ ] **Add Keyboard Handlers**: Enter to confirm, Escape to cancel
- [ ] **Add Autofocus**: Focus input field when dialog opens

**Testing Subtask:**

- [ ] **Write Tests**: Test validation states and user interactions (see Testing section below)

**Key Implementation Notes:**

- Use `lib-scaling-compact-card` as wrapper for consistent animation
- Input field uses Angular Material `mat-form-field` and `mat-input`
- Validation runs on every keystroke (no debounce) for immediate feedback
- Save button disabled when validation error exists or name is empty
- Component is presentational - validation logic injected, not embedded

**Component Interface:**

```typescript
@Component({
  selector: 'lib-preset-name-dialog',
  // ...
})
export class PresetNameDialogComponent {
  title = input<string>('Save Preset');
  initialValue = input<string>('');
  reservedNames = input<string[]>([]);
  
  confirmed = output<string>();
  cancelled = output<void>();
  
  currentName = signal<string>('');
  validationError = computed(() => /* validation logic */);
  remainingChars = computed(() => /* 50 - length */);
  canSave = computed(() => /* validation + non-empty */);
}
```

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] Dialog displays title from input property
- [ ] Input field shows initialValue when provided
- [ ] Validation error appears for empty name
- [ ] Validation error appears for invalid characters
- [ ] Validation error appears for reserved names
- [ ] Validation error appears for names over 50 chars
- [ ] Character counter updates as user types
- [ ] Save button disabled when validation error exists
- [ ] Confirmed output emits trimmed name on save click
- [ ] Cancelled output emits on cancel click
- [ ] Enter key triggers save when valid
- [ ] Escape key triggers cancel
- [ ] Input field auto-focuses on component load

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
- See [Testing Standards](../../../TESTING_STANDARDS.md) for validation testing

</details>

---

<details open>
<summary><h3>Task 2: Create Preset Name Dialog Template</h3></summary>

**Purpose**: Build the HTML template for the preset name dialog with Material form components and validation feedback display.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Utility classes and styling patterns
- [Component Library](../../../COMPONENT_LIBRARY.md) - Form component examples

**Implementation Subtasks:**

- [ ] **Add Scaling Container**: Wrap content in `lib-scaling-compact-card`
- [ ] **Add Dialog Header**: Title with icon
- [ ] **Add Form Field**: `mat-form-field` with `mat-input` for name entry
- [ ] **Add Validation Message**: Conditional error message display
- [ ] **Add Character Counter**: Display remaining characters
- [ ] **Add Button Row**: Save and Cancel buttons using `lib-icon-button`
- [ ] **Add Keyboard Bindings**: `(keydown.enter)` and `(keydown.escape)` handlers

**Testing Subtask:**

- [ ] **Write Tests**: Test template rendering and bindings (see Testing section below)

**Key Implementation Notes:**

- Use `@if` for conditional validation message display
- Error message should use `.error-text` utility class from style guide
- Character counter uses `.dimmed` class when under limit, `.error-text` when over
- Save button uses `lib-icon-button` with `check` icon
- Cancel button uses `lib-icon-button` with `close` icon
- Template follows clean architecture: no business logic, only presentation

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] Title displays correctly in header
- [ ] Input field binds to currentName signal
- [ ] Validation message displays when error exists
- [ ] Validation message hidden when no error
- [ ] Character counter displays correct format (X/50)
- [ ] Character counter shows error styling when over limit
- [ ] Save button disabled attribute reflects canSave signal
- [ ] Clicking save button emits confirmed event
- [ ] Clicking cancel button emits cancelled event

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 3: Style Preset Name Dialog</h3></summary>

**Purpose**: Apply consistent styling to the preset name dialog using established style guide patterns and Material component overrides.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Global styles and utility classes
- [CRT Settings Panel](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss) - Similar dialog styling reference

**Implementation Subtasks:**

- [ ] **Add Dialog Width**: Set max-width to ~400px for comfortable reading
- [ ] **Style Dialog Header**: Add spacing, icon styling, title typography
- [ ] **Style Form Field**: Material input overrides for glassy theme
- [ ] **Style Validation Message**: Error text styling with icon
- [ ] **Style Character Counter**: Subtle text with state-based coloring
- [ ] **Style Button Row**: Flex layout with spacing between buttons
- [ ] **Add Focus Styles**: Keyboard navigation focus indicators

**Testing Subtask:**

- [ ] **Write Tests**: Visual regression testing (manual review)

**Key Implementation Notes:**

- Use `.glassy` class or glassy variables from style guide
- Dialog should feel cohesive with CRT settings panel aesthetics
- Focus indicators must meet WCAG 2.1 AA contrast requirements
- Validation error uses `--error-color` CSS variable
- Character counter uses `--dimmed-color` when normal, `--error-color` when over limit

**Styling Variables to Use:**

```scss
// From style guide
--card-background: rgba(42, 23, 52, 0.9);
--primary-color: #9b4dca;
--error-color: #ff6b6b;
--dimmed-color: rgba(255, 255, 255, 0.5);
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] Dialog width appropriate for content (~400px)
- [ ] Glassy card background visible
- [ ] Form field styling matches theme
- [ ] Error messages clearly visible
- [ ] Button hover states provide feedback
- [ ] Focus indicators visible and high-contrast
- [ ] Mobile responsive (tested at 360px width)

**Testing Reference:**

- See [Style Guide](../../../STYLE_GUIDE.md) for design system compliance

</details>

---

<details open>
<summary><h3>Task 4: Create Confirmation Dialog Component</h3></summary>

**Purpose**: Build a reusable confirmation dialog for destructive actions (preset deletion) with clear warning messaging.

**Related Documentation:**

- [Master Plan - UI Component Structure](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#ui-component-structure)
- [Icon Button Component](../../../../docs/COMPONENT_LIBRARY.md#icon-button)

**Implementation Subtasks:**

- [ ] **Create Component Class**: Create `ConfirmationDialogComponent` with standalone imports
- [ ] **Add Input Properties**: `title`, `message`, `confirmLabel`, `cancelLabel` inputs
- [ ] **Add Output Events**: `confirmed`, `cancelled` outputs
- [ ] **Add Warning Icon**: Display `warning` Material icon in header
- [ ] **Add Destructive Styling**: Distinguish destructive confirm button (error color)
- [ ] **Add Keyboard Handlers**: Enter confirms, Escape cancels

**Testing Subtask:**

- [ ] **Write Tests**: Test dialog interactions and outputs (see Testing section below)

**Key Implementation Notes:**

- Use `lib-scaling-compact-card` wrapper
- Confirm button uses `error` color variant to indicate destructive action
- Default confirm label is "Delete", cancel label is "Cancel"
- Component is generic - reusable beyond preset deletion
- Message should support multi-line text for detailed warnings

**Component Interface:**

```typescript
@Component({
  selector: 'lib-confirmation-dialog',
  // ...
})
export class ConfirmationDialogComponent {
  title = input<string>('Confirm Action');
  message = input<string>('');
  confirmLabel = input<string>('Delete');
  cancelLabel = input<string>('Cancel');
  
  confirmed = output<void>();
  cancelled = output<void>();
}
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] Dialog displays title from input
- [ ] Dialog displays message text
- [ ] Confirm button shows confirmLabel text
- [ ] Cancel button shows cancelLabel text
- [ ] Warning icon displays in header
- [ ] Clicking confirm emits confirmed event
- [ ] Clicking cancel emits cancelled event
- [ ] Enter key emits confirmed event
- [ ] Escape key emits cancelled event
- [ ] Confirm button uses error color variant

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 5: Create Confirmation Dialog Template & Styles</h3></summary>

**Purpose**: Build template and styles for confirmation dialog with clear visual hierarchy and destructive action warning.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Button styling and utility classes
- [Icon Button](../../../../docs/COMPONENT_LIBRARY.md#icon-button)

**Implementation Subtasks:**

- [ ] **Create Template Structure**: Header with warning icon, message area, button row
- [ ] **Add Icon Display**: `mat-icon` with `warning` symbol in header
- [ ] **Add Message Display**: Multi-line text support with proper wrapping
- [ ] **Add Action Buttons**: Confirm (destructive) and Cancel buttons
- [ ] **Add Keyboard Bindings**: Enter and Escape handlers
- [ ] **Style Dialog Width**: Max-width ~350px for focused attention
- [ ] **Style Warning Icon**: Large, prominent, error-colored
- [ ] **Style Confirm Button**: Distinct error/destructive styling
- [ ] **Style Message Text**: Clear, readable typography

**Testing Subtask:**

- [ ] **Write Tests**: Test template rendering and styling (see Testing section below)

**Key Implementation Notes:**

- Warning icon should be immediately noticeable (large size, error color)
- Confirm button uses `lib-icon-button` with `color="error"` variant
- Cancel button uses normal styling (not destructive)
- Message wraps properly for long preset names
- Dialog narrower than name dialog to focus attention on decision

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] Warning icon displays and is prominent
- [ ] Title renders correctly
- [ ] Message text displays with proper wrapping
- [ ] Confirm button styled as destructive action
- [ ] Cancel button styled as safe action
- [ ] Button layout clear and accessible
- [ ] Dialog width appropriate for content
- [ ] Mobile responsive layout

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Style Guide](../../../STYLE_GUIDE.md)

</details>

---

<details open>
<summary><h3>Task 6: Export Dialog Components</h3></summary>

**Purpose**: Add dialog components to component library barrel exports for easy consumption.

**Implementation Subtasks:**

- [ ] **Export PresetNameDialog**: Add to `preset-name-dialog/index.ts`
- [ ] **Export ConfirmationDialog**: Add to `confirmation-dialog/index.ts`
- [ ] **Export from Root**: Add both components to `libs/ui/components/src/lib/index.ts`
- [ ] **Update Component Library Docs**: Add entry in COMPONENT_LIBRARY.md (optional)

**Testing Subtask:**

- [ ] **Write Tests**: Test exports resolve correctly (see Testing section below)

**Key Implementation Notes:**

- Follow existing barrel export patterns in component library
- Ensure both component classes and any related types are exported
- Maintain alphabetical ordering in root index.ts

**Testing Focus for Task 6:**

**Behaviors to Test:**

- [ ] Components can be imported from `@teensyrom-nx/ui/components`
- [ ] All public interfaces and types are accessible
- [ ] No circular dependency warnings

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts`
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.html`
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.scss`
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.spec.ts`
- `libs/ui/components/src/lib/preset-name-dialog/index.ts`
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.ts`
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.html`
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.scss`
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.spec.ts`
- `libs/ui/components/src/lib/confirmation-dialog/index.ts`

**Modified Files:**

- `libs/ui/components/src/lib/index.ts`

**Total**: 10 new files, 1 modified file

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] Preset name dialog accepts input with validation
- [ ] Confirmation dialog displays warning and action buttons
- [ ] Both dialogs use scaling-compact-card wrapper
- [ ] Keyboard navigation works (Enter/Escape)
- [ ] Real-time validation feedback displays

**Testing Requirements:**

- [ ] All testing subtasks completed
- [ ] Component behaviors tested thoroughly
- [ ] Validation states tested with edge cases
- [ ] Keyboard interactions tested
- [ ] All tests passing with no failures
- [ ] Test coverage ≥80%

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] Components follow style guide patterns
- [ ] Accessible (keyboard navigation, ARIA labels)
- [ ] Responsive on mobile devices

**Ready for Next Phase:**

- [ ] Dialog components fully functional
- [ ] Components exported correctly
- [ ] Ready for settings panel integration
- [ ] No visual or interaction bugs

---

## 📝 Notes & Considerations

### Design Decisions

- **Scaling Compact Card**: Provides consistent animation and glassy aesthetic matching CRT settings panel
- **Real-time Validation**: Immediate feedback improves UX over debounced validation
- **Destructive Styling**: Error-colored confirm button clearly signals dangerous action

### Implementation Constraints

- **Mobile Support**: Touch targets must be ≥44px for mobile usability
- **Accessibility**: Dialogs must trap focus and handle Escape key
- **Animation Performance**: Scaling animations should be smooth on lower-end devices

### Future Enhancements

- **Dialog Service**: Could create dialog service for programmatic opening
- **Animation Variants**: Could add fade-only option for less prominent dialogs
- **Preset Preview**: Could show CRT effect preview in name dialog

### Discoveries During Implementation

> Add notes here as you discover important details during implementation
