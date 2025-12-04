# Phase 1: Core Nav Rail Component

## 🎯 Objective

Create the foundational `lib-nav-rail` component with hover-expand/collapse behavior, delayed transitions, and proper styling. This phase delivers a fully functional, reusable nav rail component that can be integrated into the layout in Phase 2.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Nav Rail Master Plan](../NAV-RAIL-MASTER-PLAN.md) - High-level feature plan
- [ ] [Navigation Standards](../../../NAVIGATION_STANDARDS.md) - Existing navigation patterns

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns and tokens
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing components to reference

**Reference Implementations:**

- [ ] `ContentOverlayContainerComponent` - Hover detection pattern with debouncing
- [ ] `ScalingCompactCardComponent` - Card wrapper we'll use
- [ ] `MenuItemComponent` - Existing menu item pattern
- [ ] `NavigationService` - Current navigation state management

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/nav-rail/
├── nav-rail.component.ts                    ✨ New - Main component
├── nav-rail.component.html                  ✨ New - Template
├── nav-rail.component.scss                  ✨ New - Styles
├── nav-rail.component.spec.ts               ✨ New - Tests
├── nav-rail-item.component.ts               ✨ New - Individual menu item
├── nav-rail-item.component.html             ✨ New - Item template
├── nav-rail-item.component.scss             ✨ New - Item styles
├── nav-rail-item.component.spec.ts          ✨ New - Item tests
├── nav-rail.model.ts                        ✨ New - Types/interfaces
└── index.ts                                 ✨ New - Barrel export

