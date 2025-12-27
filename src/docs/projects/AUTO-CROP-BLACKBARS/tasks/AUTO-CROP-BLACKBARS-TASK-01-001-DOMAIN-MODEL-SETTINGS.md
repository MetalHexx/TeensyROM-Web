# Subagent Task Handoff Document

## 📋 Overview

This handoff defines the work for Phase 1 Task 1: Domain Model & Settings Infrastructure for AUTO-CROP-BLACKBARS.

---

## INPUT_DOC

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS  
**Task Name**: Add `autoCropBlackBars` to CRT settings and defaults  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation)  
**Estimated Context Size**: Small

**What**: Add a new boolean setting `autoCropBlackBars` to the CRT settings domain model and ensure it flows through the settings interface, defaults, presets, and persistence.

**Why**: This enables users to toggle the auto-crop feature and ensures consistent initialization and persistence of the setting across sessions and presets.

**Success Criteria**:
- [ ] `CrtSettings` includes `autoCropBlackBars: boolean`
- [ ] `DEFAULT_CRT_SETTINGS` includes `autoCropBlackBars: true`
- [ ] All CRT presets include the property with `true` default
- [ ] Re-export of `CrtSettings` remains correct via interface barrel
- [ ] Setting persists via existing CRT storage
- [ ] Unit tests verify defaults, persistence, and preset behavior

---

**Prerequisites Completed**:
- Phase plan available: [Phase 1: Core Detection & Cropping Infrastructure](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md)

**Dependencies**:
- Existing CRT settings model and interface
- CRT storage service used for persistence
- Preset configuration files for CRT settings

**Constraints**:
- Default should be `true` (feature enabled by default)
- Backward compatibility: no migration; default fills when absent

---

**Files to Create/Modify**:
- `libs/domain/src/lib/models/crt-settings.model.ts` — Add `autoCropBlackBars: boolean` to `CrtSettings`
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` — Add `autoCropBlackBars: true` in `DEFAULT_CRT_SETTINGS` and all presets
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper/crt-settings.interface.ts` — Verify/maintain re-export of `CrtSettings`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` — Extend tests for preset/default loading (if pattern exists)

**Files to Review** (patterns):
- [CRT Settings Interface](../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts)
- [CRT Settings Defaults](../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

---

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Style Guide](../../../STYLE_GUIDE.md) (UI panel consistency)

**Key Requirements**:
1. Update `CrtSettings` with `autoCropBlackBars: boolean`;
2. Default to `true` across `DEFAULT_CRT_SETTINGS` and presets;
3. Ensure barrel/interface exports remain correct;
4. Verify persistence via existing CRT storage (mock in tests);
5. No code-side migrations; rely on defaults.

**Anti-Patterns to Avoid**:
- Adding complex logic to settings model (keep pure data)
- Hardcoding defaults outside the `.defaults.ts` file
- Editing generated code or unrelated settings

---

**Test Coverage Required**:
- [ ] Default value propagates when not present in storage
- [ ] Persistence tested via storage mock (survives refresh)
- [ ] Preset loading includes the property and toggles UI state

**Behavioral Expectations**:
- New setting appears in model and populates UI via defaults/presets
- No runtime errors when old saved settings lack this property

---

**Related Documentation**:
- [Phase 1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md#task-1-domain-model--settings-infrastructure)
- [Feature PRD](../PRD.md)
- [CRT Component Library](../../../COMPONENT_LIBRARY.md#crt-effect-wrapper)

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS (toggle relies on this setting)

---

## OUTPUT_DOC

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-001-REPORT.md`  
**Report Template**: [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)  
**Return Value**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-001-REPORT.md`

---

### Handoff Complete

Worker subagent: Please execute the task and save your completion report to the specified location.