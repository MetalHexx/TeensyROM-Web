# Task 05-001: Rename Presets & Add Image Preset

**Phase**: 5 - Preset Rename & Context Separation  
**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-05-001  
**Size**: Medium (8 files)  
**Estimated Time**: 45-60 minutes

---

## 🎯 Task Objective

Rename existing CRT presets from size-based naming (SMALL_WEBGL, LARGE_WEBGL) to context-based naming (SMALL_VIDEO_WEBGL, LARGE_VIDEO_WEBGL) and add a new dedicated image preset (SMALL_IMAGE_WEBGL). Update all references across domain, UI, and feature layers to use the new preset keys and ensure each component type uses its context-appropriate default.

**Why This Matters**: 
- Semantic naming clarifies intent (video capture vs. static image viewing)
- Dedicated image preset allows future optimization for static content
- Maintains clean separation between video and image rendering contexts

---

## 📚 Required Reading

**Before starting, review**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - TypeScript patterns, const naming
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Test update patterns

**Context Documents**:
- [Phase 5 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-05-PRESET-RENAME.md)
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md)

---

## 📂 Files to Modify

### Domain Layer (2 files)
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Update preset keys
- `libs/domain/src/lib/models/crt-preset-names.const.spec.ts` - Update tests

### UI Components Layer (3 files)
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update preset definitions
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts` - Update tests
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Update default reference

### Features Layer (3 files)
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`

---

## 🔧 Implementation Steps

### Step 1: Update Domain Layer Constants

**File**: `libs/domain/src/lib/models/crt-preset-names.const.ts`

**Changes**:
1. Rename `SMALL_WEBGL` constant key to `SMALL_VIDEO_WEBGL`
2. Update its value from `default-small-webgl` to `default-small-video-webgl`
3. Rename `LARGE_WEBGL` constant key to `LARGE_VIDEO_WEBGL`
4. Update its value from `default-large-webgl` to `default-large-video-webgl`
5. Add new constant key `SMALL_IMAGE_WEBGL` with value `default-small-image-webgl`
6. Update JSDoc comment to mention three presets (Small Video, Large Video, Small Image)

**Expected Result**:
```typescript
export const CRT_PRESET_KEYS = {
  SMALL_VIDEO_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}small-video-webgl`,
  LARGE_VIDEO_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}large-video-webgl`,
  SMALL_IMAGE_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}small-image-webgl`,
} as const;
```

---

### Step 2: Update Domain Layer Tests

**File**: `libs/domain/src/lib/models/crt-preset-names.const.spec.ts`

**Changes**:
1. Update test "should have exactly 2 preset keys" → "should have exactly 3 preset keys"
2. Change assertion from `toHaveLength(2)` to `toHaveLength(3)`
3. Update "should have SMALL_WEBGL and LARGE_WEBGL keys" test
   - Add assertion for `SMALL_IMAGE_WEBGL`
   - Update test name to reflect all three keys
4. Update "should use correct preset key values" test
   - Add assertion for `SMALL_IMAGE_WEBGL` value
   - Update existing assertions for renamed keys
5. Update any other tests referencing the old key names

**Key Test Updates**:
- `expect(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL).toBe('default-small-video-webgl')`
- `expect(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL).toBe('default-large-video-webgl')`
- `expect(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL).toBe('default-small-image-webgl')`

---

### Step 3: Update UI Layer Preset Definitions

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Changes**:
1. Update `CRT_PRESETS` object:
   - Rename `[CRT_PRESET_KEYS.SMALL_WEBGL]` key to `[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]`
   - Rename `[CRT_PRESET_KEYS.LARGE_WEBGL]` key to `[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]`
   - Add new `[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]` entry
2. Copy the SMALL_VIDEO_WEBGL configuration for SMALL_IMAGE_WEBGL (identical for now)
3. Update JSDoc comments:
   - Update preset documentation to reflect "Small Video", "Large Video", "Small Image"
   - Update "Ideal for" comments to clarify video vs. image contexts

**New Preset Config** (copy from SMALL_VIDEO_WEBGL):
```typescript
[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]: {
  scanlineIntensity: 0.3,
  scanlineSize: 1.5,
  vignetteStrength: 0.7,
  screenCurvature: 0,
  contrast: 1.05,
  brightness: 1.3,
  saturation: 1.15,
  hue: 0,
  phosphorPattern: CRT_PHOSPHOR_PATTERNS.APERTURE_GRILLE,
  phosphorIntensity: 0.1,
  bloomEnabled: false,
  bloomIntensity: 0,
  bloomRadius: 1,
  barrelDistortion: 0,
  chromaticAberration: 0,
},
```

---

### Step 4: Update UI Layer Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts`

**Changes**:
1. Update all test assertions using old key names to use new names
2. Tests to update:
   - `isBuiltInPreset()` tests - use `SMALL_VIDEO_WEBGL`, `LARGE_VIDEO_WEBGL`, `SMALL_IMAGE_WEBGL`
   - `isCustomPreset()` tests - use new key names
   - `stripCustomPrefix()` tests - use new key names if referenced
   - Any other tests checking preset key values

