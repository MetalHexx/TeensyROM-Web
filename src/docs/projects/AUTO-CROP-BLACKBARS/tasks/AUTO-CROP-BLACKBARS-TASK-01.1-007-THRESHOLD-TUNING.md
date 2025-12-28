# Task 01.1-007: Detection Threshold Tuning & Accuracy Improvement

## 📋 Task Metadata

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-007-THRESHOLD-TUNING  
**Phase**: 1.1 - Advanced WebGL-Based Black Bar Detection  
**Assigned Agent**: GPU Wizard (WebGL Expert)  
**Priority**: 🔴 **CRITICAL** - Blocks Phase 1.1 completion  
**Estimated Size**: Small (1-2 days)  
**Status**: 🔲 Not Started  
**Depends On**: AUTO-CROP-BLACKBARS-TASK-01.1-006-DEBUG-VISUALIZATION (completed)

---

## 🎯 Objective

Fix severe detection inaccuracy discovered through debug visualization. Current thresholds detect dark game content as "black bars", causing 25-27% overcropping on right/bottom edges. Adjust shader thresholds and improve detection algorithm to accurately identify only true black borders.

**What**: Tune `BLACK_LUMINANCE_THRESHOLD` and `BLACK_SATURATION_THRESHOLD`, add spatial consistency checks  
**Why**: Current detection cuts off 75% of game content - unusable for production  
**Success**: Detection identifies 3-5% borders (actual black) without flagging dark game content (space backgrounds, sprites)

---

## 📚 Required Reading

**Prior Context**:
- [x] [Task 01.1-006 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-006-REPORT.md) - **CRITICAL**: Read findings section with screenshot analysis
- [x] [Edge Detection Shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/edge-detect.frag.ts) - Current thresholds
- [x] [Detection Pass Renderer](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts) - Edge measurement logic

**Standards**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 🧠 Context & Rationale

### The Critical Problem

Debug visualization (Task 01.1-006) exposed **severe overcropping**:

| Edge | Current Detection | Should Be | Error |
|------|-------------------|-----------|-------|
| Left | 10% black bar | 3-5% | +5-7% |
| Top | 15% black bar | 8-10% | +5-7% |
| **Right** | **30% black bar** | **3-5%** | **+25-27% 🔴** |
| **Bottom** | **20% black bar** | **3-5%** | **+15-17% 🔴** |

**Screenshot Evidence**: "North Star" C64 game shows:
- Red overlay covers **game content** (space backgrounds, sprites)
- Only ~20% of screen remains as "content" (should be ~95%)
- Dark blue/purple game elements misidentified as "black"

### Root Cause Analysis

**1. Thresholds Too Loose**
```glsl
// edge-detect.frag.ts - CURRENT (BROKEN)
const float BLACK_LUMINANCE_THRESHOLD = 0.05;  // 5% brightness
const float BLACK_SATURATION_THRESHOLD = 0.1;  // 10% saturation
```

These values catch:
- ❌ Dark space backgrounds (luminance ~3-6%)
- ❌ Shadow areas in sprites (luminance ~4-7%)
- ❌ Dark UI elements (luminance ~3-5%)
- ❌ Blue/purple color-shifted pixels (saturation ~8-12%)

**2. Single-Sample Detection**

Current algorithm checks **one pixel** at edge:
```glsl
// Simplified current logic
if (luminance < 0.05 && saturation < 0.1) {
  // It's black! Mark as bar
}
```

No spatial consistency check - one dark pixel flags entire edge as "black bar".

**3. No Confidence Threshold**

Algorithm always applies detected crop, even with low confidence. Should require high certainty before cropping.

---

## 🔧 Implementation Plan

### Phase 1: Tighten Thresholds (PRIMARY FIX)

**File**: `edge-detect.frag.ts`

**Current Values**:
```glsl
const float BLACK_LUMINANCE_THRESHOLD = 0.05;  // 5%
const float BLACK_SATURATION_THRESHOLD = 0.1;  // 10%
```

**Proposed Values** (start conservative, tune with debug overlay):
```glsl
const float BLACK_LUMINANCE_THRESHOLD = 0.02;  // 2% - only truly black pixels
const float BLACK_SATURATION_THRESHOLD = 0.05; // 5% - less tolerance for color
```

**Tuning Process**:
1. Start at 0.02/0.05
2. Enable debug overlay on "North Star" test case
3. If still overcropping → reduce further (0.015/0.03)
4. If undercropping → increase slightly (0.025/0.06)
5. Test on 3-5 different C64 games to verify consistency

### Phase 2: Add Spatial Consistency Check (STRETCH GOAL)

**File**: `detection-pass-renderer.ts`

