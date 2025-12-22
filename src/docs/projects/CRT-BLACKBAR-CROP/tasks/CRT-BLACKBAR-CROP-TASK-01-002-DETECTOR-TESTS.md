# Task Handoff: Detector Comprehensive Test Suite

## 📋 Task Identity

**Task ID**: CRT-BLACKBAR-CROP-TASK-01-002-DETECTOR-TESTS  
**Task Name**: Comprehensive Unit Tests for Black Bar Detector  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Test Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (3-5 files)

---

## 🎯 Objective

**What**: Write comprehensive behavioral unit tests for the `BlackbarDetector` class covering all edge cases, snapping logic, EMA smoothing, and integration scenarios.

**Why**: The detector is the core of the crop feature and must be proven correct across all edge cases before integrating into the WebGL pipeline. Comprehensive tests ensure confidence in the algorithm and prevent regressions.

**Success Criteria**:
- [ ] Test file created at `libs/utils/video/blackbar-detector.spec.ts`
- [ ] All detector behaviors tested (initialization, edge scanning, snapping, EMA, threshold)
- [ ] Edge cases covered (all black, no bars, asymmetric, tiny center, minimal bars)
- [ ] Test fixtures created for synthetic frame generation
- [ ] All tests pass
- [ ] Test coverage >90% for detector class
- [ ] Tests follow behavioral testing principles

---

## 📂 Context & Dependencies

**Prerequisites Completed**:
- CRT-BLACKBAR-CROP-TASK-01-001-DETECTOR-FOUNDATION: Detector implementation complete

**Dependencies**:
- Vitest testing framework
- `BlackbarDetector` class from Task 01-001
- `CrtCropSettings` and `CropRect` contracts from Task 01-001
- Standard browser APIs (Canvas, HTMLVideoElement)

**Constraints**:
- Tests must run in Node environment (use jsdom for canvas APIs if needed)
- Tests should complete in <5 seconds total
- No external test data files (generate synthetic frames programmatically)

---

## 📁 File Scope

**Files to Create**:
- `libs/utils/video/blackbar-detector.spec.ts` - Main test suite

**Files to Review**:
- `libs/utils/video/blackbar-detector.ts` - Implementation to test
- `libs/utils/video/known-crop-levels.const.ts` - Known-good levels for snapping tests
- `libs/domain/contracts/crt-crop.contract.ts` - Settings interface
- `libs/domain/models/crop-rect.model.ts` - CropRect model

---

## 🛠️ Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Behavioral testing approach
- [Store Testing](../../../../docs/STORE_TESTING.md) - Testing patterns (adapt for utility class)

**Key Requirements**:

### Test Organization

Structure tests using `describe` blocks by behavior category:

```typescript
describe('BlackbarDetector', () => {
  describe('Initialization', () => { /* ... */ });
  describe('Edge Scanning', () => { /* ... */ });
  describe('Luminance Calculation', () => { /* ... */ });
  describe('PAL Snap to Known-Good', () => { /* ... */ });
  describe('NTSC Snap to Known-Good', () => { /* ... */ });
  describe('Video Standard Switching', () => { /* ... */ });
  describe('EMA Smoothing', () => { /* ... */ });
  describe('Minimum Threshold', () => { /* ... */ });
  describe('Edge Cases', () => { /* ... */ });
  describe('Integration Scenarios', () => { /* ... */ });
});
```

### Test Fixtures

Create helper functions to generate synthetic video frames for testing:

1. **`createMockVideoElement(pattern: FramePattern): HTMLVideoElement`**:
   - Returns mock video element backed by canvas with test pattern
   - Patterns: `'all-black'`, `'no-bars'`, `'uniform-bars-10'`, `'asymmetric'`, `'tiny-center'`, `'minimal-bars-2'`

2. **Canvas-Based Frame Generation**:
   - Create offscreen canvas with desired pattern
   - Draw pattern (solid colors, rectangles for bars, small object in center)
   - Return mock video element with canvas as source

**Example Pattern Implementation**:
```typescript
function createUniformBarFrame(barPercent: number): HTMLVideoElement {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d')!;
  
  // Black bars
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 320, 240);
  
  // White content area
  const barPixelsH = (barPercent / 100) * 320;
  const barPixelsV = (barPercent / 100) * 240;
  ctx.fillStyle = 'white';
  ctx.fillRect(barPixelsH, barPixelsV, 320 - 2*barPixelsH, 240 - 2*barPixelsV);
  
  return mockVideoFromCanvas(canvas);
}
```

### Behavioral Test Scenarios

**Initialization Tests**:
- [ ] Detector accepts settings without errors
- [ ] Default settings work correctly
- [ ] Invalid settings throw appropriate errors (if applicable)

**Edge Scanning Tests**:
- [ ] Top edge region sampled correctly (10% of height)
- [ ] Bottom edge region sampled correctly
- [ ] Left edge region sampled correctly (10% of width)
- [ ] Right edge region sampled correctly
- [ ] Edge regions divided into 4x4 grids
- [ ] Luminance calculated using BT.601 formula

**PAL Snap-to-Known-Good Tests**:
- [ ] PAL mode: Raw {top: 0, bottom: 0} → snaps to {top: 0, bottom: 0}
- [ ] PAL mode: Raw {top: 6, bottom: 4} → snaps to {top: 8, bottom: 5}
- [ ] PAL mode: Raw {top: 10, bottom: 6} → snaps to {top: 12, bottom: 8}
- [ ] PAL mode: Raw {top: 14, bottom: 9} → snaps to {top: 15, bottom: 10}
- [ ] PAL mode: Raw {top: 17, bottom: 11} → snaps to {top: 18, bottom: 12}
- [ ] PAL mode: Raw {top: 19, bottom: 14} → snaps to {top: 20, bottom: 15}
- [ ] PAL mode: Asymmetric input preserved (top ≠ bottom)

