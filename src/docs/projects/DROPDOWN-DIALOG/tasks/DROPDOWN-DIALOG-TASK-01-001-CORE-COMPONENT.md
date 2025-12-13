# Task Handoff: Create Core Dropdown Dialog Component

## 📋 Task Identity

**Task ID**: DROPDOWN-DIALOG-TASK-01-001-CORE-COMPONENT  
**Task Name**: Create Core Dropdown Dialog Component with CDK Overlay  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation)  
**Estimated Context Size**: Small (3-5 files)

---

## 🎯 Objective

**What**: Build a standalone Angular component that uses CDK overlay positioning to create a pure positioning container for dialogs and overlays. This component handles overlay lifecycle, positioning, and backdrop management through content projection.

**Why**: Provides a reusable, composable foundation for positioned dialogs throughout the application. Enables wrapping existing dialog components (preset-name-dialog, confirmation-dialog) without modification, ensuring consistent positioning behavior.

**Success Criteria**:
- [ ] Component created with CDK overlay integration
- [ ] Content projection works (trigger + dialog-content slots)
- [ ] Programmatic API (`open()`, `close()`, `isOpen` signal) functional
- [ ] Positioning matches dropdown menu behavior
- [ ] Backdrop click-to-close works
- [ ] All unit tests passing with >90% coverage
- [ ] Component builds and lints without errors

---

## 🔗 Context & Dependencies

**Prerequisites Completed**: None (this is the foundation task)

**Dependencies**:
- Angular 19+ with standalone components
- `@angular/cdk/overlay` module
- `@angular/cdk/portal` module
- Existing `dropdown-menu` component as reference pattern

**Constraints**:
- Must be a pure positioning container (no styling opinions)
- Must match dropdown menu positioning exactly
- Must work in fullscreen contexts
- Must support transparent backdrop with click-to-close
- Must prevent memory leaks (proper overlay disposal)

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.ts` - Core component
- `libs/ui/components/src/lib/dropdown-dialog/dropdown-dialog.component.spec.ts` - Unit tests
- `libs/ui/components/src/lib/dropdown-dialog/index.ts` - Barrel export

**Files to Review** (for context/patterns):
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Reference implementation for positioning
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts` - Test composability target
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.ts` - Test composability target

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - Component structure, TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable component patterns
- [Angular CDK Overlay Docs](https://material.angular.io/cdk/overlay/overview) - CDK positioning API

### Key Requirements

**1. Component Structure**

Create standalone component with selector `lib-dropdown-dialog`:
- Use Angular 19 standalone component pattern
- Import CDK modules: `OverlayModule` from `@angular/cdk/overlay`
- Import animation trigger matching dropdown menu

**2. Template Structure**

Two content projection slots:
```html
<div #trigger>
  <ng-content></ng-content>  <!-- Trigger element (first child) -->
</div>

<ng-template #dialogTemplate>
  <div [@fadeInOut]>
    <ng-content select="[dialog-content]"></ng-content>
  </div>
</ng-template>
```

**3. CDK Overlay Positioning**

Position strategy configuration matching dropdown menu:
- Use `flexibleConnectedTo` with trigger element reference
- Position preferences: below-start, below-end, above-start, above-end
- Vertical offset: 8px
- Scroll strategy: `reposition()`
- Backdrop: transparent with `cdk-overlay-transparent-backdrop` class

**4. Fullscreen Support**

Copy dropdown menu's fullscreen positioning logic:
- Detect `document.fullscreenElement`
- Attach overlay to fullscreen container if present
- Move overlay pane and backdrop elements
- Recalculate position relative to fullscreen bounds
- Restore to body on close

**5. Programmatic API**

Expose these public members:
- `open(): void` - Creates overlay and positions it
- `close(): void` - Disposes overlay and cleans up
- `isOpen = signal<boolean>(false)` - Reactive state
- `opened = output<void>()` - Event after overlay opens
- `closed = output<void>()` - Event after overlay closes

**6. State Management**

Internal signals:
- `overlayRef = signal<OverlayRef | null>(null)` - Tracks overlay instance
- Check `isOpen()` before opening to prevent double-open
- Emit events after state changes complete

**7. Animation**

Match dropdown menu animations exactly:
```typescript
trigger('fadeInOut', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.95)' }),
    animate('150ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
  ]),
  transition(':leave', [
    animate('100ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
  ])
])
```

### Anti-Patterns to Avoid

❌ **Don't add visual styling** - This is a pure positioning container  
❌ **Don't implement form logic** - That belongs in projected content  
❌ **Don't forget cleanup** - Always dispose overlay on close  
❌ **Don't allow double-open** - Check `isOpen()` first  
❌ **Don't skip fullscreen support** - Required for CRT settings panel

### Code Detail Level

The dropdown menu component provides proven patterns for positioning. Key methods to reference:
- `open()` method: Shows overlay creation, portal attachment, fullscreen handling
- `close()` method: Shows cleanup, element restoration, disposal
- Position strategy: Shows exact position configuration

Create similar structure adapted for dialog use case. Trigger detection uses first child (`#trigger` ref), content uses `[dialog-content]` selector.

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests - Overlay Lifecycle**:
- [ ] Component renders without errors
- [ ] Trigger element reference accessible via `@viewChild`
- [ ] Dialog template reference accessible
- [ ] `open()` creates overlay with correct positioning
- [ ] `open()` sets `isOpen` signal to true
- [ ] `open()` emits `opened` event
- [ ] Calling `open()` twice doesn't create second overlay
- [ ] `close()` disposes overlay
- [ ] `close()` sets `isOpen` signal to false
- [ ] `close()` emits `closed` event

