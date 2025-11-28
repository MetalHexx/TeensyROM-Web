# Phase 6: Refactor VideoCaptureComponent

## 🎯 Objective

Refactor `VideoCaptureComponent` to compose the new UI components for the embedded preview. Validates reusability of components in a simpler context.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Target architecture
- [ ] Phase 5 should be complete (validates architecture)
- [ ] Review current `video-capture.component.ts/html/scss`

---

## 📂 Files Modified

```
libs/features/player/src/lib/.../video-capture/
├── video-capture.component.ts               📝 Moderate refactor
├── video-capture.component.html             📝 Moderate refactor
└── video-capture.component.scss             📝 Reduction
```

---

<details open>
<summary><h3>Task 1: Update Template</h3></summary>

**Purpose**: Use new components for video display.

- [ ] Replace video element with `lib-video-stream`
- [ ] Use `lib-video-overlay-container` for device selector and maximize button
- [ ] Keep device enumeration logic in smart component

</details>

<details open>
<summary><h3>Task 2: Simplify Component Logic</h3></summary>

**Purpose**: Delegate video display, keep domain logic.

- [ ] Remove stream attachment logic (delegated to video-stream)
- [ ] Keep device enumeration and selection (smart component responsibility)
- [ ] Keep dialog opening logic

</details>

<details open>
<summary><h3>Task 3: Migrate SCSS and Test</h3></summary>

**Purpose**: Remove delegated styles, verify functionality.

- [ ] Remove video styling (now in video-stream)
- [ ] Remove overlay positioning (now in overlay-container)
- [ ] **Test**: Device switching, maximize button, stream display

</details>

---

## ✅ Success Criteria

- [ ] Device enumeration and switching works
- [ ] Maximize opens dialog with same stream
- [ ] Uses new composed components
- [ ] All tests pass
- [ ] No visual regressions

---

**Estimated Size**: Small-Medium (3 files) | **Dependencies**: Phase 5 validates architecture
