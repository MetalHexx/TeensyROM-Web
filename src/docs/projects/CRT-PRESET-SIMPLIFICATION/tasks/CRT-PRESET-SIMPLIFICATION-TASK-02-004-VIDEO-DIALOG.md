# Task Handoff: Update Video-Dialog Component

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-004-VIDEO-DIALOG  
**Task Name**: Update Video-Dialog Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (3-4 files)

---

## 🎯 Objective

**What**: Refactor video-dialog component to use LARGE preset with WebGL detection, replacing hardcoded settings with clean preset initialization.

**Why**: Eliminate inline hardcoded CRT settings in favor of proper LARGE preset with detection, bringing dialog component in line with new architecture.

**Success Criteria**:
- [ ] Component uses `CRT_CONFIGS.large` (updated from `CRT_CONFIGS.full`)
- [ ] Hardcoded `crtSettings` signal removed
- [ ] WebGL detection logic implemented for first-time users
- [ ] Initialization uses LARGE_WEBGL or LARGE_CSS based on detection
- [ ] Saved settings always override detection (backward compatibility)
- [ ] Storage key remains `'video-dialog'` (unchanged)
- [ ] Imports updated to use LARGE_CSS/LARGE_WEBGL preset keys
- [ ] Component tests updated and passing
- [ ] Dialog functionality unchanged (MAT_DIALOG_DATA, stream handling)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-01-001 through 01-006: Phase 1 structure refactoring
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: WebGL detection utility created
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: File-image component updated (reference pattern)

**Dependencies**:
- `detectWebGLSupport()` from `@teensyrom-nx/infrastructure/utils`
- `CRT_PRESET_KEYS`, `CRT_PRESETS` from domain/UI layers
- `CRT_CONFIGS` (large variant)
- `CrtStorageService` for settings persistence
- `MAT_DIALOG_DATA` for dialog initialization
- `MatDialogRef` for dialog control

**Constraints**:
- Must not change storage key (backward compatibility)
- Must load existing saved settings without modification
- Must maintain dialog functionality (fullscreen video display)
- Dialog receives stream and device via MAT_DIALOG_DATA

---

## 📂 File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
  - Update imports to include `detectWebGLSupport` and new preset keys
  - Update `crtConfig` from `CRT_CONFIGS.full` to `CRT_CONFIGS.large`
  - Remove hardcoded `crtSettings` signal definition
  - Add initialization logic in constructor
  - Replace `DEFAULT_CRT_SETTINGS` usage with LARGE preset
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts`
  - Update test expectations for new preset keys
  - Mock `detectWebGLSupport` function
  - Mock MAT_DIALOG_DATA for dialog tests
  - Add tests for WebGL detection scenarios
  - Verify dialog initialization with data injection

**Files to Review** (for context):
- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - Detection utility
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts` - Reference initialization pattern
- `libs/ui/components/src/lib/crt-configs.const.ts` - Config definitions

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Component testing
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Dialog testing patterns

**Key Requirements**:

1. **Update Imports**:
```typescript
// Add WebGL detection
import { detectWebGLSupport } from '@teensyrom-nx/infrastructure/utils';

// Update preset keys
import { CRT_PRESET_KEYS } from '@teensyrom-nx/domain/models';
// Use LARGE_CSS, LARGE_WEBGL (not FULLSCREEN_CSS, FULLSCREEN_WEBGL)
```

2. **Update Config Property**:
```typescript
// BEFORE
crtConfig = CRT_CONFIGS.full;

// AFTER
crtConfig = CRT_CONFIGS.large;
```

3. **Remove Hardcoded Settings** (current code has inline values):
```typescript
// BEFORE: Hardcoded signal with many inline values
crtSettings = signal<CrtSettings>({
  scanlineIntensity: 0.50,
  scanlineSize: 2.5,
  vignetteStrength: 1.30,
  vignetteSize: 0.85,
  // ... many more hardcoded values
});
```

4. **Add Detection-Based Initialization**:
```typescript
// AFTER: Signal initialized in constructor with detection logic
crtSettings = signal<CrtSettings>({} as CrtSettings);

constructor(
  @Inject(MAT_DIALOG_DATA) protected data: VideoDialogData,
  protected dialogRef: MatDialogRef<VideoDialogComponent>,
  private crtStorage: CrtStorageService
) {
  effect(() => {
    const deviceId = this.data.deviceId;
    if (deviceId) {
      const saved = this.crtStorage.load(deviceId, 'video-dialog');
      if (saved) {
        this.crtSettings.set(saved);
      } else {
        // First-time: detect WebGL
        const hasWebGL = detectWebGLSupport();
        const presetKey = hasWebGL 
          ? CRT_PRESET_KEYS.LARGE_WEBGL 
          : CRT_PRESET_KEYS.LARGE_CSS;
        this.crtSettings.set(CRT_PRESETS[presetKey]);
      }
    }
  }, { allowSignalWrites: true });
}
```

