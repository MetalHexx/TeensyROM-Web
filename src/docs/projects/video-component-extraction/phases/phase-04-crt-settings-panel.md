# Phase 4: CRT Settings Panel Component

## 🎯 Objective

Extract CRT settings sliders into standalone `lib-crt-settings-panel` component. Makes settings UI reusable and independently testable, composable into any overlay.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Architecture decisions
- [ ] [Phase 2](./phase-02-crt-effect-wrapper.md) - CrtSettings interface (must be complete)
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing patterns

---

## 📂 File Structure

```
libs/ui/components/src/lib/
├── crt-settings-panel/                      ✨ New folder
│   ├── crt-settings-panel.component.ts      ✨ New
│   ├── crt-settings-panel.component.html    ✨ New
│   ├── crt-settings-panel.component.scss    ✨ New
│   └── crt-settings-panel.component.spec.ts ✨ New

libs/ui/components/src/index.ts              📝 Add export
```

---

<details open>
<summary><h3>Task 1: Create Settings Panel Component</h3></summary>

**Purpose**: Standalone panel with all CRT sliders.

- [ ] Create component with `settings` input and `settingsChange` output
- [ ] All 8 CRT parameter sliders with proper min/max/step
- [ ] Uses Angular Material sliders

</details>

<details open>
<summary><h3>Task 2: Implement Two-Way Binding Pattern</h3></summary>

**Purpose**: Settings input with change output for parent state control.

- [ ] Accept CrtSettings input
- [ ] Emit partial updates on slider changes
- [ ] **Test**: Input binding, change emission

</details>

<details open>
<summary><h3>Task 3: Style and Document</h3></summary>

**Purpose**: Match existing CRT controls styling.

- [ ] Style consistent with current video-dialog CRT panel
- [ ] Uses `lib-compact-card-layout` for container
- [ ] Update COMPONENT_LIBRARY.md

</details>

---

## ✅ Success Criteria

- [ ] All 8 sliders functional
- [ ] Two-way binding pattern works
- [ ] Styling matches existing appearance
- [ ] All tests pass, lint passes
- [ ] Documentation updated

---

**Estimated Size**: Small (4 files) | **Dependencies**: Phase 2 (CrtSettings type)
