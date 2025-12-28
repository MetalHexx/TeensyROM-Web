# Phase 2: Smooth Transitions & User Control

## 🎯 Objective

Enhance the auto crop system with smooth cubic-bezier easing animation, user-adjustable transition speed control, and confidence scoring to prevent thrashing during undeterministic frames. This phase delivers a polished, production-ready feature with natural camera-operator style movements and optional debug visualization for tuning and troubleshooting.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md) - Complete project overview
- [ ] [Phase 1 Implementation](./AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md) - Foundation built in Phase 1
- [ ] [Feature PRD](../PRD.md) - Original smooth transition requirements

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [E2E Tests Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Debug overlay styling

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
├── crt-settings.model.ts                    📝 Modified - Add cropSmoothness property

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.defaults.ts                 📝 Modified - Add cropSmoothness default
├── webgl/
│   ├── crop-animator.ts                     📝 Modified - Add cubic-bezier easing
│   ├── crop-animator.spec.ts                📝 Modified - Add easing tests
│   ├── black-bar-detector.ts                📝 Modified - Add confidence scoring
│   ├── black-bar-detector.spec.ts           📝 Modified - Add confidence tests
│   ├── crt-renderer.ts                      📝 Modified - Add debug overlay, hysteresis logic
│   └── crt-renderer.spec.ts                 📝 Modified - Integration tests

libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts          📝 Modified - Add smoothness slider
├── crt-settings-panel.component.html        📝 Modified - Add slider UI
├── crt-settings-panel.component.spec.ts     📝 Modified - Test slider interaction
└── crt-slider-configs.ts                    📝 Modified - Add smoothness slider config

apps/teensyrom-ui-e2e/src/e2e/
└── crt-auto-crop.cy.ts                      ✨ New - Comprehensive E2E tests
```

---

<details open>
<parameter name="summary"><h3>Task 1: Animation System with Easing & User Control</h3></summary>

**Purpose**: Upgrade the `CropAnimator` from basic lerp to smooth cubic-bezier easing, add the `cropSmoothness` setting for user control, and integrate the smoothness slider into the settings panel.

**Related Documentation:**

- [CropAnimator](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crop-animator.ts) - Existing basic lerp implementation
- [Master Plan Animation](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#animation) - Easing specification

**Implementation Subtasks:**

- [ ] **Add Domain Property**: Add `cropSmoothness: number` (0-1 range) to `CrtSettings` in domain model
- [ ] **Add Default Value**: Set `cropSmoothness: 0.5` in `DEFAULT_CRT_SETTINGS` (medium smoothness)
- [ ] **Update All Presets**: Add `cropSmoothness: 0.5` to all preset configurations
- [ ] **Implement Easing Function**: Add `easeInOutCubic(t)` to `CropAnimator` class
- [ ] **Upgrade Update Logic**: Replace simple lerp with eased interpolation respecting `cropSmoothness`
- [ ] **Add Slider Config**: Create `CROP_SMOOTHNESS_SLIDER` config in `crt-slider-configs.ts`
- [ ] **Add Slider UI**: Add slider control to "Scanlines & Screen" panel below auto crop toggle
- [ ] **Wire Settings Flow**: Pass `cropSmoothness` from settings through to animator

**Testing Subtask:**

- [ ] **Write Tests**: Test easing function and smoothness control behavior

**Key Implementation Notes:**

- Easing function: `easeInOutCubic(t) = t < 0.5 ? 4*t³ : 1 - (-2*t + 2)³ / 2`
- Smoothness maps to animation speed: 0 = instant snap, 0.5 = moderate, 1.0 = very slow/smooth
- Convert smoothness to lerp alpha: `alpha = 0.05 + (0.2 * (1 - smoothness))` (range: 0.05-0.25 per frame)
- Apply easing to t-value before lerp: `t = easeInOutCubic(Math.min(1.0, accumulatedTime / transitionDuration))`
- Slider range: 0.0 to 1.0, step 0.05, label "Crop Smoothness"

**Critical Easing Implementation**:

```typescript
class CropAnimator {
  private smoothness: number = 0.5;
  
  updateSmoothness(value: number): void {
    this.smoothness = value;
  }
  
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  update(): CropRect {
    // Calculate lerp alpha from smoothness (0=fast, 1=slow)
    const alpha = 0.05 + (0.2 * (1 - this.smoothness));
    
    // Apply easing before lerp for smooth acceleration/deceleration
    // ... implementation details
  }
}
```

**Testing Focus for Task 1:**

> Focus on easing curve behavior and user control

**Behaviors to Test:**

**CropAnimator Tests:**
- [ ] **Easing Curve**: `easeInOutCubic(0) = 0`, `easeInOutCubic(0.5) = 0.5`, `easeInOutCubic(1) = 1`
- [ ] **Easing Smoothness**: Curve starts slow, accelerates mid-transition, slows at end
- [ ] **Smoothness Impact**: Low smoothness (0.1) reaches target faster than high (0.9)
- [ ] **Zero Smoothness**: Setting to 0 causes near-instant snap (alpha = 0.25)
- [ ] **Max Smoothness**: Setting to 1.0 causes very slow transition (alpha = 0.05)

**Settings Panel Tests:**
- [ ] **Slider Renders**: Smoothness slider renders with correct default (0.5)
- [ ] **Slider Interaction**: Moving slider emits `settingsChange` with new smoothness
- [ ] **Value Display**: Current value displays next to slider (0.50 format)
- [ ] **Preset Loading**: Loading preset updates slider position

**Testing Reference:**

- Plot easing function values at 0, 0.25, 0.5, 0.75, 1.0 to verify curve
- Mock time progression to test animation convergence speed

</details>

---

<details open>
<parameter name="summary"><h3>Task 2: Confidence Scoring & Anti-Thrash Logic</h3></summary>

**Purpose**: Add confidence scoring to the `BlackBarDetector` to distinguish reliable detections from undeterministic frames, implement hysteresis logic to prevent rapid crop changes, and ensure stability during scene transitions and fade effects.

**Related Documentation:**

- [Master Plan Confidence Scoring](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#confidence-scoring) - Algorithm specification
- [BlackBarDetector](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/black-bar-detector.ts) - Existing detection implementation

**Implementation Subtasks:**

- [ ] **Add Detection History**: Track last N detections (circular buffer, N=5) in `BlackBarDetector`
- [ ] **Calculate Edge Consistency**: Measure uniformity of black pixels across sampled edge points
- [ ] **Calculate Temporal Stability**: Compare current detection to previous detections for similarity
- [ ] **Compute Confidence Score**: Combine edge consistency (60%) and temporal stability (40%)
- [ ] **Add Confidence Threshold**: Require confidence > 0.7 for commit
- [ ] **Implement Hysteresis**: Require 3 consecutive high-confidence samples before changing crop
- [ ] **Add Luminance Variance Check**: Detect overall frame darkening (fade transitions) and freeze detection
- [ ] **Integrate in Renderer**: CrtRenderer only updates animator target when confidence is sufficient

**Testing Subtask:**

- [ ] **Write Tests**: Test confidence calculation and hysteresis behavior

**Key Implementation Notes:**

- Edge consistency: Standard deviation of luminance values along detected edge (low σ = high consistency)
- Temporal stability: Compare current crop rect to average of last 5 detections (small difference = high stability)
- Confidence formula: `confidence = (edgeConsistency * 0.6) + (temporalStability * 0.4)`
- Hysteresis counter: Increment on high confidence, reset on low confidence, commit at count >= 3
- Luminance variance: If overall frame mean luminance drops >30% from previous, freeze detection
- Hold last known good crop during low confidence periods

**Critical Confidence Interface**:

```typescript
interface DetectionResult {
  cropRect: CropRect;
  confidence: number; // 0-1
  edgeConsistency: number; // 0-1
  temporalStability: number; // 0-1
}

class BlackBarDetector {
  private detectionHistory: DetectionResult[] = [];
  private highConfidenceStreak: number = 0;
  private lastCommittedCrop: CropRect | null = null;
  
  detect(gl, texture, width, height): DetectionResult;
  shouldCommitCrop(result: DetectionResult): boolean; // Hysteresis logic
}
```

**Testing Focus for Task 2:**

> Focus on stability during undeterministic frames

**Behaviors to Test:**

**Confidence Calculation Tests:**
- [ ] **High Edge Consistency**: Uniform black edge returns high consistency score (>0.9)
- [ ] **Low Edge Consistency**: Mixed black/non-black edge returns low consistency (<0.5)
- [ ] **High Temporal Stability**: Consecutive similar crops return high stability (>0.9)
- [ ] **Low Temporal Stability**: Wildly different crops return low stability (<0.5)
- [ ] **Confidence Formula**: Combined score accurately weights consistency and stability

**Hysteresis Tests:**
- [ ] **Confidence Below Threshold**: Low confidence detection doesn't commit crop change
- [ ] **Single High Confidence**: One high-confidence sample doesn't commit (needs 3)
- [ ] **Three Consecutive**: Three consecutive high-confidence samples commit crop change
- [ ] **Interrupted Streak**: Low confidence resets counter, requires 3 more high-confidence
- [ ] **Stable Crop Hold**: During low confidence period, last good crop is maintained

**Fade Detection Tests:**
- [ ] **Normal Content**: Normal frame luminance doesn't trigger freeze
- [ ] **Fade to Black**: Luminance drop >30% freezes detection
- [ ] **Fade Recovery**: Luminance recovery re-enables detection

**Testing Reference:**

- Create synthetic pixel patterns with known consistency properties
- Mock detection history with controlled sequences
- Verify hysteresis counter increments/resets correctly

</details>

---

<details open>
<parameter name="summary"><h3>Task 3: Debug Overlay Visualization</h3></summary>

**Purpose**: Create an optional debug overlay that visualizes detected crop zones, confidence scores, and detection state to help users understand the feature behavior and assist with troubleshooting.

**Related Documentation:**

- [CrtRenderer](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Canvas rendering context
- [Style Guide](../../../STYLE_GUIDE.md) - Overlay styling patterns

**Implementation Subtasks:**

- [ ] **Add Debug Mode Setting**: Add `showCropDebugOverlay: boolean` to `CrtSettings` (default: false)
- [ ] **Create Debug Render Method**: Add `renderDebugOverlay()` method to `CrtRenderer`
- [ ] **Draw Crop Rectangle**: Render detected crop rectangle borders on canvas (green = committed, yellow = pending)
- [ ] **Draw Sample Points**: Show edge sample point locations (small dots)
- [ ] **Display Confidence Info**: Overlay text showing current confidence, edge consistency, temporal stability
- [ ] **Draw Detection State**: Indicator showing "Detecting", "High Confidence", "Holding" states
- [ ] **Add Canvas 2D Context**: Use 2D context overlay on top of WebGL canvas for debug rendering
- [ ] **Add Toggle to Settings Panel**: Advanced section with debug overlay toggle (initially hidden, expandable)

**Testing Subtask:**

- [ ] **Write Tests**: Test debug rendering logic and toggle interaction

**Key Implementation Notes:**

- Use separate 2D canvas overlay positioned absolutely over WebGL canvas
- Render debug overlay AFTER WebGL render pass (on top)
- Color coding: Green = committed crop, Yellow = pending high-confidence crop, Red = low-confidence
- Text overlay: Top-left corner with confidence metrics
- Sample points: Small 3px circles at edge sampling locations
- Only render when `showCropDebugOverlay: true` (performance consideration)
- Clear 2D canvas before each render to prevent trails

**Debug Overlay Layout**:

```
┌─────────────────────────────────────┐
│ Confidence: 0.85                    │
│ Edge: 0.92 | Temporal: 0.73         │
│ State: High Confidence (2/3)        │
│                                     │
│   ┌─────────────────────────┐      │  ← Green border (committed crop)
│   │                         │      │
│   │   [Video Content]       │      │
│   │                         │      │
│   └─────────────────────────┘      │
│   • • •    Sample Points    • • •  │  ← Dots at sampling locations
└─────────────────────────────────────┘
```

**Testing Focus for Task 3:**

> Focus on debug rendering accuracy and toggle behavior

**Behaviors to Test:**

**Debug Rendering Tests:**
- [ ] **Toggle Off**: No debug overlay renders when disabled
- [ ] **Toggle On**: Debug overlay renders when enabled
- [ ] **Crop Rectangle**: Green border matches committed crop dimensions
- [ ] **Pending Crop**: Yellow border shows during high-confidence pending state
- [ ] **Sample Points**: Dots render at correct edge locations
- [ ] **Text Metrics**: Confidence values display correctly (2 decimal precision)
- [ ] **State Indicator**: Shows correct state: "Detecting", "High Confidence", "Holding"

**Settings Panel Tests:**
- [ ] **Advanced Section**: Debug toggle in collapsed advanced section (not primary controls)
- [ ] **Toggle Interaction**: Clicking toggle enables/disables debug overlay immediately
- [ ] **Tooltip Help**: Tooltip explains debug overlay purpose

**Testing Reference:**

- Mock 2D canvas context for rendering tests
- Spy on `fillRect`, `strokeRect`, `fillText` calls
- Verify coordinates match expected crop rectangle

</details>

---

<details open>
<parameter name="summary"><h3>Task 4: E2E Testing & Content Validation</h3></summary>

**Purpose**: Create comprehensive Cypress E2E tests covering various real-world scenarios with different video content types, ensuring the auto crop feature works correctly across PAL/NTSC content, different border sizes, and edge cases like fades and full-black frames.

**Related Documentation:**

- [E2E Tests Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress patterns and setup
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach

**Implementation Subtasks:**

- [ ] **Create Test Spec File**: New file `crt-auto-crop.cy.ts` with comprehensive scenarios
- [ ] **Prepare Test Fixtures**: Create/source test video files with known border patterns
- [ ] **Test Feature Toggle**: Verify toggle on/off transitions smoothly
- [ ] **Test Smoothness Control**: Verify slider affects animation speed visibly
- [ ] **Test Black Bar Detection**: Load video with borders, verify crop activates
- [ ] **Test PAL Content**: Test with PAL-style content (larger bottom border)
- [ ] **Test Fade Transitions**: Verify detection freezes during fades
- [ ] **Test Full-Black Frames**: Verify crop holds during all-black frames
- [ ] **Test Preset Loading**: Verify presets include auto crop settings correctly
- [ ] **Performance Validation**: Verify no frame drops or console errors

**Testing Subtask:**

- [ ] **Write Tests**: Comprehensive E2E scenarios

**Key Implementation Notes:**

- Use Cypress video testing capabilities to load test content
- Verify WebGL canvas renders without errors (check for WebGL context loss)
- Test should wait for detection interval (200ms) before asserting crop changes
- Use visual regression testing to detect crop changes (compare canvas output)
- Test with multiple browser viewport sizes (fullscreen vs windowed)
- Validate settings persistence across page reloads

**Test Scenarios**:

```typescript
describe('CRT Auto-Crop Border', () => {
  it('enables and detects black bars on PAL content', () => {
    // Load PAL test video with large bottom border
    // Enable auto crop toggle
    // Wait 500ms for detection
    // Verify crop rectangle changed from default
  });
  
  it('smoothness slider affects transition speed', () => {
    // Set smoothness to 0.1 (fast)
    // Trigger crop change
    // Measure frames to convergence
    // Set smoothness to 0.9 (slow)
    // Trigger crop change
    // Verify slower convergence
  });
  
  it('holds crop during fade to black', () => {
    // Load video with fade transition
    // Enable auto crop
    // Verify crop established before fade
    // Play through fade
    // Verify crop didn't change during fade
  });
  
  // ... more scenarios
});
```

**Testing Focus for Task 4:**

> Focus on real-world behavioral validation

**Behaviors to Test:**

**Feature Activation:**
- [ ] **Toggle On**: Enabling toggle activates detection
- [ ] **Toggle Off**: Disabling toggle resets crop to full frame
- [ ] **Page Reload**: Settings persist through reload

**Detection Scenarios:**
- [ ] **Standard Content**: Video with uniform black borders crops correctly
- [ ] **PAL Content**: Larger bottom border detected and cropped
- [ ] **NTSC Content**: Standard borders detected correctly
- [ ] **Pillarbox**: Left/right borders detected and cropped
- [ ] **Letterbox + Pillarbox**: All four sides detected simultaneously

**Stability Scenarios:**
- [ ] **Fade to Black**: Crop holds during fade, doesn't thrash
- [ ] **Full Black Frame**: Crop holds on all-black frame
- [ ] **Scene Change**: New scene with different borders transitions smoothly
- [ ] **Partial Black Content**: Content with dark but not black edges doesn't false-trigger

**User Control:**
- [ ] **Smoothness Low**: Fast transitions visible with low smoothness
- [ ] **Smoothness High**: Slow, smooth transitions with high smoothness
- [ ] **Debug Overlay**: Enabling debug shows visual feedback
- [ ] **Preset Loading**: Presets with auto crop enabled work correctly

**Performance:**
- [ ] **No Frame Drops**: Video plays smoothly during detection
- [ ] **No Console Errors**: No WebGL or JavaScript errors logged
- [ ] **Memory Stable**: No memory leaks over extended playback

**Testing Reference:**

- Use `cy.viewport()` to test different screen sizes
- Use `cy.get('canvas')` to access WebGL canvas for rendering checks
- Mock video sources or use test fixtures from `/fixtures/` folder
- Use Cypress video recording to capture test runs

</details>

---

## 🎯 Phase Success Criteria

### Functional Validation

- [ ] Smoothness slider provides visible control over animation speed
- [ ] Low smoothness (0.1-0.3) transitions quickly, high smoothness (0.7-1.0) transitions slowly
- [ ] Confidence scoring prevents thrashing during undeterministic frames
- [ ] Fade transitions don't cause erratic crop changes
- [ ] Full-black frames hold last known crop
- [ ] Debug overlay accurately visualizes detection state and metrics
- [ ] All E2E tests pass with various content scenarios

### Technical Validation

- [ ] Cubic-bezier easing produces smooth acceleration/deceleration
- [ ] Confidence score accurately reflects detection reliability
- [ ] Hysteresis logic requires 3 consecutive high-confidence samples
- [ ] Luminance variance detection freezes during fades
- [ ] Debug rendering doesn't impact performance (when disabled)
- [ ] All unit and integration tests pass

### User Experience Validation

- [ ] Crop transitions feel natural and camera-like, not robotic
- [ ] No visible jitter or thrashing in normal content
- [ ] Smoothness control is intuitive and responsive
- [ ] Debug overlay provides useful diagnostic information
- [ ] Feature feels stable and production-ready

---

## 🧪 Testing Checklist

- [ ] **Unit Tests**: CropAnimator easing, BlackBarDetector confidence logic
- [ ] **Integration Tests**: Renderer with confidence scoring and hysteresis
- [ ] **Component Tests**: Smoothness slider interaction
- [ ] **E2E Tests**: All scenarios in `crt-auto-crop.cy.ts` pass
- [ ] **Manual Testing**: Test with real C64 capture content
- [ ] **Performance Testing**: Verify no regression with debug overlay enabled
- [ ] **Cross-Browser**: Test in Chrome, Firefox, Edge
- [ ] **Visual Regression**: Compare canvas output before/after transitions

---

## 📝 Implementation Notes

### Key Technical Decisions

- **Easing Function**: Cubic-bezier provides natural acceleration/deceleration feel
- **Confidence Weights**: Edge consistency (60%) weighted higher than temporal (40%) for accuracy
- **Hysteresis**: 3 consecutive samples balances responsiveness vs stability
- **Fade Detection**: 30% luminance drop threshold catches most fades without false positives
- **Debug Overlay**: 2D canvas overlay approach keeps WebGL rendering clean

### Edge Cases Handled

- **Rapid Scene Changes**: Hysteresis prevents thrashing between different border sizes
- **Fade to Black**: Luminance variance detection freezes crop during fades
- **Full-Black Frames**: Confidence scoring keeps crop stable, doesn't snap to (0,0,1,1)
- **Noisy Content**: Edge consistency scoring filters out noisy/compressed video edges
- **Context Loss**: Debug overlay re-initializes on WebGL context restore

### Performance Optimizations

- Debug overlay only renders when enabled (no overhead when off)
- Confidence calculation is lightweight (simple statistics)
- Hysteresis logic short-circuits on first low-confidence sample
- Easing calculation is pure math (no expensive operations)

---

## 🎉 Project Complete!

Once all tasks are complete and success criteria met, the auto crop black bars feature is production-ready with:

✅ Core detection and shader-based cropping
✅ Smooth cubic-bezier easing animation
✅ User-adjustable transition speed control
✅ Confidence scoring and anti-thrash logic
✅ Debug overlay for visualization and tuning
✅ Comprehensive testing coverage (unit, integration, E2E)
✅ Polished user experience with natural camera-like movements

---

## 📅 Estimated Effort

**Total Phase Duration**: 2-3 days

- **Task 1** (Animation System): 4-6 hours (easing + slider + tests)
- **Task 2** (Confidence Scoring): 6-8 hours (algorithm + hysteresis + tests)
- **Task 3** (Debug Overlay): 4-5 hours (canvas rendering + UI toggle)
- **Task 4** (E2E Tests): 6-8 hours (test spec + fixtures + scenarios)

**Testing & Polish**: 4-6 hours (cross-browser, performance validation, edge case handling)