libs/ui/components/src/index.ts              📝 Modified - Export nav-rail
```

---

<details open>
<summary><h3>Task 1: Create Nav Rail Component Structure</h3></summary>

**Purpose**: Set up the core `lib-nav-rail` component with inputs, signals for state management, and the basic template structure using `lib-scaling-compact-card`.

**Related Documentation:**

- [ScalingCompactCardComponent](../../../COMPONENT_LIBRARY.md) - Card wrapper pattern
- [Coding Standards - Component Structure](../../../CODING_STANDARDS.md#component-structure)

**Implementation Subtasks:**

- [ ] **Create nav-rail folder**: New folder in `libs/ui/components/src/lib/`
- [ ] **Define NavRailItem interface**: Interface for menu items with `name`, `icon`, `route`, optional `payload`
- [ ] **Create nav-rail.component.ts**: Standalone component with required inputs
- [ ] **Set up signal-based state**: `isExpanded`, `isHovering` signals
- [ ] **Create basic template**: Wrap content in `lib-scaling-compact-card`, project menu items
- [ ] **Add barrel exports**: Export from component index and main ui/components index

**Key Implementation Notes:**

- Use `input()` for menu items array
- Use `output()` for item click events
- Internal signals for hover/expansion state
- Wrap entire content in `lib-scaling-compact-card` with appropriate inputs

**Component Inputs:**

```typescript
items = input.required<NavRailItem[]>();
activeRoute = input<string>('');
collapsedWidth = input<string>('56px');
expandedWidth = input<string>('200px');
hoverDelayMs = input<number>(150);
```

**Testing Focus for Task 1:**

- [ ] Component renders with collapsed width by default
- [ ] Menu items are rendered from input array
- [ ] Active route input highlights correct item

</details>

---

<details open>
<summary><h3>Task 2: Implement Hover Detection with Delay</h3></summary>

**Purpose**: Add mouseenter/mouseleave handlers with debounced signals to create the delayed expand/collapse behavior, preventing accidental triggers.

**Related Documentation:**

- [ContentOverlayContainerComponent](../../../libs/ui/components/src/lib/content-overlay-container/) - Reference pattern for hover logic

**Implementation Subtasks:**

- [ ] **Add host bindings**: `(mouseenter)` and `(mouseleave)` on component host
- [ ] **Create hover timer logic**: Use `setTimeout`/`clearTimeout` for delay
- [ ] **Implement `onMouseEnter()`**: Clear any pending collapse timer, start expand timer
- [ ] **Implement `onMouseLeave()`**: Clear any pending expand timer, start collapse timer
- [ ] **Connect to isExpanded signal**: Update signal when timers complete
- [ ] **Add cleanup**: Clear timers in `DestroyRef.onDestroy()`

**Key Implementation Notes:**

- Both expand and collapse should have the same delay (~150ms)
- Timer IDs should be tracked for proper cleanup
- Consider using a single "target state" approach to avoid race conditions
- Reference `ContentOverlayContainerComponent.onMouseEnter/Leave()` for pattern

**Testing Focus for Task 2:**

- [ ] Hovering for less than delay does NOT expand
- [ ] Hovering for longer than delay DOES expand
- [ ] Leaving for less than delay does NOT collapse
- [ ] Leaving for longer than delay DOES collapse
- [ ] Quick hover-leave-hover resets timers correctly

</details>

---

<details open>
<summary><h3>Task 3: Create Nav Rail Item Component</h3></summary>

**Purpose**: Create the individual menu item component that displays an icon and label, with proper styling for collapsed and expanded states.

**Related Documentation:**

- [MenuItemComponent](../../../libs/ui/components/src/lib/menu-item/) - Existing pattern
- [IconLabelComponent](../../../COMPONENT_LIBRARY.md#icon-label) - Reference for icon+text pattern

**Implementation Subtasks:**

- [ ] **Create nav-rail-item.component.ts**: Standalone component
- [ ] **Define inputs**: `icon`, `label`, `isActive`, `isExpanded` (from parent)
- [ ] **Define output**: `itemClick` event
- [ ] **Create template**: Icon always visible, label conditionally visible/animated
- [ ] **Add click handler**: Emit item click, handle keyboard (Enter/Space)
- [ ] **Add accessibility**: `role="button"`, `tabindex="0"`, `aria-label`

**Key Implementation Notes:**

- Icon should always be visible and centered in collapsed state
- Label should clip/reveal during animation
- Use `overflow: hidden` on label container for smooth transition
- Active state indicated via `--color-highlight`

**Testing Focus for Task 3:**

- [ ] Item renders icon always
- [ ] Label hidden when `isExpanded` is false
- [ ] Label visible when `isExpanded` is true
- [ ] Active state applies highlight styling
- [ ] Click emits event
- [ ] Keyboard interaction works (Enter/Space)

</details>

---

<details open>
<summary><h3>Task 4: Style the Nav Rail</h3></summary>

**Purpose**: Implement CSS for collapsed/expanded states, smooth width transitions, icon centering, and label reveal animations.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Tokens and patterns
- [Component Library - Cards](../../../COMPONENT_LIBRARY.md#cards) - Card styling reference

**Implementation Subtasks:**

- [ ] **Host styles**: Display block, height 100%, position relative
- [ ] **Collapsed state styles**: Fixed width (56px), icons centered
- [ ] **Expanded state styles**: Width ~200px, labels visible
- [ ] **Width transition**: Smooth CSS transition with appropriate easing
- [ ] **Icon centering**: Flexbox centering in collapsed state
- [ ] **Label animation**: Opacity and/or width transition for reveal
- [ ] **Active item highlight**: Use `--color-highlight` for active route
- [ ] **Hover states**: Subtle background on item hover

**Key Implementation Notes:**

- Use CSS custom properties for widths (allow override via inputs)
- Transition timing should feel snappy but smooth (~200-300ms)
- Use `cubic-bezier` easing consistent with other app animations
- Ensure icons don't shift position during expansion

**CSS Custom Properties:**

```scss
:host {
  --nav-rail-collapsed-width: 56px;
  --nav-rail-expanded-width: 200px;
  --nav-rail-transition-duration: 250ms;
}
```

**Testing Focus for Task 4:**

- [ ] Collapsed state has correct width
- [ ] Expanded state has correct width
- [ ] Transition is smooth (visual verification)
- [ ] Icons remain centered/aligned during transition
- [ ] Active item has highlight color

</details>

---

<details open>
<summary><h3>Task 5: Write Comprehensive Tests</h3></summary>

**Purpose**: Create thorough unit tests for the nav rail and nav rail item components covering all behaviors.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing patterns
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing approach

**Implementation Subtasks:**

- [ ] **Set up test fixtures**: TestBed configuration for both components
- [ ] **Test initial state**: Component renders collapsed, items visible
- [ ] **Test hover behavior**: Verify debounced expand/collapse
- [ ] **Test item rendering**: Icons and labels based on state
- [ ] **Test active route**: Correct item highlighted
- [ ] **Test item click**: Events emitted correctly
- [ ] **Test accessibility**: ARIA attributes, keyboard nav
- [ ] **Test cleanup**: Timers cleared on destroy

**Key Implementation Notes:**

- Use `fakeAsync` and `tick()` for timer testing
- Mock the delay input to speed up tests
- Test both happy path and edge cases
- Verify no memory leaks from timers

**Behaviors to Test:**

- [ ] Component initializes in collapsed state
- [ ] Mouse enter starts expand timer
- [ ] Mouse leave before delay cancels expand
- [ ] Mouse leave after expand starts collapse timer
- [ ] Items render with correct icons
- [ ] Active item has highlight class
- [ ] Click on item emits event with payload
- [ ] Keyboard Enter/Space triggers click
- [ ] Cleanup removes all timers

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.html`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.scss`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.spec.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.html`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.spec.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail.model.ts`
- `libs/ui/components/src/lib/nav-rail/index.ts`

**Modified Files:**

- `libs/ui/components/src/index.ts` - Add nav-rail exports

---

## 📝 Testing Summary

> Tests are written within each task above. This section provides quick reference.

**Test Execution:**

```bash
# Run nav-rail tests specifically
pnpm nx test ui-components --testPathPattern=nav-rail

# Run in watch mode during development
pnpm nx test ui-components --watch
```

**Test Coverage Areas:**

- Component initialization and rendering
- Hover detection and delay timing
- State transitions (collapsed ↔ expanded)
- Active route highlighting
- Item click events
- Keyboard accessibility
- Timer cleanup on destroy

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] Nav rail component created and exports available
- [ ] Component renders in collapsed state (56px) by default
- [ ] Hover expands component after ~150ms delay
- [ ] Mouse leave collapses component after ~150ms delay
- [ ] Active route item highlighted with `--color-highlight`
- [ ] Item clicks emit events with item payload

**Testing Requirements:**

- [ ] All unit tests pass
- [ ] Timer behavior tested with fakeAsync
- [ ] Accessibility attributes verified

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes
- [ ] Consistent with coding standards
- [ ] Uses existing style tokens appropriately

**Ready for Phase 2:**

- [ ] Component is fully functional standalone
- [ ] Can be dropped into any container
- [ ] API is clean and documented in code

---

## 📝 Notes & Considerations

### Design Decisions

- **Debounce approach**: Using setTimeout/clearTimeout rather than RxJS for simplicity in a synchronous interaction
- **State management**: Internal signals rather than extending NavigationService (service extension in Phase 2)
- **Item component**: Separate component for clean separation and reusability

### Future Considerations

- Pin functionality added in Phase 3
- Mobile mode could be added as component input later
- Persistence via settings service in future phase
