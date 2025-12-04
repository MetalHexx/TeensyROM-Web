# Task Handoff: NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE

## 📋 Task Identity

**Task ID**: NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE

**Task Name**: Create Nav Rail Component Structure

**Assigned To**: UI Wizard

**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`

**Priority**: High

**Estimated Context Size**: Medium (6-8 files)

---

## 🎯 Objective

**What**: Create the foundational `lib-nav-rail` component structure with inputs, outputs, signals for state management, and the basic template using `lib-scaling-compact-card`.

**Why**: This establishes the component architecture that all subsequent tasks will build upon. Getting the structure right ensures clean separation of concerns and proper state management.

**Success Criteria**:
- [ ] Nav rail component created in `libs/ui/components/src/lib/nav-rail/`
- [ ] `NavRailItem` interface defined with required properties
- [ ] Component accepts `items` input array and renders menu items
- [ ] Component wrapped in `lib-scaling-compact-card`
- [ ] Component exports added to barrel files
- [ ] Basic rendering tests pass

---

## 📦 Context & Dependencies

**Prerequisites Completed**: None - this is the first task

**Dependencies**:
- `ScalingCompactCardComponent` from `@teensyrom-nx/ui/components`
- `MatIconModule` from `@angular/material/icon`
- Angular signals API

**Constraints**:
- Must use Angular 19 standalone component pattern
- Must use signal-based inputs (`input()`, `input.required()`)
- Must use signal-based outputs (`output()`)
- Must follow existing component patterns in the codebase

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts` - Main component
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.html` - Template
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.scss` - Styles (basic)
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.spec.ts` - Tests
- `libs/ui/components/src/lib/nav-rail/nav-rail.model.ts` - Interfaces
- `libs/ui/components/src/lib/nav-rail/index.ts` - Barrel export

**Files to Modify**:
- `libs/ui/components/src/index.ts` - Add nav-rail exports

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/menu-item/menu-item.component.ts` - Similar menu pattern
- `libs/ui/components/src/lib/scaling-compact-card/scaling-compact-card.component.ts` - Wrapper component
- `libs/app/navigation/src/lib/navigation-item.model.ts` - NavItem interface reference

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [Component Library](../../../COMPONENT_LIBRARY.md) - Existing patterns

**Key Requirements**:

1. **NavRailItem Interface** (`nav-rail.model.ts`):
   - `name: string` - Display label
   - `icon: string` - Material icon name
   - `route: string` - Router path
   - `payload?: T` - Optional generic payload (matches existing NavItem pattern)

2. **Component Inputs**:
   - `items = input.required<NavRailItem[]>()` - Menu items
   - `activeRoute = input<string>('')` - Current active route
   - `collapsedWidth = input<string>('56px')` - Width when collapsed
   - `expandedWidth = input<string>('200px')` - Width when expanded
   - `hoverDelayMs = input<number>(150)` - Delay for hover transitions

3. **Component Outputs**:
   - `itemClick = output<NavRailItem>()` - Emitted when item clicked

4. **Internal Signals**:
   - `isExpanded = signal<boolean>(false)` - Current expansion state
   - `isHovering = signal<boolean>(false)` - Mouse hover state

5. **Template Structure**:
   - Wrap in `lib-scaling-compact-card`
   - Render items in a list
   - Each item shows icon and label
   - Use `@for` for iteration

**Anti-Patterns to Avoid**:
- Don't use `@Input()` decorator - use `input()` signal
- Don't use `@Output()` decorator - use `output()`
- Don't use `*ngFor` - use `@for` control flow
- Don't implement hover logic yet - that's Task 2

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Component creates successfully
- [ ] Items render from input array
- [ ] Active route item has correct class
- [ ] Item click emits correct event
- [ ] Component wrapped in scaling-compact-card

**Behavioral Expectations**:
- Component should render in collapsed state by default
- Items should display icons (labels can be hidden by CSS initially)
- Click on item should emit the item that was clicked

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Plan](../phases/NAV-RAIL-PHASE-01-CORE-COMPONENT.md)
- [Master Plan](../NAV-RAIL-MASTER-PLAN.md)

**Similar Implementations**:
- `MenuItemComponent` - Shows icon + text menu item pattern
- `NavMenuComponent` - Shows how navigation items are rendered

---

## 📤 Output

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
