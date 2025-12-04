# Subagent Task Handoff: NAV-RAIL-TASK-02-005-INTEGRATION-TESTING

## 📋 Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | NAV-RAIL-TASK-02-005-INTEGRATION-TESTING |
| **Task Name** | Phase 2 Integration Testing and Verification |
| **Assigned To** | UI Wizard |
| **Agent Chatmode** | `.github/chatmodes/UI Wizard.chatmode.md` |
| **Priority** | Medium |
| **Estimated Context Size** | Medium (multiple files) |

---

## 🎯 Objective

**What**: Verify the complete Phase 2 integration works correctly with navigation service, router, layout, and visual presentation.

**Why**: Ensure all Phase 2 components work together seamlessly before moving to Phase 3 (pin feature and keyboard accessibility).

**Success Criteria**:
- [ ] All existing navigation tests pass (no regressions)
- [ ] All layout tests pass with nav rail
- [ ] Navigation flow works: click item → route changes → active highlights
- [ ] Hover expand/collapse works in integrated layout
- [ ] Visual verification checklist completed
- [ ] No console errors in browser

---

## 📁 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-02-001: Navigation service extended
- NAV-RAIL-TASK-02-002: Layout template updated
- NAV-RAIL-TASK-02-003: Layout styling applied
- NAV-RAIL-TASK-02-004: Header hamburger hidden

**Dependencies**:
- All Phase 2 files modified
- Running dev server for visual verification

---

## 📂 File Scope

**Files to Run Tests On**:
| Library | Command |
|---------|---------|
| app-navigation | `pnpm nx test app-navigation` |
| app-shell | `pnpm nx test app-shell` |
| ui-components | `pnpm nx test ui-components` |

**Files to Potentially Modify** (if tests need fixes):
| File | Purpose |
|------|---------|
| `libs/app/shell/src/lib/layout/layout.component.spec.ts` | May need mock updates |
| `libs/app/navigation/src/lib/navigation.service.spec.ts` | Verify new tests |

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Integration patterns

**Key Requirements**:

1. **Run All Affected Tests**:
   ```bash
   pnpm nx test app-navigation
   pnpm nx test app-shell
   pnpm nx test ui-components
   ```

2. **Fix Any Failing Tests**:
   - If tests fail due to template changes, update mocks/expectations
   - Don't remove tests - fix them or mark as skipped with TODO if blocking

3. **Integration Test Behaviors**:
   
   Write/verify these integration behaviors in layout spec:
   - [ ] Layout initializes with nav rail visible
   - [ ] Nav rail receives menu items from NAV_ITEMS
   - [ ] Clicking nav item triggers router navigation
   - [ ] Active route signal updates after navigation
   - [ ] Nav rail reflects active route

4. **Visual Verification Checklist**:
   
   Start dev server and manually verify:
   ```bash
   pnpm start
   # Open http://localhost:4200
   ```
   
   - [ ] Nav rail visible on left side with margins
   - [ ] Synthwave background shows through margins
   - [ ] Hover expands rail after ~150ms delay
   - [ ] Leaving rail collapses after ~150ms delay
   - [ ] Icons visible when collapsed
   - [ ] Labels visible when expanded
   - [ ] Active route highlighted with accent color
   - [ ] Clicking item navigates to correct route
   - [ ] New active route highlighted after navigation
   - [ ] No hamburger button in header
   - [ ] Header title and theme toggle still work
   - [ ] Content area doesn't overlap collapsed rail
   - [ ] Works in both light and dark themes

5. **Console Error Check**:
   - Open browser DevTools
   - Navigate through all menu items
   - Check for any JavaScript errors
   - Check for any TypeScript compilation errors

**Test Update Patterns**:

If layout tests fail due to missing NavRailComponent:
```typescript
// In test configuration
imports: [
  // ... existing imports
  NavRailComponent, // Add if testing with real component
],
// OR mock it
declarations: [
  MockComponent(NavRailComponent), // If using ng-mocks
]
```

If tests expect mat-sidenav:
```typescript
// Update query selectors
// OLD: fixture.debugElement.query(By.directive(MatSidenav))
// NEW: fixture.debugElement.query(By.directive(NavRailComponent))
```

**Anti-Patterns to Avoid**:
- Don't skip tests without documenting why
- Don't remove test coverage
- Don't ignore console errors

---

## 🧪 Testing Requirements

**Test Suites to Pass**:
- [ ] `pnpm nx test app-navigation` - All pass
- [ ] `pnpm nx test app-shell` - All pass  
- [ ] `pnpm nx test ui-components` - All pass

**Lint Check**:
- [ ] `pnpm nx lint app-navigation` - Passes
- [ ] `pnpm nx lint app-shell` - Passes

**Integration Behaviors to Verify**:
- [ ] Navigation service new signals work
- [ ] Layout renders nav rail correctly
- [ ] Router integration works
- [ ] Active state updates on navigation

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/NAV-RAIL-PHASE-02-LAYOUT-INTEGRATION.md#task-5-integration-testing)
- [Testing Standards](../../../TESTING_STANDARDS.md)

**Previous Task Reports**:
- [Task 02-001 Report](../reports/NAV-RAIL-TASK-02-001-REPORT.md)
- [Task 02-002 Report](../reports/NAV-RAIL-TASK-02-002-REPORT.md)
- [Task 02-003 Report](../reports/NAV-RAIL-TASK-02-003-REPORT.md)
- [Task 02-004 Report](../reports/NAV-RAIL-TASK-02-004-REPORT.md)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-02-005-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Include in Report**:
- Test results summary (pass/fail counts)
- Visual verification checklist results
- Any issues found and fixed
- Screenshots if helpful
- Recommendations for Phase 3

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