**Current**: Single pixel sample at each edge  
**Improved**: Multi-sample with consistency requirement

```typescript
// Pseudocode
readEdgeMeasurements(): EdgeDetectionMeasurements {
  // Instead of checking just (0, midY) for left edge:
  // Sample at (0, 25%), (0, 50%), (0, 75%)
  // Require 2 out of 3 samples to agree before declaring "black bar"
  
  const leftSamples = [
    this.samplePixel(0, height * 0.25),
    this.samplePixel(0, height * 0.50),
    this.samplePixel(0, height * 0.75)
  ];
  
  const blackCount = leftSamples.filter(isBlack).length;
  const leftBarWidth = blackCount >= 2 ? calculateWidth() : 0;
}
```

**Benefits**:
- Reduces false positives from isolated dark pixels
- More robust against noise
- Better handles gradient borders

**Tradeoff**: Slightly more GPU reads per frame (12 samples vs 4)

### Phase 3: Add Confidence Threshold (OPTIONAL)

**File**: `video-mode-detector.ts`

**Current**: Always applies detected crop  
**Improved**: Only apply if detection confidence is high

```typescript
detectMode(measurements: EdgeDetectionMeasurements): CropRect | null {
  // Calculate confidence based on:
  // - Are all four edges consistent? (symmetry check)
  // - Are measurements stable over time? (reduce flickering)
  // - Is detected content area reasonable? (not too small)
  
  const confidence = calculateConfidence(measurements);
  
  if (confidence < CONFIDENCE_THRESHOLD) {
    return null; // Don't crop if uncertain
  }
  
  return computeCropRect(measurements);
}
```

---

## 📊 Testing Strategy

### Test Case 1: North Star (Primary Test)

**Expected Results** (use debug overlay to verify):
- Left border: 3-5% (thin black line only)
- Top border: 8-10% (includes "NORTHSTAR" title bar)
- Right border: 3-5% (thin black line only)
- Bottom border: 3-5% (thin black line only)

**Pass Criteria**:
- No red overlay on dark space backgrounds
- No red overlay on sprites or UI elements
- Green borders align with visible black borders only

### Test Case 2: Various C64 Games

Test detection accuracy across different content types:

1. **Dark backgrounds**: Space shooters, night scenes
2. **Light backgrounds**: Day scenes, white UI
3. **Gradient borders**: Some games have fade-to-black edges
4. **Full-screen games**: No borders (should detect 0% on all edges)
5. **Windowed games**: Borders on all sides

**Pass Criteria for Each**:
- Detection matches visual inspection
- No content cropped out
- Stable detection (no flickering between frames)

### Test Case 3: PAL vs NTSC

C64 output can be PAL (312 lines) or NTSC (262 lines):
- Test both aspect ratios
- Verify thresholds work regardless of resolution
- Check vertical vs horizontal black bar handling

### Performance Testing

**Metrics** (should not regress):
- FPS: Maintain 60fps during playback
- Detection latency: < 200ms to initial crop
- Memory: No leaks from debug overlay

---

## 🎯 Success Criteria

**Functional**:
- [ ] Left/right borders detected at 3-5% (not 10%/30%)
- [ ] Top border detected at 8-10% (not 15%)
- [ ] Bottom border detected at 3-5% (not 20%)
- [ ] Dark game content NOT flagged as black bars (space backgrounds, sprites)
- [ ] Detection stable across frame-to-frame (no flickering)
- [ ] Works on PAL and NTSC video modes

**Quality**:
- [ ] Debug overlay shows correct boundaries (red only on actual black)
- [ ] No performance regression (60fps maintained)
- [ ] Threshold values documented with rationale
- [ ] Test results documented in completion report

**Validation**:
- [ ] Tested on 3-5 different C64 games
- [ ] Screenshot evidence showing before/after
- [ ] Measurements logged to verify accuracy

---

## 📂 Files to Modify

### Primary Changes

1. **edge-detect.frag.ts** (Phase 1 - CRITICAL)
   - Line ~8-9: Update `BLACK_LUMINANCE_THRESHOLD` and `BLACK_SATURATION_THRESHOLD`
   - Add inline comments explaining tuning rationale

### Secondary Changes (If Time Permits)

2. **detection-pass-renderer.ts** (Phase 2 - STRETCH)
   - `readEdgeMeasurements()`: Add multi-sample logic
   - Add helper method `sampleMultiplePoints()`

3. **video-mode-detector.ts** (Phase 3 - OPTIONAL)
   - `detectMode()`: Add confidence calculation
   - Add `calculateConfidence()` helper method

---

## 🚨 Risks & Mitigation

**Risk 1: Undercropping After Fix**

