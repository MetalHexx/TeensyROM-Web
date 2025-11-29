# CRT-ENHANCEMENTS-TASK-01-001: Preset Dropdown Infrastructure

## 📋 Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | CRT-ENHANCEMENTS-TASK-01-001-PRESET-DROPDOWN |
| **Task Name** | Preset Dropdown Infrastructure |
| **Phase** | 1 - Preset Dropdown Infrastructure |
| **Priority** | High |
| **Estimated Size** | Medium (4-8 files) |

---

## 🎯 Objective

**What**: Add a functional preset dropdown to the CRT Settings Panel header that allows users to quickly select from existing CRT presets (`full`, `standard`, `small`, `none`).

**Why**: This establishes the foundational UI pattern for preset selection before adding new effects in later phases. Users will be able to quickly switch between predefined CRT looks rather than manually adjusting individual sliders.

**Success Criteria**:
- [ ] Preset dropdown visible in CRT Settings Panel header
- [ ] Dropdown displays all four existing presets with user-friendly labels
- [ ] Selecting a preset emits `presetSelected` event with correct preset name
- [ ] Dropdown closes after selection
- [ ] Dropdown works correctly in fullscreen video dialog
- [ ] All unit tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Existing `CrtSettingsPanelComponent` with header area
- Existing `DropdownMenuComponent` with fullscreen support
- Existing `CRT_PRESETS` constant with four presets

**Dependencies**:
- `@angular/material` for icons and tooltips
- `@angular/cdk` for overlay (used by dropdown)

**Constraints**:
- Must work within compact header area of settings panel
- Must function correctly in fullscreen mode (dropdown overlay positioning)
- Must maintain existing reset button functionality

---

## 📂 File Scope

**Files to Modify**:

1. `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
   - Add `CRT_PRESET_LABELS` constant mapping preset keys to display names
   - Export new constant

2. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
   - Import `DropdownMenuComponent` and `DropdownMenuItemComponent`
   - Add `presetNames` computed property for template iteration
   - Add `getPresetLabel()` method for display names
   - Uncomment/enable `presetSelected` output usage

3. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
   - Uncomment the preset dropdown section in header
   - Wire up click handlers for preset items
   - Add tooltips if desired

4. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`
   - Ensure header accommodates dropdown trigger alongside reset button
   - Style active preset indicator if implemented

5. `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`
   - Add tests for dropdown rendering
   - Add tests for preset selection events
   - Add tests for dropdown close behavior

**Files to Review** (for context):

- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Dropdown implementation with fullscreen support
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts` - Consumer of settings panel

---

## 📋 Implementation Guidance

### Step 1: Add Preset Labels

Add display-friendly labels for each preset in the defaults file:

```typescript
// In crt-settings.defaults.ts
export const CRT_PRESET_LABELS: Record<keyof typeof CRT_PRESETS, string> = {
  full: 'Full CRT',
  standard: 'Standard (Flat)',
  small: 'Subtle',
  none: 'None (Disabled)',
};
```

### Step 2: Enable Dropdown in Settings Panel

The settings panel already has commented-out dropdown code. The key changes:

1. Import the dropdown components
2. Add `presetNames` property: `Object.keys(CRT_PRESETS)`
3. Create `getPresetLabel(preset: string)` method
4. Uncomment the dropdown template section
5. Ensure `onPresetSelect()` method calls `presetSelected.emit()`

### Step 3: Test Fullscreen Behavior

The `DropdownMenuComponent` already handles fullscreen overlay attachment. Key behaviors to verify:
- Dropdown opens when trigger clicked
- Dropdown positions correctly (below trigger)
- Clicking outside closes dropdown
- Selecting item closes dropdown and emits event

### Step 4: Unit Tests

Add tests covering:
- Dropdown trigger renders in header
- Click opens dropdown
- All four preset items appear
- Click item emits correct preset name
- Dropdown closes after selection

---

## 🧪 Testing Requirements

**Unit Tests**:
- [ ] Dropdown trigger button renders in header actions area
- [ ] Clicking trigger opens dropdown menu
- [ ] All four presets appear as dropdown items
- [ ] Each preset shows correct display label
- [ ] Clicking "Full CRT" emits `presetSelected` with 'full'
- [ ] Clicking "Standard (Flat)" emits `presetSelected` with 'standard'
- [ ] Clicking "Subtle" emits `presetSelected` with 'small'
- [ ] Clicking "None (Disabled)" emits `presetSelected` with 'none'
- [ ] Dropdown closes after preset selection
- [ ] Reset button still functions alongside dropdown

**Manual Testing**:
- [ ] Open video dialog, open CRT settings panel
- [ ] Click preset dropdown trigger - dropdown appears
- [ ] Click preset - settings visually update
- [ ] Enter fullscreen, repeat test
- [ ] Verify dropdown appears above fullscreen content

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Document](../phases/CRT-ENHANCEMENTS-PHASE-01-PRESET-DROPDOWN.md)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)
- [Dropdown Menu Component](../../../COMPONENT_LIBRARY.md#dropdown-menu) (if documented)

**Existing Implementations**:
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - CDK overlay dropdown pattern
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts` - `onCrtPresetSelected()` handler pattern

---

## 📤 Output Report

**Report Location**: `docs/projects/crt-enhancements/reports/CRT-ENHANCEMENTS-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

---

## ⚠️ Anti-Patterns to Avoid

1. **Don't modify dropdown-menu component** - It already handles fullscreen; use it as-is
2. **Don't add state to track selected preset** - Parent component handles this via settings object
3. **Don't create new preset definitions** - Use existing `CRT_PRESETS` constant
4. **Don't change presetSelected output signature** - It already emits `CrtPresetName`
