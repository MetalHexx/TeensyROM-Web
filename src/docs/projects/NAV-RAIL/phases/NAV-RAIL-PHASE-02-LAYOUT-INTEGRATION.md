# Phase 2: Layout Integration & Navigation Service

## 🎯 Objective

Integrate the nav rail component into the app layout, update the navigation service to support expansion/pin states, and properly position the floating rail with equal margins. This phase makes the nav rail the primary navigation mechanism.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Nav Rail Master Plan](../NAV-RAIL-MASTER-PLAN.md) - High-level feature plan
- [ ] [Phase 1 Report](../reports/NAV-RAIL-TASK-01-005-REPORT.md) - Phase 1 completion details (when available)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [State Standards](../../../STATE_STANDARDS.md) - Signal-based state patterns

**Reference Implementations:**

- [ ] `LayoutComponent` - Current layout structure
- [ ] `NavigationService` - Current navigation service
- [ ] `NavMenuComponent` - Current menu (being replaced)

---

## 📂 File Structure Overview

```
libs/app/navigation/src/lib/
├── navigation.service.ts                    📝 Modified - Add expansion/pin signals
├── navigation.service.spec.ts               📝 Modified - Test new signals

libs/app/shell/src/lib/
├── layout/
│   ├── layout.component.ts                  📝 Modified - Add nav rail
│   ├── layout.component.html                📝 Modified - Replace mat-sidenav with nav-rail
│   ├── layout.component.scss                📝 Modified - Position nav rail
│   └── layout.component.spec.ts             📝 Modified - Update tests
├── components/
│   └── header/
│       ├── header.component.html            📝 Modified - Hide/remove hamburger
│       └── nav-button/                      📝 Modified or removed
```

---

<details open>
<summary><h3>Task 1: Extend Navigation Service</h3></summary>

**Purpose**: Add signals and methods to the NavigationService for managing rail expansion and pin states, preparing for the layout integration.

**Related Documentation:**

- [NavigationService](../../../libs/app/navigation/src/lib/navigation.service.ts) - Current implementation
- [State Standards](../../../STATE_STANDARDS.md) - Signal patterns

**Implementation Subtasks:**

- [ ] **Add isExpanded signal**: Private signal with readonly accessor
- [ ] **Add isPinned signal**: Private signal with readonly accessor  
- [ ] **Add expandNav() method**: Sets isExpanded to true
- [ ] **Add collapseNav() method**: Sets isExpanded to false (only if not pinned)
- [ ] **Add togglePin() method**: Toggles isPinned, expands if pinning
- [ ] **Update closeNav()**: Consider expansion state
- [ ] **Write unit tests**: Test all new signals and methods

**Key Implementation Notes:**

- Keep existing `isNavOpen` for potential mobile use later
- `collapseNav()` should be a no-op when `isPinned` is true
- Pinning should immediately expand if not already expanded

**Testing Focus for Task 1:**

- [ ] `isExpanded` initializes to false
- [ ] `isPinned` initializes to false
- [ ] `expandNav()` sets `isExpanded` to true
- [ ] `collapseNav()` sets `isExpanded` to false when not pinned
- [ ] `collapseNav()` does nothing when pinned
- [ ] `togglePin()` toggles pin state
- [ ] `togglePin()` to true also expands

</details>

---

<details open>
<summary><h3>Task 2: Update Layout Template</h3></summary>

**Purpose**: Replace the `mat-sidenav` with the new `lib-nav-rail` component, positioning it as a floating element.

**Related Documentation:**

- [LayoutComponent](../../../libs/app/shell/src/lib/layout/) - Current implementation
- [Nav Rail Component](../../../libs/ui/components/src/lib/nav-rail/) - Phase 1 component

**Implementation Subtasks:**

- [ ] **Import NavRailComponent**: Add to layout imports
- [ ] **Remove mat-sidenav**: Remove the sidenav element (keep mat-sidenav-content for now)
- [ ] **Add nav-rail element**: Position within layout, outside content area
- [ ] **Wire up inputs**: Connect nav items, active route from router
- [ ] **Wire up events**: Handle item clicks via NavigationService
- [ ] **Connect expansion signals**: Link component state to service

**Key Implementation Notes:**

- Nav rail should be positioned absolutely within the layout
- Content area margin/padding may need adjustment
- Use router events or activated route to determine active path
- Consider using `mat-sidenav-container` still for the content structure

**Template Structure:**

```html
<lib-header></lib-header>

<div class="layout-container">
  <lib-nav-rail
    [items]="menuItems()"
    [activeRoute]="activeRoute()"
    [isExpanded]="navService.isExpanded()"
    [isPinned]="navService.isPinned()"
    (itemClick)="onNavItemClick($event)"
    (expandedChange)="onExpandedChange($event)"
    (pinChange)="onPinChange($event)"
  ></lib-nav-rail>
  
  <div class="content-area">
    <router-outlet />
  </div>
</div>
```

**Testing Focus for Task 2:**

- [ ] Nav rail renders in layout
- [ ] Menu items from NAV_ITEMS constant
- [ ] Navigation works when item clicked
- [ ] Active route highlighted correctly

</details>

---

<details open>
<summary><h3>Task 3: Position and Style Nav Rail</h3></summary>

**Purpose**: Add CSS for absolute positioning of the floating nav rail with proper margins, z-index, and content area adjustment.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Spacing and layout patterns
- [Layout Component Styles](../../../libs/app/shell/src/lib/layout/layout.component.scss) - Current styles

