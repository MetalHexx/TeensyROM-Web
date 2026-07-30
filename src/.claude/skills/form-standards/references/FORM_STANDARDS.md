# Form Standards for TeensyROM

This document defines how complex forms are built in TeensyROM using a hierarchical component architecture combined with reactive forms patterns. Our approach balances maintainability, reusability, and scalability.

---

## Standards & Conventions

### Form Architecture Overview

TeensyROM uses a three-layer component hierarchy to decompose complex forms into focused, testable units with clear responsibilities. This pattern promotes unidirectional data flow and separation of concerns.

```mermaid
graph TD
    A["Smart Container<br/>(Form Owner)"] -->|passes FormGroup| B["Section Components<br/>(Presentational)"]
    B -->|passes FormControl/FormGroup| C["Field Components<br/>(Optional)"]

    style A fill:#e1f5ff
    style B fill:#f3e5f5
    style C fill:#e8f5e9

    A1["Responsibilities:<br/>• Owns root FormGroup<br/>• Handles submission<br/>• Store integration<br/>• Form-level validation"] -.-> A
    B1["Responsibilities:<br/>• Receives FormGroup input<br/>• Presentational only<br/>• Groups related controls<br/>• Renders UI"] -.-> B
    C1["Responsibilities:<br/>• Renders form controls<br/>• Custom widgets<br/>• ControlValueAccessor<br/>• Highly reusable"] -.-> C
```

---

### Layer Responsibilities

#### Layer 1: Smart Container (Form Owner)

The smart container owns the complete reactive form structure and manages form-level concerns.

**Core Responsibilities:**
- Creates and owns the root `FormGroup`
- Injects domain services and store
- Handles form submission and validation
- Manages form state (dirty, auto-save, undo/redo)
- Passes section `FormGroup`s to child components

**Characteristics:**
- Business logic aware
- Integrates with store/state management
- Handles form subscriptions (valueChanges, statusChanges)
- Uses `debounceTime` for auto-save patterns
- Manages lifecycle cleanup with `takeUntilDestroyed`

---

#### Layer 2: Section Components (Presentational)

Section components manage logical form sections and receive form state via inputs.

**Core Responsibilities:**
- Receive `FormGroup` or `FormControl` via `input()` signals
- Render related form fields as a cohesive section
- Display validation errors inline
- Pass controls to field components or form controls directly

**Characteristics:**
- Purely presentational (no service injection)
- No direct store access
- Reusable across different parent forms
- Stateless and focused on rendering
- Accept form state as inputs only

---

#### Layer 3: Field Components (Optional)

Field components handle individual form controls or complex custom widgets.

**Core Responsibilities:**
- Render form controls with consistent styling
- Implement `ControlValueAccessor` for custom inputs
- Display control-level validation messages
- Handle user interactions (blur, change events)

**Characteristics:**
- Highly reusable across multiple sections
- Can be used standalone in forms
- Implement custom form control protocol
- Focused on single responsibility (e.g., date picker, multi-select)

---

### Data Flow Patterns

#### Initialization and Loading

Forms are initialized when the container component loads data from the store.

**Process:**
1. Container detects store changes via signals or observables
2. Container builds or updates FormGroup structure
3. Container patches initial values with `patchValue()` using `{ emitEvent: false }`
4. Child components receive FormGroup input and render current state

**Pattern Details:**
- Use `emitEvent: false` to prevent circular updates from valueChanges subscriptions
- Initialize before subscription to valueChanges to avoid auto-save on load
- Use `effect()` for reactive updates when store data changes

#### User Interaction and Updates

Changes flow from child components up through the reactive forms system to the store.

**Process:**
1. User interacts with form control (types, selects, etc.)
2. FormControl value updates automatically
3. FormGroup valueChanges observable emits new value
4. Container debounces and validates changes
5. Container dispatches update to store
6. Store persists to backend

**Debounce Strategy:**
- Use 500ms debounce for text inputs and most controls
- Validate before saving: filter by `form.valid`
- Always use `takeUntilDestroyed()` to prevent memory leaks

---

### Validation Patterns

#### Validation Layer Distribution

Validation rules are applied at form building time but displayed at the appropriate layer.

**Container Layer:**
- Form-level validators (cross-field validation)
- Overall form validity state
- Submit button enable/disable logic

