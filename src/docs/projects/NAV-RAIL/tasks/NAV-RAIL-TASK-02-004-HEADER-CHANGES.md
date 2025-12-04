# Subagent Task Handoff: NAV-RAIL-TASK-02-004-HEADER-CHANGES

## 📋 Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | NAV-RAIL-TASK-02-004-HEADER-CHANGES |
| **Task Name** | Hide Hamburger Button from Header |
| **Assigned To** | UI Wizard |
| **Agent Chatmode** | `.github/chatmodes/UI Wizard.chatmode.md` |
| **Priority** | Medium |
| **Estimated Context Size** | Small (2-3 files) |

---

## 🎯 Objective

**What**: Hide the hamburger navigation button from the header since the nav rail is always visible.

**Why**: With the floating nav rail always present, the hamburger toggle is no longer needed for desktop. We're hiding rather than removing to preserve the option for mobile use later.

**Success Criteria**:
- [ ] Hamburger button (`lib-nav-button`) hidden in header
- [ ] No console errors from navigation service calls
- [ ] Header layout still correct (title, version, theme toggle)
- [ ] `NavButtonComponent` files preserved (not deleted)
- [ ] All tests pass

---

## 📁 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-02-003: Nav rail is positioned and visible in layout

**Dependencies**:
- HeaderComponent at `libs/app/shell/src/lib/components/header/`
- NavButtonComponent at `libs/app/shell/src/lib/components/header/nav-button/`

**Constraints**:
- **Hide, don't delete** - preserve for future mobile implementation
- Navigation service methods still work (just not called from header)
- Media query approach preferred for future responsiveness

---

## 📂 File Scope

**Files to Modify**:
| File | Changes |
|------|---------|
| `libs/app/shell/src/lib/components/header/header.component.html` | Comment out or conditionally hide lib-nav-button |
| `libs/app/shell/src/lib/components/header/header.component.scss` | Add display:none for nav button (optional approach) |
| `libs/app/shell/src/lib/components/header/header.component.spec.ts` | Update tests if needed |

**Files to Keep (DO NOT DELETE)**:
| File | Reason |
|------|--------|
| `libs/app/shell/src/lib/components/header/nav-button/nav-button.component.ts` | Future mobile use |
| `libs/app/shell/src/lib/components/header/nav-button/nav-button.component.html` | Future mobile use |
| `libs/app/shell/src/lib/components/header/nav-button/nav-button.component.scss` | Future mobile use |
| `libs/app/shell/src/lib/components/header/nav-button/nav-button.component.spec.ts` | Future mobile use |

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Template patterns
- [Style Guide](../../../STYLE_GUIDE.md) - Responsive patterns

**Key Requirements**:

**Option A: CSS Hide (Recommended)**

Add to header SCSS:
```scss
lib-nav-button {
  display: none;
  
  // Future: show on mobile
  // @media (max-width: 768px) {
  //   display: block;
  // }
}
```

Keep template unchanged:
```html
<mat-toolbar class="mat-elevation-z6+" color="primary">
  <lib-nav-button></lib-nav-button>  <!-- Still in DOM, just hidden -->
  <span class="app-title">TeensyROM</span>
  ...
</mat-toolbar>
```

**Option B: Template Comment**

Comment out in template:
```html
<mat-toolbar class="mat-elevation-z6+" color="primary">
  <!-- Hidden for desktop - nav rail provides navigation -->
  <!-- <lib-nav-button></lib-nav-button> -->
  <span class="app-title">TeensyROM</span>
  ...
</mat-toolbar>
```

**Recommendation**: Option A (CSS) is preferred because:
1. Easier to add responsive breakpoint later
2. Component stays instantiated (no conditional logic)
3. Simpler diff for future mobile work

**Anti-Patterns to Avoid**:
- Don't delete NavButtonComponent files
- Don't remove NavigationService imports from header
- Don't use `@if` conditional (adds complexity for simple hide)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests**:
- [ ] Header renders without errors
- [ ] Header layout correct (title visible, theme toggle works)
- [ ] No console errors related to navigation

**Visual Verification** (manual):
- [ ] Hamburger button not visible in header
- [ ] Title "TeensyROM" positioned correctly (no gap)
- [ ] Theme toggle and version still visible and functional

**Note**: If existing header tests check for nav-button presence, update them to handle the hidden state or remove those assertions.

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/NAV-RAIL-PHASE-02-LAYOUT-INTEGRATION.md#task-4-handle-header-changes)
- [Master Plan - Mobile Strategy](../NAV-RAIL-MASTER-PLAN.md#mobile-strategy-future)

**Current Header Template**:
```html
<mat-toolbar class="mat-elevation-z6+" color="primary">
  <lib-nav-button></lib-nav-button>  <!-- TO BE HIDDEN -->

  <span class="app-title">TeensyROM</span>
  <span class="spacer"></span>

  <span class="version-text">{{ appVersion() }}</span>

  <button mat-icon-button (click)="themeService.toggleTheme()">
    <!-- theme icon -->
  </button>
</mat-toolbar>
```

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-02-004-REPORT.md`

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
