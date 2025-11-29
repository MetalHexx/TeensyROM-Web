# Phase 6: Video Dialog & Capture Integration

## 🎯 Objective

Ensure all new CRT effects and presets work correctly in the video dialog and video capture components, including fullscreen mode. Verify dropdown overlays render properly and effects are applied correctly to live video streams. This phase focuses on integration testing and refinement.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation
- [ ] All previous phase reports - Implementation details

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [E2E Cypress Testing](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - E2E test patterns

---

## 📂 File Structure Overview

```
libs/features/player/src/lib/player-view/player-device-container/
├── video-capture/
│   ├── video-capture.component.ts             📝 Modified - Update default preset
│   ├── video-capture.component.html           📝 Modified - Potentially adjust layout
│   └── video-capture.component.spec.ts        📝 Modified - Add CRT integration tests
│   └── video-dialog/
│       ├── video-dialog.component.ts          📝 Modified - Ensure all effects work
│       ├── video-dialog.component.html        📝 Modified - Adjust for new controls
│       ├── video-dialog.component.scss        📝 Modified - Style adjustments
│       └── video-dialog.component.spec.ts     📝 Modified - Integration tests

apps/teensyrom-ui-e2e/src/e2e/
└── crt-effects.cy.ts                          ✨ New - E2E tests for CRT workflow
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Test Preset Dropdown in Video Dialog</h3></summary>

**Purpose**: Verify the categorized preset dropdown works correctly in normal and fullscreen video dialog modes.

**Test Scenarios**:
1. Open video dialog in normal mode
2. Open CRT settings panel
3. Click preset dropdown
4. Verify category headers display
5. Select a preset
6. Verify settings update
7. Enter fullscreen mode
8. Repeat steps 3-6

**Potential Issues to Check**:
- Dropdown overlay z-index in fullscreen
- Dropdown positioning within fullscreen container
- Dropdown closes when selecting preset
- Settings panel updates after selection

**Files to Test**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Testing**:
- [ ] Dropdown opens in normal mode
- [ ] Dropdown opens in fullscreen mode
- [ ] Category headers visible
- [ ] Preset selection works
- [ ] Dropdown closes after selection

</details>

---

<details open>
<summary><h3>Task 2: Test New Effects on Live Video</h3></summary>

**Purpose**: Verify all new CSS effects render correctly on live video streams.

**Effects to Test**:
1. **Core Effects (Phase 2)**:
   - Scanline opacity variations
   - Hue rotation
   - Color temperature shifts
   - Vertical scanlines
   - All grid modes (horizontal, vertical, grid, dot-matrix)

2. **Realism Effects (Phase 3)**:
   - Bloom effect on video
   - Chromatic aberration
   - Phosphor persistence blur
   - Interlace flicker (if applicable)
   - Barrel distortion

3. **Aesthetic Effects (Phase 4)**:
   - Phosphor patterns (shadow-mask, aperture-grille, slot-mask)
   - Static noise overlay
   - Animated noise
   - Screen reflection

**Test Approach**:
- Connect actual video capture device (if available)
- Use test video stream if device unavailable
- Cycle through presets that use each effect
- Verify visual output matches expectations

**Files to Test**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] All grid modes render on video
- [ ] Bloom effect visible (if implemented for video)
- [ ] Chromatic aberration visible
- [ ] Noise overlay visible
- [ ] Phosphor patterns visible

</details>

---

<details open>
<summary><h3>Task 3: Test Settings Panel Scroll Behavior</h3></summary>

**Purpose**: Verify the settings panel scrolls correctly when all collapsible sections are expanded.

**Test Scenarios**:
1. Open CRT settings panel
2. Expand all collapsible sections
3. Verify panel becomes scrollable
4. Scroll through all controls
5. Verify all sliders accessible and functional
6. Test in both normal and fullscreen modes

**Potential Issues**:
- Panel exceeds container height
- Scrollbar styling in glassy container
- Scroll position resets unexpectedly
- Focus management when scrolling

**Files to Modify (if needed)**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`

**Testing**:
- [ ] Panel scrolls when content exceeds height
- [ ] Scrollbar is visible and usable
- [ ] All controls accessible via scroll
- [ ] Panel height constrained appropriately

</details>

---

<details open>
<summary><h3>Task 4: Test Panel Visibility Toggle with New Sections</h3></summary>

**Purpose**: Verify the settings panel visibility toggle works correctly with the expanded control set.

**Test Scenarios**:
1. CRT enabled, panel hidden
2. Click settings button, panel shows
3. Expand some sections
4. Click settings button, panel hides
5. Click settings button, panel shows with same expansion state
6. Toggle CRT off, panel should hide
7. Toggle CRT on, verify behavior

**Files to Test**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Testing**:
- [ ] Panel toggles visibility correctly
- [ ] Section expansion state preserved
- [ ] Panel hides when CRT disabled
- [ ] No UI flicker during transitions

</details>

---

<details open>
<summary><h3>Task 5: Test Fullscreen Transitions</h3></summary>

**Purpose**: Verify CRT effects persist correctly through fullscreen enter/exit transitions.

**Test Scenarios**:
1. Set custom CRT settings
2. Enter fullscreen
3. Verify effects still applied
4. Exit fullscreen
5. Verify effects still applied
6. Verify no visual glitches during transition

**Files to Test**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.ts`

**Testing**:
- [ ] Effects persist through fullscreen enter
- [ ] Effects persist through fullscreen exit
- [ ] No visual glitches during transition
- [ ] Overlay controls remain functional

</details>

---

<details open>
<summary><h3>Task 6: Test Device Selector + CRT Controls Coordination</h3></summary>

**Purpose**: Verify device selector and CRT controls work together without interference.

**Test Scenarios**:
1. Open CRT settings panel
2. Open device selector dropdown
3. Verify both can be open simultaneously OR properly exclusive
4. Select device, verify CRT settings preserved
5. Toggle CRT, verify device selection preserved
6. Test hover overlay behavior with dropdowns open

**Files to Test**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Testing**:
- [ ] Both panels can open (or exclusive behavior is clear)
- [ ] Device change doesn't reset CRT settings
- [ ] CRT toggle doesn't affect device selection
- [ ] Overlay hover pauses when dropdowns open

</details>

---

<details open>
<summary><h3>Task 7: Update Video Capture Default Preset</h3></summary>

**Purpose**: Apply appropriate CRT preset for the embedded video capture component.

**Considerations**:
- Embedded capture is smaller, less screen real estate
- `small` preset may be appropriate, or new `embedded` preset
- Effects should be subtle to not overpower small display
- May want minimal or no curvature for embedded view

**Preset Options**:
- Use existing `small` preset
- Create new `embedded` preset with:
  - Subtle scanlines (lower intensity)
  - No curvature
  - No vignette (or very subtle)
  - No advanced effects

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- Potentially `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts` (if creating new preset)

**Testing**:
- [ ] Embedded capture has appropriate CRT effect
- [ ] Effect is subtle and doesn't interfere with viewing
- [ ] Consistent with dialog experience but appropriately scaled

</details>

---

<details open>
<summary><h3>Task 8: Add Integration Unit Tests</h3></summary>

**Purpose**: Add unit tests for CRT integration in video components.

**Test Categories**:

**Video Dialog Tests**:
- [ ] CRT wrapper receives settings from dialog state
- [ ] Preset selection updates wrapper settings
- [ ] Settings panel visibility toggles correctly
- [ ] Fullscreen state maintained with CRT enabled

**Video Capture Tests**:
- [ ] Default preset applied on initialization
- [ ] CRT toggle works in embedded context
- [ ] Settings panel (if available) works

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`

</details>

---

<details open>
<summary><h3>Task 9: Create E2E Tests for CRT Workflow</h3></summary>

**Purpose**: Add Cypress E2E tests for complete CRT workflow in video dialog.

**E2E Test Scenarios**:

1. **Basic CRT Toggle**:
   - Open video dialog
   - Toggle CRT on/off
   - Verify visual change

2. **Preset Selection**:
   - Open CRT settings
   - Open preset dropdown
   - Select a preset
   - Verify settings applied

3. **Settings Adjustment**:
   - Open CRT settings
   - Adjust slider value
   - Verify effect change

4. **Fullscreen Workflow**:
   - Enter fullscreen
   - Toggle CRT controls
   - Select preset
   - Exit fullscreen
   - Verify settings preserved

5. **Category Navigation** (if categories implemented):
   - Open preset dropdown
   - Navigate through categories
   - Select presets from different categories

**Files to Create**:
- `apps/teensyrom-ui-e2e/src/e2e/crt-effects.cy.ts`

**Testing**:
- [ ] All E2E tests pass
- [ ] Tests are reliable (not flaky)
- [ ] Tests cover major user workflows

</details>

---

<details open>
<summary><h3>Task 10: Performance Testing</h3></summary>

**Purpose**: Test CRT effects performance on various devices and configurations.

**Test Scenarios**:
1. Run with minimal effects (scanlines only)
2. Run with moderate effects (full preset)
3. Run with maximum effects (all enabled)
4. Measure frame rate/smoothness
5. Test on lower-powered device if available

**Performance Criteria**:
- Video playback remains smooth (30+ fps)
- No visible stutter when adjusting settings
- Browser remains responsive
- Memory usage stable

**Documentation**:
- Note any effects that significantly impact performance
- Document recommended settings for lower-end devices

**Testing**:
- [ ] Performance acceptable with standard presets
- [ ] No memory leaks during extended use
- [ ] Performance notes documented

</details>

---

## ✅ Definition of Done

- [ ] Preset dropdown works in normal and fullscreen video dialog
- [ ] All new CRT effects render correctly on live video
- [ ] Settings panel scrolls properly with all sections
- [ ] Panel visibility toggle works with new sections
- [ ] Effects persist through fullscreen transitions
- [ ] Device selector and CRT controls don't interfere
- [ ] Video capture has appropriate default preset
- [ ] Integration unit tests pass
- [ ] E2E tests pass for CRT workflow
- [ ] Performance is acceptable for standard use cases
- [ ] No visual regressions from previous functionality

---

## 📝 Notes

- E2E tests may require test fixtures for video streams if actual devices unavailable
- Performance testing may reveal effects that need optimization
- Consider adding "performance mode" preset that disables expensive effects
- Document any known limitations or browser-specific issues
