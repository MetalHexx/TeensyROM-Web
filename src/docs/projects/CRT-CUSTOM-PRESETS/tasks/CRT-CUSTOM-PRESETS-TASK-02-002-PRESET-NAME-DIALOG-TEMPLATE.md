# Task Handoff: Preset Name Dialog Template

**Task ID**: CRT-CUSTOM-PRESETS-TASK-02-002-PRESET-NAME-DIALOG-TEMPLATE  
**Task Name**: Create Preset Name Dialog Template  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (~2 files)

---

## 🎯 Objective

**What**: Build the HTML template for the preset name dialog with Material form components, validation feedback, character counter, and action buttons.

**Why**: The template provides the visual structure and data bindings for the preset name entry experience, ensuring users receive immediate feedback on input validity.

**Success Criteria**:
- [ ] Template created with `lib-scaling-compact-card` wrapper
- [ ] Dialog header displays title with icon
- [ ] Material form field with input bound to `currentName` signal
- [ ] Validation error message displays conditionally
- [ ] Character counter displays with state-based styling
- [ ] Action buttons (Save/Cancel) wired to component methods
- [ ] Keyboard bindings attached (Enter/Escape)
- [ ] Template compiles without errors
- [ ] All rendering tests pass (10+ tests expected)

---

## 📋 Prerequisites Completed

- ✅ **CRT-CUSTOM-PRESETS-TASK-02-001-PRESET-NAME-DIALOG-CLASS**: Component class implemented

---

## 📦 Dependencies

**Component Dependencies**:
- `lib-scaling-compact-card` - Animated dialog wrapper
- `lib-icon-button` - Action buttons
- Material components (form field, input, icons)

**Signal Bindings**:
- `title()` - Dialog title
- `currentName()` - Input value (two-way binding)
- `validationError()` - Error message text
- `remainingChars()` - Character counter text
- `canSave()` - Save button disabled state

**Constraints**:
- Must use Angular 19 control flow (`@if`, not `*ngIf`)
- Must use two-way binding for input field
- Must follow Material Design form patterns
- Must be accessible (ARIA labels, keyboard navigation)

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.html` - Dialog template

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/scaling-compact-card/scaling-compact-card.component.html` - Wrapper usage
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Form patterns
- `libs/ui/components/src/lib/icon-button/icon-button.component.html` - Button patterns

**Files to Reference**:
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts` - Component class (Task 02-001)

---

## 🔧 Implementation Guidance

### Template Structure

```html
<lib-scaling-compact-card>
  <!-- Dialog Header -->
  <div class="dialog-header">
    <mat-icon>edit</mat-icon>
    <h2>{{ title() }}</h2>
  </div>
  
  <!-- Form Field -->
  <mat-form-field appearance="outline" class="preset-name-field">
    <mat-label>Preset Name</mat-label>
    <input 
      matInput
      [value]="currentName()"
      (input)="currentName.set($any($event.target).value)"
      [maxlength]="50"
      (keydown)="onKeyDown($event)"
      autofocus
      placeholder="Enter preset name"
      aria-label="Preset name"
    />
    
    <!-- Character Counter -->
    <mat-hint align="end">
      <span [class.error-text]="currentName().length > 50">
        {{ remainingChars() }}
      </span>
    </mat-hint>
    
    <!-- Validation Error -->
    @if (validationError()) {
      <mat-error>{{ validationError() }}</mat-error>
    }
  </mat-form-field>
  
  <!-- Action Buttons -->
  <div class="button-row">
    <lib-icon-button
      [icon]="'check'"
      [label]="'Save'"
      [disabled]="!canSave()"
      (click)="onSaveClick()"
    />
    <lib-icon-button
      [icon]="'close'"
      [label]="'Cancel'"
      (click)="onCancelClick()"
    />
  </div>
