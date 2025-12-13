# Task Handoff: Confirmation Dialog Component

**Task ID**: CRT-CUSTOM-PRESETS-TASK-02-004-CONFIRMATION-DIALOG  
**Task Name**: Create Confirmation Dialog Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (~4 files)

---

## 🎯 Objective

**What**: Build a reusable confirmation dialog component for destructive actions (like preset deletion) with clear warning messaging, customizable labels, and keyboard navigation.

**Why**: A generic confirmation dialog provides a consistent UX pattern for all destructive actions, preventing accidental deletions and following best practices for user consent workflows.

**Success Criteria**:
- [ ] `ConfirmationDialogComponent` class created as standalone component
- [ ] Input properties defined: `title`, `message`, `confirmLabel`, `cancelLabel`
- [ ] Output events defined: `confirmed`, `cancelled`
- [ ] Warning icon displayed prominently in header
- [ ] Confirm button styled as destructive action (error color)
- [ ] Keyboard handlers implemented (Enter confirms, Escape cancels)
- [ ] Template and styles implemented
- [ ] Component compiles without errors
- [ ] All behavioral tests pass (12+ tests expected)

---

## 📋 Prerequisites Completed

- ✅ **Phase 1 Complete**: Storage infrastructure and type system ready
- ✅ **CRT-CUSTOM-PRESETS-TASK-02-001 through 02-003**: Preset name dialog completed (reference patterns)

---

## 📦 Dependencies

**Angular Packages**:
- `@angular/core` - Component, input(), output()
- `@angular/material/button` - Material button components
- `@angular/material/icon` - Material icons

**Internal Dependencies**:
- `@teensyrom-nx/ui/components` - `lib-scaling-compact-card`, `lib-icon-button`

**Constraints**:
- Must be standalone component (no NgModule)
- Must use signal-based inputs/outputs (Angular 19 pattern)
- Must be generic and reusable (not preset-specific)
- Must clearly distinguish destructive action (error-colored confirm button)

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.ts` - Component class
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.html` - Template
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.scss` - Styles
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.spec.ts` - Tests
- `libs/ui/components/src/lib/confirmation-dialog/index.ts` - Barrel export

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/preset-name-dialog/` - Similar dialog structure (Tasks 02-001 through 02-003)
- `libs/ui/components/src/lib/icon-button/icon-button.component.ts` - Button component API

---

## 🔧 Implementation Guidance

### Component Class Structure

**File**: `confirmation-dialog.component.ts`

```typescript
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCompactCardComponent } from '../scaling-compact-card';
import { IconButtonComponent } from '../icon-button';

@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    ScalingCompactCardComponent,
    IconButtonComponent,
  ],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss',
})
export class ConfirmationDialogComponent {
  // Input properties
  title = input<string>('Confirm Action');
  message = input<string>('');
  confirmLabel = input<string>('Delete');
  cancelLabel = input<string>('Cancel');
  
  // Output events
  confirmed = output<void>();
  cancelled = output<void>();
  
  // Event handlers
  onConfirmClick(): void {
    this.confirmed.emit();
  }
  
  onCancelClick(): void {
    this.cancelled.emit();
  }
  
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onConfirmClick();
    } else if (event.key === 'Escape') {
      this.onCancelClick();
    }
  }
}
```

### Template Structure

**File**: `confirmation-dialog.component.html`

```html
<lib-scaling-compact-card (keydown)="onKeyDown($event)">
  <!-- Dialog Header with Warning Icon -->
  <div class="dialog-header">
    <mat-icon class="warning-icon">warning</mat-icon>
    <h2>{{ title() }}</h2>
  </div>
  
  <!-- Message Text -->
  <div class="dialog-message">
    <p>{{ message() }}</p>
  </div>
  
  <!-- Action Buttons -->
  <div class="button-row">
    <lib-icon-button
      [icon]="'delete'"
      [label]="confirmLabel()"
      [color]="'error'"
      (click)="onConfirmClick()"
    />
    <lib-icon-button
      [icon]="'close'"
      [label]="cancelLabel()"
      (click)="onCancelClick()"
    />
  </div>
</lib-scaling-compact-card>
```

### Styles Structure

**File**: `confirmation-dialog.component.scss`

```scss
:host {
  display: block;
}

// Dialog container sizing
lib-scaling-compact-card {
  max-width: 350px;
  width: 100%;
}

// Dialog header
.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  
  .warning-icon {
    color: var(--error-color);
    font-size: 32px;
    width: 32px;
    height: 32px;
  }
  
  h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
  }
}

// Message text
.dialog-message {
  margin-bottom: var(--spacing-lg);
  
  p {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--text-secondary);
    line-height: 1.5;
    white-space: pre-wrap; // Support multi-line messages
    word-wrap: break-word; // Wrap long preset names
  }
}