**Section Layer:**
- Section-specific error message rendering
- Validation styling (error states, helper text)
- Visual feedback to user

**Field Layer:**
- Control-specific validators (format, length, range)
- Custom validator implementation
- Field-level error conditions

#### Error Display Strategy

Display validation errors at the point of entry with clear, actionable messages.

**Best Practices:**
- Show errors after blur or submit, not during typing
- Display inline below or beside the control
- Use Material Design error patterns (red text, error icons)
- Provide clear, context-specific messages
- Match frontend validators to backend validation rules
  - Ask the user for a backend validator file reference if needed

---

### Type Safety and Composition

#### FormGroup Typing

Use generic `FormGroup` type for component inputs to avoid type compatibility issues with FormBuilder inference.

**Pattern:**
- Container: builds form with `FormBuilder` (type inference preferred)
- Section/Field Components: accept `FormGroup` type (not typed FormGroup)
- Template: pass section/control using property access (e.g., `form.get('sectionName')`)

#### Control Access

Access form controls using standard reactive forms methods consistently across layers.

**Methods:**
- Use `formGroup.get('controlName')` for optional access
- Use `formControlName` directive for template binding
- Use optional chaining for safe property access

---

### State Management Integration

#### Store Connection Pattern

Smart containers integrate with store through a predictable pattern.

**Load Phase:**
- Inject store service
- Use `effect()` to react to store signal changes
- Patch form with initial values

**Save Phase:**
- Subscribe to `form.valueChanges`
- Apply debounce and validation filters
- Dispatch save action to store
- Let store handle backend persistence

**Cleanup:**
- Always use `takeUntilDestroyed()` on subscriptions
- Use `DestroyRef` for cleanup coordination
- Prevent memory leaks from form observables

---

### Testing Approach

#### Container Testing

Test form structure, state management, and integration.

**Coverage:**
- Form initialization from store
- Form submission logic
- Auto-save and debounce behavior
- Store integration and dispatching
- Validation state propagation

**Setup:**
- Mock store with test data
- Use real FormGroups (not mocked)
- Shallow render child components

#### Section Component Testing

Test presentation and user interaction without store dependencies.

**Coverage:**
- Rendering form controls correctly
- Validation error display
- User input handling
- FormGroup input reactivity

**Setup:**
- Pass mocked FormGroup as input
- No store injection required
- Test with different validation states
- Test empty/error/success scenarios

#### Integration Testing

Test complete form hierarchy and data flow.

**Coverage:**
- Parent-to-child FormGroup passing
- Validation propagation through layers
- User interaction flow
- Store integration end-to-end

**Setup:**
- Use real FormGroups
- Render full component tree
- Test with realistic data

---

### Best Practices and Patterns

#### Key Principles

**✅ DO:**
- Pass `FormGroup` to children via `input()` signals
- Keep section components presentation-only
- Use `formControlName` directive for bindings
- Validate at appropriate layer (field → section → container)
- Use `{ emitEvent: false }` when patching from external source
- Handle form subscriptions with `takeUntilDestroyed()`

**❌ DON'T:**
- Pass entire form to deeply nested components (pass only needed sections)
- Inject services in presentational section components
- Access parent form directly from child components
- Skip frontend validation in favor of backend-only checks
- Forget to unsubscribe from `valueChanges` observables
- Mutate FormGroup structure in child components

#### Reusability Strategies

**Section Component Reuse:**
- Accept FormGroup via input
- Don't couple to specific parent
- Use generic section names (e.g., "Player Settings Section")
- Compose multiple sections in different containers

**Field Component Reuse:**
- Implement `ControlValueAccessor` for custom inputs
- Accept FormControl as input
- Make completely presentational
- Use in any section or form

---

## Detailed Pattern & Examples

This section describes the hierarchical form component pattern in more depth: pattern architecture, implementation examples, benefits, validation and state integration examples, testing strategy, and best practices. It decomposes large forms into a tree of smaller, focused components with clear parent-child relationships and unidirectional data flow.

### Pattern Architecture

#### Three-Layer Form Hierarchy

```
Smart Container Component (Form Owner)
    ↓ (passes FormGroup)
Section Components (Form Groups)
    ↓ (passes FormGroup/FormControl)
Field Components (Form Controls)
```

##### Layer 1: Smart Container (Form Owner)

