# Floating Nav Rail - Master Plan

**Project Overview**: Replace the existing hamburger-toggle sidebar navigation with a floating nav rail that always displays menu icons, expands on hover to reveal labels, and can be pinned open by the user. The rail will be wrapped in a `lib-scaling-compact-card` for visual consistency with other floating UI elements like the player toolbar.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)

---

## 🎯 Project Objective

Create a modern, floating navigation rail that provides persistent access to app sections while maintaining the glassy, synthwave aesthetic of the TeensyROM UI. The rail will always show menu icons (collapsed state at 56px width), expand to show labels on hover (~200px width) with a slight delay to prevent accidental triggers, and support a "pin open" mode for users who prefer the expanded state.

**User Value**: Users gain persistent visual access to navigation without the friction of clicking a hamburger menu. The hover-to-expand pattern is familiar from desktop applications like VS Code, while the floating glassy card aesthetic maintains visual consistency with the player UI.

**Architectural Benefit**: Moving away from Angular Material's `mat-sidenav` to a custom component provides full control over the hover behavior, timing, and animations without fighting the framework's intended patterns.

---

## 📋 Implementation Phases

<details>
<summary><h3>Phase 1: Core Nav Rail Component ✅ COMPLETE</h3></summary>

### Objective

Create the foundational `lib-nav-rail` component with hover-expand/collapse behavior, delayed transitions, and proper styling using the existing design system.

### Key Deliverables

- [x] New `lib-nav-rail` component in `libs/ui/components`
- [x] Hover detection with configurable delay (150ms default)
- [x] Smooth width transition animation (56px ↔ 200px)
- [x] Active route highlighting using `--color-highlight` token
- [x] Wrapped in `lib-scaling-compact-card` for glassy aesthetic

### Completed Tasks

1. **Task 01-001: Component Structure** - Created NavRailComponent with NavRailItem interface, inputs/outputs
2. **Task 01-002: Hover Logic** - Implemented debounced expand/collapse with configurable delay
3. **Task 01-003: Item Component** - Created NavRailItemComponent for individual items with accessibility
4. **Task 01-004: Styling** - CSS transitions with design tokens, 250ms animation duration

### Phase 1 Decisions

| Decision | Resolution |
|----------|------------|
| Transition Easing | Material Design cubic-bezier(0.4, 0, 0.2, 1) |
| Transition Duration | 250ms for smooth feel |
| NavRailItem Payload | Generic `<T>` type for flexibility |
| Active Route Matching | Exact match (parent handles logic) |
| Component Decoupling | Fully decoupled from router/app concerns |

### Test Results

- **52 tests passing** (20 item component + 32 parent component)
- All linting passes

</details>

---

<details open>
<summary><h3>Phase 2: Layout Integration & Navigation Service 🚧 IN PROGRESS</h3></summary>

### Objective

Integrate the nav rail into the app layout, update the navigation service to support new state modes, and remove/repurpose the hamburger button.

### Key Deliverables

- [ ] Nav rail integrated into `LayoutComponent` 
- [ ] Navigation service updated with expansion state signals
- [ ] Hamburger button hidden (preserved for mobile)
- [ ] Proper z-index layering with content
- [ ] Equal margins on all sides of the floating rail

### Tasks

| Task ID | Name | Status | Description |
|---------|------|--------|-------------|
| TASK-02-001 | Navigation Service | ⬜ Not Started | Add expansion/pin signals and methods |
| TASK-02-002 | Layout Template | ⬜ Not Started | Replace mat-sidenav with lib-nav-rail |
| TASK-02-003 | Layout Styling | ⬜ Not Started | Position rail with margins and z-index |
| TASK-02-004 | Header Changes | ⬜ Not Started | Hide hamburger button via CSS |
| TASK-02-005 | Integration Testing | ⬜ Not Started | Verify complete integration |

### Task Dependencies

```
TASK-02-001 (Service) ──┐
                        ├──▶ TASK-02-002 (Template) ──▶ TASK-02-003 (Styling) ──▶ TASK-02-004 (Header) ──▶ TASK-02-005 (Testing)
```