// Button row
.button-row {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

// Mobile responsiveness
@media (max-width: 600px) {
  lib-scaling-compact-card {
    max-width: 100%;
    margin: var(--spacing-sm);
  }
  
  .button-row {
    flex-direction: column-reverse;
    gap: var(--spacing-xs);
    
    lib-icon-button {
      width: 100%;
    }
  }
}
```

### Key Requirements

1. **Component Inputs**:
   - `title`: Dialog title (default: "Confirm Action")
   - `message`: Warning message text (default: empty)
   - `confirmLabel`: Confirm button text (default: "Delete")
   - `cancelLabel`: Cancel button text (default: "Cancel")

2. **Component Outputs**:
   - `confirmed`: Emitted when user confirms action
   - `cancelled`: Emitted when user cancels action

3. **Warning Icon**:
   - Material icon: `warning`
   - Size: 32x32px (larger than normal icons)
   - Color: `var(--error-color)` (red/pink)
   - Positioned in header next to title

4. **Destructive Confirm Button**:
   - Use `lib-icon-button` with `color="error"` prop
   - Icon: `delete` (trash can icon)
   - Label from `confirmLabel()` input
   - Visually distinct from cancel button

5. **Message Display**:
   - Support multi-line text (`white-space: pre-wrap`)
   - Wrap long text (`word-wrap: break-word`)
   - Example: "Are you sure you want to delete preset 'My Very Long Preset Name'?"

6. **Keyboard Navigation**:
   - Enter key: Confirm action
   - Escape key: Cancel action
   - Attached to `lib-scaling-compact-card` root element

7. **Dialog Sizing**:
   - Max-width: 350px (narrower than name dialog to focus attention)
   - Full width within max-width (responsive)

### Barrel Export

**File**: `confirmation-dialog/index.ts`

```typescript
export * from './confirmation-dialog.component';
```

---

## 🧪 Testing Requirements

### Test Coverage Required

**File**: `confirmation-dialog.component.spec.ts`

**Behavioral Expectations** (12+ tests):

**Input Property Tests**:
- [ ] Component initializes with default title "Confirm Action"
- [ ] Component displays custom title when provided
- [ ] Component initializes with empty message
- [ ] Component displays custom message when provided
- [ ] Component initializes with default confirm label "Delete"
- [ ] Component displays custom confirm label when provided
- [ ] Component initializes with default cancel label "Cancel"
- [ ] Component displays custom cancel label when provided

**Icon Display Tests**:
- [ ] Warning icon displays in header
- [ ] Warning icon has error color styling

**Event Emission Tests**:
- [ ] Clicking confirm button emits `confirmed` event
- [ ] Clicking cancel button emits `cancelled` event

**Keyboard Navigation Tests**:
- [ ] Enter key emits `confirmed` event
- [ ] Escape key emits `cancelled` event

**Styling Tests** (visual inspection):
- [ ] Confirm button uses error color variant
- [ ] Dialog width is ~350px
- [ ] Message text wraps properly for long content

### Testing Approach

```typescript
describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
    }).compileComponents();
    
    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
  });
  
  it('should emit confirmed event on confirm click', () => {
    let emitted = false;
    component.confirmed.subscribe(() => emitted = true);
    
    component.onConfirmClick();
    
    expect(emitted).toBe(true);
  });
  
  // ... more tests
});
```

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📚 Related Documentation

**Planning Documents**:
- [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md)
- [Phase 2: UI Dialog Components](../phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Component Reference**:
- [Scaling Compact Card](../../../COMPONENT_LIBRARY.md#scaling-compact-card)
- [Icon Button](../../../COMPONENT_LIBRARY.md#icon-button)

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Style Guide](../../../STYLE_GUIDE.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-02-001 through 02-003: Preset name dialog (reference pattern)
- CRT-CUSTOM-PRESETS-TASK-02-005-CONFIRMATION-DIALOG-TEMPLATE-STYLES: Combined with this task
- CRT-CUSTOM-PRESETS-TASK-02-006-DIALOG-EXPORTS: Export task (next)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 🎯 Anti-Patterns to Avoid

❌ **Don't make preset-specific** - Component must be generic and reusable  
❌ **Don't skip warning icon** - Critical visual indicator for destructive action  
❌ **Don't use normal button styling** - Confirm must use error color  
❌ **Don't hardcode strings** - All text via input properties  
❌ **Don't forget keyboard navigation** - Enter/Escape handlers required  
❌ **Don't skip message wrapping** - Long preset names must wrap properly  

---

## 💡 Implementation Tips

1. **Create all files together** - Component class, template, styles, tests, barrel export
2. **Test destructive styling** - Verify error color variant on confirm button
3. **Test message wrapping** - Use long text to verify layout
4. **Compare with preset name dialog** - Maintain consistent patterns
5. **Keep component simple** - No validation or complex logic needed
6. **Test keyboard shortcuts early** - Easy to miss during implementation

---

## 📝 Usage Example

How this component will be used in Phase 3:

```typescript
// In settings panel component
showDeleteConfirmation(presetName: string): void {
  const dialogRef = ... // Open dialog
  
  // Configure dialog
  dialog.title = signal('Delete Preset');
  dialog.message = signal(`Are you sure you want to delete preset '${presetName}'? This action cannot be undone.`);
  dialog.confirmLabel = signal('Delete');
  dialog.cancelLabel = signal('Cancel');
  
  // Handle events
  dialog.confirmed.subscribe(() => {
    // Delete preset
  });
  
  dialog.cancelled.subscribe(() => {
    // Close dialog
  });
}
```

---

**Ready to implement?** Create a complete, reusable confirmation dialog with all four files (class, template, styles, tests). Focus on generic design and destructive action patterns. Test thoroughly with various message lengths and labels.
