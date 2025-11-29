# Phase 1: Preset Dropdown Infrastructure

## 🎯 Objective

Add a functional preset dropdown to the CRT Settings Panel that works with the existing four presets (`full`, `standard`, `small`, `none`). This establishes the UI pattern and dropdown integration before adding new effects, ensuring a testable foundation for subsequent phases.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [CRT Enhancements Brainstorming](../CRT_ENHANCEMENTS_BRAINSTORMING.md) - Feature research and ideas
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Application styling standards

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts       📝 Modified - Add dropdown integration
│   ├── crt-settings-panel.component.html     📝 Modified - Add dropdown to header
│   ├── crt-settings-panel.component.scss     📝 Modified - Style dropdown trigger
│   └── crt-settings-panel.component.spec.ts  📝 Modified - Add dropdown tests
├── crt-effect-wrapper/
│   ├── crt-settings.defaults.ts              📝 Modified - Add preset labels
│   └── crt-settings.interface.ts             📝 Modified - Add CrtPresetName type export
└── dropdown-menu/
    └── dropdown-menu.component.ts            📝 Modified - Ensure fullscreen compatibility
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Add Preset Labels to Defaults</h3></summary>

**Purpose**: Create user-friendly display labels for each preset that can be shown in the dropdown menu.

**Implementation Details**:

- Add `CRT_PRESET_LABELS` constant mapping preset names to display strings
- Export from `crt-settings.defaults.ts` alongside existing exports
- Labels should be descriptive: "Full CRT", "Standard (Flat)", "Subtle", "None (Disabled)"

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Testing**:
- [ ] Verify all preset names have corresponding labels
- [ ] Verify labels are exported correctly

</details>

---

<details open>
<summary><h3>Task 2: Integrate Dropdown into Settings Panel Header</h3></summary>

**Purpose**: Add the `lib-dropdown-menu` component to the CRT Settings Panel header, positioned alongside the existing reset button.

**Implementation Details**:

- Import `DropdownMenuComponent` and `DropdownMenuItemComponent` in the settings panel
- Position dropdown trigger button in the header actions area
- Use a small icon button with "tune" or "style" icon as trigger
- Generate dropdown items from `CRT_PRESETS` keys using `Object.keys()`
- Each item displays the label from `CRT_PRESET_LABELS`

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add imports
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add dropdown markup

**Testing**:
- [ ] Dropdown trigger button appears in header
- [ ] Clicking trigger opens dropdown menu
- [ ] All four preset names appear in dropdown
- [ ] Clicking backdrop closes dropdown

</details>

---

<details open>
<summary><h3>Task 3: Handle Preset Selection</h3></summary>

**Purpose**: Wire up preset selection in the dropdown to emit the existing `presetSelected` output event.

**Implementation Details**:

- Add click handler to each dropdown item
- On click, emit `presetSelected` with the preset name (e.g., 'full', 'standard')
- Close dropdown after selection
- Use existing `CrtPresetName` type for type safety

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add selection handler
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Wire up click events

**Testing**:
- [ ] Selecting "Full CRT" emits `presetSelected` with 'full'
- [ ] Selecting any preset closes the dropdown
- [ ] Parent component receives correct preset name

</details>

---

<details open>
<summary><h3>Task 4: Display Active Preset Indicator</h3></summary>

**Purpose**: Show the currently active preset in the dropdown trigger or highlight the active preset in the list.

**Implementation Details**:

- Add `activePreset` input signal to track which preset is currently selected (if any)
- Alternatively, compute active preset by comparing current settings to all presets
- Highlight active preset item in dropdown with checkmark or different styling
- Consider showing preset name in tooltip on trigger button

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add active preset logic
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add active indicator
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Style active state

**Testing**:
- [ ] Active preset shows visual indicator (checkmark, highlight, etc.)
- [ ] Active state updates when preset is selected
- [ ] Active state clears when user manually adjusts sliders (optional behavior)

</details>

---

<details open>
<summary><h3>Task 5: Style Dropdown for Settings Panel Context</h3></summary>

**Purpose**: Ensure the dropdown styling matches the glassy card aesthetic and fits well in the compact header area.

**Implementation Details**:

- Ensure dropdown trigger button uses `size="small"` variant
- Verify dropdown panel uses glassy-card styling (already in dropdown-menu component)
- Adjust header layout if needed to accommodate dropdown + reset button
- Ensure proper spacing between elements

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Adjust header styles

**Testing**:
- [ ] Dropdown trigger is appropriately sized for header
- [ ] Header elements don't overflow or overlap
- [ ] Dropdown panel has consistent glassy styling

</details>

---

<details open>
<summary><h3>Task 6: Test Fullscreen Dropdown Behavior</h3></summary>

**Purpose**: Verify the dropdown works correctly when the CRT Settings Panel is used inside a fullscreen video dialog.

**Implementation Details**:

- The `DropdownMenuComponent` already handles fullscreen overlay attachment
- Test that dropdown appears above the fullscreen content (correct z-index)
- Test that clicking backdrop closes dropdown in fullscreen
- Test that dropdown positions correctly relative to trigger in fullscreen

**Files to Review**:
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Fullscreen handling logic
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.html` - Dialog structure

**Testing**:
- [ ] Open video dialog and enter fullscreen
- [ ] Open CRT settings panel
- [ ] Click preset dropdown trigger
- [ ] Dropdown appears correctly positioned
- [ ] Selecting preset works and closes dropdown
- [ ] Clicking outside closes dropdown

</details>

---

<details open>
<summary><h3>Task 7: Unit Tests for Dropdown Integration</h3></summary>

**Purpose**: Add comprehensive unit tests for the new dropdown functionality in the CRT Settings Panel.

**Test Cases**:

- [ ] Dropdown trigger renders in header
- [ ] Dropdown opens when trigger clicked
- [ ] All preset items render with correct labels
- [ ] Clicking preset item emits `presetSelected` event
- [ ] Dropdown closes after selection
- [ ] Active preset indicator appears correctly
- [ ] Reset button still works alongside dropdown

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

</details>

---

## ✅ Definition of Done

- [x] Preset dropdown visible in CRT Settings Panel header
- [x] Dropdown displays all four existing presets with user-friendly labels
- [x] Selecting a preset emits `presetSelected` event with correct preset name
- [x] Dropdown closes after selection
- [ ] Active preset has visual indicator *(deferred to future enhancement)*
- [x] Dropdown works correctly in fullscreen video dialog
- [x] All unit tests pass (31 CRT panel tests + 50 overlay container tests)
- [x] No visual regressions in existing CRT controls
- [x] Code follows established patterns and conventions

**Phase Status**: ✅ COMPLETE

**Completion Report**: [CRT-ENHANCEMENTS-TASK-01-001-REPORT.md](../reports/CRT-ENHANCEMENTS-TASK-01-001-REPORT.md)

---

## 📝 Notes

- The existing `presetSelected` output and preset handling in `VideoDialogComponent.onCrtPresetSelected()` should not require changes
- The dropdown-menu component was specifically designed to handle fullscreen overlay cases - leverage that existing functionality
- Focus on getting the infrastructure right before adding complexity in later phases