5. **Dialog Data Access**:
   - Dialog receives `data: VideoDialogData` with `deviceId` and `stream`
   - Use `this.data.deviceId` for storage key (not `this.deviceId()` signal)
   - Stream is accessed via `this.data.stream`

6. **Component Tests Updates**:
   - Mock `MAT_DIALOG_DATA` with test device ID and mock stream
   - Mock `MatDialogRef` for dialog control tests
   - Mock `detectWebGLSupport` to control preset selection
   - Test saved settings scenario (detection not called)
   - Test WebGL available scenario (LARGE_WEBGL selected)
   - Test WebGL unavailable scenario (LARGE_CSS selected)
   - Verify storage key is `'video-dialog'`
   - Verify dialog functionality (fullscreen toggle, close)

**Anti-Patterns to Avoid**:
- Don't modify saved settings structure
- Don't change storage key
- Don't skip WebGL detection when no saved settings exist
- Don't break dialog data injection pattern

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests** (in `video-dialog.component.spec.ts`):
- [ ] **Saved settings scenario**: When `crtStorage.load()` returns settings, uses saved values
- [ ] **WebGL available scenario**: When no saved settings and WebGL detected, uses LARGE_WEBGL preset
- [ ] **WebGL unavailable scenario**: When no saved settings and no WebGL, uses LARGE_CSS preset
- [ ] **Config property**: Verifies `crtConfig` is `CRT_CONFIGS.large`
- [ ] **Storage key unchanged**: Confirms storage key is `'video-dialog'`
- [ ] **Dialog data injection**: Verifies component receives deviceId and stream from MAT_DIALOG_DATA
- [ ] **Dialog functionality**: Close, fullscreen toggle still work

**Behavioral Expectations**:
- Mock `MAT_DIALOG_DATA` with:
  ```typescript
  { deviceId: 'test-device', stream: mockMediaStream }
  ```
- Mock `MatDialogRef` for close/fullscreen tests
- Mock `crtStorage.load()` to return:
  - Null (first-time user) → triggers detection
  - Mock settings object → loads directly, no detection
- Mock `detectWebGLSupport()` to return:
  - `true` → expect LARGE_WEBGL preset selected
  - `false` → expect LARGE_CSS preset selected
- Verify component renders video stream without errors

**Testing Reference**:
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md#dialog-testing) for dialog patterns
- Reference file-image component tests for initialization pattern
- Use Angular Material testing utilities for dialog testing

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan - Dialog Component](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#phase-2-component-implementation)
- [Phase 2 Plan - Task 4](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-4-update-video-dialog-component)

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: Detection utility (prerequisite)
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: Reference initialization pattern (completed)
- CRT-PRESET-SIMPLIFICATION-TASK-02-003-VIDEO-CAPTURE: Video component pattern (completed)

**Reports from Previous Tasks**:
- [Task 02-001 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-001-REPORT.md) - WebGL detection utility
- [Task 02-002 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-002-REPORT.md) - File-image pattern
- [Task 02-003 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-003-REPORT.md) - Video-capture pattern

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Current Behavior**:
- Component has hardcoded `crtSettings` signal with inline values
- Uses `CRT_CONFIGS.full` (renamed to `large` in Phase 1)
- Storage key is `'video-dialog'`
- Dialog initialized via MAT_DIALOG_DATA injection

**Why This Change**:
- Consistency: All components use same detection pattern
- Clean architecture: No hardcoded settings in components
- Maintainability: Preset values managed in one place
- User-friendly: CSS fallback for browsers without WebGL

**Component Context**:
- Video-dialog is fullscreen modal for video playback
- Opened from video-capture compact view
- Large display area requires prominent CRT effects (LARGE preset appropriate)
- Dialog manages its own fullscreen toggle and close behavior

**Backward Compatibility**:
- Existing saved settings continue working
- Storage format unchanged
- Dialog initialization pattern unchanged (still uses MAT_DIALOG_DATA)
- Only affects first-time users (no saved settings)

**Dialog Data Structure**:
```typescript
interface VideoDialogData {
  deviceId: string;
  stream: MediaStream;
}
```
