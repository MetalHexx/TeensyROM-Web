# Phase 5: Refactor VideoDialogComponent

## 🎯 Objective

Refactor `VideoDialogComponent` to compose the new UI components while preserving all existing functionality. This validates the architecture with the more complex use case first.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Target architecture
- [ ] Phases 1-4 must be complete
- [ ] Review current `video-dialog.component.ts/html/scss`

---

## 📂 Files Modified

```
libs/features/player/src/lib/.../video-capture/video-dialog/
├── video-dialog.component.ts                📝 Major refactor
├── video-dialog.component.html              📝 Major refactor
└── video-dialog.component.scss              📝 Significant reduction
```

---

<details open>
<summary><h3>Task 1: Update Template to Use New Components</h3></summary>

**Purpose**: Replace inline implementation with composed components.

- [ ] Replace video element with `lib-video-stream`
- [ ] Wrap with `lib-crt-effect-wrapper`
- [ ] Use `lib-video-overlay-container` for layout
- [ ] Project toolbars into appropriate slots

</details>

<details open>
<summary><h3>Task 2: Simplify Component Logic</h3></summary>

**Purpose**: Delegate to child components, reduce local state.

- [ ] Remove stream attachment logic (delegated to video-stream)
- [ ] Simplify CRT settings to input/output binding
- [ ] Delegate fullscreen to overlay container
- [ ] Keep only dialog-specific logic (close, dialog data)

</details>

<details open>
<summary><h3>Task 3: Migrate SCSS</h3></summary>

**Purpose**: Remove styles now handled by composed components.

- [ ] Remove CRT effect styles (now in crt-effect-wrapper)
- [ ] Remove overlay positioning (now in overlay-container)
- [ ] Keep only dialog-specific overrides

</details>

<details open>
<summary><h3>Task 4: Verify and Test</h3></summary>

**Purpose**: Ensure no regressions.

- [ ] All existing functionality works (CRT, fullscreen, toolbars)
- [ ] Update/fix existing tests for new structure
- [ ] Visual regression check
- [ ] **Test**: Dialog opens, stream displays, CRT toggles, fullscreen works

</details>

---

## ✅ Success Criteria

- [ ] All existing functionality preserved
- [ ] Uses new composed components
- [ ] Significantly reduced template and SCSS complexity
- [ ] All tests pass
- [ ] No visual regressions

---

**Estimated Size**: Medium (3 files, significant changes) | **Dependencies**: Phases 1-4 complete
