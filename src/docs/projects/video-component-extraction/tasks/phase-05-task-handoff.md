# Phase 5 Task Handoff: Refactor VideoDialogComponent

## 🎯 Subagent Task Assignment

---

### INPUT_DOC

**Task ID**: TASK-05-001-REFACTOR-VIDEO-DIALOG
**Task Name**: Refactor VideoDialogComponent to Compose New UI Components
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium-Large (3 files, significant changes)

---

## Objective

**What**: Refactor `VideoDialogComponent` to compose `lib-video-stream`, `lib-crt-effect-wrapper`, `lib-content-overlay-container`, and `lib-crt-settings-panel` instead of inline implementation.

**Why**: This validates the extracted component architecture works for the complex video dialog use case, reducing ~400+ lines of SCSS and simplifying component logic by delegating to specialized children.

**Success Criteria**:
- [ ] VideoDialogComponent template uses composed components (not inline implementation)
- [ ] Same `config` passed to both `lib-crt-effect-wrapper` AND `lib-crt-settings-panel` (unified config model)
- [ ] Uses `CRT_CONFIGS.full` for full video dialog CRT experience
- [ ] SCSS reduced by ~400+ lines (CRT effects moved to wrapper)
- [ ] All existing functionality preserved (fullscreen, close, toolbars, CRT effects)
- [ ] All unit tests pass (updated for new structure)
- [ ] Visual appearance matches before refactor

---

## Prerequisites Completed

- ✅ Phase 1: `lib-video-stream` component (encapsulates video element + stream binding)
- ✅ Phase 2: `lib-crt-effect-wrapper` component (CSS-only CRT effects with `config` input)
- ✅ Phase 3: `lib-content-overlay-container` component (9-slot architecture, fullscreen, hover-reveal)
- ✅ Phase 4: `lib-crt-settings-panel` component (unified config model with `config` input)

---

## Dependencies

**New Component Imports**:
- `VideoStreamComponent` from `@libs/ui/components`
- `CrtEffectWrapperComponent` from `@libs/ui/components`
- `ContentOverlayContainerComponent` from `@libs/ui/components`
- `CrtSettingsPanelComponent` from `@libs/ui/components`

**Type/Constant Imports**:
- `CrtSettings`, `CrtSettingsConfig` (interfaces)
- `DEFAULT_CRT_SETTINGS`, `CRT_PRESETS` (settings presets)
- `CRT_CONFIGS`, `DEFAULT_CRT_CONFIG` (feature flag configs)

---

## Constraints

- **No functionality regression**: All existing features must continue working
- **Unified config model**: MUST pass same `config` to both wrapper and settings panel
- **Keep existing tests**: Update tests to work with new structure, don't delete them
- **Preserve visual appearance**: CRT effects should look identical after refactor

---

## File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts` - Simplify logic, add new imports, convert to CrtSettings signal
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.html` - Replace inline implementation with composed components
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.scss` - Remove CRT/overlay styles (now in child components)
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts` - Update tests for new structure

**Files to Review** (for context):
- [Phase 4 Report](../reports/phase-04-report.md) - Critical: unified config model pattern
- [Master Plan](../master-plan.md) - Architecture overview and slot mapping
- [Phase 5 Plan](../phases/phase-05-refactor-video-dialog.md) - Detailed task breakdown

---

## Implementation Guidance

### Complete Slot Mapping

| Current Element | Target Slot | New Content | Notes |
|-----------------|-------------|-------------|-------|
| `.video-wrapper` + `<video>` | `content` | `lib-crt-effect-wrapper` wrapping `lib-video-stream` | Pass `config` to wrapper |
| `.filter-toolbar-overlay` | `topOverlay` | `lib-filter-toolbar` (existing) | Just add slot attribute |
| `.player-toolbar-overlay` | `bottomOverlay` | `lib-player-toolbar` (existing) | Just add slot attribute |
| `.close-button` | `topRightCorner` | `lib-icon-button` with close icon | New component usage |
| `.crt-controls-overlay` | `leftControls` | `lib-crt-settings-panel` | Pass same `config` as wrapper |
| `.right-controls-card` | `rightControls` | Card with icon buttons | CRT toggle, settings toggle, fullscreen |

### Unified Config Pattern (Critical)

Pass the **same config** to both `lib-crt-effect-wrapper` and `lib-crt-settings-panel`. Use `CRT_CONFIGS.full` for video dialog.

### Component Logic Changes

**Remove** (now in child components):
- `afterNextRender` stream attachment → `lib-video-stream`
- `setupFullscreenListener` → `lib-content-overlay-container`
- Individual CRT signals (8) → single `crtSettings` signal
- Inline CRT style bindings → `lib-crt-effect-wrapper`

**Keep**: Dialog data, `onClose()`, CRT toggle, settings panel visibility

**Add**: `crtSettings` signal, `crtConfig` signal, `@ViewChild` for overlay container

### SCSS Cleanup

Remove all CRT effect styles and overlay positioning - now in child components. Keep only dialog-specific overrides.

---

## Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

---

## Anti-Patterns to Avoid

- ❌ Passing different `config` to wrapper and settings panel (breaks unified model)
- ❌ Keeping inline CRT styles in SCSS (should all be in wrapper now)
- ❌ Keeping individual CRT signals (consolidate to single `crtSettings` signal)
- ❌ Removing existing tests (update them instead)
- ❌ Breaking existing functionality (fullscreen, close, toolbars must still work)

---

## Testing Requirements

**Test Coverage Required**:
- [ ] Dialog opens with video stream playing
- [ ] CRT effects apply correctly when enabled
- [ ] CRT toggle enables/disables effects
- [ ] CRT settings panel receives and emits settings correctly
- [ ] Preset selection updates settings
- [ ] Reset button resets to defaults
- [ ] Fullscreen toggle works via overlay container
- [ ] Close button closes dialog
- [ ] Toolbars appear on hover

**Behavioral Expectations**:
- All existing functionality works through composed components
- Visual appearance matches before refactor (no visual regressions)
- Settings panel shows all 8 sliders when `CRT_CONFIGS.full` is used

---

## Reference Materials

**Related Documentation**:
- [Master Plan](../master-plan.md) - Overall architecture
- [Phase 5 Plan](../phases/phase-05-refactor-video-dialog.md) - Detailed implementation tasks
- [Phase 4 Report](../reports/phase-04-report.md) - **CRITICAL**: Unified config model

**Prior Phase Reports**:
- [Phase 1 Report](../reports/phase-01-report.md) - lib-video-stream
- [Phase 2 Report](../reports/phase-02-report.md) - lib-crt-effect-wrapper
- [Phase 3 Report](../reports/phase-03-report.md) - lib-content-overlay-container

**Related Tasks**:
- Phase 6 depends on this phase for pattern validation

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/video-component-extraction/reports/phase-05-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/video-component-extraction/reports/phase-05-report.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.

**Key Reminders**:
1. Read Phase 4 Report first - the unified config model is critical
2. Use `CRT_CONFIGS.full` for video dialog (all features enabled)
3. Pass SAME config to both wrapper and settings panel
4. Migrate incrementally (one step at a time) to catch issues early
