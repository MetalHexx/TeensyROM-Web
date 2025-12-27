# Auto-Crop Border - Master Plan

## 🎯 Project Objective

Add an optional **"Auto-Crop Border"** feature to the TeensyROM Web CRT pipeline that automatically eliminates visible black borders around C64 capture content. When enabled, the system continuously analyzes incoming frames to detect black bars on all sides, then smoothly crops and scales the active content to fill the available 4:3 viewport. This enhancement improves the viewing experience across C64 games and programs that present varying border usage, especially in PAL mode where bottom borders are often larger than top borders.

**User Value**: Users watching their real C64 through TeensyROM CRT effects will see the video automatically remove black bars so the active picture uses the full 4:3 space, without abrupt jumps. The feature provides a familiar "camera operator" experience with smooth, gradual adjustments rather than jarring snaps.

**Technical Implementation**: The feature leverages the existing WebGL post-processing pipeline where the `CrtRenderer` already samples video frames as textures. Black bar detection runs in the renderer by sampling edge pixels using `gl.readPixels()`, calculating a crop rectangle, and smoothly animating toward new crops via shader uniforms. This approach is performant, running detection sampling at 200ms intervals (5 FPS) while the animation smooths out transitions at 60 FPS.

---

## 📚 Standards Documentation

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Store Testing**: [STORE_TESTING.md](../../STORE_TESTING.md)
- **Smart Component Testing**: [SMART_COMPONENT_TESTING.md](../../SMART_COMPONENT_TESTING.md)

---

## 📋 Implementation Phases

### Phase 1: Core Detection & Cropping Infrastructure ✅ COMPLETE

**Objective**: Implement the foundational black bar detection and shader-based cropping system, enabling automatic black bar removal with basic stability controls.

**Key Deliverables**:
- [x] `BlackBarDetector` class with edge pixel sampling and luminance-based black detection
- [x] `CropAnimator` class with easing functions for smooth transitions
- [x] Modified fragment shader with crop/scale uniforms
- [x] `autoCropBlackBars` setting added to domain model with persistence
- [x] Basic toggle in CRT settings panel
- [x] Unit tests for detection and animation logic

**Status**: ✅ Complete (December 25, 2024)

**Tasks**:
- ✅ [AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS](./tasks/AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS.md) - Add settings properties to domain
- ✅ [AUTO-CROP-BLACKBARS-TASK-01-002-BLACK-BAR-DETECTOR](./tasks/AUTO-CROP-BLACKBARS-TASK-01-002-BLACK-BAR-DETECTOR.md) - Implement black bar detection logic
- ✅ [AUTO-CROP-BLACKBARS-TASK-01-003-SHADER-CROP](./tasks/AUTO-CROP-BLACKBARS-TASK-01-003-SHADER-CROP.md) - Add shader crop/scale uniforms
- ✅ [AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS](./tasks/AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS.md) - Add settings panel controls

**Post-Completion Analysis**: Phase 1 successfully implemented edge detection using HSV saturation checks, but black bar **depth detection** failed across 7 different approaches (see [Task 01-002 Report](./reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md) for details). Current implementation uses fixed 8px crop fallback, which works for thin bars but fails for thick bars (>20px). Phase 1.1 addresses these limitations with GPU-based detection.

---

### Phase 1.1: Advanced WebGL-Based Black Bar Detection 🚧 NEXT

**Objective**: Redesign black bar detection to use GPU compute shaders for pixel-perfect depth measurement, eliminating the performance bottlenecks and depth detection failures from Phase 1. Move all detection work to WebGL fragment shaders running on the GPU at 60 FPS without CPU overhead.

**Key Deliverables**:
- [ ] Multi-pass GPU detection pipeline (edge detection → depth scanning → results readback)
- [ ] Fragment shaders using histogram variance analysis for content boundary detection
- [ ] `DetectionPassRenderer` class managing render targets and shader programs
- [ ] `EdgeAnalysisProcessor` class for GPU results interpretation
- [ ] Debug visualization overlay showing detection process in real-time
- [ ] Performance: < 5ms detection overhead, maintains 60 FPS rendering
- [ ] Accuracy: ± 2px for thin bars, ± 5px for thick bars (50-100px)