**NTSC Snap-to-Known-Good Tests**:
- [ ] NTSC mode: Raw {top: 0, bottom: 0} → snaps to {top: 0, bottom: 0}
- [ ] NTSC mode: Raw {top: 4, bottom: 3} → snaps to {top: 5, bottom: 5}
- [ ] NTSC mode: Raw {top: 7, bottom: 6} → snaps to {top: 8, bottom: 8}
- [ ] NTSC mode: Raw {top: 11, bottom: 10} → snaps to {top: 12, bottom: 12}
- [ ] NTSC mode: Raw {top: 14, bottom: 13} → snaps to {top: 15, bottom: 15}
- [ ] NTSC mode: Raw {top: 17, bottom: 16} → snaps to {top: 18, bottom: 18}
- [ ] NTSC mode: Asymmetric input made symmetric (top = bottom after snap)

**Video Standard Switching Tests**:
- [ ] Switch PAL → NTSC mid-detection → uses NTSC snap levels
- [ ] Switch NTSC → PAL mid-detection → uses PAL snap levels
- [ ] EMA state preserved across video standard changes

**EMA Smoothing Tests**:
- [ ] First call (no previous crop) → no smoothing applied, returns snapped value
- [ ] Second call → smoothing applied independently to top/bottom: `alpha * new + (1-alpha) * previous`
- [ ] Multiple calls with stable value → top/bottom both converge toward stable value
- [ ] Multiple calls with changing value → smooth transition, no sudden jumps
- [ ] Alpha=0.3 produces expected smoothing behavior
- [ ] PAL asymmetry maintained through smoothing (top smoothed separately from bottom)

**Minimum Threshold Tests**:
- [ ] Raw 2% (below 3% threshold) → returns 0%
- [ ] Raw 3% (at threshold) → snaps to 5%
- [ ] Raw 4% (above threshold) → snaps to 5%

**Edge Case Tests**: (both PAL/NTSC)
- [ ] **No black bars** (content fills frame): Returns `{top: 0, right: 0, bottom: 0, left: 0}`
- [ ] **PAL uniform bars (10%)**: Returns asymmetric snapped crop (e.g., {top: 12, bottom: 8})
- [ ] **NTSC uniform bars (10%)**: Returns symmetric snapped crop (e.g., {top: 12, bottom: 12})
- [ ] **Minimal bars (2%)**: Returns 0% due to threshold (both standards)
- [ ] **PAL typical** (larger top, smaller bottom): Maintains asymmetry after snapping
- [ ] **Tiny center object** (large raw crop 47%): Snaps to max level (PAL: {20, 15}, NTSC: {18, 18}) to uniform, snaps correctly
- [ ] **Tiny center object** (large raw crop 47%): Snaps to max 20%

**Integration Scenarios**:
- [ ] Multiple detect calls with sam(PAL/NTSC switch) → new settings applied correctly
- [ ] PAL frame with typical asymmetry → detector produces appropriate asymmetric crop
- [ ] NTSC frame with symmetric borders → detector produces symmetric cropempotent)
- [ ] Settings update mid-detection → new settings applied correctly
- [ ] Detect on real-looking frame patterns → reasonable crop values

**Anti-Patterns to Test Against**:
- [ ] Verify detector doesn't create new canvas every call (performance)
- [ ] Verify raw values never returned without snapping
- [ ] Verify minimum threshold always enforced

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] All public methods tested
- [ ] All private methods tested indirectly through public API
- [ ] All branches covered (if/else, switch cases)
- [ ] All edge cases covered
- [ ] >90% line coverage

**Behavioral Expectations**:
- Tests should be readable and describe what behavior is being verified
- Use descriptive test names: `it('should snap 11% raw crop to 12% known-good level')`
- Group related tests with `describe` blocks
- Avoid testing implementation details (focus on observable behavior)

**Test Execution**:
```bash
# Run tests
pnpm nx test utils

# Watch mode
pnpm nx test utils --watch

# Coverage report
pnpm nx test utils --coverage
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Behavioral testing principles
- [Master Plan - Testing Strategy](../CRT-BLACKBAR-CROP-MASTER-PLAN.md#testing-strategy)
- [Phase 1 - Testing Focus](../phases/CRT-BLACKBAR-CROP-PHASE-01-FOUNDATION.md#testing-focus-for-task-2)

**Related Tasks**:
- CRT-BLACKBAR-CROP-TASK-01-001-DETECTOR-FOUNDATION: Detector implementation (prerequisite)

**Similar Test Patterns**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts` - WebGL utility class tests

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/CRT-BLACKBAR-CROP/reports/CRT-BLACKBAR-CROP-TASK-01-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of completed report

---

## 💡 Implementation Notes

**Test Fixture Strategy**:
- Create reusable test fixtures for frame patterns
- Use factory functions for configurability
- Keep fixtures simple and focused

**Mock Video Element**:
- Canvas-backed mock is sufficient
- Ensure canvas has proper dimensions (320x240)
- Ensure video element reports `readyState = 4` (HAVE_ENOUGH_DATA)

**Performance**:
- Tests should run fast (<5s total)
- Use synthetic frames (don't load real video files)
- Avoid excessive loops or complex calculations in tests

**Debugging**:
- If tests fail, check luminance calculation formula
- Verify edge scanning regions are correct
- Confirm snapping logic uses nearest neighbor
- Validate EMA formula matches specification

Good luck! Comprehensive tests ensure detector reliability for all downstream work.