**Implementation Subtasks:**

- [ ] **Add layout container styles**: Relative positioning for absolute child
- [ ] **Position nav rail**: Fixed/absolute position, left side
- [ ] **Add margins**: Equal margin on all sides (use standard spacing)
- [ ] **Set z-index**: Above content, below dialogs
- [ ] **Adjust content area**: Margin-left to account for collapsed rail + margins
- [ ] **Handle height**: Full height minus margins top/bottom
- [ ] **Ensure synthwave background shows**: Transparent backgrounds where needed

**Key Implementation Notes:**

- Use `1rem` margin on all sides for consistency with rest of UI
- Z-index should be below modals (which are typically 1000+)
- Consider using CSS custom properties for margins
- Content area needs left margin to not overlap with collapsed rail

**CSS Structure:**

```scss
.layout-container {
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
}

lib-nav-rail {
  position: fixed;
  top: var(--header-height);
  left: 1rem;
  bottom: 1rem;
  z-index: 100;
}

.content-area {
  flex: 1;
  margin-left: calc(56px + 2rem); // collapsed width + margins
}
```

**Testing Focus for Task 3:**

- [ ] Nav rail positioned correctly (visual)
- [ ] Equal margins on all sides (visual)
- [ ] Content doesn't overlap collapsed rail
- [ ] Z-index allows rail to be above content
- [ ] Background shows through properly

</details>

---

<details open>
<summary><h3>Task 4: Handle Header Changes</h3></summary>

**Purpose**: Remove or hide the hamburger button from the header since the nav rail is always visible.

**Related Documentation:**

- [HeaderComponent](../../../libs/app/shell/src/lib/components/header/) - Current header
- [NavButtonComponent](../../../libs/app/shell/src/lib/components/header/nav-button/) - Hamburger button

**Implementation Subtasks:**

- [ ] **Decide: hide vs remove**: Keep component for mobile future, just hide?
- [ ] **Update header template**: Remove/hide nav-button usage
- [ ] **Add CSS hiding (if keeping)**: `display: none` for desktop
- [ ] **Update header tests**: Remove/adjust tests for nav button
- [ ] **Consider mobile breakpoint**: Add media query to show on small screens (future)

**Key Implementation Notes:**

- Recommend hiding with CSS rather than removing for future mobile support
- Could use a class or media query based approach
- Keep NavButtonComponent file for now, just don't render it

**Testing Focus for Task 4:**

- [ ] Header renders without hamburger button (desktop)
- [ ] No console errors from missing nav service calls
- [ ] Header layout still correct

</details>

---

<details open>
<summary><h3>Task 5: Integration Testing</h3></summary>

**Purpose**: Verify the complete integration works correctly with navigation service, router, and layout.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing approach

**Implementation Subtasks:**

- [ ] **Test layout with nav rail**: Component renders correctly
- [ ] **Test navigation flow**: Click item → route changes → active updates
- [ ] **Test expansion state**: Service state reflected in component
- [ ] **Test pin state**: Pin toggle works through integration
- [ ] **Verify no regressions**: Existing navigation tests still pass

**Key Implementation Notes:**

- Use RouterTestingModule for route testing
- Mock NavigationService for isolated component tests
- Test real integration in layout component tests

**Behaviors to Test:**

- [ ] Layout initializes with collapsed rail
- [ ] Clicking nav item navigates and updates active
- [ ] Service expansion state syncs with component
- [ ] Service pin state syncs with component
- [ ] Content area has correct margin

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**

- `libs/app/navigation/src/lib/navigation.service.ts`
- `libs/app/navigation/src/lib/navigation.service.spec.ts`
- `libs/app/shell/src/lib/layout/layout.component.ts`
- `libs/app/shell/src/lib/layout/layout.component.html`
- `libs/app/shell/src/lib/layout/layout.component.scss`
- `libs/app/shell/src/lib/layout/layout.component.spec.ts`
- `libs/app/shell/src/lib/components/header/header.component.html`
- `libs/app/shell/src/lib/components/header/header.component.scss` (optional)

---

## 📝 Testing Summary

**Test Execution:**

```bash
# Run navigation service tests
pnpm nx test app-navigation

# Run shell/layout tests
pnpm nx test app-shell

# Run all affected tests
pnpm nx affected --target=test
```

**Test Coverage Areas:**

- Navigation service new signals/methods
- Layout component with nav rail
- Navigation flow integration
- Header without hamburger button

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] Nav rail visible in layout, floating with margins
- [ ] Navigation service has expansion/pin signals
- [ ] Clicking nav items navigates correctly
- [ ] Active route highlighted in rail
- [ ] Hamburger button hidden in header

**Testing Requirements:**

- [ ] All navigation service tests pass
- [ ] All layout component tests pass
- [ ] Integration tests verify navigation flow

**Quality Checks:**

- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] No console errors
- [ ] Visual appearance correct

**Ready for Phase 3:**

- [ ] Nav rail integrated and functional
- [ ] Service ready for pin feature
- [ ] Layout stable and tested

---

## 📝 Notes & Considerations

### Design Decisions

- **Keep mat-sidenav-content**: The content wrapper structure is fine, just removing the sidenav drawer
- **Hide hamburger, don't delete**: Preserves option for mobile mode later
- **Fixed positioning**: Keeps rail visible during scroll

### Mobile Considerations

- Header hamburger hidden via CSS, can be shown at breakpoint
- Nav rail can get `display: none` at mobile breakpoint
- Future: Add `mode` input to nav-rail for drawer behavior