**Example Test Update**:
```typescript
// Before
expect(isBuiltInPreset(CRT_PRESET_KEYS.SMALL_WEBGL)).toBe(true);

// After
expect(isBuiltInPreset(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL)).toBe(true);
```

---

### Step 5: Update Settings Panel Default Reference

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

**Changes**:
1. Find the default preset emission (line ~554)
2. Update from `CRT_PRESET_KEYS.LARGE_WEBGL` to `CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL`

**Expected Change**:
```typescript
// Before
this.presetSelected.emit(CRT_PRESET_KEYS.LARGE_WEBGL);

// After
this.presetSelected.emit(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);
```

---

### Step 6: Update Video Capture Component

**File**: `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`

**Changes**:
1. Update default preset in constructor (line ~104):
   - Change `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]` to `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]`
2. Update `excludePresets` computed property:
   - Change from excluding `[CRT_PRESET_KEYS.LARGE_WEBGL]`
   - To excluding `[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL, CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]`

**Expected Code**:
```typescript
// Default preset update
this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);

// Exclusion list update
protected readonly excludePresets = computed(() => [
  CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL,
  CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL
]);
```

---

### Step 7: Update Video Dialog Component

**File**: `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Changes**:
1. Update default preset reference:
   - Find usages of `CRT_PRESET_KEYS.LARGE_WEBGL`
   - Replace with `CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL`
2. Update `excludePresets` computed property:
   - Change from excluding `[CRT_PRESET_KEYS.SMALL_WEBGL]`
   - To excluding `[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL, CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]`

**Expected Code**:
```typescript
// Exclusion list update
protected readonly excludePresets = computed(() => [
  CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL,
  CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL
]);
```

---

### Step 8: Update File Image Component

**File**: `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`

**Changes**:
1. Update default preset in constructor (line ~77):
   - Change `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]` to `CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]`
2. Update `excludePresets` computed property:
   - Change from excluding `[CRT_PRESET_KEYS.LARGE_WEBGL]`
   - To excluding `[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL, CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]`

**Expected Code**:
```typescript
// Default preset update
this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]);

// Exclusion list update
protected readonly excludePresets = computed(() => [
  CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL,
  CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL
]);
```

---

## 🧪 Testing Plan

### Unit Tests

**Run tests for each affected library**:

```bash
# Domain layer
pnpm nx test domain --watch=false

# UI Components layer
pnpm nx test ui-components --watch=false

# Features layer (player)
pnpm nx test player --watch=false
```

**Expected Results**:
- All existing tests should pass after updates
- No new test failures introduced
- TypeScript compilation succeeds with no errors

### Manual Verification

**Test each component in browser**:

1. **Video Capture Component**:
   - Load app with video device
   - Open CRT settings
   - Verify "Default" is shown (not "Small Video")
   - Verify SMALL_VIDEO_WEBGL preset is used

2. **Video Dialog Component**:
   - Open fullscreen video dialog
   - Open CRT settings
   - Verify "Default" is shown (not "Large Video")
   - Verify LARGE_VIDEO_WEBGL preset is used

3. **File Image Component**:
   - View static image content
   - Open CRT settings
   - Verify "Default" is shown (not "Small Image")
   - Verify SMALL_IMAGE_WEBGL preset is used

4. **Custom Presets**:
   - Create a custom preset in any component
   - Verify it saves and loads correctly
   - Verify custom presets still appear alongside "Default"

---

## ✅ Success Criteria

- [ ] Domain layer exports 3 preset keys with semantic names
- [ ] UI layer defines 3 preset configurations
- [ ] All component references updated to use new keys
- [ ] Video capture uses SMALL_VIDEO_WEBGL and excludes video-dialog/image presets
- [ ] Video dialog uses LARGE_VIDEO_WEBGL and excludes video-capture/image presets
- [ ] File image uses SMALL_IMAGE_WEBGL and excludes both video presets
- [ ] All unit tests pass (`domain`, `ui-components`, `player`)
- [ ] No TypeScript compilation errors
- [ ] Manual verification: each component shows only "Default" in dropdown
- [ ] Custom presets still function correctly

---

## 🚧 Implementation Notes

**Notes During Implementation**:

<!-- Add notes here as you work -->

---

## 📊 Task Completion Report

**Implementation Summary**:

<!-- Fill this in after completing the task -->

**Changes Made**:
- [ ] Domain constants updated
- [ ] Domain tests updated
- [ ] UI preset definitions updated
- [ ] UI tests updated
- [ ] Settings panel updated
- [ ] Video capture component updated
- [ ] Video dialog component updated
- [ ] File image component updated

**Test Results**:
- Domain tests: [ ] Pass / [ ] Fail
- UI Components tests: [ ] Pass / [ ] Fail
- Player tests: [ ] Pass / [ ] Fail

**Issues Encountered**: 

<!-- List any blockers or unexpected issues -->

**Technical Debt Created**: 

<!-- Note any items to add to TECHNICAL_DEBT.md -->

---

## 🔗 Related

- **Phase**: [Phase 5 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-05-PRESET-RENAME.md)
- **Project**: [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md)