**Status**: 🔲 Not Started

**Rationale**: Phase 1's CPU-based detection hit fundamental performance limits (40+ `gl.readPixels()` calls per frame caused stalls) and failed to distinguish between content boundaries and uniform black bars. GPU-based detection enables advanced algorithms (histogram variance, edge analysis) at real-time speeds and can accurately measure bars of any thickness.

**Tasks**:
- [AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER](./tasks/AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER.md) - Create edge detection fragment shader with HSV dual-threshold
- [AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS](./tasks/AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS.md) - Horizontal and vertical depth scanning shaders
- [AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION](./tasks/AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION.md) - Integrate detection pipeline into CrtRenderer
- [AUTO-CROP-BLACKBARS-TASK-01.1-004-DEBUG-OVERLAY](./tasks/AUTO-CROP-BLACKBARS-TASK-01.1-004-DEBUG-OVERLAY.md) - Debug visualization and settings

**See**: [Phase 1.1 Plan](./phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md)

---

### Phase 2: Smooth Transitions & User Control

**Objective**: Add smooth animation, user-adjustable transition speed, confidence scoring to prevent thrashing, and debug visualization for tuning.

**Key Deliverables**:
- [ ] Easing animation with configurable speed via `cropSmoothness` setting
- [ ] Confidence scoring and hysteresis to prevent jitter
- [ ] "Crop Smoothness" slider in settings panel
- [ ] Optional debug overlay showing detected crop rectangle
- [ ] Comprehensive behavioral tests for animation and stability
- [ ] E2E tests with various C64 content scenarios

**Status**: 🔲 Not Started

**Tasks**:
- [AUTO-CROP-BLACKBARS-TASK-02-001-ANIMATION-SYSTEM](./tasks/AUTO-CROP-BLACKBARS-TASK-02-001-ANIMATION-SYSTEM.md) - Implement smooth easing and user control
- [AUTO-CROP-BLACKBARS-TASK-02-002-CONFIDENCE-SCORING](./tasks/AUTO-CROP-BLACKBARS-TASK-02-002-CONFIDENCE-SCORING.md) - Add stability and anti-thrash logic
- [AUTO-CROP-BLACKBARS-TASK-02-003-DEBUG-OVERLAY](./tasks/AUTO-CROP-BLACKBARS-TASK-02-003-DEBUG-OVERLAY.md) - Add debug visualization
- [AUTO-CROP-BLACKBARS-TASK-02-004-E2E-TESTS](./tasks/AUTO-CROP-BLACKBARS-TASK-02-004-E2E-TESTS.md) - Comprehensive end-to-end testing

---

## 🏗️ Architecture Overview

### System Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│ CrtSettingsPanelComponent (UI Layer)                        │
│ - Toggle: "Auto-Crop Border"                           │
│ - Slider: "Crop Smoothness" (0-1)                          │
│ - Emits settingsChange events                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ CrtSettings (Domain Model)                                  │
│ - autoCropBlackBars: boolean                                │
│ - cropSmoothness: number                                    │
│ - Persisted via CRT_STORAGE                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ CrtEffectWrapperComponent                                   │
│ - Passes settings to CrtRenderer                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ CrtRenderer (WebGL)                                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ BlackBarDetector                                       │ │
│  │ - Samples edge pixels (200ms intervals)               │ │
│  │ - Luminance threshold detection                       │ │
│  │ - Calculates crop rectangle                           │ │
│  │ - Confidence scoring                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ CropAnimator                                           │ │
│  │ - Eases current crop toward target                    │ │
│  │ - Cubic bezier easing function                        │ │
│  │ - Respects cropSmoothness setting                     │ │
│  │ - Updates uniforms each frame (60 FPS)                │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Fragment Shader (scanline.frag.ts)                     │ │
│  │ uniform vec4 u_cropRect;                               │ │
│  │ - Remaps texture coordinates                           │ │
│  │ - Scales cropped content to viewport                  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Detection Algorithm

