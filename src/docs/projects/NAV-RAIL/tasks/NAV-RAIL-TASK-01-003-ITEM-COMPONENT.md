# Task Handoff: NAV-RAIL-TASK-01-003-ITEM-COMPONENT

## 📋 Task Identity

**Task ID**: NAV-RAIL-TASK-01-003-ITEM-COMPONENT
**Task Name**: Create Nav Rail Item Component
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium (4-5 files)

---

## 🎯 Objective

**What**: Create the individual `lib-nav-rail-item` component that displays an icon and label, with proper styling for collapsed and expanded states.

**Why**: Separating the item into its own component provides clean encapsulation, makes testing easier, and allows for reuse if needed.

**Success Criteria**:
- [ ] NavRailItemComponent created with proper inputs/outputs
- [ ] Icon always visible regardless of expansion state
- [ ] Label visible only when expanded
- [ ] Active state applies highlight color
- [ ] Click and keyboard (Enter/Space) emit events
- [ ] Accessibility attributes present (role, tabindex, aria-label)
- [ ] All tests pass

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE: Parent component exists
- NAV-RAIL-TASK-01-002-HOVER-LOGIC: Expansion state logic works

**Dependencies**:
- `MatIconModule` from `@angular/material/icon`
- `NavRailItem` interface from `nav-rail.model.ts`

**Constraints**:
- Must be a standalone component
- Must work within parent's `@for` loop
- Must receive expansion state from parent

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.ts`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.html`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss`
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.spec.ts`

**Files to Modify**:
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts` - Import and use item component
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.html` - Replace inline rendering with item component
- `libs/ui/components/src/lib/nav-rail/index.ts` - Export item component

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/menu-item/menu-item.component.ts` - Similar component pattern
- `libs/ui/components/src/lib/icon-button/icon-button.component.ts` - Icon + interaction pattern

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Component Library](../../../COMPONENT_LIBRARY.md) - MenuItemComponent pattern

**Key Requirements**:

1. **Component Inputs**:
   - `item = input.required<NavRailItem>()` - The menu item data
   - `isExpanded = input<boolean>(false)` - From parent's expansion state
   - `isActive = input<boolean>(false)` - Whether this is the active route

2. **Component Output**:
   - `itemClick = output<NavRailItem>()` - Emitted on click/keyboard activation

3. **Template Structure**:
   ```html
   <div
     class="nav-rail-item"
     [class.active]="isActive()"
     [class.expanded]="isExpanded()"
     (click)="onClick()"
     (keydown.enter)="onClick()"
     (keydown.space)="onClick()"
     tabindex="0"
     role="button"
     [attr.aria-label]="item().name"
   >
     <mat-icon class="item-icon">{{ item().icon }}</mat-icon>
     <span class="item-label">{{ item().name }}</span>
   </div>
   ```

4. **SCSS Structure**:
   ```scss
   .nav-rail-item {
     display: flex;
     align-items: center;
     padding: 12px;
     cursor: pointer;
     transition: background-color 0.2s;
     
     &:hover {
       background-color: rgba(var(--glassy-color), 0.1);
     }
     
     &.active {
       color: var(--color-highlight);
     }
     
     .item-icon {
       flex-shrink: 0;
       width: 24px;
       height: 24px;
     }
     
     .item-label {
       margin-left: 16px;
       white-space: nowrap;
       overflow: hidden;
       opacity: 0;
       width: 0;
       transition: opacity 0.2s, width 0.2s;
     }
     
     &.expanded .item-label {
       opacity: 1;
       width: auto;
     }
   }
   ```

5. **Update Parent Template**:
   ```html
   @for (item of items(); track item.route) {
     <lib-nav-rail-item
       [item]="item"
       [isExpanded]="isExpanded()"
       [isActive]="item.route === activeRoute()"
       (itemClick)="onItemClick($event)"
     />
   }
   ```

**Anti-Patterns to Avoid**:
- Don't duplicate expansion logic - receive from parent
- Don't handle navigation directly - just emit event
- Don't use old template syntax (`*ngFor`, `[ngClass]`)

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Component renders with icon
- [ ] Label hidden when `isExpanded` is false
- [ ] Label visible when `isExpanded` is true
- [ ] Active class applied when `isActive` is true
- [ ] Click emits `itemClick` with item
- [ ] Enter key emits `itemClick`
- [ ] Space key emits `itemClick`
- [ ] Has correct ARIA attributes

**Behavioral Expectations**:
- Icon should always be visible and centered
- Label should smoothly appear/disappear with expansion
- Hover should provide visual feedback
- Active state should use highlight color

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Plan - Task 3](../phases/NAV-RAIL-PHASE-01-CORE-COMPONENT.md#task-3)
- [Style Guide](../../../STYLE_GUIDE.md) - Color tokens

**Related Tasks**:
- NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE: Parent component to integrate with
- NAV-RAIL-TASK-01-002-HOVER-LOGIC: Provides the `isExpanded` state

---

## 📤 Output

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-01-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
