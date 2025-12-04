# Phase 3: Pin Feature & Keyboard Accessibility

## 🎯 Objective

Add the ability to pin the rail open and implement keyboard accessibility including the Alt+M hotkey. This phase completes the core functionality of the nav rail with full accessibility support.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Nav Rail Master Plan](../NAV-RAIL-MASTER-PLAN.md) - High-level feature plan
- [ ] [Phase 1 Report](../reports/) - Phase 1 completion details (when available)
- [ ] [Phase 2 Report](../reports/) - Phase 2 completion details (when available)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Accessibility Guidelines](https://www.w3.org/WAI/ARIA/apg/) - ARIA patterns

**Reference Implementations:**

- [ ] `ContentOverlayContainerComponent` - For overlay lock patterns
- [ ] Existing keyboard shortcut patterns in codebase (if any)

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/nav-rail/
├── nav-rail.component.ts                    📝 Modified - Add pin button, keyboard handling
├── nav-rail.component.html                  📝 Modified - Add pin button template
├── nav-rail.component.scss                  📝 Modified - Pin button styles
├── nav-rail.component.spec.ts               📝 Modified - Pin and keyboard tests

libs/app/shell/src/lib/layout/
├── layout.component.ts                      📝 Modified - Add keyboard shortcut listener
├── layout.component.spec.ts                 📝 Modified - Test keyboard shortcut

libs/app/navigation/src/lib/
├── navigation.service.ts                    📝 Modified (if needed for keyboard focus)
```

---

<details open>
<summary><h3>Task 1: Add Pin Button to Nav Rail</h3></summary>

**Purpose**: Add a pin toggle button at the bottom of the nav rail that allows users to lock the rail in expanded state.

**Related Documentation:**

- [IconButtonComponent](../../../COMPONENT_LIBRARY.md#icon-button) - Button pattern

**Implementation Subtasks:**

- [ ] **Add pin button to template**: Position at bottom of rail
- [ ] **Create pin toggle handler**: Toggle pin state, emit event
- [ ] **Add isPinned input**: Accept pin state from parent
- [ ] **Add pinChange output**: Emit when pin toggled
- [ ] **Update hover logic**: Don't collapse when pinned
- [ ] **Style pin button**: Consistent with other nav items

**Key Implementation Notes:**

- Pin button should use `push_pin` icon
- When pinned, icon could be rotated or highlighted
- Button should be at the very bottom, separated from nav items
- Consider adding a visual divider above pin button

**Template Addition:**

```html
<!-- At bottom of nav rail -->
<div class="nav-rail-footer">
  <button 
    class="pin-button"
    (click)="onPinClick()"
    [class.pinned]="isPinned()"
    [attr.aria-pressed]="isPinned()"
    aria-label="Pin navigation open"
  >
    <mat-icon>push_pin</mat-icon>
  </button>
</div>
```

**Testing Focus for Task 1:**

- [ ] Pin button renders at bottom of rail
- [ ] Clicking pin toggles pinned state
- [ ] `pinChange` event emitted on click
- [ ] Visual difference when pinned vs unpinned
- [ ] Rail stays expanded when pinned and mouse leaves

</details>

---

<details open>
<summary><h3>Task 2: Implement Pin Logic in Component</h3></summary>

**Purpose**: Update the nav rail's hover/expansion logic to respect the pinned state.

**Related Documentation:**

- [Phase 1 Hover Logic](./NAV-RAIL-PHASE-01-CORE-COMPONENT.md#task-2) - Original hover implementation

**Implementation Subtasks:**

- [ ] **Add isPinned input**: Signal input from parent
- [ ] **Update onMouseLeave()**: Check isPinned before starting collapse timer
- [ ] **Add computed for canCollapse**: `!isPinned()` check
- [ ] **Update collapse timer logic**: Guard with canCollapse
- [ ] **Emit pinChange on toggle**: Output for parent sync

**Key Implementation Notes:**

- When pinned, `onMouseLeave` should be a no-op for collapse
- Unpinning while mouse is outside should trigger collapse
- Pin state should be reflected visually immediately

**Logic Update:**

```typescript
onMouseLeave(): void {
  this.isHovering.set(false);
  this.clearExpandTimer();
  
  // Only collapse if not pinned
  if (!this.isPinned()) {
    this.startCollapseTimer();
  }
}

onPinClick(): void {
  const newPinState = !this.isPinned();
  this.pinChange.emit(newPinState);
  
  // If unpinning and mouse not over, schedule collapse
  if (!newPinState && !this.isHovering()) {
    this.startCollapseTimer();
  }
}
```

**Testing Focus for Task 2:**

- [ ] Mouse leave does NOT collapse when pinned
- [ ] Mouse leave DOES collapse when not pinned
- [ ] Unpinning when mouse outside triggers collapse
- [ ] Unpinning when mouse inside does NOT collapse immediately

</details>

---

<details open>
<summary><h3>Task 3: Implement Alt+M Keyboard Shortcut</h3></summary>

**Purpose**: Add a global keyboard shortcut (Alt+M) that expands the nav rail and focuses the first menu item.

**Related Documentation:**

- [HostListener documentation](https://angular.io/api/core/HostListener) - Event binding

**Implementation Subtasks:**

- [ ] **Add keydown listener to layout**: Listen for Alt+M
- [ ] **Create focusFirstItem method in nav rail**: Focus first menu item
- [ ] **Expose method via ViewChild**: Allow layout to call into nav rail
- [ ] **Expand rail on shortcut**: Ensure rail is expanded when focusing
- [ ] **Handle focus visibility**: Ensure focus ring visible

**Key Implementation Notes:**

- Use `@HostListener('document:keydown', ['$event'])` in layout
- Check for `event.altKey && event.key === 'm'`
- Prevent default to avoid browser menu activation
- Focus should go to first `nav-rail-item`, not pin button

**Layout Implementation:**

```typescript
@HostListener('document:keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {
  if (event.altKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    this.navService.expandNav();
    this.navRail()?.focusFirstItem();
  }
}
```

**Testing Focus for Task 3:**

- [ ] Alt+M expands nav rail
- [ ] Alt+M focuses first menu item
- [ ] Focus ring visible on focused item
- [ ] Shortcut works from anywhere in app

</details>

---

<details open>
<summary><h3>Task 4: Implement Keyboard Navigation</h3></summary>

**Purpose**: Add proper keyboard navigation through menu items using arrow keys, with Enter/Space to activate.

**Related Documentation:**

- [WAI-ARIA Menu Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/) - Accessibility pattern

**Implementation Subtasks:**

- [ ] **Add keydown handler to nav rail**: Handle arrow keys
- [ ] **Implement ArrowDown/ArrowUp**: Move focus between items
- [ ] **Handle Home/End keys**: Jump to first/last item
- [ ] **Ensure tab order**: Items should be in logical tab order
- [ ] **Add roving tabindex**: Only focused item has tabindex="0"
- [ ] **Test with screen reader**: Verify announcements

**Key Implementation Notes:**

- Arrow keys should wrap around (down from last → first)
- Enter/Space already handled in nav-rail-item
- Consider `role="menu"` and `role="menuitem"` for proper semantics
- Pin button should be separate from menu item navigation

**Keyboard Handler:**

```typescript
onKeydown(event: KeyboardEvent): void {
  const items = this.menuItemElements();
  const currentIndex = items.findIndex(el => el === document.activeElement);
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex].focus();
      break;
    case 'ArrowUp':
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex].focus();
      break;
    case 'Home':
      event.preventDefault();
      items[0].focus();
      break;
    case 'End':
      event.preventDefault();
      items[items.length - 1].focus();
      break;
  }
}
```

**Testing Focus for Task 4:**

- [ ] ArrowDown moves focus to next item
- [ ] ArrowUp moves focus to previous item
- [ ] ArrowDown from last wraps to first
- [ ] ArrowUp from first wraps to last
- [ ] Home focuses first item
- [ ] End focuses last item
- [ ] Enter/Space activates focused item

</details>

---

<details open>
<summary><h3>Task 5: Style Focus States and Pin Visual</h3></summary>

**Purpose**: Add proper focus styling for accessibility and visual indication of pin state.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Focus and highlight patterns

**Implementation Subtasks:**

- [ ] **Add focus-visible styles**: Clear focus ring on menu items
- [ ] **Style pinned state**: Rotated pin icon, highlight color
- [ ] **Add pin button hover state**: Consistent with other buttons
- [ ] **Ensure contrast**: Focus ring visible on glassy background
- [ ] **Test high contrast mode**: Verify accessibility

**Key Implementation Notes:**

- Use `:focus-visible` for keyboard-only focus rings
- Pin icon rotation: 45deg when pinned (angled like "pinned down")
- Use `--color-highlight` for pinned state indication
- Focus ring should be visible against glassy background

**CSS Additions:**

```scss
.nav-rail-item:focus-visible {
  outline: 2px solid var(--color-highlight);
  outline-offset: 2px;
}