**Symptom**: Thresholds too tight, actual black borders not detected  
**Mitigation**: Use debug overlay to tune incrementally. Better to undercrop (user sees borders) than overcrop (content lost)

**Risk 2: Game-Specific Tuning Required**

**Symptom**: Works for North Star but fails on other games  
**Mitigation**: Test on diverse content types. If impossible to find universal thresholds, consider user-adjustable settings in future task.

**Risk 3: Performance Impact from Multi-Sampling**

**Symptom**: FPS drops below 60 if too many samples taken  
**Mitigation**: Profile GPU read performance. Start with 3 samples per edge (12 total) - acceptable overhead.

---

## 🔗 Dependencies

**Blocks**:
- Phase 1.1 completion (cannot ship with current accuracy)
- Task 01.1-008 (any follow-up features)
- User testing (feature unusable in current state)

**Depends On**:
- [x] Task 01.1-006 (debug visualization) - COMPLETE

**Integration Points**:
- CrtRenderer: Calls detection pipeline every frame
- VideoModeDetector: Consumes edge measurements
- Debug overlay: Visualizes detection results for validation

---

## 📝 Completion Criteria

**Code Complete**:
- [ ] Threshold constants updated in shader
- [ ] (Optional) Multi-sample logic implemented
- [ ] (Optional) Confidence threshold implemented
- [ ] All changes committed with descriptive messages

**Testing Complete**:
- [ ] North Star test case passes (3-5% borders, no content flagged)
- [ ] 3-5 additional C64 games tested
- [ ] PAL and NTSC modes verified
- [ ] Performance benchmarks run (no regression)

**Documentation Complete**:
- [ ] Completion report with before/after screenshots
- [ ] Threshold tuning rationale documented
- [ ] Test results summarized
- [ ] Known limitations identified (if any)

**Review Ready**:
- [ ] Debug overlay shows correct detection on all test cases
- [ ] No console errors or warnings
- [ ] Build passes without errors
- [ ] Phase 1.1 ready to mark as complete

---

## 📸 Evidence Required

**Before/After Comparison**:
1. Screenshot of North Star with OLD thresholds (from Task 01.1-006 report)
2. Screenshot of North Star with NEW thresholds (debug overlay showing correct boundaries)
3. Measurement comparison table

**Test Case Evidence**:
- Screenshots of 3-5 different C64 games with debug overlay
- Confirmation that detection matches visual inspection

**Performance Data**:
- FPS measurements before/after changes
- Detection latency measurements

---

## 💡 Tuning Tips

**Start Conservative**: It's easier to loosen thresholds than tighten them after testing.

**Use Debug Overlay**: Real-time visual feedback is 100x faster than console logging.

**Test Edge Cases**:
- Very dark games (minimal lighting)
- Very bright games (white backgrounds)
- Games with gradient borders (fade to black)

**Document Failures**: If a game doesn't work, screenshot it and note the issue for future refinement.

**Consider User Control**: If universal thresholds prove impossible, plan for user-adjustable settings in a future task.

---

## 🎓 Learning Objectives

This task demonstrates:
- **Empirical tuning** using visual debugging tools
- **Threshold selection** for image processing algorithms
- **Tradeoffs** between sensitivity (detecting all bars) and specificity (avoiding false positives)
- **Performance optimization** for real-time GPU operations

---

## ✅ Ready to Start

**Prerequisites Met**:
- [x] Debug visualization working (Task 01.1-006)
- [x] Problem clearly understood (screenshot analysis)
- [x] Test case identified (North Star game)
- [x] Tuning process defined (iterative with debug overlay)

**Agent Instructions**:
1. Read Task 01.1-006 report findings section
2. Review current shader thresholds
3. Start with Phase 1 (threshold adjustment) - this alone may fix 90% of the problem
4. Use debug overlay to validate changes in real-time
5. Test on multiple games before declaring success
6. Document tuning rationale and test results

**Estimated Duration**: 4-8 hours (most time spent testing, not coding)

---

## 🔄 Related Tasks

**Previous**: [Task 01.1-006: Debug Visualization](./AUTO-CROP-BLACKBARS-TASK-01.1-006-DEBUG-VISUALIZATION.md) - Exposed the problem  
**Next**: Task 01.1-008 (TBD) - May involve user-adjustable thresholds or preset-based tuning

**Phase 1.1 Status**:
- ✅ Task 01.1-004: GPU Detection Pass (complete)
- ✅ Task 01.1-005: Measurement-Based Cropping (complete)
- ✅ Task 01.1-006: Debug Visualization (complete)
- 🔲 Task 01.1-007: Threshold Tuning (this task - CRITICAL)

Once this task is complete, Phase 1.1 can be marked as done and auto-crop feature is production-ready.