**Edge Sampling Strategy**:
- Sample 10 points along each edge (top, bottom, left, right)
- Convert RGB to luminance: `Y = 0.299*R + 0.587*G + 0.114*B`
- Black threshold: `Y < 0.15` (configurable, accounts for capture noise)
- Run detection every 200ms (5 FPS sampling rate)

**Crop Calculation**:
```typescript
// Pseudocode
for each edge:
  count consecutive black pixels from edge inward
  if (blackCount / totalSamples) > 0.7:  // 70% threshold
    cropEdge = blackCount / edgeLength  // normalized 0-1
```

**Confidence Scoring**:
```typescript
confidence = (edgeConsistency * 0.6) + (temporalStability * 0.4)
// edgeConsistency: How uniformly black the detected border is
// temporalStability: How similar this crop is to previous samples

// Only commit crop change if confidence > 0.7 for 3+ consecutive samples
```

**Animation**:
```typescript
// Cubic bezier easing (ease-in-out)
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Each frame (60 FPS):
currentCrop = lerp(currentCrop, targetCrop, easingFactor * cropSmoothness)
```

---

## 🧪 Testing Strategy

### Unit Tests

**BlackBarDetector Tests** (`libs/ui/components/.../webgl/black-bar-detector.spec.ts`):
- Edge sampling logic with various pixel patterns
- Luminance calculation accuracy
- Crop rectangle calculation from sample data
- Confidence scoring with different scenarios

**CropAnimator Tests** (`libs/ui/components/.../webgl/crop-animator.spec.ts`):
- Easing function behavior (ease-in-out curve)
- Lerp interpolation with various speeds
- Smoothness setting impact on animation speed
- Animation convergence to target

**Settings Panel Tests** (`libs/ui/components/.../crt-settings-panel.component.spec.ts`):
- Toggle interaction emits correct settings
- Slider interaction updates cropSmoothness value
- Settings persistence through preset system

### Integration Tests

**CrtRenderer Integration** (`libs/ui/components/.../crt-renderer.spec.ts`):
- Detection triggers crop calculation
- Animator receives detector output
- Shader uniforms update with animated values
- Feature toggles on/off correctly

### E2E Tests (Cypress)

**Auto Crop Scenarios** (`apps/teensyrom-ui-e2e/src/e2e/crt-auto-crop.cy.ts`):
- Load video with black bars → verify crop activates
- Toggle feature on/off → verify smooth transitions
- Adjust smoothness slider → verify animation speed changes
- Test with different content: PAL/NTSC, various border sizes
- Test edge cases: full-black frames, fade transitions, tiny sprites

---

## 📊 Success Criteria

### Functional Requirements

- [x] Toggle enables/disables auto crop feature
- [ ] Black bars are detected and cropped from video content
- [ ] Transitions between crop states are smooth (no jarring jumps)
- [ ] Feature works with both video and image content
- [ ] Settings persist across sessions
- [ ] Smoothness slider provides noticeable control over transition speed

### Performance Requirements

- [ ] Detection sampling runs at 200ms intervals (5 FPS) without frame drops
- [ ] Animation runs at 60 FPS with smooth interpolation
- [ ] No visible performance degradation during detection
- [ ] Shader overhead is negligible (< 1ms per frame)

### User Experience Requirements

- [ ] Common C64 content with black borders visibly crops to fill 4:3 view
- [ ] Crop changes feel natural, like a camera operator adjusting framing
- [ ] Full-black frames or undeterministic content don't cause thrashing
- [ ] Feature feels stable during scene transitions and fades
- [ ] Debug overlay (when enabled) clearly shows detection zones

### Quality Requirements

- [ ] All unit tests pass with > 80% code coverage for new code
- [ ] Integration tests verify detector → animator → shader pipeline
- [ ] E2E tests validate real-world scenarios with video content
- [ ] No regressions in existing CRT effects
- [ ] Code follows established patterns from CRT effect system

---

## 🚀 Rollout Strategy

### Phase 1 Rollout

**Scope**: Core detection and cropping with basic toggle

**Default Configuration**:
- `autoCropBlackBars: true` (enabled by default per user preference)
- Detection runs at 200ms intervals
- Basic stability (no advanced confidence scoring yet)

