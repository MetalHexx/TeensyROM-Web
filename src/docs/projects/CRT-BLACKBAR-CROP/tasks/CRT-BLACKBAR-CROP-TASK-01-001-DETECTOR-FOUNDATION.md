# Task Handoff: Domain Contracts & Detector Implementation

## 📋 Task Identity

**Task ID**: CRT-BLACKBAR-CROP-TASK-01-001-DETECTOR-FOUNDATION  
**Task Name**: Define Domain Contracts and Implement Black Bar Detector  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (6-8 files)

---

## 🎯 Objective

**What**: Create shared domain contracts for crop settings and implement a performant black bar detection algorithm as a pure, testable utility class.

**Why**: This foundational work enables subsequent phases (WebGL integration, UI controls) to build on well-defined contracts and a proven detection algorithm. The detector must be pure (no Angular dependencies) to facilitate testing and potential reuse.

**Success Criteria**:
- [ ] `CrtCropMode` enum and `CrtCropSettings` interface defined in domain layer
- [ ] `CropRect` model created in shared models folder
- [ ] `BlackbarDetector` class implements detection with snapping and EMA smoothing
- [ ] Known-good crop levels defined as constants
- [ ] All contracts exported from barrel indexes
- [ ] Detector produces expected crop rects for test scenarios
- [ ] All unit tests pass with >90% coverage

---

## 📂 Context & Dependencies

**Prerequisites Completed**:
- None (this is Phase 1, Task 1)

**Dependencies**:
- TypeScript 5.x
- Standard browser APIs (Canvas, HTMLVideoElement)
- Vitest testing framework

**Constraints**:
- Detector must be pure JavaScript/TypeScript (no Angular dependencies)
- Must work in browser environment (no Node.js-specific APIs)
- Detection algorithm should complete in <50ms per frame
- EMA smoothing must prevent visible jitter

---

## 📁 File Scope

**Files to Create**:
- `libs/domain/contracts/crt-crop.contract.ts` - Crop mode enum and settings interface
- `libs/domain/models/crop-rect.model.ts` - Crop rectangle model with TRBL percentages
- `libs/utils/video/blackbar-detector.ts` - Detector class with algorithm
- `libs/utils/video/known-crop-levels.const.ts` - Known-good snap points
- `libs/utils/video/index.ts` - Barrel export for video utils

**Files to Modify**:
- `libs/domain/contracts/index.ts` - Add exports for new contract
- `libs/domain/models/index.ts` - Add exports for new model

**Files to Review** (for context):
- `libs/domain/contracts/device.contract.ts` - Example of domain contract pattern
- `libs/domain/models/file-item.model.ts` - Example of domain model pattern
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - WebGL renderer that will consume CropRect

---

## 🛠️ Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - TypeScript conventions, naming
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Unit testing approach
- [Domain Standards](../../../../docs/features/CLEAN_ARCHITECTURE.md) - Domain layer patterns

**Key Requirements**:

### Part 1: Domain Contracts

1. **`CrtCropMode` Enum**:
   - Values: `'off'`, `'auto'`, `'manual'`
   - Use string literals for type safety
   - Export as const enum for tree-shaking

2. **`VideoStandard` Enum**:
   - Values: `'pal'`, `'ntsc'`
   - PAL: 625 lines, asymmetric borders (larger top ~23-24 lines, smaller bottom ~18-20 lines)
   - NTSC: 525 lines, more symmetric borders
   - Use string literals for type safety

3. **`CrtCropSettings` Interface**:
   - Properties: `mode`, `videoStandard`, `manualTop`, `manualBottom`, `manualLeftRight`, `luminanceThreshold`, `smoothingAlpha`, `minimumCropThreshold`
   - JSDoc comments explaining each property's purpose and valid ranges
   - Default: `{ mode: 'off', videoStandard: 'pal', manualTop: 0, manualBottom: 0, manualLeftRight: 0, ... }`
   - **Note**: `manualLeftRight` applies to both left AND right (C64 content is always horizontally centered)

4. **`CropRect` Model**:
   - Properties: `top`, `right`, `bottom`, `left` (all numbers, 0-100 percentages)
   - JSDoc comment explaining coordinate system
   - **Note**: For C64 content, left=right always (horizontal symmetry), but top≠bottom for PAL (vertical asymmetry)

### Part 2: Known-Good Crop Levels

Create separate snap level arrays for PAL and NTSC:

**PAL Snap Levels** (asymmetric):
```typescript
PAL_SNAP_LEVELS = [
  { top: 0, bottom: 0 },
  { top: 8, bottom: 5 },
  { top: 12, bottom: 8 },
  { top: 15, bottom: 10 },
  { top: 18, bottom: 12 },
  { top: 20, bottom: 15 }
]
```

**NTSC Snap Levels** (symmetric):
```typescript
NTSC_SNAP_LEVELS = [
  { top: 0, bottom: 0 },
  { top: 5, bottom: 5 },
  { top: 8, bottom: 8 },
  { top: 12, bottom: 12 },
  { top: 15, bottom: 15 },
  { top: 18, bottom: 18 }
]
```

### Part 3: Black Bar Detector