</lib-scaling-compact-card>
```

### Key Requirements

1. **Scaling Compact Card Wrapper**:
   - Use `<lib-scaling-compact-card>` as root element
   - All dialog content nested inside
   - Provides animation and glassy card styling

2. **Dialog Header**:
   - Material icon: `edit` (pencil icon)
   - Title from `title()` input signal
   - Semantic `<h2>` tag for accessibility

3. **Material Form Field**:
   - Appearance: `outline` for visual clarity
   - Label: "Preset Name"
   - Input bound to `currentName()` signal (two-way)
   - Max length: 50 (HTML attribute for browser enforcement)
   - Placeholder: "Enter preset name"
   - Autofocus: User can start typing immediately
   - ARIA label: "Preset name" for screen readers

4. **Input Binding**:
   ```html
   [value]="currentName()"
   (input)="currentName.set($any($event.target).value)"
   ```
   - **Why `$any()`**: TypeScript strict mode requires casting `EventTarget` to access `.value`
   - Alternative: Can define typed event handler in component class

5. **Character Counter**:
   - Display via `<mat-hint align="end">`
   - Show `remainingChars()` computed signal
   - Conditional error styling: `[class.error-text]="currentName().length > 50"`
   - Note: HTML maxlength prevents typing beyond 50, but styling still needed for paste events

6. **Validation Error Display**:
   - Use Angular 19 `@if` control flow: `@if (validationError()) { }`
   - Material component: `<mat-error>`
   - Display `validationError()` text
   - Automatically styled by Material (red, below input)

7. **Action Buttons**:
   - Use `lib-icon-button` component (reusable library component)
   - Save button:
     - Icon: `check`
     - Label: "Save"
     - Disabled: `[disabled]="!canSave()"`
     - Click: `onSaveClick()`
   - Cancel button:
     - Icon: `close`
     - Label: "Cancel"
     - Never disabled
     - Click: `onCancelClick()`

8. **Keyboard Navigation**:
   - Attach `(keydown)="onKeyDown($event)"` to input element
   - Component class handles Enter (save) and Escape (cancel)
   - Input has autofocus, so keyboard events work immediately

### Accessibility Considerations

- **ARIA Labels**: Input has `aria-label="Preset name"`
- **Semantic HTML**: Use `<h2>` for title (proper heading hierarchy)
- **Focus Management**: Autofocus on input field when dialog opens
- **Keyboard Navigation**: Enter/Escape handlers for power users
- **Error Announcements**: `<mat-error>` automatically announced by screen readers
- **Button Labels**: `lib-icon-button` has text labels (not icon-only)

### Material Design Patterns

- **Outline Form Field**: Clear visual boundary, works well on glassy backgrounds
- **Hint Text**: Character counter positioned at end (right side)
- **Error Display**: Below input, replaces hint when error exists
- **Button Grouping**: Flex row with spacing between actions

---

## 🧪 Testing Requirements

### Test Coverage Required

**File**: `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.spec.ts`  
(Add tests to existing spec file from Task 02-001)

**Behavioral Expectations** (10+ tests):

**Rendering Tests**:
- [ ] Dialog header displays title from input signal
- [ ] Edit icon displays in header
- [ ] Input field renders with correct attributes (maxlength, placeholder, autofocus)
- [ ] Character counter displays correct format initially

**Data Binding Tests**:
- [ ] Input value reflects `currentName` signal
- [ ] Typing updates `currentName` signal
- [ ] Character counter updates as user types

**Validation Display Tests**:
- [ ] Validation error message hidden when no error
- [ ] Validation error message displays when `validationError()` is truthy
- [ ] Error text matches `validationError()` computed value

**Character Counter Styling**:
- [ ] Character counter uses normal styling when under limit
- [ ] Character counter uses error styling when over limit (edge case: paste)

**Button State Tests**:
- [ ] Save button disabled when `canSave()` is false
- [ ] Save button enabled when `canSave()` is true
- [ ] Cancel button always enabled

**Event Binding Tests**:
- [ ] Clicking Save button calls `onSaveClick()`
- [ ] Clicking Cancel button calls `onCancelClick()`
- [ ] Keyboard events passed to `onKeyDown()`

### Testing Approach

Test template rendering and bindings:

```typescript
it('should display title from input signal', () => {
  component.title = signal('Custom Title');
  fixture.detectChanges();
  
  const titleElement = fixture.nativeElement.querySelector('h2');
  expect(titleElement.textContent).toBe('Custom Title');
});

it('should bind input value to currentName signal', () => {
  component.currentName.set('Test Name');
  fixture.detectChanges();
  
  const input = fixture.nativeElement.querySelector('input');
  expect(input.value).toBe('Test Name');
});

it('should update currentName on input', () => {
  const input = fixture.nativeElement.querySelector('input');
  input.value = 'New Name';
  input.dispatchEvent(new Event('input'));
  
  expect(component.currentName()).toBe('New Name');
});
```

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📚 Related Documentation

**Planning Documents**:
- [Phase 2: UI Dialog Components](../phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Component Reference**:
- [Scaling Compact Card](../../../COMPONENT_LIBRARY.md#scaling-compact-card)
- [Icon Button](../../../COMPONENT_LIBRARY.md#icon-button)

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Template patterns
- [Style Guide](../../../STYLE_GUIDE.md) - Utility classes
- [Testing Standards](../../../TESTING_STANDARDS.md)

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-02-001-PRESET-NAME-DIALOG-CLASS: Component class (prerequisite)
- CRT-CUSTOM-PRESETS-TASK-02-003-PRESET-NAME-DIALOG-STYLES: Styling (next)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 🎯 Anti-Patterns to Avoid

❌ **Don't use `*ngIf`** - Use Angular 19 `@if` control flow  
❌ **Don't use `[(ngModel)]`** - Use explicit value/input binding with signals  
❌ **Don't forget autofocus** - Critical for UX (user can type immediately)  
❌ **Don't skip ARIA labels** - Required for accessibility  
❌ **Don't hardcode strings** - Use signal bindings for dynamic content  
❌ **Don't nest multiple form fields** - Keep template simple and flat  

---

## 💡 Implementation Tips

1. **Start with wrapper** - Get `lib-scaling-compact-card` working first
2. **Add form field next** - Material components can be tricky, isolate issues
3. **Test binding incrementally** - Verify each signal binding works before moving on
4. **Use browser DevTools** - Inspect computed signal values in template
5. **Test keyboard shortcuts** - Easy to forget in template-only changes
6. **Check Material CSS** - Ensure Material styles loaded in test environment

---

**Ready to implement?** Create the template with proper structure, bindings, and accessibility attributes. Test all rendering behaviors thoroughly.
