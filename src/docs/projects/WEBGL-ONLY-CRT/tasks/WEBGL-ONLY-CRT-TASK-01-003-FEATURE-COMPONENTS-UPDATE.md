# Task Handoff: Feature Components Update

**Task ID**: WEBGL-ONLY-CRT-TASK-01-003-FEATURE-COMPONENTS-UPDATE  
**Task Name**: Remove WebGL Detection from Player Components  
**Assigned To**: Clean Coder  
**Priority**: High  
**Estimated Context Size**: Medium (6-9 files)

---

## 🎯 Objective

**What**: Remove WebGL detection logic from file-image, video-capture, and video-dialog components. Simplify initialization to directly use WebGL presets without detection conditionals.

**Why**: WebGL detector service is removed, and CSS rendering mode no longer exists. Components should directly load WebGL presets or saved settings.

**Success Criteria**:
- [ ] WEBGL_DETECTOR injection removed from all components
- [ ] Detection logic removed from constructors/effects
- [ ] file-image uses SMALL_WEBGL preset by default
- [ ] video-capture uses SMALL_WEBGL preset by default
- [ ] video-dialog uses LARGE_WEBGL preset by default
- [ ] Saved settings load correctly (renderMode ignored if present)
- [ ] 40+ component tests passing

---

## 📋 Context & Dependencies

**Prerequisites Completed**:
- WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP
- WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR

**Dependencies**:
- Domain layer no longer exports WEBGL_DETECTOR
- CSS presets removed from CRT_PRESETS
- CrtSettings no longer has renderMode property

**Constraints**:
- Must preserve saved settings backward compatibility
- Must maintain existing storage keys (file-image, video-compact, video-dialog)
- Must follow Angular 19 patterns

---

## 📂 File Scope

**Files to MODIFY**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Tests to UPDATE**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts`

---

## 🛠️ Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

### Part 1: Update File-Image Component

**Current Behavior** (needs fixing):
```typescript
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const savedSettings = this.crtStorage.load(deviceId, 'file-image');
      if (savedSettings) {
        this.crtSettings.set(savedSettings);
      } else {
        // First-time user: detect WebGL support
        const hasWebGL = this.webglDetector.isSupported();  // ❌ Remove this
        const presetKey = hasWebGL 
          ? CRT_PRESET_KEYS.SMALL_WEBGL 
          : CRT_PRESET_KEYS.SMALL_CSS;  // ❌ CSS preset gone
        this.crtSettings.set(CRT_PRESETS[presetKey]);
      }
    }
  }, { allowSignalWrites: true });
}
```

**New Behavior**:
1. Remove `WEBGL_DETECTOR` injection
2. Remove `webglDetector` field
3. Simplify effect logic:
   - If saved settings exist, use them (as before)
   - If no saved settings, use `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]` directly
   - No detection conditionals

### Part 2: Update Video-Capture Component

**Current Behavior** (needs fixing):
- Similar detection logic in constructor effect
- Uses SMALL_CSS or SMALL_WEBGL based on detection
- Storage key: `'video-compact'`

**New Behavior**:
1. Remove `WEBGL_DETECTOR` injection
2. Remove detection logic
3. Default to `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]`
4. Keep storage key unchanged (`'video-compact'`)

### Part 3: Update Video-Dialog Component

**Current Behavior** (needs fixing):
- Similar detection logic in constructor effect
- Uses LARGE_CSS or LARGE_WEBGL based on detection
- Storage key: `'video-dialog'`

**New Behavior**:
1. Remove `WEBGL_DETECTOR` injection
2. Remove detection logic
3. Default to `CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL]`
4. Keep storage key unchanged (`'video-dialog'`)

### Part 4: Clean Up Imports

Remove from all three components:
```typescript
import { WEBGL_DETECTOR } from '@teensyrom-nx/domain';  // ❌ Remove
private readonly webglDetector = inject(WEBGL_DETECTOR);  // ❌ Remove
```

Keep these imports (still needed):
```typescript
import { CRT_STORAGE, CrtSettings } from '@teensyrom-nx/domain';
import { CRT_PRESETS, CRT_PRESET_KEYS } from '@teensyrom-nx/ui/components';
```

### Part 5: Simplified Initialization Pattern

**Recommended Pattern** for all three components:

```typescript
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const savedSettings = this.crtStorage.load(deviceId, '<storage-key>');
      if (savedSettings) {
        this.crtSettings.set(savedSettings);
      } else {
        this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.<PRESET_NAME>]);
      }
    }
  }, { allowSignalWrites: true });
}
```

Replace `<storage-key>` and `<PRESET_NAME>` appropriately per component.

---

## 🧪 Testing Requirements

**Unit Tests** (40+ tests):

**File-Image Component** (~13 tests):
- [ ] Initializes with SMALL_WEBGL when no saved settings
- [ ] Loads saved settings when available
- [ ] Ignores renderMode if present in saved settings
- [ ] No WEBGL_DETECTOR injection attempts
- [ ] CRT settings update correctly via onCrtSettingsChange
- [ ] Preset selection works (onCrtPresetSelected)
- [ ] All existing tests still pass

**Video-Capture Component** (~13 tests):
- [ ] Initializes with SMALL_WEBGL when no saved settings
- [ ] Loads saved settings when available
- [ ] Ignores renderMode if present in saved settings
- [ ] No WEBGL_DETECTOR injection attempts
- [ ] CRT settings update correctly
- [ ] Video device selection still works
- [ ] All existing tests still pass

**Video-Dialog Component** (~14 tests):
- [ ] Initializes with LARGE_WEBGL when no saved settings
- [ ] Loads saved settings when available
- [ ] Ignores renderMode if present in saved settings
- [ ] No WEBGL_DETECTOR injection attempts
- [ ] CRT settings update correctly
- [ ] Dialog controls still work
- [ ] All existing tests still pass

**Test Strategy**:
```bash
# Baseline before changes
pnpm nx test player --watch=false

