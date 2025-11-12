## Reactive Forms

### Form Component Hierarchy

**Standard**: Use hierarchical form component pattern with parent form owner and presentational section components

**Pattern**: Forms are decomposed into a tree structure:
- **Smart Container**: Owns FormGroup, handles submission and store integration
- **Section Components**: Receive FormGroup via input(), purely presentational
- **Field Components** (optional): Custom form controls implementing ControlValueAccessor

**Detailed Documentation**: See [FORM_COMPONENT_TREE.md](./FORM_COMPONENT_TREE.md) for complete pattern documentation

### FormGroup Passing

**Standard**: Pass FormGroup to child components via `input()` signals

```typescript
// Parent component
form = this.fb.group({
  section: this.fb.group({ /* controls */ })
});

// Child component
export class SectionComponent {
  formGroup = input.required<FormGroup>();
}

// Template
<app-section [formGroup]="form.controls.section" />
```

**Type Safety**: Use generic `FormGroup` type for component inputs (not `FormGroup<T>`) to avoid type compatibility issues with FormBuilder inference.

### Form Validation

**Standard**: Apply validators at form building time, display errors in section components

```typescript
// In parent
form = this.fb.group({
  email: ['', [Validators.required, Validators.email]]
});

// In section component template
@if (formGroup().get('email')?.hasError('required')) {
  <mat-error>Email is required</mat-error>
}
@if (formGroup().get('email')?.hasError('email')) {
  <mat-error>Invalid email format</mat-error>
}
```

**Validation Best Practices**:
- Match frontend validators to backend validation rules
- Display errors inline below fields (Material Design pattern)
- Show errors on blur or submit, not while typing
- Provide clear, actionable error messages

### Form State Management

**Standard**: Use valueChanges observable with debouncing for auto-save patterns

```typescript
ngOnInit() {
  this.form.valueChanges.pipe(
    takeUntilDestroyed(this.destroyRef),
    debounceTime(500),
    filter(() => this.form.valid)
  ).subscribe(values => {
    this.store.saveData(values);
  });
}
```

**Cleanup**: Always use `takeUntilDestroyed()` to prevent memory leaks from form subscriptions.

### Form Initialization

**Standard**: Initialize form values from store using effect pattern

```typescript
ngOnInit() {
  effect(() => {
    const data = this.store.data();
    this.form.patchValue(data, { emitEvent: false });
  });
}
```

**emitEvent: false**: Prevents valueChanges from triggering when initializing from external source (avoids circular updates).

---


# Form Component Tree Pattern

## Overview

This document describes the hierarchical form component pattern used in TeensyROM for managing complex forms. This pattern decomposes large forms into a tree of smaller, focused components with clear parent-child relationships and unidirectional data flow.

---

## Pattern Architecture

### Three-Layer Form Hierarchy

```
Smart Container Component (Form Owner)
    ↓ (passes FormGroup)
Section Components (Form Groups)
    ↓ (passes FormGroup/FormControl)
Field Components (Form Controls)
```

#### Layer 1: Smart Container (Form Owner)

**Responsibility**: Owns the root `FormGroup`, manages form state, handles submission

**Characteristics**:
- Creates and owns the complete reactive form structure
- Injects services (store, infrastructure)
- Handles form submission and validation
- Manages form-level concerns (dirty state, auto-save, undo/redo)
- Passes section `FormGroup`s down to child components

**Example**: Settings view component builds root form and passes sections to children

#### Layer 2: Section Components (Presentational)

**Responsibility**: Manages a logical section of the form (e.g., Player Settings, Search Settings)

**Characteristics**:
- Receives `FormGroup` via `input()` signal
- Purely presentational (no services, no store)
- Groups related form controls logically
- Passes individual `FormControl`s or nested `FormGroup`s to field components
- Reusable across different parent forms

**Example**: Player settings section component receives player FormGroup

#### Layer 3: Field Components (Optional)

**Responsibility**: Renders individual form controls or complex input widgets

**Characteristics**:
- Receives `FormControl` or nested `FormGroup` via `input()`
- Implements `ControlValueAccessor` for custom form controls
- Highly reusable across multiple sections
- Handles field-specific UI logic (validation messages, formatting)

**Example**: Search weights slider group component

---

## Implementation Pattern

### Smart Container Example Structure

```typescript
@Component({
  selector: 'app-settings-view',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PlayerSettingsComponent,
    SearchSettingsComponent,
    // ... other section components
  ],
  template: `
    <form [formGroup]="form">
      <app-player-settings [formGroup]="form.controls.player" />
      <app-search-settings [formGroup]="form.controls.search" />
    </form>
  `
})
export class SettingsViewComponent {
  private fb = inject(FormBuilder);
  private store = inject(SettingsStore);
  
  form = this.fb.group({
    player: this.fb.group({ /* player controls */ }),
    search: this.fb.group({ /* search controls */ }),
  });
  
  // Form submission, auto-save, validation logic here
}
```

### Section Component Example Structure