**Class Structure**:
```typescript
export class BlackbarDetector {
  private settings: CrtCropSettings;
  private previousCrop: CropRect | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(settings: CrtCropSettings) { /* ... */ }
  
  detectCrop(videoElement: HTMLVideoElement): CropRect { /* ... */ }
  
  updateSettings(settings: CrtCropSettings): void { /* ... */ }
  
  private scanEdges(imageData: ImageData): RawCropValues { /* ... */ }
  private snapToKnownGood(rawCrop: number): number { /* ... */ }
  private applyEMA(current: CropRect, previous: CropRect): CropRect { /* ... */ }
}
```

**Detection Algorithm Flow**:
1. Capture video frame to offscreen canvas (downsampled to 320x240 for performance)
2. Get image data from canvas
3. Scan top 10%, bottom 10%, left 10%, right 10% edge regions
4. Divide each edge into 4x4 grid, sample luminance at center of each cell
5. Calculate average luminance per edge region
6. Compare against `luminanceThreshold` to determine if region is "black"
7. Calculate raw crop percentages (percentage of edge that is black)
8. Average top/bottom for vertical crop, left/right for horizontal crop
9. Take max of vertical/horizontal for uniform crop value
10. Snap to nearest value in `KNOWN_CROP_LEVELS`
11. Check if snapped value < `minimumCropThreshold`, if so return 0%
12. Apply EMA smoothing with previous crop rect
13. Return final `CropRect`

**Luminance Calculation**:
- Use ITU-R BT.601 formula: `L = 0.299 * R + 0.587 * G + 0.114 * B`
- Pixel is "black" if `L < luminanceThreshold`

**Snap-to-Known-Good Logic**:
- Find nearest value: `Math.min(...KNOWN_CROP_LEVELS.map(k => Math.abs(raw - k)))`
- Return corresponding known-good level

**EMA Smoothing**:
- Formula: `smoothed = alpha * new + (1 - alpha) * previous`
- Apply to each component: `top`, `right`, `bottom`, `left`

**Edge Cases to Handle**:
- All black frame → return `{top: 0, right: 0, bottom: 0, left: 0}`
- No black bars (content fills frame) → return `{top: 0, right: 0, bottom: 0, left: 0}`
- First call (no previous crop) → skip EMA smoothing

**Anti-Patterns to Avoid**:
- Don't create new canvas every call (reuse offscreen canvas)
- Don't sample every pixel (use 4x4 grid for performance)
- Don't return raw detection values (always snap to known-good)
- Don't forget minimum threshold check (prevents micro-corrections)

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests for domain contracts (TypeScript compilation)
- [ ] Unit tests for detector initialization
- [ ] Unit tests for edge scanning logic
- [ ] Unit tests for snap-to-known-good with all levels
- [ ] Unit tests for EMA smoothing over multiple frames
- [ ] Unit tests for minimum threshold enforcement
- [ ] Unit tests for edge cases (all black, no bars, asymmetric, tiny center object)

**Behavioral Expectations**:
- Detector initializes without errors
- Edge regions sampled correctly from frame
- Luminance calculated using correct formula
- Raw values snap to nearest known-good level
- EMA reduces jitter over multiple frames
- Values below minimum threshold return 0%
- All black frame returns 0% crop
- Content filling frame returns 0% crop
- Asymmetric bars produce uniform crop via averaging
- Tiny center object (extreme raw crop) snaps to max 20%

**Test Fixtures**:
Create helper functions to generate synthetic video frames:
- `createAllBlackFrame()` - Solid black canvas
- `createNoBarFrame()` - Content fills entire frame
- `createUniformBarFrame(barPercent: number)` - Bars on all sides
- `createAsymmetricBarFrame(top/right/bottom/left)` - Different bars per side
- `createTinyCenterFrame()` - Small object in center, rest black

---

## 📚 Reference Materials

**Related Documentation**:
- [Master Plan - Architecture Overview](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#architecture-overview)
- [Master Plan - Phase 1](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#phase-1-foundation--detection-algorithm)
- [Phase 1 Plan](../phases/CRT-BLACKBAR-CROP-PHASE-01-FOUNDATION.md)

**Related Tasks**:
- CRT-BLACKBAR-CROP-TASK-01-002-DETECTOR-TESTS: Comprehensive test suite (next task)

**Similar Implementations**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - WebGL utility class pattern

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/CRT-BLACKBAR-CROP/reports/CRT-BLACKBAR-CROP-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of completed report

---

## 💡 Implementation Notes

**Performance Considerations**:
- Downsampling to 320x240 reduces pixel processing by ~75%
- 4x4 grid per edge region = 16 samples per edge (64 total)
- Offscreen canvas reuse avoids allocation overhead
- Target <50ms per detectCrop() call

**Testing Strategy**:
- Use Vitest for unit tests
- Mock HTMLVideoElement with canvas-backed synthetic frames
- Test each behavior in isolation
- Use descriptive test names: `it('should snap 11% raw crop to 12% known-good')`

**Code Organization**:
- Keep detector class pure (no dependencies)
- Make all methods testable (expose privates for testing if needed)
- Follow single responsibility principle
- Use meaningful variable names

Good luck! This is foundational work that enables all subsequent phases.