**Unit Tests - Content Projection**:
- [ ] Default slot projects trigger content
- [ ] `[dialog-content]` selector projects dialog content
- [ ] Projected content renders in overlay when opened
- [ ] Multiple instances have independent content

**Unit Tests - Positioning**:
- [ ] Position strategy uses correct position preferences
- [ ] Offset applied correctly (8px vertical)
- [ ] Scroll strategy is `reposition` type
- [ ] Backdrop class is `cdk-overlay-transparent-backdrop`

**Unit Tests - Fullscreen**:
- [ ] Fullscreen element detected when present
- [ ] Overlay attached to fullscreen container
- [ ] Elements restored to body on close
- [ ] Non-fullscreen mode works correctly

**Unit Tests - Backdrop**:
- [ ] Backdrop click triggers `close()`
- [ ] Backdrop click emits `closed` event
- [ ] Backdrop disposed with overlay

### Behavioral Expectations

**What users/consumers observe**:
- Calling `open()` makes dialog appear positioned below/above trigger
- Clicking outside dialog closes it
- Calling `close()` removes dialog from view
- `isOpen` signal reflects current state accurately
- Events fire at correct times for parent component integration

**Edge cases to handle**:
- Opening already-open dialog (no-op)
- Closing already-closed dialog (no-op)
- Multiple dialog instances on same page
- Trigger element not yet rendered (safety check)
- Fullscreen element changes during dialog open

---

## 📚 Reference Materials

### Related Documentation

- [Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Complete project vision
- [Phase 1 Plan](../phases/DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md) - Detailed phase breakdown
- [Dropdown Menu Reference](../../../../libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts) - Proven positioning patterns

### Related Tasks

- DROPDOWN-DIALOG-TASK-02-001-EXTRACT-UTILITIES (Phase 2) - Will extract shared positioning code
- DROPDOWN-DIALOG-TASK-03-001-CRT-INTEGRATION (Phase 3) - Will use this component

### Key Architectural Decisions

**Decision 1: Pure Container Pattern**
- Component has zero styling opinions
- All visual design comes from projected content
- Enables wrapping any component without modification

**Decision 2: Content Projection Slots**
- Default slot for trigger (first child)
- `[dialog-content]` selector for overlay content
- Matches dropdown menu pattern for consistency

**Decision 3: Match Dropdown Menu Behavior**
- Copy positioning logic exactly
- Use same animation timings
- Maintain consistency across application

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete

---

## 💡 Implementation Notes

### Getting Started

1. **Study Dropdown Menu**: Read the dropdown menu component thoroughly - it's your guide
2. **Scaffold Component**: Create component file with standalone config and imports
3. **Template First**: Build template with content projection slots
4. **Add Positioning**: Implement overlay creation with CDK positioning
5. **Add Fullscreen**: Copy fullscreen logic from dropdown menu
6. **Write Tests**: Test each behavior as you implement it

### Testing Strategy

- Use `TestBed.configureTestingModule` with standalone component
- Mock `Overlay` service to avoid CDK complexity in unit tests
- Test state signals reactively (observe changes)
- Test event emission using observables
- Verify overlay disposal to prevent memory leaks

### Key Integration Points

**With Dropdown Menu**:
- Both will share positioning utilities in Phase 2
- Must position identically for consistency
- Fullscreen logic must work the same way

**With Dialog Components**:
- Will wrap preset-name-dialog and confirmation-dialog in Phase 3
- Dialogs must work unchanged inside dropdown-dialog
- Event handlers connect through `(confirmed)` and `(cancelled)` outputs

### Success Validation

Before marking complete:
- [ ] Component renders in Storybook or test app
- [ ] Can wrap `lib-preset-name-dialog` successfully
- [ ] Can wrap `lib-confirmation-dialog` successfully
- [ ] Positioning works in normal and fullscreen contexts
- [ ] All tests green with good coverage
- [ ] No linting errors or TypeScript warnings

---

## 🎯 Completion Checklist

When you've finished this task:

- [ ] All files created as specified
- [ ] Component compiles without errors
- [ ] All unit tests written and passing
- [ ] Test coverage >90%
- [ ] Linting passes
- [ ] Can be imported and used by other components
- [ ] Completion report written following template
- [ ] Report saved to specified output location

---

## 🤝 Questions Before Starting?

If anything is unclear about this task:
1. What specific positioning behavior are you uncertain about?
2. Do you need clarification on fullscreen handling?
3. Are there questions about the content projection pattern?
4. Do you need help with CDK overlay API usage?

Raise questions early - it's better to clarify than assume!

---

**Task Status**: Ready to assign  
**Expected Effort**: 4-6 hours (including testing)  
**Blocking Issues**: None  
**Ready to Begin**: ✅ Yes