```typescript
@Component({
  selector: 'app-player-settings',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div [formGroup]="formGroup()">
      <mat-form-field>
        <mat-label>Repeat Mode</mat-label>
        <mat-select formControlName="repeatMode">
          <mat-option value="Off">Off</mat-option>
          <mat-option value="Single">Single</mat-option>
          <mat-option value="All">All</mat-option>
        </mat-select>
      </mat-form-field>
      
      <mat-form-field>
        <mat-label>SID Timer (seconds)</mat-label>
        <input matInput type="number" formControlName="sidTimerSeconds">
      </mat-form-field>
    </div>
  `
})
export class PlayerSettingsComponent {
  formGroup = input.required<FormGroup>();  // Receives FormGroup from parent
}
```

---

## Form Group Passing

### TypeScript FormGroup Typing

When passing FormGroup to child components, use generic `FormGroup` type (not `FormGroup<T>`):

```typescript
// In parent component
form = this.fb.group({
  player: this.fb.group({ /* controls */ })
});

// In child component
formGroup = input.required<FormGroup>();  // Generic FormGroup, not FormGroup<PlayerSettings>
```

**Rationale**: Angular's type inference for FormBuilder creates complex nested types that don't match explicit interfaces. Using generic `FormGroup` avoids type compatibility issues while maintaining type safety at the control level via `formControlName` directives.

### Accessing Controls in Child Components

```typescript
// In template - type-safe via string literal
<input matInput formControlName="repeatMode">

// In component TypeScript - cast when needed
get repeatModeControl(): FormControl {
  return this.formGroup().get('repeatMode') as FormControl;
}
```

---

## Benefits of This Pattern

### Maintainability
✅ **Single Responsibility**: Each component has one clear purpose
✅ **Easy to Test**: Components can be tested in isolation with mocked FormGroups
✅ **Easy to Debug**: Form state flows in one direction (parent → child)

### Reusability
✅ **Section Components**: Reusable across different parent forms
✅ **Field Components**: Reusable across multiple sections
✅ **Composition**: Mix and match sections for different use cases

### Scalability
✅ **Add New Sections**: Create new section component, add to parent
✅ **Modify Sections**: Change section component without affecting others
✅ **Nested Complexity**: Support deeply nested form structures

---

## Form Validation

### Validation at Each Layer

**Container Layer**:
- Form-level validation (e.g., cross-field validation)
- Overall form validity state
- Submit button enabling/disabling

**Section Layer**:
- Section-specific validation display
- Error message rendering
- Validation styling (red borders, error text)

**Field Layer**:
- Control-specific validation
- Custom validator implementation
- Format validation (dates, numbers, patterns)

### Example Validation Pattern

```typescript
// In parent container
form = this.fb.group({
  player: this.fb.group({
    sidTimerSeconds: [180, [Validators.required, Validators.min(1), Validators.max(3600)]]
  })
});

// In section component template
@if (formGroup().get('sidTimerSeconds')?.hasError('min')) {
  <mat-error>Timer must be at least 1 second</mat-error>
}
@if (formGroup().get('sidTimerSeconds')?.hasError('max')) {
  <mat-error>Timer cannot exceed 3600 seconds</mat-error>
}
```

---

## State Management Integration

### Form State Flow

1. **Container** loads initial values from store
2. **Form** built with initial values via `patchValue()`
3. **User** interacts with section/field components
4. **Container** detects changes via `valueChanges` observable
5. **Container** updates store (typically debounced for auto-save)
6. **Store** persists changes to backend

### Example Integration

```typescript
export class SettingsViewComponent implements OnInit {
  private store = inject(SettingsStore);
  private destroyRef = inject(DestroyRef);
  
  form = this.fb.group({ /* form structure */ });
  
  ngOnInit() {
    // Load initial values from store
    effect(() => {
      const settings = this.store.settings();
      this.form.patchValue(settings, { emitEvent: false });
    });
    
    // Auto-save on changes (debounced)
    this.form.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(500),
      filter(() => this.form.valid)
    ).subscribe(values => {
      this.store.saveSettings(values);
    });
  }
}
```

---

## Testing Strategy

### Container Testing
- Test form building and initialization
- Test form submission logic
- Test store integration
- Mock section components (shallow rendering)

### Section Testing
- Test with mocked FormGroup
- Test validation display
- Test user interactions
- No store dependencies (pure presentation)

### Integration Testing
- Test complete form hierarchy
- Test data flow parent → child
- Test validation propagation
- Use real FormGroups (not mocked)

**Reference**: See [SMART_COMPONENT_TESTING.md](./SMART_COMPONENT_TESTING.md) for detailed testing patterns

---

## Best Practices

### Do's
✅ Pass `FormGroup` via `input()` signals to section components
✅ Keep section components presentational (no services)
✅ Use `formControlName` for type-safe control binding
✅ Validate at appropriate layer (field → section → container)
✅ Use `{ emitEvent: false }` when patching from external source
✅ Handle form subscriptions with `takeUntilDestroyed()`

### Don'ts
❌ Pass entire form to deeply nested components
❌ Inject services in presentational section components
❌ Access parent form directly from child components
❌ Skip validation in favor of backend-only checks
❌ Forget to unsubscribe from `valueChanges` observables
❌ Mutate FormGroup structure in child components

---

## Related Documentation

- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - General coding patterns
- [SMART_COMPONENT_TESTING.md](./SMART_COMPONENT_TESTING.md) - Component testing strategies
- [STATE_STANDARDS.md](./STATE_STANDARDS.md) - Store integration patterns
- [Angular Reactive Forms](https://angular.io/guide/reactive-forms) - Official Angular forms guide
