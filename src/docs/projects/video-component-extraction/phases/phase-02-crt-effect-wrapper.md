# Phase 2: CRT Effect Wrapper Component

## 🎯 Objective

Extract CRT effect styling into a reusable `lib-crt-effect-wrapper` component that can wrap any content. Separates visual effects from video logic, enabling external settings control for future persistence.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Architecture decisions
- [ ] [Phase 1](./phase-01-video-stream-component.md) - Must be complete
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling conventions
- [ ] Review existing CRT styles in `video-dialog.component.scss`

---

## 📂 File Structure

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/                      ✨ New folder
│   ├── crt-effect-wrapper.component.ts      ✨ New
│   ├── crt-effect-wrapper.component.html    ✨ New
│   ├── crt-effect-wrapper.component.scss    ✨ New
│   ├── crt-effect-wrapper.component.spec.ts ✨ New
│   ├── crt-settings.interface.ts            ✨ New
│   └── crt-settings.defaults.ts             ✨ New

libs/ui/components/src/index.ts              📝 Add exports
```

---

<details open>
<summary><h3>Task 1: Define CRT Settings Types</h3></summary>

**Purpose**: Strongly-typed interface for all CRT effect parameters.

- [ ] Create `CrtSettings` interface (8 parameters: scanlines, vignette, curvature, filters)
- [ ] Create `DEFAULT_CRT_SETTINGS` constant with current values
- [ ] Export types for consumer use

</details>

<details open>
<summary><h3>Task 2: Create Wrapper Component</h3></summary>

**Purpose**: Wrapper that applies CRT effects via CSS custom properties.

- [ ] Create component with `enabled` and `settings` inputs
- [ ] Simple template with ng-content for wrapping any content
- [ ] Bind settings to CSS custom properties

</details>

<details open>
<summary><h3>Task 3: Extract CRT Styles</h3></summary>

**Purpose**: Move CRT styles from video-dialog to wrapper component.

- [ ] Extract scanlines, vignette, filters, curvature effects
- [ ] Remove video-specific selectors
- [ ] **Test**: Class toggle, CSS variable binding, content projection

</details>

<details open>
<summary><h3>Task 4: Documentation</h3></summary>

**Purpose**: Document for discoverability.

- [ ] Export component, interface, and defaults
- [ ] Update COMPONENT_LIBRARY.md
- [ ] Update STYLE_GUIDE.md with CSS variables

</details>

---

## ✅ Success Criteria

- [ ] CrtSettings interface and defaults exported
- [ ] Wrapper applies effects when enabled
- [ ] Content projects correctly
- [ ] All tests pass, lint passes
- [ ] Documentation updated

---

**Estimated Size**: Small (6 files) | **Dependencies**: Phase 1 complete