# Run tests in watch mode as you update each component
pnpm nx test player --watch

# Final verification
pnpm nx test player --watch=false
pnpm nx lint player
```

**Mock Updates Needed**:

All test files currently have:
```typescript
const mockWebGLDetector: IWebGLDetector = {
  isSupported: vi.fn().mockReturnValue(true),
};

// In TestBed
{ provide: WEBGL_DETECTOR, useValue: mockWebGLDetector }
```

**Remove this mock** from all test files. Tests should no longer need WebGL detector.

---

## ⚠️ Important Notes

### Backward Compatibility

Saved settings may contain old renderMode property:
```json
{
  "renderMode": "css",  // Ignored
  "scanlineIntensity": 0.5,
  "brightness": 1.3
  // ... other valid settings
}
```

The `crtStorage.load()` method will return these settings as-is. Component simply applies them to `crtSettings` signal. The crt-effect-wrapper component (Task 2) handles ignoring renderMode.

### Storage Keys Unchanged

Do NOT change these storage keys (backward compatibility):
- file-image: `'file-image'`
- video-capture: `'video-compact'`
- video-dialog: `'video-dialog'`

### Preset Selection Logic

All preset selection logic in `onCrtPresetSelected` methods should still work:
- Built-in presets: Load from CRT_PRESETS (now only SMALL_WEBGL, LARGE_WEBGL)
- Custom presets: Load from storage (as before)

No changes needed to preset selection logic.

---

## 📤 Output

**Report Location**: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-003-REPORT.md`

**Report Template**: [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

---

## ✅ Definition of Done

- [ ] WEBGL_DETECTOR removed from all 3 components
- [ ] Detection logic removed from initialization
- [ ] Components use correct WebGL presets by default
- [ ] Saved settings load correctly
- [ ] All imports cleaned up
- [ ] 40+ component tests passing
- [ ] No TypeScript compilation errors
- [ ] No console errors in dev mode
- [ ] Completion report written