.pin-button {
  &.pinned {
    color: var(--color-highlight);
    
    mat-icon {
      transform: rotate(45deg);
    }
  }
}
```

**Testing Focus for Task 5:**

- [ ] Focus ring visible when navigating with keyboard
- [ ] No focus ring on mouse click
- [ ] Pin icon rotated when pinned
- [ ] Pin button highlighted when pinned
- [ ] Focus ring has sufficient contrast

</details>

---

<details open>
<summary><h3>Task 6: Write Accessibility Tests</h3></summary>

**Purpose**: Verify all accessibility requirements are met with comprehensive tests.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Test patterns

**Implementation Subtasks:**

- [ ] **Test ARIA attributes**: role, aria-label, aria-pressed
- [ ] **Test keyboard navigation**: Arrow keys, Home, End
- [ ] **Test focus management**: Correct element focused
- [ ] **Test shortcut**: Alt+M functionality
- [ ] **Test screen reader**: Manual testing with NVDA/VoiceOver

**Behaviors to Test:**

- [ ] Nav rail has `role="navigation"` or `role="menu"`
- [ ] Items have `role="menuitem"` or appropriate role
- [ ] Pin button has `aria-pressed` reflecting state
- [ ] All interactive elements have `aria-label`
- [ ] Focus moves correctly with keyboard
- [ ] Tab order is logical

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**

- `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.html`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.scss`
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.spec.ts`
- `libs/app/shell/src/lib/layout/layout.component.ts`
- `libs/app/shell/src/lib/layout/layout.component.spec.ts`

---

## 📝 Testing Summary

**Test Execution:**

```bash
# Run nav rail tests
pnpm nx test ui-components --testPathPattern=nav-rail