### Open Questions for Phase 2

- **Header Button**: ✅ Resolved: Hide with CSS (not remove) for future mobile use

</details>

---

<details open>
<summary><h3>Phase 3: Pin Feature & Keyboard Accessibility</h3></summary>

### Objective

Add the ability to pin the rail open and implement keyboard accessibility including the Alt+M hotkey.

### Key Deliverables

- [ ] Pin toggle button at bottom of rail
- [ ] Pinned state keeps rail expanded regardless of hover
- [ ] Alt+M keyboard shortcut focuses first menu item
- [ ] Keyboard navigation through menu items
- [ ] Focus states styled appropriately

### High-Level Tasks

1. **Add Pin Button**: Icon button at bottom of rail that toggles pinned state
2. **Implement Pin Logic**: When pinned, rail stays expanded; visual indicator for pin state
3. **Keyboard Shortcut**: Global Alt+M listener to focus first menu item
4. **Tab Navigation**: Proper focus management and keyboard nav through items
5. **Accessibility Testing**: ARIA attributes, focus visibility

### Open Questions for Phase 3

- **Pin Icon**: Should use `push_pin` icon or something else?
- **Pin Visual State**: How to indicate pinned state? Rotate pin icon? Different color?

</details>

---

<details open>
<summary><h3>Phase 4: Documentation & Polish</h3></summary>

### Objective

Create keyboard shortcuts documentation, update component library docs, and handle any polish items.

### Key Deliverables

- [ ] New `KEYBOARD_SHORTCUTS.md` document
- [ ] Component library updated with `lib-nav-rail` documentation
- [ ] Style guide updated if any new tokens/patterns added
- [ ] Mobile preparation notes documented (for future phase)

### High-Level Tasks

1. **Create Keyboard Shortcuts Doc**: Document Alt+M and any other app shortcuts
2. **Update Component Library**: Add nav rail with usage examples and API docs
3. **Review and Polish**: Address any rough edges from previous phases
4. **Document Mobile Strategy**: Notes for future mobile implementation

</details>

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **Custom Component over mat-sidenav**: Full control over hover behavior without fighting Material's patterns
- **Floating Aesthetic**: Wrapped in `lib-scaling-compact-card` for visual consistency with player UI
- **Signal-Based State**: Use Angular signals for expansion/pin state, consistent with rest of app
- **Debounced Hover**: Prevent accidental triggers with 150-200ms delay on both open and close
- **CSS Transitions**: Width animation via CSS for smooth performance

### Integration Points

- **NavigationService**: Extended with new signals (`isExpanded`, `isPinned`)
- **LayoutComponent**: Hosts the nav rail in absolute position
- **Router**: Active route detection for highlighting
- **Style Tokens**: Uses `--color-highlight` for active state

### Component Hierarchy

```
LayoutComponent
├── HeaderComponent (hamburger button removed/hidden)
├── lib-nav-rail (NEW - positioned absolutely)
│   └── lib-scaling-compact-card
│       └── nav-rail content (icons, labels, pin button)
└── mat-sidenav-content (main content area, unchanged)
```

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] Nav rail renders with correct initial state (collapsed)
- [ ] Hover triggers expansion after delay
- [ ] Mouse leave triggers collapse after delay
- [ ] Pin toggle prevents collapse on mouse leave
- [ ] Active route highlighted correctly
- [ ] Menu item click navigates and (if not pinned) collapses

### Integration Tests

- [ ] Nav rail integrates with NavigationService
- [ ] Keyboard shortcut focuses menu
- [ ] Route changes update active indicator

### E2E Tests

- [ ] User can navigate using rail
- [ ] Hover behavior works as expected
- [ ] Pin functionality persists during session
- [ ] Keyboard navigation works

---

## ✅ Success Criteria

