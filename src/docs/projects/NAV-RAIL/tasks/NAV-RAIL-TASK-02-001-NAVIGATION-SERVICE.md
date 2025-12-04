# Subagent Task Handoff: NAV-RAIL-TASK-02-001-NAVIGATION-SERVICE

## 📋 Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | NAV-RAIL-TASK-02-001-NAVIGATION-SERVICE |
| **Task Name** | Extend Navigation Service with Expansion/Pin Signals |
| **Assigned To** | UI Wizard |
| **Agent Chatmode** | `.github/chatmodes/UI Wizard.chatmode.md` |
| **Priority** | High |
| **Estimated Context Size** | Small (2 files) |

---

## 🎯 Objective

**What**: Add signals and methods to the `NavigationService` for managing rail expansion and pin states.

**Why**: The layout component needs to control the nav rail's expansion state independently of the hover behavior (e.g., for pin functionality and programmatic control).

**Success Criteria**:
- [ ] `isExpanded` private signal with readonly accessor added
- [ ] `isPinned` private signal with readonly accessor added
- [ ] `expandNav()` method sets `isExpanded` to true
- [ ] `collapseNav()` method sets `isExpanded` to false (only if not pinned)
- [ ] `togglePin()` method toggles `isPinned`, expands if pinning
- [ ] All unit tests pass
- [ ] Lint passes

---

## 📁 Context & Dependencies

**Prerequisites Completed**:
- Phase 1 complete: NavRailComponent created with internal expansion state
- See [Phase 1 Reports](../reports/) for implementation details

**Dependencies**:
- `NavigationService` at `libs/app/navigation/src/lib/navigation.service.ts`
- Angular signals pattern from existing `_isNavOpen` signal

**Constraints**:
- Keep existing `isNavOpen` signal for potential mobile drawer use
- Follow existing signal naming pattern (`_privateSignal` → `publicReadonly`)
- Service remains stateless regarding route logic

---

## 📂 File Scope

**Files to Modify**:
| File | Changes |
|------|---------|
| `libs/app/navigation/src/lib/navigation.service.ts` | Add 2 new signals and 3 new methods |
| `libs/app/navigation/src/lib/navigation.service.spec.ts` | Add tests for new functionality |

**Files to Review (Context)**:
| File | Purpose |
|------|---------|
| `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts` | Understand how expansion state is used |

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [State Standards](../../../STATE_STANDARDS.md) - Signal patterns
- [Coding Standards](../../../CODING_STANDARDS.md) - Naming conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing

**Key Requirements**:

1. **Add `_isExpanded` private signal**:
   - Initial value: `false`
   - Expose via `isExpanded = this._isExpanded.asReadonly()`

2. **Add `_isPinned` private signal**:
   - Initial value: `false`
   - Expose via `isPinned = this._isPinned.asReadonly()`

3. **Add `expandNav()` method**:
   - Sets `_isExpanded` to `true`
   - No-op if already expanded

4. **Add `collapseNav()` method**:
   - Sets `_isExpanded` to `false` **only if not pinned**
   - No-op if pinned or already collapsed

5. **Add `togglePin()` method**:
   - Toggles `_isPinned` state
   - If pinning (false → true), also expand if not already expanded
   - If unpinning (true → false), do NOT auto-collapse

**Anti-Patterns to Avoid**:
- Don't couple to router or specific routes
- Don't add persistence logic (that comes later)
- Don't modify existing `isNavOpen` behavior

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests** (add to existing spec file):
- [ ] `isExpanded` initializes to `false`
- [ ] `isPinned` initializes to `false`
- [ ] `expandNav()` sets `isExpanded` to `true`
- [ ] `expandNav()` is idempotent (calling twice doesn't error)
- [ ] `collapseNav()` sets `isExpanded` to `false` when not pinned
- [ ] `collapseNav()` is a no-op when `isPinned` is `true`
- [ ] `togglePin()` toggles `isPinned` from `false` to `true`
- [ ] `togglePin()` toggles `isPinned` from `true` to `false`
- [ ] `togglePin()` to `true` also expands nav if collapsed
- [ ] `togglePin()` to `false` does NOT collapse nav

**Behavioral Expectations**:
- Pin state is independent of expansion state
- Pinning always expands
- Unpinning doesn't auto-collapse (user can still hover to collapse)

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/NAV-RAIL-PHASE-02-LAYOUT-INTEGRATION.md#task-1-extend-navigation-service)
- [Master Plan](../NAV-RAIL-MASTER-PLAN.md)

**Similar Implementations**:
- Existing `_isNavOpen` signal in same file shows the pattern

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-02-001-REPORT.md`

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
