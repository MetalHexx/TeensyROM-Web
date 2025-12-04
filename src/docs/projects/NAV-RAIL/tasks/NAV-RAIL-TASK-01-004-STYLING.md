# Task Handoff: NAV-RAIL-TASK-01-004-STYLING

## 📋 Task Identity

**Task ID**: NAV-RAIL-TASK-01-004-STYLING
**Task Name**: Style the Nav Rail Component
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Implement comprehensive CSS for collapsed/expanded states, smooth width transitions, icon centering, and proper visual styling using the design system tokens.

**Why**: The visual polish is critical for the nav rail to feel integrated with the rest of the UI and provide a smooth, professional user experience.

**Success Criteria**:
- [ ] Collapsed state has correct width (56px)
- [ ] Expanded state has correct width (~200px)
- [ ] Width transition is smooth (250-300ms)
- [ ] Icons remain centered during transition
- [ ] Labels clip/reveal smoothly
- [ ] Active item uses `--color-highlight`
- [ ] Hover states provide visual feedback
- [ ] Glassy card styling works correctly

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE: Component structure
- NAV-RAIL-TASK-01-002-HOVER-LOGIC: Expansion signals
- NAV-RAIL-TASK-01-003-ITEM-COMPONENT: Item component with basic styles

**Dependencies**:
- CSS custom properties from global styles
- `--color-highlight` token
- `--glassy-color` token
- `lib-scaling-compact-card` wrapper

**Constraints**:
- Must use existing design tokens
- Must work with glassy card styling
- Transition timing should feel consistent with rest of app

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.scss` - Main component styles
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss` - Item polish

**Files to Review** (for patterns):
- `libs/ui/styles/src/lib/theme/styles.scss` - Design tokens
- `libs/ui/components/src/lib/menu-item/menu-item.component.scss` - Menu styling
- `libs/ui/components/src/lib/compact-card-layout/compact-card-layout.component.scss` - Card styling

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Style Guide](../../../STYLE_GUIDE.md) - Design tokens and patterns

**Key Requirements**:

1. **CSS Custom Properties** (nav-rail.component.scss):
   ```scss
   :host {
     --nav-rail-collapsed-width: 56px;
     --nav-rail-expanded-width: 200px;
     --nav-rail-transition-duration: 250ms;
     --nav-rail-transition-easing: cubic-bezier(0.4, 0.0, 0.2, 1);
     
     display: block;
     height: 100%;
   }
   ```

2. **Rail Container Styles**:
   ```scss
   .nav-rail-container {
     display: flex;
     flex-direction: column;
     height: 100%;
     width: var(--nav-rail-collapsed-width);
     transition: width var(--nav-rail-transition-duration) var(--nav-rail-transition-easing);
     overflow: hidden;
     
     &.expanded {
       width: var(--nav-rail-expanded-width);
     }
   }
   ```

3. **Items List Styles**:
   ```scss
   .nav-rail-items {
     display: flex;
     flex-direction: column;
     padding: 8px 0;
     flex: 1;
   }
   ```

4. **Item Component Polish** (nav-rail-item.component.scss):
   ```scss
   .nav-rail-item {
     display: flex;
     align-items: center;
     height: 48px;
     padding: 0 16px;
     cursor: pointer;
     border-radius: 0;
     transition: background-color 0.15s ease;
     
     &:hover {
       background-color: rgba(var(--glassy-color), 0.15);
     }
     
     &:focus-visible {
       outline: 2px solid var(--color-highlight);
       outline-offset: -2px;
     }
     
     &.active {
       color: var(--color-highlight);
       background-color: rgba(var(--glassy-color), 0.1);
     }
     
     .item-icon {
       flex-shrink: 0;
       display: flex;
       align-items: center;
       justify-content: center;
       width: 24px;
       height: 24px;
     }
     
     .item-label {
       margin-left: 16px;
       font-size: 14px;
       font-weight: 500;
       white-space: nowrap;
       overflow: hidden;
       max-width: 0;
       opacity: 0;
       transition: 
         max-width var(--nav-rail-transition-duration) var(--nav-rail-transition-easing),
         opacity var(--nav-rail-transition-duration) var(--nav-rail-transition-easing);
     }
     
     &.expanded .item-label {
       max-width: 150px;
       opacity: 1;
     }
   }
   ```

5. **Update Template for Classes**:
   - Add `[class.expanded]="isExpanded()"` to container div
   - Ensure items receive `[isExpanded]="isExpanded()"` (already done in Task 3)

**Visual Verification Points**:
- Icons should stay perfectly centered in collapsed mode
- No horizontal shift when expanding/collapsing
- Labels should fade in as they slide out
- Active highlight should be clearly visible
- Hover should be subtle but noticeable

**Anti-Patterns to Avoid**:
- Don't use magic numbers - use CSS variables
- Don't forget to test in both light and dark themes
- Don't let icons shift position during animation

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Collapsed width is 56px
- [ ] Expanded width is 200px
- [ ] Transition class toggles correctly

**Visual Verification** (manual):
- [ ] Smooth width transition
- [ ] Icons don't shift during transition
- [ ] Labels fade in/out smoothly
- [ ] Active state visible
- [ ] Hover feedback works

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Plan - Task 4](../phases/NAV-RAIL-PHASE-01-CORE-COMPONENT.md#task-4)
- [Style Guide](../../../STYLE_GUIDE.md)

**Related Tasks**:
- NAV-RAIL-TASK-01-003-ITEM-COMPONENT: Basic item styles to enhance

---

## 📤 Output

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-01-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
