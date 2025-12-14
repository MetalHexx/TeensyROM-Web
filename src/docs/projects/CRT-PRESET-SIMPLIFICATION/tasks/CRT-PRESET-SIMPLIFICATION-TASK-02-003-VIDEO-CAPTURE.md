# Task Handoff: Update Video-Capture Component

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-003-VIDEO-CAPTURE  
**Task Name**: Update Video-Capture Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (3-4 files)

---

## 🎯 Objective

**What**: Refactor video-capture component to use SMALL preset with WebGL detection for first-time users.

**Why**: Replace hardcoded IMAGE_WEBGL preset with intelligent detection-based initialization, maintaining consistency with file-image component.

**Success Criteria**:
- [ ] Component uses `CRT_CONFIGS.small` (verify unchanged)
- [ ] WebGL detection logic implemented for first-time users
- [ ] Hardcoded IMAGE_WEBGL preset reference replaced with detection logic
- [ ] Initialization uses SMALL_WEBGL or SMALL_CSS based on detection
- [ ] Saved settings always override detection (backward compatibility)
- [ ] Storage key remains `'video-compact'` (unchanged)
- [ ] Imports updated to use SMALL_CSS/SMALL_WEBGL preset keys
- [ ] Component tests updated and passing
- [ ] No regressions in video capture functionality

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-01-001 through 01-006: Phase 1 structure refactoring
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: WebGL detection utility created
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: File-image component updated (reference pattern)

**Dependencies**:
- `detectWebGLSupport()` from `@teensyrom-nx/infrastructure/utils`
- `CRT_PRESET_KEYS`, `CRT_PRESETS` from domain/UI layers
- `CRT_CONFIGS` (small variant)
- `CrtStorageService` for settings persistence
- Video device enumeration (MediaDevices API)

**Constraints**:
- Must not change storage key (backward compatibility)
- Must load existing saved settings without modification
- Must maintain video capture and device switching functionality
- Must keep compact display styling (`CRT_CONFIGS.small`)

---

## 📂 File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
  - Update imports to include `detectWebGLSupport` and new preset keys
  - Replace hardcoded `CRT_PRESETS[CRT_PRESET_KEYS.IMAGE_WEBGL]` with detection logic
  - Verify `crtConfig` is `CRT_CONFIGS.small` (should already be correct)
  - Update constructor initialization pattern
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`
  - Update test expectations for new preset keys
  - Mock `detectWebGLSupport` function
  - Add tests for WebGL detection scenarios
  - Update device enumeration tests to work with new initialization

**Files to Review** (for context):
- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - Detection utility
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts` - Reference pattern
- `libs/infrastructure/src/lib/video/video-device.service.ts` - Video device API

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Component testing
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component test patterns

**Key Requirements**:

1. **Update Imports**:
```typescript
// Add WebGL detection
import { detectWebGLSupport } from '@teensyrom-nx/infrastructure/utils';

// Update preset keys
import { CRT_PRESET_KEYS } from '@teensyrom-nx/domain/models';
// Use SMALL_CSS, SMALL_WEBGL (not IMAGE_CSS, IMAGE_WEBGL)
```

2. **Replace Hardcoded Preset** (current code reference):
```typescript
// BEFORE: Hardcoded IMAGE_WEBGL
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const saved = this.crtStorage.load(deviceId, 'video-compact');
      if (saved) {
        this.crtSettings.set(saved);
      } else {
        // Currently hardcoded:
        this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.IMAGE_WEBGL]);
      }
    }
  }, { allowSignalWrites: true });
}

// AFTER: Detection-based initialization
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const saved = this.crtStorage.load(deviceId, 'video-compact');
      if (saved) {
        this.crtSettings.set(saved);
      } else {
        // First-time: detect WebGL
        const hasWebGL = detectWebGLSupport();
        const presetKey = hasWebGL 
          ? CRT_PRESET_KEYS.SMALL_WEBGL 
          : CRT_PRESET_KEYS.SMALL_CSS;
        this.crtSettings.set(CRT_PRESETS[presetKey]);
      }
    }
  }, { allowSignalWrites: true });
}
```

3. **Verify Config Property**:
   - Should already be `CRT_CONFIGS.small`
   - Just verify it's correct, no changes needed

4. **Video Device Integration**:
   - Component uses `videoDeviceService.enumerateDevices()`
   - This functionality is unrelated to CRT settings
   - Ensure video device enumeration still works correctly

5. **Component Tests Updates**:
   - Mock `detectWebGLSupport` to control preset selection
   - Test saved settings scenario (detection not called)
   - Test WebGL available scenario (SMALL_WEBGL selected)
   - Test WebGL unavailable scenario (SMALL_CSS selected)
   - Verify storage key is `'video-compact'`
   - Verify video device enumeration still works

**Anti-Patterns to Avoid**:
- Don't modify saved settings structure
- Don't change storage key
- Don't skip WebGL detection when no saved settings exist
- Don't interfere with video device enumeration logic

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests** (in `video-capture.component.spec.ts`):
- [ ] **Saved settings scenario**: When `crtStorage.load()` returns settings, uses saved values
- [ ] **WebGL available scenario**: When no saved settings and WebGL detected, uses SMALL_WEBGL preset
- [ ] **WebGL unavailable scenario**: When no saved settings and no WebGL, uses SMALL_CSS preset
- [ ] **Config property**: Verifies `crtConfig` is `CRT_CONFIGS.small`
- [ ] **Storage key unchanged**: Confirms storage key is `'video-compact'`
- [ ] **Device switching**: When deviceId changes, re-initializes settings correctly
- [ ] **Video enumeration**: Device enumeration still works (no regression)

**Behavioral Expectations**:
- Mock `crtStorage.load()` to return:
  - Null (first-time user) → triggers detection
  - Mock settings object → loads directly, no detection
- Mock `detectWebGLSupport()` to return:
  - `true` → expect SMALL_WEBGL preset selected
  - `false` → expect SMALL_CSS preset selected
- Mock `videoDeviceService.enumerateDevices()` for device tests
- Verify component renders video stream without errors

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md#initialization-testing)
- Reference file-image component tests for pattern
- Use `TestBed.configureTestingModule` with mocked services

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan - Component Initialization](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#phase-2-component-implementation)
- [Phase 2 Plan - Task 3](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-3-update-video-capture-component)

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: Detection utility (prerequisite)
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: Reference pattern (completed)
- CRT-PRESET-SIMPLIFICATION-TASK-02-004-VIDEO-DIALOG: Similar pattern for dialog

**Reports from Previous Tasks**:
- [Task 02-001 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-001-REPORT.md) - WebGL detection utility
- [Task 02-002 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-002-REPORT.md) - File-image pattern

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Current Behavior**:
- Component already uses `CRT_CONFIGS.small` (correct for compact display)
- Currently hardcodes IMAGE_WEBGL preset for first-time users
- Storage key is `'video-compact'` (different from other components)

**Why This Change**:
- Consistency: All components use same detection pattern
- User-friendly: CSS fallback for browsers without WebGL
- Clean architecture: No hardcoded preset references in components

**Component Context**:
- Video-capture shows live video stream in compact view
- Used when streaming video from TeensyROM device
- Small display area requires subtle CRT effects (SMALL preset appropriate)

**Backward Compatibility**:
- Existing saved settings continue working
- Storage format unchanged
- Only affects first-time users (no saved settings)