**User Communication**:
- Release notes explaining new auto crop feature
- Settings panel tooltip: "Automatically remove black borders from video"
- Link to GitHub issue for feedback

**Success Metrics**:
- No performance regressions reported
- Feature toggle works reliably
- Basic crop functionality works for common content

### Phase 2 Rollout

**Scope**: Smooth transitions, user control, advanced stability

**New Configuration**:
- `cropSmoothness: 0.5` (default medium smoothness)
- Confidence scoring prevents thrashing
- Debug overlay for advanced users

**User Communication**:
- Release notes highlighting smooth transitions and new slider
- Settings tooltip for smoothness slider: "Control how quickly the crop adjusts (slower = smoother)"
- Optional debug overlay mentioned in advanced settings docs

**Success Metrics**:
- Positive user feedback on smoothness
- No reports of crop thrashing or jitter
- Debug overlay helps users understand feature behavior

---

## ❓ Open Questions

### Design Decisions Made

✅ **Default State**: Auto crop ON by default (per user preference)
✅ **Sampling Frequency**: 200ms intervals (5 FPS) for balance of responsiveness and performance
✅ **User Control Exposure**: Toggle + smoothness slider (Phase 2)
✅ **PAL/NTSC Awareness**: Not needed for Phase 1/2 (future enhancement)

### Decisions Deferred to Implementation

**Phase 1**:
- **Black Threshold**: Start with Y < 0.15, tune during testing if needed
- **Sample Grid Density**: 10 points per edge initially, adjust if detection is unreliable
- **Edge Consistency Threshold**: 70% black pixels to consider edge as border, tune if needed

**Phase 2**:
- **Confidence Score Weights**: edgeConsistency (0.6) vs temporalStability (0.4) - tune based on testing
- **Hysteresis Parameters**: How many consecutive high-confidence samples before committing crop change
- **Debug Overlay Design**: Exact visual representation of detection zones and confidence

### Future Enhancements (Post-Phase 2)

- **PAL/NTSC Mode Detection**: Use video format metadata to bias detection expectations
- **Content Mode Profiles**: Detect standard/extended/open-border modes for smarter cropping
- **Max Zoom Limit**: Prevent extreme crops (e.g., don't zoom > 150% of original)
- **User Threshold Override**: Advanced slider for black detection sensitivity
- **Adaptive Sampling**: Increase sampling rate during detected scene changes

---

## 📝 Related Documentation

- **Feature PRD**: [PRD.md](./PRD.md) - Original feature proposal with full requirements
- **CRT Effect System**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md#crt-effect-wrapper) - Existing CRT components
- **WebGL Rendering**: [HOW_TO_ADD_WEBGL_EFFECT.md](../../HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL patterns
- **Domain Models**: [DOMAIN_STANDARDS.md](../../DOMAIN_STANDARDS.md) - Domain layer patterns

---

## 📅 Timeline Estimate

**Phase 1**: 2-3 days
- Day 1: Domain model + detection engine
- Day 2: Shader integration + UI controls
- Day 3: Testing and polish

**Phase 2**: 2-3 days
- Day 1: Animation system + confidence scoring
- Day 2: Debug overlay + UI polish
- Day 3: E2E testing and final validation

**Total**: 4-6 days for complete implementation

---

## 🎯 Definition of Done

**Phase 1 Complete When**:
- [ ] All Phase 1 tasks checked off
- [ ] Unit tests pass for detector and basic animation
- [ ] Integration tests verify renderer pipeline
- [ ] Manual testing shows basic crop functionality works
- [ ] Code reviewed and merged to main branch

**Phase 2 Complete When**:
- [ ] All Phase 2 tasks checked off
- [ ] Smoothness slider provides visible control
- [ ] Confidence scoring prevents thrashing in edge cases
- [ ] Debug overlay renders correctly
- [ ] E2E tests pass for various content scenarios
- [ ] Performance metrics meet requirements
- [ ] Feature documented in release notes

**Project Complete When**:
- [ ] All phases complete
- [ ] All success criteria met
- [ ] Documentation updated
- [ ] Feature deployed to production
- [ ] User feedback collected and addressed
