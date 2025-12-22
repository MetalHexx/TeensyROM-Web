# Phase 1: Foundation & Detection Algorithm

## 🎯 Objective

Establish the foundational contracts and implement a performant, testable black bar detection algorithm. This phase delivers the core detection logic as a pure utility with no UI dependencies, enabling parallel development of WebGL integration in subsequent phases.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Feature Master Plan](../CRT-BLACKBAR-CROP-MASTER-PLAN.md) - Complete project overview
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing CRT components reference

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - TypeScript and code organization conventions

---

## 📂 File Structure Overview

```
libs/domain/
├── contracts/
│   ├── crt-crop.contract.ts                 ✨ New - CrtCropMode enum and CrtCropSettings interface
│   └── index.ts                             📝 Modified - Export new contracts
├── models/
│   ├── crop-rect.model.ts                   ✨ New - CropRect interface with TRBL percentages
│   └── index.ts                             📝 Modified - Export new model

libs/utils/
└── video/
    ├── blackbar-detector.ts                 ✨ New - BlackbarDetector class with detection logic
    ├── blackbar-detector.spec.ts            ✨ New - Unit tests for detector
    ├── known-crop-levels.const.ts           ✨ New - Known-good crop level constants
    └── index.ts                             ✨ New - Barrel export for video utils
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Define Domain Contracts</h3></summary>

**Purpose**: Establish shared type contracts for crop mode and settings that will be consumed across domain, application, and feature layers.

**Related Documentation:**

- [Master Plan - Architecture Overview](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#architecture-overview) - Design decisions
- [Domain Standards](../../../docs/features/CLEAN_ARCHITECTURE.md) - Domain layer patterns

**Implementation Subtasks:**

- [ ] **Create `CrtCropMode` enum** in `libs/domain/contracts/crt-crop.contract.ts` with values: `'off'`, `'auto'`, `'manual'`
- [ ] **Create `VideoStandard` enum** in `libs/domain/contracts/crt-crop.contract.ts` with values: `'pal'`, `'ntsc'`
- [ ] **Create `CrtCropSettings` interface** with properties:
  - `mode: CrtCropMode`
  - `videoStandard: VideoStandard` (default 'pal')
  - `manualTop: number` (top crop percentage, -30 to 40)
  - `manualBottom: number` (bottom crop percentage, -30 to 40)
  - `manualLeftRight: number` (left/right crop percentage, -30 to 40, applied to both sides)
  - `luminanceThreshold: number` (0-255, default 15)
  - `smoothingAlpha: number` (EMA alpha, 0-1, default 0.3)
  - `minimumCropThreshold: number` (percentage, default 3)
- [ ] **Create `CropRect` interface** in `libs/domain/models/crop-rect.model.ts` with properties:
  - `top: number`
  - `right: number`
  - `bottom: number`
  - `left: number`
  - All values are percentages (0-100)
- [ ] **Export contracts** from `libs/domain/contracts/index.ts`
- [ ] **Export model** from `libs/domain/models/index.ts`

**Testing Subtask:**

- [ ] **Write Tests**: Verify interfaces compile correctly (TypeScript validation)

**Key Implementation Notes:**

- Use `export interface` for interfaces (treeshakable)
- Use `export enum` for CrtCropMode (runtime value)
- Follow existing domain contract patterns (see `device.contract.ts`)
- Add JSDoc comments explaining each property's purpose and valid ranges

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] **Type Safety**: Interfaces compile without errors
- [ ] **Export Availability**: Contracts importable from barrel exports
- [ ] **Enum Values**: CrtCropMode enum has correct string literal values

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for approach to testing contracts

</details>

---

<details open>
<summary><h3>Task 2: Implement Black Bar Detector</h3></summary>

**Purpose**: Build the core detection algorithm as a pure, stateful class that processes video frames and outputs crop rectangles with smart snapping.

**Related Documentation:**

- [Master Plan - Auto-Detection](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#key-design-decisions) - Smart snapping strategy
- [Master Plan - Phase 1](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#phase-1-foundation--detection-algorithm) - Algorithm requirements

**Implementation Subtasks:**

- [ ] **Create `KNOWN_CROP_LEVELS` constant** in `libs/utils/video/known-crop-levels.const.ts` as array: `[0, 5, 8, 12, 15, 18, 20]`
- [ ] **Create `BlackbarDetector` class** in `libs/utils/video/blackbar-detector.ts` with:
  - Constructor accepting `CrtCropSettings`
  - `detectCrop(videoElement: HTMLVideoElement): CropRect` method
  - Private methods for edge scanning, luminance analysis, snapping, and EMA smoothing
  - State tracking for previous crop rect (for smoothing)
- [ ] **Implement edge scanning** logic:
  - Sample top/bottom 10% and left/right 10% of frame
  - Downsample to 4x4 grid for performance
  - Calculate average luminance per edge region
- [ ] **Implement snap-to-known-good** logic:
  - Calculate raw crop percentages from edge analysis
  - Average top/bottom and left/right for uniform crop
  - Find nearest value in `KNOWN_CROP_LEVELS`
  - Return snapped value
- [ ] **Implement EMA smoothing**:
  - Apply exponential moving average to crop rect transitions
  - Use `smoothingAlpha` from settings
  - Prevent jitter while maintaining responsiveness
- [ ] **Add minimum threshold check**:
  - If detected crop < `minimumCropThreshold`, return 0% (no crop)
  - Prevents micro-corrections from compression artifacts
- [ ] **Export detector** from `libs/utils/video/index.ts`

**Testing Subtask:**

- [ ] **Write Tests**: Detector produces expected crop rects for various frame patterns (see testing focus below)

**Key Implementation Notes:**

- Use `CanvasRenderingContext2D` for frame sampling (create offscreen canvas, draw video frame, get image data)
- Luminance calculation: `0.299 * R + 0.587 * G + 0.114 * B` (standard grayscale formula)
- Edge sampling strategy: divide edge region into 4x4 grid, sample center of each cell
- Snap-to-known-good: use `Math.min()` with `Math.abs(detected - known)` to find nearest
- EMA formula: `smoothed = alpha * new + (1 - alpha) * previous`

**Critical Algorithm Pattern** (architectural guidance):

```typescript
detectCrop(videoElement: HTMLVideoElement): CropRect {
  // 1. Capture frame to offscreen canvas (downsampled)
  // 2. Scan edges for luminance
  // 3. Calculate raw crop percentages
  // 4. Average for uniform crop
  // 5. Snap to nearest known-good level
  // 6. Apply EMA smoothing
  // 7. Check minimum threshold
  // 8. Return CropRect
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **All Black Frame**: Detector returns CropRect with 0% on all sides (no content detected)
- [ ] **No Black Bars**: Detector returns CropRect with 0% crop (content fills frame)
- [ ] **Uniform Bars (10%)**: Detector returns nearest known-good (8% or 12%)
- [ ] **Minimal Bars (2%)**: Detector returns 0% crop (below minimum threshold)
- [ ] **Asymmetric Bars**: Detector averages top/bottom and left/right, returns uniform crop
- [ ] **EMA Smoothing**: Multiple calls with changing values produce smoothed transitions
- [ ] **Snap Accuracy**: Raw 11% detection snaps to 12%, raw 9% snaps to 8%
- [ ] **Edge Case - Tiny Center Object**: Large raw crop (47%) snaps to max (20%)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for unit testing utilities
- Mock `HTMLVideoElement` with synthetic frame data via canvas test fixtures

</details>

---

<details open>
<summary><h3>Task 3: Detector Unit Tests</h3></summary>

**Purpose**: Comprehensive behavioral tests covering edge cases, snapping logic, and smoothing behavior.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns
- [Master Plan - Testing Strategy](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#testing-strategy) - Coverage goals

**Implementation Subtasks:**

- [ ] **Create test file** `libs/utils/video/blackbar-detector.spec.ts`
- [ ] **Test: Initialization** - Detector accepts settings, initializes internal state
- [ ] **Test: Edge Scanning** - Verify edge regions sampled correctly from frame
- [ ] **Test: Luminance Calculation** - Confirm grayscale conversion uses correct weights
- [ ] **Test: Snap to Known-Good** - Each raw value maps to nearest known level
- [ ] **Test: EMA Smoothing** - Verify smoothing formula applied correctly over multiple frames
- [ ] **Test: Minimum Threshold** - Values below threshold return 0% crop
- [ ] **Test: All Black Frame** - No content detected, 0% crop
- [ ] **Test: No Black Bars** - Content fills frame, 0% crop
- [ ] **Test: Uniform Bars** - Symmetric bars detected and snapped
- [ ] **Test: Asymmetric Bars** - Averaging produces uniform crop
- [ ] **Test: Extreme Input** - Tiny center object crops to max 20%
- [ ] **Test: Frame-to-Frame Stability** - Jitter reduced by EMA

**Testing Subtask:**

- [ ] **All Tests Pass**: Run `pnpm nx test utils` and verify all detector tests pass

**Key Implementation Notes:**

- Use test fixtures: create synthetic video frames via canvas (solid colors, patterns)
- Mock `HTMLVideoElement` with canvas-backed video data
- Test each behavior in isolation (single responsibility per test)
- Use descriptive test names: `it('should return 0% crop when content fills frame')`

**Test Fixture Pattern** (architectural guidance):

```typescript
function createTestVideoElement(pattern: FramePattern): HTMLVideoElement {
  // Create offscreen canvas with test pattern
  // Return mock video element backed by canvas
}

type FramePattern = 'all-black' | 'no-bars' | 'uniform-bars-10' | 'asymmetric' | 'tiny-center';
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Detector Initialization**: Constructor accepts settings without errors
- [ ] **Edge Scanning Accuracy**: Correct regions sampled from frame
- [ ] **Snap-to-Known-Good**: All raw values map to correct nearest known level
- [ ] **EMA Smoothing**: Jitter reduced over multiple frames
- [ ] **Threshold Enforcement**: Values below minimum return 0%
- [ ] **Edge Cases**: All black, no bars, tiny center, asymmetric handled correctly

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for test organization
- Use `describe` blocks for logical grouping: "Edge Scanning", "Snapping Logic", "EMA Smoothing"

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/domain/contracts/crt-crop.contract.ts`
- `libs/domain/models/crop-rect.model.ts`
- `libs/utils/video/blackbar-detector.ts`
- `libs/utils/video/blackbar-detector.spec.ts`
- `libs/utils/video/known-crop-levels.const.ts`
- `libs/utils/video/index.ts`

**Modified Files:**

- `libs/domain/contracts/index.ts`
- `libs/domain/models/index.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **Tests are written within each task above**. This section summarizes execution and coverage.

**Test Execution Commands:**

```bash
# Run detector unit tests
pnpm nx test utils

# Watch mode during development
pnpm nx test utils --watch

# Coverage report
pnpm nx test utils --coverage
```

**Coverage Goals:**

- Detector class: >90% line coverage
- Edge cases: All scenarios from master plan tested
- Snapping logic: All known-good levels validated
- EMA smoothing: Verified via multi-frame sequences

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] Domain contracts defined and exported correctly
- [ ] `CropRect` model created in shared domain layer
- [ ] `BlackbarDetector` class implements detection algorithm
- [ ] Known-good crop levels defined as constants

**Testing Requirements:**

- [ ] All unit tests passing with >90% coverage
- [ ] Edge cases tested (all black, no bars, asymmetric, tiny center)
- [ ] Snapping logic validated for all known-good levels
- [ ] EMA smoothing verified via multi-frame tests

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes (`pnpm nx lint`)
- [ ] Code formatting is consistent
- [ ] JSDoc comments on all public interfaces

**Ready for Next Phase:**

- [ ] Detector utility is pure and testable
- [ ] Contracts ready for consumption by WebGL renderer (Phase 2)
- [ ] No UI or store dependencies (enables parallel work)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Pure Detector Class**: No Angular dependencies, easier to test and potentially reusable
- **Known-Good Levels**: Predefined snap points prevent abnormal crop values from edge cases
- **EMA Smoothing**: Balances responsiveness with stability, avoids distracting jitter
- **Minimum Threshold**: 3% prevents micro-corrections from compression artifacts

### Implementation Constraints

- **Canvas Performance**: Offscreen canvas operations are fast, but avoid calling detector more than 2Hz in production
- **Luminance Formula**: Standard ITU-R BT.601 weights for grayscale conversion
- **Downsampling**: 4x4 grid for edge sampling strikes balance between accuracy and speed

### Future Enhancements

- **Configurable Snap Points**: Allow advanced users to define custom snap levels
- **Confidence Scoring**: Return confidence value alongside crop rect for UI feedback
- **Adaptive Threshold**: Adjust luminance threshold based on overall frame brightness

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>
