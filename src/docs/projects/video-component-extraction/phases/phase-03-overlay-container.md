# Phase 3: Video Overlay Container Component

## 🎯 Objective

Create `lib-video-overlay-container` that provides layout structure for overlays (top, bottom, side, corner slots) with hover-to-reveal behavior. Handles positioning and visibility logic, not content.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Architecture decisions
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [ ] Review overlay positioning in `video-dialog.component.scss`

---

## 📂 File Structure

```
libs/ui/components/src/lib/
├── video-overlay-container/                 ✨ New folder
│   ├── video-overlay-container.component.ts      ✨ New
│   ├── video-overlay-container.component.html    ✨ New
│   ├── video-overlay-container.component.scss    ✨ New
│   └── video-overlay-container.component.spec.ts ✨ New

libs/ui/components/src/index.ts              📝 Add export
```

---

<details open>
<summary><h3>Task 1: Create Container with Named Slots</h3></summary>

**Purpose**: Layout container with content projection slots.

- [ ] Create component with named ng-content slots: `video`, `topOverlay`, `bottomOverlay`, `sideControls`, `cornerControls`
- [ ] Input for `showControlsOnHover` behavior
- [ ] Basic container structure

</details>

<details open>
<summary><h3>Task 2: Implement Hover Behavior</h3></summary>

**Purpose**: Show/hide overlays on container hover.

- [ ] CSS-based hover-to-reveal for all overlay slots
- [ ] Configurable transitions
- [ ] **Test**: Slot projection, visibility toggle

</details>

<details open>
<summary><h3>Task 3: Add Fullscreen Support</h3></summary>

**Purpose**: Native Fullscreen API integration.

- [ ] Fullscreen toggle method
- [ ] Position fixes for overlays in fullscreen mode
- [ ] Output event for fullscreen state changes
- [ ] **Test**: Fullscreen toggle, event emission

</details>

<details open>
<summary><h3>Task 4: Extract Overlay Styles and Document</h3></summary>

**Purpose**: Move positioning styles and document usage.

- [ ] Extract overlay positioning from video-dialog
- [ ] Handle both normal and fullscreen positioning
- [ ] Update COMPONENT_LIBRARY.md with slot usage patterns

</details>

---

## ✅ Success Criteria

- [ ] Named slots project content correctly
- [ ] Hover behavior shows/hides overlays
- [ ] Fullscreen works with proper overlay positioning
- [ ] All tests pass, lint passes
- [ ] Documentation updated

---

**Estimated Size**: Medium (4 files, complex CSS) | **Dependencies**: Can run parallel with Phase 2
