# Subagent Task Handoff Document

## 📋 Overview

This handoff defines the work for Phase 1 Task 4: UI Controls & Settings Panel Integration for AUTO-CROP-BLACKBARS.

---

## INPUT_DOC

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS  
**Task Name**: Add settings panel toggle for Auto-Crop Border  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small

**What**: Add a Material slide-toggle to the CRT settings panel to enable/disable auto-crop, bind it to the settings model, and ensure changes propagate via the panel’s output.

**Why**: Provides user control for the feature and connects UI to settings domain.

**Success Criteria**:
- [ ] Slide-toggle renders in the "Scanlines & Screen" panel
- [ ] Toggle bound to `settings().autoCropBlackBars`
- [ ] Toggle changes emit through `settingsChange` output
- [ ] Tooltip text: "Automatically remove black borders from video"
- [ ] Unit tests verify render, interaction, emission, tooltip

---

**Prerequisites Completed**:
- Settings property implemented (Task 1) — see [Task 1](./AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS.md)

**Dependencies**:
- Material UI components (`mat-slide-toggle`)
- CRT settings panel structure

**Constraints**:
- UI consistency per Style Guide
- No cross-feature imports; follow library boundaries

---

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` — Add toggle control
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` — Bind and emit changes
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` — Add interaction tests
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-slider-configs.ts` — Export toggle config (if pattern applies)

**UI Structure Example**:

```html
<div class="crt-control-group">
  <mat-slide-toggle
    [ngModel]="settings().autoCropBlackBars"
    (ngModelChange)="onToggleChange('autoCropBlackBars', $event)"
    [matTooltip]="'Automatically remove black borders from video'">
    Auto-Crop Border
  </mat-slide-toggle>
</div>
```

---

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Style Guide](../../../STYLE_GUIDE.md)

**Key Requirements**:
1. Place control in the correct panel grouping;
2. Bind to settings signal and emit changes;
3. Add tooltip and label per copy above;
4. Write tests using `MatSlideToggleHarness` pattern.

**Anti-Patterns to Avoid**:
- Direct DOM manipulation for tooltips
- Ad-hoc event wiring outside established panel methods

---

**Test Coverage Required**:
- [ ] Initial render reflects settings value
- [ ] Click interaction updates value and emits settingsChange
- [ ] Tooltip displays on hover
- [ ] Preset loading updates toggle state accordingly

**Behavioral Expectations**:
- Smooth, intuitive UI toggle with immediate effect

---

**Related Documentation**:
- [Phase 1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md#task-4-ui-controls--settings-panel-integration)
- [Style Guide](../../../STYLE_GUIDE.md)
- [CRT Component Library](../../../COMPONENT_LIBRARY.md#crt-effect-wrapper)

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS — provides the setting
- AUTO-CROP-BLACKBARS-TASK-01-003-SHADER-CROP — consumes the setting

---

## OUTPUT_DOC

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-004-REPORT.md`  
**Report Template**: [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)  
**Return Value**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-004-REPORT.md`

---

### Handoff Complete

Worker subagent: Please execute the task and save your completion report to the specified location.