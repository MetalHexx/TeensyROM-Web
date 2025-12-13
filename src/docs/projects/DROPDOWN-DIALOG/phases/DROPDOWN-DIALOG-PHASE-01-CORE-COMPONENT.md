# Phase 1: Core Dropdown Dialog Component

## 🎯 Objective

Build the foundational dropdown dialog component with Angular CDK overlay positioning, content projection system, and programmatic API. This component will serve as a pure positioning container that can wrap any content without styling opinions.

**Success Definition**: A working dropdown dialog component that can wrap `lib-preset-name-dialog` and `lib-confirmation-dialog` without requiring changes to those components, with comprehensive unit tests validating overlay lifecycle and content projection.

---

## 📚 Required Reading

**Feature Documentation**:
- [ ] [Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Complete project context
- [ ] [Dropdown Menu Component](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts) - Reference implementation

**Standards & Guidelines**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable components catalog
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - **ONLY if styling needed (should be minimal)**

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── dropdown-dialog/
│   ├── dropdown-dialog.component.ts       ✨ New - Core component with CDK overlay
│   ├── dropdown-dialog.component.spec.ts  ✨ New - Unit tests
│   └── index.ts                           ✨ New - Barrel export
└── dropdown-menu/
    └── dropdown-menu.component.ts         📝 Reference - Study positioning logic
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Component Structure with CDK Dependencies</h3></summary>

**Purpose**: Scaffold the dropdown dialog component with proper CDK overlay imports and basic template structure.

**Related Documentation**:
- [Angular CDK Overlay](https://material.angular.io/cdk/overlay/overview)
- [Dropdown Menu Reference](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts)

**Implementation Subtasks**:

- [x] **Create Component File**: Generate `dropdown-dialog.component.ts` with standalone configuration ✅ TASK-01-001
- [x] **Import CDK Modules**: Add `Overlay`, `OverlayModule`, `TemplatePortal` from `@angular/cdk` ✅ TASK-01-001
- [x] **Define Component Selector**: Use `lib-dropdown-dialog` selector ✅ TASK-01-001
- [x] **Setup Template Structure**: Two content projection slots (trigger and dialog-content) ✅ TASK-01-001
- [x] **Add Animation Imports**: Import fade/scale animations matching dropdown menu ✅ TASK-01-001
- [x] **Create Barrel Export**: Export component from `index.ts` ✅ TASK-01-003

**Testing Subtask**:
- [ ] **Write Tests**: Component renders and imports are correct (see Testing section)

**Key Implementation Notes**:
- Use standalone component pattern (Angular 19)
- Match dropdown menu's animation trigger exactly
- Template should have minimal structure—just projection slots

**Critical Template Pattern**:
```html
<div #trigger>
  <ng-content></ng-content>  <!-- Trigger element -->
</div>

<ng-template #dialogTemplate>
  <div [@fadeInOut]>
    <ng-content select="[dialog-content]"></ng-content>  <!-- Dialog content -->
  </div>
</ng-template>
```

**Testing Focus for Task 1**:

**Behaviors to Test**:
- [ ] Component renders without errors
- [ ] Template has correct content projection slots
- [ ] Trigger element reference is accessible
- [ ] Dialog template reference is accessible

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 2: Implement Overlay Positioning Strategy</h3></summary>

**Purpose**: Add CDK overlay creation and positioning logic matching dropdown menu behavior.

**Related Documentation**:
- [Dropdown Menu Positioning](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts#L65-L120)
- [Master Plan Architecture](../DROPDOWN-DIALOG-MASTER-PLAN.md#architecture-overview)

**Implementation Subtasks**:

- [ ] **Inject Overlay Service**: Add `Overlay` and `ViewContainerRef` to constructor
- [ ] **Create Position Strategy**: Use `flexibleConnectedTo` with trigger element
- [ ] **Configure Position Preferences**: Match dropdown menu (below-start, below-end, above-start, above-end)
- [ ] **Add Scroll Strategy**: Use `reposition()` for automatic repositioning
- [ ] **Configure Backdrop**: Transparent backdrop with `cdk-overlay-transparent-backdrop` class
- [ ] **Handle Fullscreen**: Copy dropdown menu's fullscreen positioning logic

**Testing Subtask**:
- [ ] **Write Tests**: Overlay creates with correct positioning (see Testing section)

**Key Implementation Notes**:
- Position offset: 8px vertical spacing from trigger
- Viewport margin: 0 (fullscreen compatibility)
- Push strategy: false (prevents unwanted repositioning)

**Position Configuration Example**:
```typescript
const positionStrategy = overlay
  .position()
  .flexibleConnectedTo(triggerElement)
  .withPositions([
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 }
  ]);
```

**Testing Focus for Task 2**:

**Behaviors to Test**:
- [ ] Position strategy created with correct config
- [ ] Overlay positions below trigger by default
- [ ] Scroll strategy is reposition type
- [ ] Backdrop is transparent
- [ ] Fullscreen detection works

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 3: Implement Open/Close Methods and State Management</h3></summary>

**Purpose**: Add programmatic API for opening/closing the dialog with proper state tracking.

**Related Documentation**:
- [State Standards](../../../STATE_STANDARDS.md) - Signal-based state
- [Dropdown Menu Methods](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts#L50-L60)

**Implementation Subtasks**:

- [ ] **Add State Signals**: Create `isOpen` signal (boolean)
- [ ] **Add Internal Signals**: Create `overlayRef` signal (OverlayRef | null)
- [ ] **Implement Open Method**: Create overlay, attach portal, update state
- [ ] **Implement Close Method**: Dispose overlay, clean up, update state
- [ ] **Add Event Outputs**: Create `opened` and `closed` output events
- [ ] **Handle Backdrop Click**: Subscribe to backdrop clicks to close dialog

**Testing Subtask**:
- [ ] **Write Tests**: Open/close lifecycle works correctly (see Testing section)

**Key Implementation Notes**:
- Check `isOpen` before opening (prevent double-open)
- Clean up fullscreen elements on close (if applicable)
- Emit events after state changes complete
- Properly dispose overlay to prevent memory leaks

**Method Signatures**:
```typescript
open(): void;
close(): void;
isOpen = signal<boolean>(false);
opened = output<void>();
closed = output<void>();
```

**Testing Focus for Task 3**:

**Behaviors to Test**:
- [ ] `open()` creates overlay and sets `isOpen` to true
- [ ] `opened` event emits after overlay created
- [ ] `close()` disposes overlay and sets `isOpen` to false
- [ ] `closed` event emits after disposal
- [ ] Backdrop click triggers close
- [ ] Double open is prevented

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 4: Add Fullscreen Support</h3></summary>

**Purpose**: Handle positioning correctly when dialog trigger is inside fullscreen containers.

**Related Documentation**:
- [Dropdown Menu Fullscreen Logic](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts#L95-L145)

**Implementation Subtasks**:

- [ ] **Detect Fullscreen Element**: Check `document.fullscreenElement` on open
- [ ] **Attach to Fullscreen Container**: If in fullscreen, attach overlay to fullscreen element
- [ ] **Move Overlay Elements**: Move overlay pane and backdrop to fullscreen container
- [ ] **Adjust Positioning**: Calculate position relative to fullscreen bounds
- [ ] **Restore on Close**: Move elements back to overlay container on close

**Testing Subtask**:
- [ ] **Write Tests**: Fullscreen positioning works (see Testing section)

**Key Implementation Notes**:
- Use `setTimeout(0)` to allow CDK to calculate initial position
- Capture position before moving elements
- Recalculate relative to fullscreen container bounds
- Reset inline styles when moving back to body

**Fullscreen Detection**:
```typescript
const fullscreenElement = document.fullscreenElement as HTMLElement | null;
if (fullscreenElement) {
  // Handle fullscreen positioning
}
```

**Testing Focus for Task 4**:

**Behaviors to Test**:
- [ ] Fullscreen element detected correctly
- [ ] Overlay attached to fullscreen container
- [ ] Position calculated relative to fullscreen bounds
- [ ] Elements restored to body on close
- [ ] Non-fullscreen mode unaffected

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 5: Write Comprehensive Unit Tests</h3></summary>

**Purpose**: Ensure component works correctly across all scenarios with high test coverage.

**Related Documentation**:
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Testing](../../../SMART_COMPONENT_TESTING.md)

**Implementation Subtasks**:

- [ ] **Test Component Rendering**: Component initializes without errors
- [ ] **Test Content Projection**: Trigger and dialog-content slots project correctly
- [ ] **Test Open Method**: Creates overlay and positions correctly
- [ ] **Test Close Method**: Disposes overlay and cleans up
- [ ] **Test State Signals**: `isOpen` reflects correct state
- [ ] **Test Event Emission**: `opened` and `closed` events fire
- [ ] **Test Backdrop Click**: Clicking outside closes dialog
- [ ] **Test Multiple Instances**: Multiple dialogs don't interfere
- [ ] **Test Fullscreen Mode**: Positioning works in fullscreen contexts

**Key Implementation Notes**:
- Use `TestBed.configureTestingModule` for component tests
- Mock CDK Overlay service for unit tests
- Test observable streams for event emission
- Verify no memory leaks (overlay disposed properly)

**Test Structure Example**:
```typescript
describe('DropdownDialogComponent', () => {
  describe('Overlay Lifecycle', () => {
    it('should open overlay on open()', () => { });
    it('should close overlay on close()', () => { });
    it('should emit opened event', () => { });
  });
  
  describe('Content Projection', () => {
    it('should project trigger content', () => { });
    it('should project dialog content', () => { });
  });
});
```

**Testing Focus for Task 5**:

**Behaviors to Test**:
- [ ] All component features covered by tests
- [ ] Edge cases handled (null refs, double open, etc.)
- [ ] Memory leaks prevented (overlay disposal)
- [ ] Integration with CDK verified

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.ts`
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.spec.ts`
- `libs/ui/components/src/lib/dropdown-dialog/index.ts`

**Modified Files**: None (all new files)

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] All implementation tasks completed and checked off
- [ ] Component follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] Component has minimal styling opinions (pure container)

**Testing Requirements**:
- [ ] All unit tests passing with >90% coverage
- [ ] Overlay lifecycle tested (open, close, positioning)
- [ ] Content projection tested (trigger and dialog-content slots)
- [ ] State management tested (signals and events)
- [ ] Fullscreen support tested

**Quality Checks**:
- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint`)
- [ ] Component builds successfully
- [ ] No console errors when running tests

**API Completeness**:
- [ ] `open()` method works
- [ ] `close()` method works
- [ ] `isOpen` signal accessible
- [ ] `opened` output emits
- [ ] `closed` output emits
- [ ] Content projection works (default and `[dialog-content]`)

**Ready for Phase 2**:
- [ ] All success criteria met
- [ ] Component exported and accessible
- [ ] Documentation comments added to public API
- [ ] Ready for dropdown menu refactor

---

## 📝 Notes & Considerations

### Design Decisions

**Decision 1: Signal-Based State**
- Using signals for `isOpen` enables reactive queries
- Methods (`open`, `close`) provide imperative control
- Matches dropdown menu pattern for consistency

**Decision 2: Two Content Projection Slots**
- Default slot for trigger (first child element)
- `[dialog-content]` selector for overlay content
- Clear separation makes usage intuitive

**Decision 3: Match Dropdown Menu Animations**
- Fade in/out with scale transform
- 150ms ease-out enter, 100ms ease-in exit
- Provides consistent UX across similar components

### Implementation Constraints

**Constraint 1: CDK Overlay Lifecycle**
- Must properly dispose overlay on close
- Fullscreen elements must be restored to body
- Memory leaks prevented by cleanup

**Constraint 2: Zero Styling Opinions**
- Component only handles positioning
- No card layouts, borders, or visual styling
- Projected content handles all appearance

### Discoveries During Implementation

**2025-12-08 - TASK-01-003 - Component Export Integration**
- Library has no build task - it's a source library consumed directly via Nx path aliases
- TypeScript compilation (`nx typecheck`) is sufficient verification for export integration
- Pre-existing test failures (16) and linting errors (2) documented but unrelated to export task
- JSDoc documentation pattern added to component barrel following established conventions
- Export placed alphabetically after dropdown-menu following library organization pattern
- Component successfully exported and ready for Phase 2 composability work

> Add additional notes here as you discover important details during implementation

---

## 💡 Agent Implementation Guide

### Before Creating This Component

**Ask Clarifying Questions**:

1. **Testing Strategy**: Should I use mock Overlay service or real CDK in tests?
2. **Animation Configuration**: Match dropdown menu exactly or make configurable?
3. **Fullscreen Support**: Required for Phase 1 or can defer to Phase 2?

### While Creating This Component

**Reference Existing Code**:
- Study dropdown menu component for positioning patterns
- Copy fullscreen logic directly (proven and tested)
- Match animation timings exactly

**Progressive Testing**:
- Test each task's behavior as you complete it
- Don't wait until end to write all tests
- Use watch mode for rapid feedback

### Key Implementation Tips

1. **CDK Overlay Setup**: Follow dropdown menu pattern exactly—it works well
2. **Content Projection**: Test with real components (preset-name-dialog) early
3. **State Management**: Signals first, then add methods that update signals
4. **Fullscreen**: Complex logic—copy from dropdown menu, don't reimplement

### Remember

- This is a **pure positioning container**—no styling
- Test composability with real dialog components
- Match dropdown menu behavior for consistency
- Keep API surface minimal and focused