**Responsibility**: Owns the root `FormGroup`, manages form state, handles submission

**Characteristics**:
- Creates and owns the complete reactive form structure
- Injects services (store, infrastructure)
- Handles form submission and validation
- Manages form-level concerns (dirty state, auto-save, undo/redo)
- Passes section `FormGroup`s down to child components

**Example**: Settings view component builds root form and passes sections to children

##### Layer 2: Section Components (Presentational)

**Responsibility**: Manages a logical section of the form (e.g., Player Settings, Search Settings)

**Characteristics**:
- Receives `FormGroup` via `input()` signal
- Purely presentational (no services, no store)
- Groups related form controls logically
- Passes individual `FormControl`s or nested `FormGroup`s to field components
- Reusable across different parent forms

**Example**: Player settings section component receives player FormGroup

##### Layer 3: Field Components (Optional)

**Responsibility**: Renders individual form controls or complex input widgets

**Characteristics**:
- Receives `FormControl` or nested `FormGroup` via `input()`
- Implements `ControlValueAccessor` for custom form controls
- Highly reusable across multiple sections
- Handles field-specific UI logic (validation messages, formatting)

**Example**: Search weights slider group component

---

### Implementation Pattern

#### Smart Container Example Structure

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

#### Section Component Example Structure

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

### Form Group Passing

#### TypeScript FormGroup Typing

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

#### Accessing Controls in Child Components

```typescript
// In template - type-safe via string literal
<input matInput formControlName="repeatMode">

// In component TypeScript - cast when needed
get repeatModeControl(): FormControl {
  return this.formGroup().get('repeatMode') as FormControl;
}
```

---

### Benefits of This Pattern

#### Maintainability
✅ **Single Responsibility**: Each component has one clear purpose
✅ **Easy to Test**: Components can be tested in isolation with mocked FormGroups
✅ **Easy to Debug**: Form state flows in one direction (parent → child)

#### Reusability
✅ **Section Components**: Reusable across different parent forms
✅ **Field Components**: Reusable across multiple sections
✅ **Composition**: Mix and match sections for different use cases

#### Scalability
✅ **Add New Sections**: Create new section component, add to parent
✅ **Modify Sections**: Change section component without affecting others
✅ **Nested Complexity**: Support deeply nested form structures

---

### Form Validation

#### Validation at Each Layer

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

#### Example Validation Pattern

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

### State Management Integration

#### Form State Flow

1. **Container** loads initial values from store
2. **Form** built with initial values via `patchValue()`
3. **User** interacts with section/field components
4. **Container** detects changes via `valueChanges` observable
5. **Container** updates store (typically debounced for auto-save)
6. **Store** persists changes to backend

#### Example Integration

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

### Testing Strategy

#### Container Testing
- Test form building and initialization
- Test form submission logic
- Test store integration
- Mock section components (shallow rendering)

#### Section Testing
- Test with mocked FormGroup
- Test validation display
- Test user interactions
- No store dependencies (pure presentation)

#### Integration Testing
- Test complete form hierarchy
- Test data flow parent → child
- Test validation propagation
- Use real FormGroups (not mocked)

---

### Best Practices

#### Do's
✅ Pass `FormGroup` via `input()` signals to section components
✅ Keep section components presentational (no services)
✅ Use `formControlName` for type-safe control binding
✅ Validate at appropriate layer (field → section → container)
✅ Use `{ emitEvent: false }` when patching from external source
✅ Handle form subscriptions with `takeUntilDestroyed()`

#### Don'ts
❌ Pass entire form to deeply nested components
❌ Inject services in presentational section components
❌ Access parent form directly from child components
❌ Skip validation in favor of backend-only checks
❌ Forget to unsubscribe from `valueChanges` observables
❌ Mutate FormGroup structure in child components

---

## Related Documentation

- [CODING_STANDARDS.md](../../../../docs/CODING_STANDARDS.md) - General coding patterns and conventions
- [SMART_COMPONENT_TESTING.md](../../testing-standards/references/SMART_COMPONENT_TESTING.md) - Detailed component testing strategies (`testing-standards` skill)
- [STATE_STANDARDS.md](../../state-standards/references/STATE_STANDARDS.md) - Store and state management patterns (`state-standards` skill)
- [Angular Reactive Forms](https://angular.io/guide/reactive-forms) - Official Angular documentation
