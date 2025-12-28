# Phase 1: Core Detection & Cropping Infrastructure

## 🎯 Objective

Implement the foundational black bar detection and shader-based cropping system that automatically removes black borders from C64 video capture content. This phase delivers a working auto-crop feature with basic stability, enabling users to toggle the feature on/off while the system intelligently crops black bars and scales content to fill the 4:3 viewport.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md) - Complete project overview
- [ ] [Feature PRD](../PRD.md) - Original feature requirements and rationale
- [ ] [CRT Component Library](../../../COMPONENT_LIBRARY.md#crt-effect-wrapper) - Existing CRT system architecture

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Domain Standards](../../../docs/DOMAIN_STANDARDS.md) - Domain layer patterns (if exists)
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - For UI controls in settings panel
- [ ] [HOW_TO_ADD_WEBGL_EFFECT](../../../HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL shader patterns

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
├── crt-settings.model.ts                    📝 Modified - Add autoCropBlackBars property

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.interface.ts                📝 Modified - Re-export updated interface
├── crt-settings.defaults.ts                 📝 Modified - Add default values
├── webgl/
│   ├── crt-renderer.ts                      📝 Modified - Integrate detection/animation
│   ├── black-bar-detector.ts                ✨ New - Edge sampling and detection logic
│   ├── black-bar-detector.spec.ts           ✨ New - Detection tests
│   ├── crop-animator.ts                     ✨ New - Basic animation (lerp only for Phase 1)
│   ├── crop-animator.spec.ts                ✨ New - Animation tests
│   ├── index.ts                             📝 Modified - Export new classes
│   └── shaders/
│       ├── scanline.frag.ts                 📝 Modified - Add crop uniforms and UV remapping

libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts          📝 Modified - Add toggle control
├── crt-settings-panel.component.html        📝 Modified - Add toggle UI
├── crt-settings-panel.component.spec.ts     📝 Modified - Test toggle interaction
└── crt-slider-configs.ts                    📝 Modified - Export toggle config (if needed)
```

---

<details open>
<parameter name="summary"><h3>✅ Task 1: Domain Model & Settings Infrastructure (COMPLETED)</h3></summary>

**Purpose**: Add `autoCropBlackBars` property to the CRT settings domain model, ensuring it flows through the settings interface, defaults, and persistence layer.

**Related Documentation:**

- [CRT Settings Interface](../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts) - Existing settings structure
- [CRT Settings Defaults](../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts) - Default values and presets

**Implementation Subtasks:**

- [x] **Add Property to Domain Model**: Add `autoCropBlackBars: boolean` to `CrtSettings` interface in `libs/domain/models/crt-settings.model.ts`
- [x] **Update Default Settings**: Add `autoCropBlackBars: true` to `DEFAULT_CRT_SETTINGS` in `crt-settings.defaults.ts`
- [x] **Update All Presets**: Add `autoCropBlackBars: true` to all preset configurations (SMALL_VIDEO_WEBGL, LARGE_VIDEO_WEBGL, etc.)
- [x] **Verify Re-export**: Ensure `CrtSettings` type is properly re-exported through `crt-settings.interface.ts`
- [x] **Test Persistence**: Verify setting persists through `CRT_STORAGE` service (existing infrastructure)

**Testing Subtask:**

- [x] **Write Tests**: Test settings flow and persistence

**Completion Report**: [AUTO-CROP-BLACKBARS-TASK-01-001-REPORT.md](../reports/AUTO-CROP-BLACKBARS-TASK-01-001-REPORT.md)

**Key Implementation Notes:**

- Follow existing pattern: all CRT settings are boolean or number primitives
- Default to `true` (enabled by default per user preference)
- Presets should all include the new property for consistency
- No migration needed - new property defaults to true for existing users

**Testing Focus for Task 1:**

> Focus on settings persistence and default value propagation

**Behaviors to Test:**

- [ ] **Default Value**: New setting defaults to `true` when not present in storage
- [ ] **Persistence**: Setting persists through browser refresh
- [ ] **Preset Loading**: Loading a preset includes the autoCropBlackBars value

**Testing Reference:**

- See existing tests in `crt-settings-panel.component.spec.ts` for preset pattern
- Use `CRT_STORAGE` mock for testing persistence

</details>

---

<details open>
<parameter name="summary"><h3>Task 2: Black Bar Detection Engine</h3></summary>

**Purpose**: Create the `BlackBarDetector` class that samples edge pixels from video/image frames, calculates luminance values, and determines crop rectangle coordinates based on detected black borders.

**Related Documentation:**

- [CrtRenderer](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - WebGL context and texture access
- [Master Plan Detection Algorithm](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#detection-algorithm) - Algorithm specification

**Implementation Subtasks:**

- [ ] **Create BlackBarDetector Class**: New file `black-bar-detector.ts` with clean interface
- [ ] **Implement Edge Sampling**: Sample 10 points along each edge (top/bottom/left/right) using `gl.readPixels()`
- [ ] **Luminance Calculation**: Convert RGB to luminance using `Y = 0.299*R + 0.587*G + 0.114*B`
- [ ] **Black Detection Logic**: Threshold at `Y < 0.15` (configurable constant)
- [ ] **Crop Rectangle Calculation**: Calculate normalized crop rect (0-1 coords) from detected black borders
- [ ] **Sampling Throttle**: Implement 200ms interval timing (only detect every 200ms, not every frame)
- [ ] **Export from Index**: Add to `webgl/index.ts` barrel export

**Testing Subtask:**

- [ ] **Write Tests**: Comprehensive unit tests for detection logic

**Key Implementation Notes:**

- Use `gl.readPixels()` to read pixel data into `Uint8Array` buffer
- Sample sparse grid (10 points per edge) to minimize performance impact
- Return crop rect as `{ left: number, top: number, width: number, height: number }` in normalized 0-1 coordinates
- Handle edge cases: all black frame returns no crop (0,0,1,1), partial black detected on some edges only
- Use `performance.now()` for 200ms throttling

**Critical Interface**:

```typescript
interface CropRect {
  left: number;   // 0-1 normalized
  top: number;    // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
}

class BlackBarDetector {
  detect(gl: WebGLRenderingContext, texture: WebGLTexture, width: number, height: number): CropRect | null;
}
```

**Testing Focus for Task 2:**

> Focus on detection accuracy with various pixel patterns

**Behaviors to Test:**

- [ ] **All Black Frame**: Returns null or (0,0,1,1) - no crop
- [ ] **Black Top Border**: Detects correct top crop value
- [ ] **Black Bottom Border**: Detects correct bottom crop value (common in PAL)
- [ ] **Black Left/Right Borders**: Detects pillarbox borders
- [ ] **All Four Edges**: Detects letterbox + pillarbox combination
- [ ] **Mixed Content**: Handles frames with partial black (threshold logic)
- [ ] **Luminance Calculation**: RGB to Y conversion is accurate
- [ ] **Throttling**: Detection only runs every 200ms, not every frame

**Testing Reference:**

- Mock WebGL context using existing `webgl-context.mock.ts` pattern
- Create test pixel buffers with known patterns
- Verify crop rect calculations match expected values

</details>

---

<details open>
<parameter name="summary"><h3>Task 3: Shader-Based Cropping & Animation</h3></summary>

**Purpose**: Integrate crop functionality into the fragment shader and create the `CropAnimator` class to smoothly interpolate between crop states. Modify `CrtRenderer` to orchestrate detection, animation, and uniform updates.

**Related Documentation:**

- [Scanline Fragment Shader](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts) - Shader to modify
- [CrtRenderer](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Renderer integration point

**Implementation Subtasks:**

- [ ] **Add Crop Uniforms to Shader**: Add `uniform vec4 u_cropRect` to `scanline.frag.ts`
- [ ] **Implement UV Remapping**: Remap texture coordinates before video sampling: `croppedUV = u_cropRect.xy + v_texCoord * u_cropRect.zw`
- [ ] **Create CropAnimator Class**: New file `crop-animator.ts` with linear interpolation (lerp) only for Phase 1
- [ ] **Integrate in CrtRenderer**: Add detector and animator instances to `CrtRenderer` class
- [ ] **Render Loop Integration**: Call detector every 200ms, animator every frame, update uniforms
- [ ] **Feature Toggle Logic**: Respect `autoCropBlackBars` setting - skip detection when false
- [ ] **Uniform Location Storage**: Add `u_cropRect` to uniform locations in renderer
- [ ] **Initial Uniform Setup**: Set crop rect to (0,0,1,1) on init (no crop)

**Testing Subtask:**

- [ ] **Write Tests**: Test animator lerp behavior and renderer integration

**Key Implementation Notes:**

- Shader change is simple 2-line UV remap before texture sample (minimal performance cost)
- CropAnimator uses basic lerp for Phase 1: `current = lerp(current, target, 0.1)` (10% step toward target per frame)
- Detector runs in render loop with 200ms throttle check
- Animator updates `currentCrop` every frame at 60 FPS
- Renderer calls `gl.uniform4f(u_cropRect, left, top, width, height)` each frame
- When feature is off, crop rect stays at (0,0,1,1) - no cropping

**Critical CropAnimator Interface**:

```typescript
class CropAnimator {
  private currentCrop: CropRect = { left: 0, top: 0, width: 1, height: 1 };
  private targetCrop: CropRect = { left: 0, top: 0, width: 1, height: 1 };
  
  setTarget(rect: CropRect): void;
  update(): CropRect; // Returns interpolated current crop
  reset(): void; // Reset to no crop
}
```

**Testing Focus for Task 3:**

> Focus on animation smoothness and renderer integration

**Behaviors to Test:**

**CropAnimator Tests:**
- [ ] **Lerp Convergence**: Current crop converges to target over multiple frames
- [ ] **Lerp Speed**: Interpolation speed is reasonable (reaches 90% in ~20 frames at 10% step)
- [ ] **Reset Behavior**: Reset returns to (0,0,1,1) immediately
- [ ] **Target Update**: Changing target mid-animation smoothly redirects

**CrtRenderer Integration Tests:**
- [ ] **Detector Called**: BlackBarDetector.detect() called on 200ms interval when enabled
- [ ] **Animator Updated**: CropAnimator.update() called every frame
- [ ] **Uniforms Set**: `u_cropRect` uniform updates with animated values
- [ ] **Feature Toggle**: Detection skipped when `autoCropBlackBars` is false
- [ ] **No Crop State**: Uniform stays (0,0,1,1) when feature is off

**Testing Reference:**

- Mock BlackBarDetector to return known crop values
- Verify uniform calls with spy on `gl.uniform4f`
- Test timing with mocked `performance.now()`

</details>

---

<details open>
<parameter name="summary"><h3>✅ Task 4: UI Controls & Settings Panel Integration (COMPLETED)</h3></summary>

**Purpose**: Add a toggle control to the CRT settings panel allowing users to enable/disable auto crop feature, integrated into the existing settings panel structure with proper Material UI styling.

**Related Documentation:**

- [CRT Settings Panel](../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts) - Existing panel structure
- [Style Guide](../../../STYLE_GUIDE.md) - UI component styling patterns

**Implementation Subtasks:**

- [x] **Add Toggle to Template**: Add Material checkbox/slide-toggle control in `crt-settings-panel.component.html`
- [x] **Position in Panel**: Place in "Scanlines & Screen" expansion panel (logical grouping with screen effects)
- [x] **Bind to Settings**: Use `[(ngModel)]` to bind to `settings().autoCropBlackBars`
- [x] **Emit Changes**: Ensure toggle changes emit through `settingsChange` output
- [x] **Add Tooltip**: Add `matTooltip` with description: "Automatically remove black borders from video"
- [x] **Update Tests**: Add test cases for toggle interaction in component spec

**Testing Subtask:**

- [x] **Write Tests**: Test toggle interaction and event emission

**Completion Report**: [AUTO-CROP-BLACKBARS-TASK-01-004-REPORT.md](../reports/AUTO-CROP-BLACKBARS-TASK-01-004-REPORT.md)

**Key Implementation Notes:**

- Follow existing toggle pattern (see vignette, curvature controls)
- Use Material `<mat-slide-toggle>` for consistency with other boolean settings
- Place near top of "Scanlines & Screen" panel (high visibility)
- Label: "Auto-Crop Border"
- Tooltip provides brief explanation of feature
- Changing toggle should immediately emit `settingsChange` event

**UI Structure Example**:

```html
<!-- In "Scanlines & Screen" expansion panel -->
<div class="crt-control-group">
  <mat-slide-toggle
    [ngModel]="settings().autoCropBlackBars"
    (ngModelChange)="onToggleChange('autoCropBlackBars', $event)"
    [matTooltip]="'Automatically remove black borders from video'">
    Auto-Crop Border
  </mat-slide-toggle>
</div>
```

**Testing Focus for Task 4:**

> Focus on UI interaction and event emission

**Behaviors to Test:**

- [x] **Toggle Renders**: Toggle control renders with correct initial state
- [x] **Toggle Interaction**: Clicking toggle emits `settingsChange` with updated value
- [x] **Settings Update**: Parent component receives new settings with toggled value
- [x] **Tooltip Displays**: Tooltip text appears on hover
- [x] **Preset Integration**: Loading preset with autoCropBlackBars updates toggle state

**Testing Reference:**

- See existing toggle tests in `crt-settings-panel.component.spec.ts`
- Use `MatSlideToggleHarness` for Material component testing
- Verify `settingsChange.emit()` calls with spy

</details>

---

## 🎯 Phase Success Criteria

### Functional Validation

- [ ] Toggle control in settings panel enables/disables auto crop feature
- [ ] Black bars are visibly detected and cropped from test video content
- [ ] Cropped content scales to fill 4:3 viewport
- [ ] Feature works with both video and static image content
- [ ] Settings persist across browser sessions
- [ ] Feature can be toggled on/off without errors

### Technical Validation

- [ ] BlackBarDetector samples edges and calculates crop rect correctly
- [ ] CropAnimator smoothly interpolates between crop states
- [ ] Fragment shader remaps UVs correctly based on crop uniforms
- [ ] CrtRenderer integrates all components with 200ms detection interval
- [ ] All unit tests pass with >80% coverage for new code
- [ ] No performance regression (detection runs at 200ms, not every frame)

### User Experience Validation

- [ ] Common C64 content with black borders shows visible crop effect
- [ ] Transitions between crops are smooth (basic lerp interpolation)
- [ ] No console errors or WebGL warnings
- [ ] Feature feels stable (no extreme jitter from frame-to-frame noise)

---

## 🧪 Testing Checklist

- [ ] **Unit Tests**: BlackBarDetector, CropAnimator classes tested independently
- [ ] **Integration Tests**: CrtRenderer integration with detector/animator verified
- [ ] **Component Tests**: Settings panel toggle interaction tested
- [ ] **Manual Testing**: Load test video with black bars, verify crop activates
- [ ] **Performance Testing**: Verify 200ms detection interval, no frame drops
- [ ] **Cross-Browser**: Test in Chrome, Firefox, Edge (WebGL compatibility)

---

## 📝 Implementation Notes

### Key Technical Decisions

- **Detection Sampling**: 10 points per edge provides good balance of accuracy vs performance
- **Luminance Threshold**: 0.15 accounts for capture noise while catching true blacks
- **Animation**: Basic lerp (10% step) for Phase 1 - more sophisticated easing in Phase 2
- **Default State**: Feature enabled by default (user preference confirmed)
- **Shader Approach**: UV remapping in shader is more performant than CPU-side cropping

### Edge Cases Handled

- **All Black Frame**: Detector returns null or (0,0,1,1), no cropping applied
- **Partial Black**: Only edges with >70% black pixels are considered borders
- **Feature Disabled**: Detection skipped, uniform stays at (0,0,1,1)
- **Context Loss**: Uniforms re-initialized on WebGL context restore

### Performance Considerations

- Detection runs at 200ms intervals (5 FPS) - not every frame
- Edge sampling is sparse (10 points) - not full frame scan
- Shader overhead is minimal (2-line UV remap before texture sample)
- Animation runs at 60 FPS but is simple lerp calculation (fast)

---

## 🚀 Ready for Phase 2

Once all tasks are complete and success criteria met, Phase 2 will add:

- Smooth easing animation (cubic bezier instead of linear lerp)
- User-adjustable crop smoothness slider
- Confidence scoring to prevent thrashing
- Debug overlay for visualization and tuning
- Comprehensive E2E tests with various content scenarios

---

## 📅 Estimated Effort

**Total Phase Duration**: 2-3 days

- **Task 1** (Domain Model): 2-3 hours
- **Task 2** (Detection Engine): 6-8 hours (core algorithm + tests)
- **Task 3** (Shader Integration): 6-8 hours (shader + animator + renderer integration)
- **Task 4** (UI Controls): 2-3 hours (straightforward toggle addition)

**Testing & Polish**: 4-6 hours (manual testing, bug fixes, edge case handling)
