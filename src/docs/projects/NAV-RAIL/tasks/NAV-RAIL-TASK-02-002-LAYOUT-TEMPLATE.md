# Subagent Task Handoff: NAV-RAIL-TASK-02-002-LAYOUT-TEMPLATE

## 📋 Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | NAV-RAIL-TASK-02-002-LAYOUT-TEMPLATE |
| **Task Name** | Update Layout Template with Nav Rail |
| **Assigned To** | UI Wizard |
| **Agent Chatmode** | `.github/chatmodes/UI Wizard.chatmode.md` |
| **Priority** | High |
| **Estimated Context Size** | Medium (4-5 files) |

---

## 🎯 Objective

**What**: Replace the `mat-sidenav` drawer with the new `lib-nav-rail` component in the layout template, wiring up inputs/outputs and navigation.

**Why**: The nav rail will be the new primary navigation mechanism, always visible instead of requiring a hamburger menu toggle.

**Success Criteria**:
- [ ] `NavRailComponent` imported into LayoutComponent
- [ ] `mat-sidenav` element removed (keep `mat-sidenav-content` for now)
- [ ] `lib-nav-rail` added to template with proper inputs/outputs
- [ ] Menu items converted from `NavItem[]` to `NavRailItem[]`
- [ ] Active route tracked and passed to nav rail
- [ ] Navigation works when items are clicked
- [ ] All tests pass

---

## 📁 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-02-001: Navigation service has expansion/pin signals
- Phase 1: NavRailComponent exists and is tested

**Dependencies**:
- `NavRailComponent` from `@teensyrom-nx/ui/components`
- `NavigationService` with new signals
- `NAV_ITEMS` from `@teensyrom-nx/app/navigation`
- Angular Router for active route detection

**Constraints**:
- `NavItem` and `NavRailItem` interfaces are compatible (same properties)
- Keep `mat-sidenav-content` wrapper for content area styling
- Don't remove `NavMenuComponent` yet (will be deprecated but not removed this task)

---

## 📂 File Scope

**Files to Modify**:
| File | Changes |
|------|---------|
| `libs/app/shell/src/lib/layout/layout.component.ts` | Import NavRailComponent, add signals for menu items and active route |
| `libs/app/shell/src/lib/layout/layout.component.html` | Replace mat-sidenav with lib-nav-rail |
| `libs/app/shell/src/lib/layout/layout.component.spec.ts` | Update tests for new template |

**Files to Review (Context)**:
| File | Purpose |
|------|---------|
| `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts` | Understand component API |
| `libs/app/navigation/src/lib/navigation.constants.ts` | NAV_ITEMS structure |
| `libs/app/navigation/src/lib/navigation-item.model.ts` | NavItem interface |
| `libs/ui/components/src/lib/nav-rail/nav-rail.model.ts` | NavRailItem interface |

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing

**Key Requirements**:

1. **Import NavRailComponent**:
   ```typescript
   import { NavRailComponent } from '@teensyrom-nx/ui/components';
   // Add to imports array
   ```

2. **Add menu items signal**:
   - Create `menuItems` computed signal from `NAV_ITEMS`
   - Map `NavItem` to `NavRailItem` (they're compatible, just need typing)

3. **Add active route tracking**:
   - Create `activeRoute` signal that updates on navigation
   - Use `Router.events` filtered to `NavigationEnd`
   - Extract current route path from router state

4. **Update template**:
   ```html
   <lib-header></lib-header>

   <div class="layout-container">
     <lib-nav-rail
       [items]="menuItems()"
       [activeRoute]="activeRoute()"
       (itemClick)="onNavItemClick($event)"
     ></lib-nav-rail>

     <mat-sidenav-content class="router-container">
       <div class="router-content">
         <router-outlet />
       </div>
     </mat-sidenav-content>
   </div>

   <lib-alert-container></lib-alert-container>
   ```

5. **Add navigation handler**:
   ```typescript
   onNavItemClick(item: NavRailItem): void {
     this.router.navigate([item.route]);
   }
   ```

**Active Route Detection Pattern**:
```typescript
// In constructor or as a field
private readonly routeUrl = toSignal(
  this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects)
  ),
  { initialValue: this.router.url }
);

// Computed active route (extract path without query params)
activeRoute = computed(() => {
  const url = this.routeUrl();
  // Return first path segment (e.g., '/player/browse' → 'player')
  return url?.split('/')[1] ?? '';
});
```

**Anti-Patterns to Avoid**:
- Don't remove `mat-sidenav-content` structure yet (CSS depends on it)
- Don't add CSS positioning in this task (Task 3)
- Don't connect expansion/pin signals yet (just get navigation working first)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests**:
- [ ] Layout renders with nav rail
- [ ] Menu items are passed to nav rail
- [ ] Active route is determined from router
- [ ] Clicking nav item triggers navigation
- [ ] Active route updates after navigation

**Behavioral Expectations**:
- Nav rail visible in layout (not hidden behind hamburger)
- Items display with correct icons and labels on hover
- Clicking an item navigates to that route
- Active route is highlighted

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/NAV-RAIL-PHASE-02-LAYOUT-INTEGRATION.md#task-2-update-layout-template)
- [Task 02-001 Report](../reports/NAV-RAIL-TASK-02-001-REPORT.md) - Navigation service changes

**Interface Compatibility**:
```typescript
// NavItem (existing)
interface NavItem {
  name: string;
  icon: string;
  route: string;
}

// NavRailItem (nav rail)
interface NavRailItem<T = undefined> {
  name: string;
  icon: string;
  route: string;
  payload?: T;
}
// Compatible! NavItem can be assigned to NavRailItem
```

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## ✅ Handoff Checklist

- [x] Task objective is crystal clear
- [x] Success criteria are specific and testable
- [x] File scope is explicit
- [x] All prerequisites are listed
- [x] Standards documents are linked
- [x] Testing requirements are explicit
- [x] Output report path is specified
