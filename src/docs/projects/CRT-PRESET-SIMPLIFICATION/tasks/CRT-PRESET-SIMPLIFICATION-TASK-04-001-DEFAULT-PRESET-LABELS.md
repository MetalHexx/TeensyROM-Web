# Task Handoff: Default Preset Label Implementation

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-04-001-DEFAULT-PRESET-LABELS
**Task Name**: Implement "Default" Preset Label for All Components
**Assigned To**: UI Wizard (Clean Coder mode)
**Agent Chatmode**: [.github/chat-modes/clean-coder.prompt.md](../../../../.github/chat-modes/clean-coder.prompt.md)
**Priority**: High
**Estimated Context Size**: Medium (8-12 files modified)

---

## 🎯 Objective

**What**: Modify CRT settings panel and feature components to display a single "Default" preset label in each context, while internally maintaining size-based preset architecture (SMALL_WEBGL/LARGE_WEBGL).

**Why**: Eliminates user confusion from seeing multiple context-inappropriate presets (e.g., "Small" in fullscreen dialog, "Large" in thumbnail view). Creates a cleaner UX where each component shows one optimized "Default" option, while preserving the ability to create custom presets.

**Success Criteria**:
- [ ] CRT settings panel accepts `currentPresetLabel` input from parent components
- [ ] file-image component displays "Default" (internally uses SMALL_WEBGL)
- [ ] video-capture component displays "Default" (internally uses SMALL_WEBGL)
- [ ] video-dialog component displays "Default" (internally uses LARGE_WEBGL)
- [ ] Custom presets continue showing their saved names (unaffected)
- [ ] All unit tests updated and passing
- [ ] No CSS preset references remain (WebGL-only architecture)

---

## 📋 Context & Dependencies

**Prerequisites Completed**:
- CSS rendering mode removed - only WebGL presets exist
- Component implementations use SMALL_WEBGL or LARGE_WEBGL internally
- Default values tuned and finalized in earlier phases

**Dependencies**:
- CRT settings panel component must support new input before components can use it
- All three components share the same settings panel component

**Constraints**:
- Must maintain backward compatibility for custom presets
- Storage layer unchanged (stores `CrtSettings` objects, not preset names)
- Settings panel must work with or without `currentPresetLabel` input (progressive enhancement)

---

## 📂 File Scope

**Files to Modify**:

**UI Layer** (Settings Panel):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add `currentPresetLabel` input, update label resolution
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Use new label in dropdown template
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Test new label behavior
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Remove CSS preset labels, document WebGL-only
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` - Update label tests

**Feature Components**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts` - Add `currentPresetLabel` computed signal
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.html` - Pass label to settings panel
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts` - Verify label usage
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts` - Add `currentPresetLabel` computed signal
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.html` - Pass label to settings panel
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts` - Verify label usage
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts` - Add `currentPresetLabel` computed signal
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.html` - Pass label to settings panel
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts` - Verify label usage

**Files to Review** (for context):
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Preset key constants (unchanged)
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Type definitions (unchanged)

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - Component structure, TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [Style Guide](../../../STYLE_GUIDE.md) - Styling conventions

### Implementation Sequence

**Step 1: Update CRT Settings Panel** (Foundation)

**Add input property**:
```typescript
// In crt-settings-panel.component.ts
currentPresetLabel = input<string>(); // Optional - for component-provided labels
```

**Update label resolution method**:
```typescript
protected getPresetDisplayName(presetName: AnyPresetName): string {
  // 1. If component provided a label, use it for built-in presets
  const providedLabel = this.currentPresetLabel();
  if (providedLabel && isBuiltInPreset(presetName)) {
    return providedLabel;
  }
  
  // 2. For custom presets, always show their saved name
  if (!isBuiltInPreset(presetName)) {
    return presetName.replace('custom-', '');
  }
  
  // 3. Fallback to global preset labels (backward compatibility)
  return CRT_PRESET_LABELS[presetName] || presetName;
}
```

**Update template usage**:
```html
<!-- In crt-settings-panel.component.html -->
<mat-select [value]="currentPreset()" (selectionChange)="onPresetSelected($event.value)">
  <mat-option [value]="currentPreset()">
    {{ getPresetDisplayName(currentPreset()) }}
  </mat-option>
  @for (preset of customPresetsSignal(); track preset.name) {
    <mat-option [value]="preset.name">
      {{ getPresetDisplayName(preset.name) }}
    </mat-option>
  }
</mat-select>
```

**Remove CSS preset labels**:
```typescript
// In crt-settings.defaults.ts
// BEFORE: 4 labels (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL)
// AFTER: 2 labels (SMALL_WEBGL, LARGE_WEBGL) for backward compatibility
export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  [CRT_PRESET_KEYS.SMALL_WEBGL]: 'Small (WebGL)',
  [CRT_PRESET_KEYS.LARGE_WEBGL]: 'Large (WebGL)',
  // Note: These labels are used as fallback only. Components should provide their own context-appropriate labels.
};
```

---

**Step 2: Update File-Image Component**

**Add preset label signal**:
```typescript
// In file-image.component.ts
protected readonly currentPresetLabel = computed(() => 'Default');
```

**Pass to settings panel template**:
```html
<!-- In file-image.component.html -->
<lib-crt-settings-panel-overlay
  topLeftCorner
  [config]="crtConfig"
  [crtSettings]="crtSettings()"
  [currentPreset]="CRT_PRESET_KEYS.SMALL_WEBGL"
  [currentPresetLabel]="currentPresetLabel()"
  [validatePresetNameFn]="validatePresetNameFn"
  (settingsChange)="onCrtSettingsChange($event)"
  (presetSelected)="onCrtPresetSelected($event)"
/>
```

