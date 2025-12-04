# Subagent Task Handoff: NAV-RAIL-TASK-02-003-LAYOUT-STYLING

## 📋 Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | NAV-RAIL-TASK-02-003-LAYOUT-STYLING |
| **Task Name** | Position and Style Nav Rail in Layout |
| **Assigned To** | UI Wizard |
| **Agent Chatmode** | `.github/chatmodes/UI Wizard.chatmode.md` |
| **Priority** | High |
| **Estimated Context Size** | Small (2 files) |

---

## 🎯 Objective

**What**: Add CSS for positioning the floating nav rail with proper margins, z-index, and content area adjustment.

**Why**: The nav rail needs to float over the synthwave background with equal margins on all sides, and the content area needs to be offset so it doesn't overlap the collapsed rail.

**Success Criteria**:
- [ ] Nav rail positioned fixed/absolute on left side
- [ ] Equal margins (1rem) on all sides of the rail
- [ ] Rail height = full viewport minus header and margins
- [ ] Content area has left margin to avoid collapsed rail overlap
- [ ] Z-index layering correct (rail above content, below dialogs)
- [ ] Synthwave background visible through transparent areas
- [ ] Visual appearance correct in browser

---

## 📁 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-02-002: Nav rail is in the layout template

**Dependencies**:
- Layout template has `lib-nav-rail` element
- Header component defines `--header-height` or has known height
- Synthwave background is on `:host::before` pseudo-element

**Constraints**:
- Use `1rem` margins to match rest of UI
- Z-index should be below modals (typically 1000+)
- Don't break the synthwave background effect
- Keep `mat-sidenav-content` structure for now

---

## 📂 File Scope

**Files to Modify**:
| File | Changes |
|------|---------|
| `libs/app/shell/src/lib/layout/layout.component.scss` | Add nav rail positioning and content offset |
| `libs/app/shell/src/lib/layout/layout.component.html` | Add wrapper div if needed for positioning context |

**Files to Review (Context)**:
| File | Purpose |
|------|---------|
| `libs/ui/components/src/lib/nav-rail/nav-rail.component.scss` | Rail's internal styling |
| `libs/app/shell/src/lib/components/header/header.component.scss` | Header height reference |

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Style Guide](../../../STYLE_GUIDE.md) - Spacing, z-index conventions

**Key Requirements**:

1. **Add layout container**:
   - Wrapper div with `position: relative` for positioning context
   - `flex: 1` to take remaining space after header
   - `overflow: hidden` to contain content

2. **Position nav rail**:
   ```scss
   lib-nav-rail {
     position: fixed;
     top: calc(var(--header-height, 64px) + 1rem);  // Below header + margin
     left: 1rem;                                     // Left margin
     bottom: 1rem;                                   // Bottom margin
     z-index: 100;                                   // Above content, below modals
   }
   ```

3. **Adjust content area**:
   ```scss
   .content-area,
   mat-sidenav-content {
     margin-left: calc(56px + 2rem);  // collapsed width (56px) + left margin (1rem) + gap (1rem)
   }
   ```

4. **Ensure transparency**:
   - Nav rail's `lib-scaling-compact-card` already has glassy styling
   - Background should show through margins
   - No solid background on layout container

5. **Handle header height**:
   - Check if `--header-height` CSS variable exists
   - If not, use `64px` as default (standard Material toolbar height)
   - Consider adding CSS variable to header component if not present

**Template Update** (if needed):
```html
<lib-header></lib-header>

<div class="layout-container">
  <lib-nav-rail
    [items]="menuItems()"
    [activeRoute]="activeRoute()"
    (itemClick)="onNavItemClick($event)"
  ></lib-nav-rail>

  <div class="content-area">
    <router-outlet />
  </div>
</div>

<lib-alert-container></lib-alert-container>
```

**Anti-Patterns to Avoid**:
- Don't use absolute pixel values for header height (use variable)
- Don't add background color to layout container (blocks synthwave)
- Don't set z-index too high (below dialogs at 1000+)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Visual Verification** (manual):
- [ ] Nav rail has equal margins on all sides (1rem)
- [ ] Nav rail doesn't overlap content when collapsed
- [ ] Synthwave background visible in margins
- [ ] Z-index correct (rail above content, below any modals)
- [ ] Works correctly when page scrolls (if applicable)

**Unit Tests** (optional - styling is mostly visual):
- [ ] Layout renders without errors
- [ ] Content area has expected margin-left

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/NAV-RAIL-PHASE-02-LAYOUT-INTEGRATION.md#task-3-position-and-style-nav-rail)
- [Style Guide](../../../STYLE_GUIDE.md) - Z-index and spacing conventions

**Current Layout Structure**:
```
:host (LayoutComponent)
├── ::before (synthwave background, z-index: -1)
├── lib-header (64px height)
├── .layout-container
│   ├── lib-nav-rail (fixed, 56px width collapsed)
│   └── .content-area (margin-left to avoid rail)
└── lib-alert-container
```

**Z-Index Hierarchy Reference**:
- Background: -1
- Content: 0 (default)
- Nav rail: 100
- Dialogs/modals: 1000+

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-02-003-REPORT.md`

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
