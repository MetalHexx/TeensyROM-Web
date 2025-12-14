# Phase 4: Default Preset Implementation

## 🎯 Objective

Simplify the user experience by showing only a single "Default" preset in each component context, while internally mapping to size-appropriate presets (SMALL_WEBGL or LARGE_WEBGL). This eliminates user confusion from seeing multiple presets and creates a cleaner, more intuitive interface where each component has a single optimized default.

**User Value**: Users no longer see confusing "Small" or "Large" labels that don't match their use case context. Each component presents a single "Default" option that's already optimized for that specific viewing context. Custom presets remain available for power users who want to save personalized settings.

**Technical Benefits**: Cleaner preset dropdown UI, elimination of context-inappropriate preset options (e.g., "Small" in fullscreen dialog), and clear separation between internal preset architecture and user-facing labels.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Preset Simplification Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - High-level feature plan
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT component documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Component styling patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.defaults.ts             📝 Modified - Update preset labels
│   └── crt-settings.defaults.spec.ts        📝 Modified - Update label tests
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts      📝 Modified - Update label retrieval logic
│   └── crt-settings-panel.component.spec.ts 📝 Modified - Update dropdown tests

libs/features/player/src/lib/player-view/player-device-container/
├── file-image/
│   ├── file-image.component.ts              📝 Modified - Use "Default" label
│   ├── file-image.component.html            📝 Modified - Pass label to settings panel
│   └── file-image.component.spec.ts         📝 Modified - Verify label usage
├── video-capture/
│   ├── video-capture.component.ts           📝 Modified - Use "Default" label
│   ├── video-capture.component.html         📝 Modified - Pass label to settings panel
│   └── video-capture.component.spec.ts      📝 Modified - Verify label usage
└── video-capture/video-dialog/
    ├── video-dialog.component.ts            📝 Modified - Use "Default" label
    ├── video-dialog.component.html          📝 Modified - Pass label to settings panel
    └── video-dialog.component.spec.ts       📝 Modified - Verify label usage
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Update CRT Settings Panel for Context-Aware Labels</h3></summary>

**Purpose**: Modify the CRT settings panel component to accept a component-provided preset label instead of using the global `CRT_PRESET_LABELS` mapping. This allows each component to display "Default" while internally using size-appropriate presets.

**Related Documentation:**