**Update tests**:
- Verify dropdown shows "Default" for built-in preset
- Verify custom presets show their saved name
- Verify label changes don't affect settings persistence

---

**Step 3: Update Video-Capture Component**

Same pattern as file-image:
1. Add `currentPresetLabel = computed(() => 'Default')`
2. Pass to settings panel in template
3. Update tests

---

**Step 4: Update Video-Dialog Component**

Same pattern as file-image and video-capture:
1. Add `currentPresetLabel = computed(() => 'Default')`
2. Pass to settings panel in template
3. Update tests

---

### Key Technical Decisions

**Why computed signal for 'Default'?**
- Future-proofing: Could become dynamic based on component state
- Consistency: All components use same pattern
- Testability: Easy to verify and mock

**Why keep `CRT_PRESET_LABELS` as fallback?**
- Backward compatibility for any code not providing `currentPresetLabel`
- Graceful degradation if component forgets to pass label
- Useful during migration/refactoring

**Why not change preset keys?**
- Storage layer unaffected (stores settings objects, not names)
- Type safety maintained with existing `CRT_PRESET_KEYS`
- Internal architecture remains clean and testable

---

## 🧪 Testing Requirements

### Settings Panel Component Tests (~10 tests)

**Label Resolution**:
- [ ] Uses `currentPresetLabel` when provided for built-in presets
- [ ] Falls back to `CRT_PRESET_LABELS` when input not provided
- [ ] Always shows custom preset names (never "Default")
- [ ] Returns preset key as final fallback if no label found

**Backward Compatibility**:
- [ ] Works without `currentPresetLabel` input
- [ ] Existing consumers unaffected by new input
- [ ] Custom preset workflows unchanged

**UI Rendering**:
- [ ] Dropdown trigger shows correct label
- [ ] Custom preset options show saved names
- [ ] Built-in preset shows component-provided label

---

### Feature Component Tests (~15 tests, 5 per component)

**File-Image Component**:
- [ ] `currentPresetLabel()` returns 'Default'
- [ ] Settings panel receives label via input binding
- [ ] Dropdown displays "Default" for SMALL_WEBGL preset
- [ ] Custom preset creation/selection works
- [ ] Settings persistence unaffected

**Video-Capture Component**:
- [ ] `currentPresetLabel()` returns 'Default'
- [ ] Settings panel receives label via input binding
- [ ] Dropdown displays "Default" for SMALL_WEBGL preset
- [ ] Custom preset creation/selection works
- [ ] Settings persistence unaffected

**Video-Dialog Component**:
- [ ] `currentPresetLabel()` returns 'Default'
- [ ] Settings panel receives label via input binding
- [ ] Dropdown displays "Default" for LARGE_WEBGL preset
- [ ] Custom preset creation/selection works
- [ ] Settings persistence unaffected

---

### Integration Verification

**Manual Testing Checklist**:
1. Open file-image component → CRT settings → Verify dropdown shows "Default"
2. Create custom preset in file-image → Verify it shows custom name (not "Default")
3. Open video-capture → CRT settings → Verify dropdown shows "Default"
4. Open video-dialog → CRT settings → Verify dropdown shows "Default"
5. Switch between "Default" and custom preset → Verify settings apply correctly
6. Reload page → Verify saved preset loads correctly

---

## 📊 Expected Outcomes

**Before This Task**:
```
file-image:     Dropdown shows "Small (WebGL)" | "Large (WebGL)"
video-capture:  Dropdown shows "Small (WebGL)" | "Large (WebGL)"
video-dialog:   Dropdown shows "Small (WebGL)" | "Large (WebGL)"
```

**After This Task**:
```
file-image:     Dropdown shows "Default" (internally SMALL_WEBGL)
video-capture:  Dropdown shows "Default" (internally SMALL_WEBGL)
video-dialog:   Dropdown shows "Default" (internally LARGE_WEBGL)

All with custom presets:
                Dropdown shows "Default" | "My Custom Preset"
```

---

## 🎯 Definition of Done

- [ ] Settings panel component accepts `currentPresetLabel` input
- [ ] All three components pass "Default" label to settings panel
- [ ] CSS preset labels removed from `CRT_PRESET_LABELS`
- [ ] Custom presets show their saved name (not affected by label changes)
- [ ] All unit tests passing (settings panel + 3 components)
- [ ] Integration testing confirms correct label display
- [ ] No "Small" or "Large" labels visible in any component
- [ ] Storage persistence unchanged and working
- [ ] Code follows Angular 19 conventions (signals, inputs, outputs)
- [ ] JSDoc comments updated to reflect WebGL-only architecture

---

## 🔗 Related Documentation

- [Phase 4 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-04-DEFAULT-PRESET-IMPLEMENTATION.md)
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md)
- [CRT Settings Panel Component](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)

---

## 💡 Implementation Tips

1. **Start with settings panel** - This is the foundation that components depend on
2. **Test incrementally** - Verify settings panel changes before updating components
3. **Preserve custom presets** - Ensure custom preset workflows remain untouched
4. **Check backward compatibility** - Settings panel should work with or without new input
5. **Follow existing patterns** - Match code style of current component implementations
6. **Update tests as you go** - Don't defer testing to the end

---

## OUTPUT_DOC

When complete, create a task completion report and save it to:

**File Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-04-001-REPORT.md`

Use the template from [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md) and include:

- Summary of changes made to settings panel
- Summary of changes to each component
- Test results (all passing tests)
- Any deviations from plan or unexpected discoveries
- Screenshots or examples of "Default" label in UI
- Confirmation of custom preset workflows still working