# Run layout tests
pnpm nx test app-shell

# Run all affected
pnpm nx affected --target=test
```

**Manual Accessibility Testing:**

- [ ] Test with keyboard only (no mouse)
- [ ] Test with NVDA or VoiceOver
- [ ] Test focus visibility
- [ ] Test at different zoom levels

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] Pin button visible at bottom of rail
- [ ] Pin toggle keeps rail expanded
- [ ] Pin visual state (rotated icon, highlight)
- [ ] Alt+M expands and focuses first item
- [ ] Arrow keys navigate menu items
- [ ] Enter/Space activates items

**Accessibility Requirements:**

- [ ] All ARIA attributes correct
- [ ] Keyboard navigation complete
- [ ] Focus visible and logical
- [ ] Screen reader announces correctly

**Testing Requirements:**

- [ ] All unit tests pass
- [ ] Manual keyboard testing passed
- [ ] Screen reader testing passed

**Ready for Phase 4:**

- [ ] Pin feature complete
- [ ] Keyboard accessibility complete
- [ ] Ready for documentation

---

## 📝 Notes & Considerations

### Pin Icon Behavior

- Unpinned: Icon upright (default orientation)
- Pinned: Icon rotated 45° and highlighted
- This provides clear visual feedback without needing text

### Keyboard Shortcut Choice

- Alt+M chosen for "Menu" 
- Doesn't conflict with browser shortcuts
- Easy to remember and access

### Future Considerations

- Could add Escape to collapse rail
- Could add touch gesture support for mobile
- Pin persistence via localStorage (Phase 4 or future)