- [Master Plan - Architecture Overview](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#architecture-overview)
- [CRT Settings Panel Component](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)

**Implementation Subtasks:**

- [ ] **Add `currentPresetLabel` input** to `CrtSettingsPanelComponent`
  - Type: `InputSignal<string>`
  - Purpose: Display text for currently selected preset in dropdown
  - Default: Falls back to `CRT_PRESET_LABELS` if not provided (backward compatibility)

- [ ] **Update `getPresetDisplayName` method** to use provided label
  - Check `currentPresetLabel()` first
  - Fall back to `CRT_PRESET_LABELS[presetName]` for custom presets
  - Return preset name as fallback if no label found

- [ ] **Remove CSS-related preset labels** from `CRT_PRESET_LABELS`
  - Delete SMALL_CSS and LARGE_CSS entries (no longer needed)
  - Keep SMALL_WEBGL and LARGE_WEBGL for backward compatibility with custom presets

- [ ] **Update component template** to use new label resolution
  - Display `getPresetDisplayName(currentPreset())` in dropdown trigger
  - Show "Default" for built-in presets when provided by component
  - Show custom preset names normally

- [ ] **Update unit tests** for new label behavior
  - Test `currentPresetLabel` input binding
  - Test fallback to `CRT_PRESET_LABELS` when input not provided
  - Test custom preset name display
  - Verify backward compatibility

**Key Implementation Notes:**

- Maintain backward compatibility - components not providing `currentPresetLabel` should continue working
- Custom presets always show their saved name, never "Default"
- Built-in preset labels come from parent component context, not global constants
- File structure follows existing component patterns in `libs/ui/components`

</details>

---

<details open>
<summary><h3>Task 2: Update Component Implementations</h3></summary>

**Purpose**: Modify all three CRT-enabled components (file-image, video-capture, video-dialog) to pass "Default" as the preset label to their settings panels, creating a consistent single-preset experience across all contexts.

**Related Documentation:**

- [File Image Component](../../../../libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts)
- [Video Capture Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts)
- [Video Dialog Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts)

**Implementation Subtasks:**

- [ ] **Update FileImageComponent**
  - Add computed signal: `currentPresetLabel = computed(() => 'Default')`
  - Pass `[currentPresetLabel]="currentPresetLabel()"` to settings panel in template
  - Verify settings panel displays "Default" in dropdown
  - Update component tests to verify label

- [ ] **Update VideoCaptureComponent**
  - Add computed signal: `currentPresetLabel = computed(() => 'Default')`
  - Pass `[currentPresetLabel]="currentPresetLabel()"` to settings panel in template  
  - Verify settings panel displays "Default" in dropdown
  - Update component tests to verify label

- [ ] **Update VideoDialogComponent**
  - Add computed signal: `currentPresetLabel = computed(() => 'Default')`
  - Pass `[currentPresetLabel]="currentPresetLabel()"` to settings panel in template
  - Verify settings panel displays "Default" in dropdown
  - Update component tests to verify label

- [ ] **Verify custom preset creation** still works in all components
  - User can create custom presets from current settings
  - Custom presets show their saved name (not "Default")
  - Switching between "Default" and custom presets works correctly

**Key Implementation Notes:**

- All components use SMALL_WEBGL or LARGE_WEBGL internally but display "Default"
- Custom presets remain unchanged - they show their saved name
- Settings panel preset dropdown shows: "Default" (active) and any custom presets
- No changes to storage logic - saved settings remain device-scoped per context

**Expected User Experience:**

```
file-image component:
  Preset dropdown: "Default" (internally SMALL_WEBGL)
  
video-capture component:
  Preset dropdown: "Default" (internally SMALL_WEBGL)
  
video-dialog component:
  Preset dropdown: "Default" (internally LARGE_WEBGL)
  
All components with custom preset:
  Preset dropdown: "Default", "My Custom Preset"
```

</details>

---

## ✅ Success Criteria

- [ ] CRT settings panel accepts `currentPresetLabel` input for component-provided labels
- [ ] All three components display "Default" in their preset dropdown
- [ ] Custom presets continue to show their saved names (not affected)
- [ ] Internal preset architecture (SMALL_WEBGL/LARGE_WEBGL) unchanged
- [ ] Storage keys and saved settings remain backward compatible
- [ ] Users cannot see inappropriate preset options for their context
- [ ] All unit tests passing with updated label expectations
- [ ] Settings panel dropdown UI clean and uncluttered
- [ ] Switching between "Default" and custom presets works correctly

---

## 🧪 Testing Strategy

### Unit Tests

**Settings Panel Component** (~8 tests):
- [ ] `currentPresetLabel` input binding works
- [ ] Falls back to `CRT_PRESET_LABELS` when input not provided
- [ ] Custom preset names display correctly
- [ ] Backward compatibility maintained for existing consumers

**Feature Components** (~15 tests):
- [ ] file-image displays "Default" label
- [ ] video-capture displays "Default" label  
- [ ] video-dialog displays "Default" label
- [ ] Custom preset creation/selection still works
- [ ] Saved settings load correctly (ignore preset names)

### Integration Tests

- [ ] Settings panel renders "Default" when provided by component
- [ ] Preset dropdown shows "Default" + custom presets only
- [ ] No "Small" or "Large" labels visible to users
- [ ] Custom preset creation workflow unaffected
- [ ] Settings persist correctly per device/context

---

## 📝 Implementation Notes

**Discovered During Implementation:**

- Current CSS rendering mode removed - only WebGL presets remain
- Settings panel already supports custom presets alongside built-in presets
- Component initialization logic already handles preset selection correctly
- Storage service remains unchanged - it stores `CrtSettings` objects, not preset names

**Architectural Decisions:**

- **Input-based labels**: Settings panel receives label from parent component instead of looking up global constants
- **Backward compatibility**: Settings panel falls back to `CRT_PRESET_LABELS` for consumers not providing `currentPresetLabel`
- **Custom preset handling**: Custom presets always show their saved name, never "Default"
- **Internal preset keys**: Components continue using `CRT_PRESET_KEYS.SMALL_WEBGL` / `LARGE_WEBGL` internally for type safety

---

## 🔗 Dependencies

### Prerequisites

- **Phase 1 Complete**: Preset structure refactored to SMALL_WEBGL/LARGE_WEBGL only
- **Phase 2 Complete**: Component implementations using new preset structure
- **Phase 3 Complete**: Default values tuned and finalized

### Blockers

- None - this phase is purely presentational changes to existing functionality

---

## 📚 References

- [CRT Settings Panel Component](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)
- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md)