- [ ] Nav rail always visible with icons in collapsed state (56px)
- [ ] Rail expands to show labels on hover after ~150ms delay
- [ ] Rail collapses after mouse leaves with ~150ms delay
- [ ] Pin button at bottom of rail keeps it expanded when active
- [ ] Alt+M keyboard shortcut focuses first menu item
- [ ] Active route highlighted using `--color-highlight`
- [ ] Visual style matches other floating cards (glassy, rounded)
- [ ] Equal margins on all sides when floating
- [ ] All unit and integration tests pass
- [ ] Keyboard navigation and focus states work properly
- [ ] Documented in component library and keyboard shortcuts doc

---

## 🎭 User Scenarios

### Navigation Scenarios

<details open>
<summary><strong>Scenario 1: Basic Navigation via Hover</strong></summary>

```gherkin
Given the user is on any page in the app
And the nav rail is in collapsed state showing only icons
When the user hovers over the nav rail
And waits approximately 150ms
Then the rail smoothly expands to show labels next to icons
And the current route is highlighted
```

</details>

<details open>
<summary><strong>Scenario 2: Navigate to Different Section</strong></summary>

```gherkin
Given the nav rail is expanded (via hover or pin)
When the user clicks on a menu item
Then the app navigates to that section
And the clicked item becomes highlighted
And the rail collapses (if not pinned) after mouse leaves
```

</details>

<details open>
<summary><strong>Scenario 3: Accidental Hover Prevention</strong></summary>

```gherkin
Given the nav rail is collapsed
When the user quickly moves mouse across the rail (under 150ms)
Then the rail does not expand
And the UI remains stable
```

</details>

### Pin Scenarios

<details open>
<summary><strong>Scenario 4: Pin Rail Open</strong></summary>

```gherkin
Given the nav rail is expanded
When the user clicks the pin button at the bottom
Then the pin icon indicates pinned state
And the rail remains expanded even when mouse leaves
```

</details>

<details open>
<summary><strong>Scenario 5: Unpin Rail</strong></summary>

```gherkin
Given the nav rail is pinned open
When the user clicks the pin button again
Then the pin icon indicates unpinned state
And the rail collapses when mouse leaves
```

</details>

### Keyboard Scenarios

<details open>
<summary><strong>Scenario 6: Keyboard Shortcut Focus</strong></summary>

```gherkin
Given the user is anywhere in the app
When the user presses Alt+M
Then the nav rail expands
And focus moves to the first menu item
```

</details>

<details open>
<summary><strong>Scenario 7: Keyboard Navigation</strong></summary>

```gherkin
Given focus is on a menu item in the nav rail
When the user presses Arrow Down
Then focus moves to the next menu item
When the user presses Enter
Then the app navigates to that section
```

</details>

---

## 📚 Related Documentation

- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Navigation Standards**: [NAVIGATION_STANDARDS.md](../../NAVIGATION_STANDARDS.md)
- **ContentOverlayContainer**: Reference for hover detection pattern

---

## 📝 Notes

### Design Considerations

- **Entry Animation**: Using `lib-scaling-compact-card` gives us the entry animation when the app loads
- **Hover Target**: The entire card (including padding) should be the hover target for better UX
- **Content Clipping**: During width animation, labels should clip smoothly

### Mobile Strategy (Future)

- The current implementation is desktop-focused
- For mobile, consider reverting to hamburger overlay pattern
- Keep the component architecture flexible to support both modes
- Potential future input: `mode: 'rail' | 'drawer'`

### Pin Persistence (Future)

- Architecture supports adding localStorage persistence
- Can be wired to settings infrastructure later
- For now, pin state resets on page reload

### Summary of Decisions

| Decision | Choice |
|----------|--------|
| Delay Timing | 150-200ms |
| Pin Button Location | Bottom of rail |
| Pin Persistence | Design for it, implement later |
| Keyboard Shortcut | Alt+M |
| Collapsed Width | 56px |
| Visual Style | `lib-scaling-compact-card` (glassy) |
| Active Highlight | `--color-highlight` token |
| Vertical Size | Full height with equal margins |
