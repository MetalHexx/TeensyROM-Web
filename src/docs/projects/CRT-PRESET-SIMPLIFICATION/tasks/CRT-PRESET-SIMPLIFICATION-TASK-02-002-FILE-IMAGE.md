# Task Handoff: Update File-Image Component

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE  
**Task Name**: Update File-Image Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (3-4 files)

---

## 🎯 Objective

**What**: Refactor file-image component to use SMALL preset with WebGL detection, removing all component-specific CRT overrides.

**Why**: Eliminate special-case override logic (forced curvature, brightness adjustments) for cleaner architecture and consistency with new preset system.

**Success Criteria**:
- [ ] Component uses `CRT_CONFIGS.small` (already correct, verify unchanged)
- [ ] `fileImageDefaultSettings` constant removed
- [ ] Forced `screenCurvature` override removed from saved settings load
- [ ] WebGL detection logic implemented for first-time users
- [ ] Initialization uses SMALL_WEBGL or SMALL_CSS based on detection
- [ ] Saved settings always override detection (backward compatibility)
- [ ] Storage key remains `'file-image'` (unchanged)
- [ ] Imports updated to use SMALL_CSS/SMALL_WEBGL preset keys
- [ ] Component tests updated and passing
- [ ] No regressions in file display functionality

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-01-001 through 01-006: Phase 1 structure refactoring
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: WebGL detection utility created

**Dependencies**:
- `detectWebGLSupport()` from `@teensyrom-nx/infrastructure/utils`
- `CRT_PRESET_KEYS`, `CRT_PRESETS` from domain/UI layers
- `CRT_CONFIGS` (small variant)
- `CrtStorageService` for settings persistence

**Constraints**:
- Must not change storage key (backward compatibility)
- Must load existing saved settings without modification
- Must maintain visual quality of CRT effects
- Must work with device switching (deviceId signal changes)

---

## 📂 File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
  - Remove `fileImageDefaultSettings` constant (lines ~30-40)
  - Update imports to include `detectWebGLSupport` and new preset keys
  - Simplify constructor effect logic
  - Remove curvature override in saved settings load
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts`
  - Update test expectations for new preset keys
  - Mock `detectWebGLSupport` function
  - Add tests for WebGL detection scenarios
  - Remove tests for override behavior (no longer applicable)

**Files to Review** (for context):
- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - Detection utility to use
- `libs/infrastructure/src/lib/crt/crt-storage.service.ts` - Storage service API
- `libs/ui/components/src/lib/crt-configs.const.ts` - Config definitions

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Component testing
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component test patterns
- [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable components

**Key Requirements**:

1. **Remove Override Constant**:
   - Delete `fileImageDefaultSettings` object (currently applies brightness/curvature overrides)
   - This object is no longer needed with proper preset values

2. **Update Imports**:
```typescript
// Add WebGL detection
import { detectWebGLSupport } from '@teensyrom-nx/infrastructure/utils';

// Update preset keys
import { CRT_PRESET_KEYS } from '@teensyrom-nx/domain/models';
// Use SMALL_CSS, SMALL_WEBGL (not IMAGE_CSS, IMAGE_WEBGL)
```

3. **Simplify Initialization Logic**:
   - Priority: Saved settings → WebGL detection → SMALL_WEBGL default
   - Remove curvature override when loading saved settings
   - Pattern:
```typescript
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const saved = this.crtStorage.load(deviceId, 'file-image');
      if (saved) {
        this.crtSettings.set(saved); // No overrides!
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

4. **Verify Config Property**:
   - Should already be `CRT_CONFIGS.small` (from previous work)
   - Just verify it's correct, no changes needed

5. **Component Tests Updates**:
   - Mock `detectWebGLSupport` to control preset selection
   - Test saved settings scenario (detection not called)
   - Test WebGL available scenario (SMALL_WEBGL selected)
   - Test WebGL unavailable scenario (SMALL_CSS selected)
   - Remove tests for curvature override behavior
   - Verify storage key is `'file-image'`

**Anti-Patterns to Avoid**:
- Don't add any new override logic (goal is to remove overrides)
- Don't modify saved settings structure (backward compatibility)
- Don't change storage key
- Don't skip WebGL detection when no saved settings exist

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests** (in `file-image.component.spec.ts`):
- [ ] **Saved settings scenario**: When `crtStorage.load()` returns settings, uses saved values
- [ ] **WebGL available scenario**: When no saved settings and WebGL detected, uses SMALL_WEBGL preset
- [ ] **WebGL unavailable scenario**: When no saved settings and no WebGL, uses SMALL_CSS preset
- [ ] **Config property**: Verifies `crtConfig` is `CRT_CONFIGS.small`
- [ ] **Storage key unchanged**: Confirms storage key is `'file-image'`
- [ ] **Device switching**: When deviceId changes, re-initializes settings correctly

**Behavioral Expectations**:
- Mock `crtStorage.load()` to return:
  - Null (first-time user) → triggers detection
  - Mock settings object → loads directly, no detection
- Mock `detectWebGLSupport()` to return:
  - `true` → expect SMALL_WEBGL preset selected
  - `false` → expect SMALL_CSS preset selected
- Verify no curvature overrides applied to loaded settings
- Verify component renders without errors

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md#initialization-testing) for setup patterns
- Use `TestBed.configureTestingModule` with mocked services
- Use `signal()` test utilities for reactive testing

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan - File-Image Override Removal](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#key-design-decisions)
- [Phase 2 Plan - Task 2](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-2-update-file-image-component)

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: Detection utility (prerequisite)
- CRT-PRESET-SIMPLIFICATION-TASK-02-003-VIDEO-CAPTURE: Similar pattern for video-capture
- CRT-PRESET-SIMPLIFICATION-TASK-02-004-VIDEO-DIALOG: Similar pattern for video-dialog

**Reports from Previous Tasks**:
- [Task 01-001 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-01-001-COMPLETION.md) - Preset keys updated
- [Task 02-001 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-001-REPORT.md) - WebGL detection utility

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Current Override Behavior (to remove)**:
- `fileImageDefaultSettings` applies brightness boost and reduced curvature
- Saved settings had `screenCurvature` forced to 16px on load
- These overrides made file-image inconsistent with other components

**Why Removing Overrides**:
- Small preset will have appropriate default values (Phase 3)
- User customizations should be respected without forced overrides
- Cleaner architecture with preset system as single source of truth

**Backward Compatibility**:
- Existing saved settings continue working without migration
- Storage format unchanged (CrtSettings interface same)
- Only change is removal of forced overrides when loading

**Visual Impact**:
- Small preset will use inherited IMAGE preset values initially
- Phase 3 will tune these values based on user feedback
- No visual regression expected (IMAGE values already optimized for small displays)
