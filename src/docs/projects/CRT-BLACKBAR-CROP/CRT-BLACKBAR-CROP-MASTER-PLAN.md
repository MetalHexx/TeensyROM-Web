# CRT Blackbar Crop Feature - Master Plan

**Project Overview**: Add intelligent black bar detection and cropping to the CRT effect system for C64 4:3 video content. This feature automatically or manually adjusts the visible viewport to maximize screen real estate by cropping black borders that appear around the active display area. Users can choose between automatic detection with smart snapping, manual control with extreme adjustment range, or disable the feature entirely.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)

---

## 🎯 Project Objective

Enable users to make better use of screen real estate when displaying C64 4:3 video content by intelligently detecting and cropping black bars around the active display area. The system provides three modes: Off (default), Auto (smart detection with known-good snapping), and Manual (three-slider control: Left/Right, Top, Bottom with -30% to +40% range each).

**User Value**: C64 games and demos often have varying amounts of black border around the active screen area. Some use the full border for effects, others have solid black borders. This feature automatically detects the content area and crops to it, or allows users to manually adjust crop levels for creative effects. The auto-detection uses smart snapping to prevent abnormal crop values that might clip content when different images arrive.

**System Benefits**: The crop effect integrates cleanly into the existing WebGL CRT pipeline, applying crop via texture UV coordinates to avoid resampling artifacts. Settings persist across sessions and are accessible alongside other CRT controls. The detection algorithm runs at low frequency (2Hz) to minimize CPU impact.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Foundation & Detection Algorithm</h3></summary>

### Objective

Establish domain contracts for crop settings and implement a performant black bar detection algorithm as a pure, testable utility.

### Key Deliverables

- [ ] Domain contracts (`CrtCropMode` enum, `CrtCropSettings` interface, `CropRect` type) in shared domain layer
- [ ] Black bar detector utility in `libs/utils/video/` with downsample, edge scan, snap-to-known-good logic
- [ ] Unit tests for detector covering edge cases (no bars, minimal bars, asymmetric bars)
- [ ] Known-good crop levels defined as constants (0%, 5%, 8%, 12%, 15%, 18%, 20%)

### High-Level Tasks

1. **Domain Contracts**: Define `CrtCropMode` ('off' | 'auto' | 'manual'), `CrtCropSettings` with threshold, smoothing, manual value properties, and `CropRect` with top/right/bottom/left percentages
2. **Detector Algorithm**: Build `BlackbarDetector` class with configurable luminance threshold, edge sampling strategy, EMA smoothing, and snap-to-nearest-known-good logic
3. **Testing**: Unit tests for detector initialization, edge scanning, snapping behavior, smoothing, and extreme cases

### Open Questions for Phase 1

- **Luminance Threshold**: Confirm 15/255 (5.9%) works well for typical C64 content, or adjust based on initial testing
- **Edge Sampling**: Is 10% edge scan area sufficient, or should it be configurable?

</details>

---

<details open>
<summary><h3>Phase 2: WebGL Crop Integration</h3></summary>

### Objective

Integrate crop stage into the existing WebGL CRT renderer pipeline using UV coordinate manipulation to apply crop without resampling.

### Key Deliverables

- [ ] Crop shader stage added to WebGL renderer with UV offset/scale uniforms
- [ ] `CrtRenderer` extended to accept `CropRect` and apply it before scanline/vignette effects
- [ ] Aspect ratio preservation and pixel rounding for clean crop boundaries
- [ ] Integration tests verifying crop applied correctly to WebGL canvas output

### High-Level Tasks

1. **Shader Extension**: Add crop uniforms (`u_cropOffsetScale`) to vertex shader, adjust UV coordinates before fragment processing
2. **Renderer Integration**: Extend `CrtRenderer.updateSettings()` to accept crop rect, calculate UV offset/scale, bind uniforms
3. **Pipeline Testing**: Verify crop stage integrates cleanly with existing scanline/vignette/curvature effects

### Open Questions for Phase 2

- **Render Order**: Should crop be applied before or after barrel distortion/curvature effects?
- **Aspect Ratio**: How do we handle non-uniform crop when contentAspectRatio is provided?

</details>

---

<details open>
<summary><h3>Phase 3: CRT Effect Wrapper Orchestration</h3></summary>

### Objective

Wire the detector and crop stage into `crt-effect-wrapper` component with auto-detection lifecycle and manual mode support.

### Key Deliverables

- [ ] `crt-effect-wrapper` instantiates `BlackbarDetector`, runs detection at 2Hz when mode is 'auto'
- [ ] Component applies detected or manual crop rect to renderer
- [ ] Detection lifecycle managed (start on video play, stop on pause, cleanup on destroy)
- [ ] Smooth transitions between crop values to avoid visual flicker

### High-Level Tasks

1. **Detection Lifecycle**: Add `BlackbarDetector` instance to wrapper, start detection loop when video plays, feed frames to detector at 2Hz
2. **Crop Application**: Compute `CropRect` from detector output or manual slider, pass to `CrtRenderer.updateSettings()`
3. **Mode Switching**: Handle transitions between Off, Auto, and Manual modes cleanly

### Open Questions for Phase 3

- **Frame Capture**: How do we extract video frames for detection without impacting render performance?
- **Transition Smoothing**: Should crop rect changes animate/ease, or snap instantly?

</details>

---

<details open>
<summary><h3>Phase 4: Settings UI & User Controls</h3></summary>

### Objective

Add crop mode selector and manual slider controls to the CRT settings panel, wired to the application store.

### Key Deliverables

- [ ] Mode dropdown added to `crt-settings-panel` with Off, Auto, Manual options
- [ ] Manual slider (-30% to +40%) visible when Manual mode selected
- [ ] Settings bound to application store with persistence
- [ ] Form validation preventing invalid combinations

### High-Level Tasks

1. **UI Controls**: Add mode dropdown and manual slider to settings panel template
2. **Store Integration**: Extend CRT settings store to include crop mode and manual value
3. **Conditional Visibility**: Show/hide manual slider based on selected mode
4. **Help Text**: Add tooltips explaining each mode

### Open Questions for Phase 4

- **Panel Layout**: Should crop controls go in their own section or alongside screen/scanline settings?
- **Live Preview**: Should auto-detection show visual feedback (detected rect overlay) for debugging?

</details>

---

<details open>
<summary><h3>Phase 5: Testing & Refinement</h3></summary>

### Objective

Comprehensive testing across layers, performance optimization, and user experience polish.

### Key Deliverables

- [ ] Unit tests for detector, store actions, UI interactions
- [ ] Integration tests for wrapper orchestration and renderer pipeline
- [ ] E2E tests for complete user workflows (enable auto, switch to manual, persist settings)
- [ ] Performance profiling confirms <5% CPU impact from detection
- [ ] Documentation updated with usage examples and edge case notes

### High-Level Tasks

1. **Test Coverage**: Write behavioral tests for all layers (detector, wrapper, renderer, UI, store)
2. **Performance**: Profile detection algorithm, optimize downsampling and edge scanning if needed
3. **UX Polish**: Smooth transitions, helpful error states, clear visual feedback
4. **Documentation**: Update component library with crop feature usage, add known limitations

### Open Questions for Phase 5

- **Edge Cases**: How do we handle demos with intentional border effects (scrolling text, raster bars)?
- **Failure Mode**: If detection fails repeatedly, should we auto-disable and notify user?

</details>

---

<details open>
<summary><h2>🏗️ Architecture Overview</h2></summary>

### Key Design Decisions

- **Video Standard Support**: PAL/NTSC toggle with asymmetric snap levels for PAL (larger top border ~23-24 lines vs bottom ~18-20 lines) and symmetric levels for NTSC. Default to PAL for C64 content.
- **Smart Snapping**: Auto-detection snaps to video standard-specific known-good crop levels to prevent abnormal values from tiny center objects clipping subsequent content
- **UV Coordinate Crop**: Crop applied via texture UV offset/scale in vertex shader, not viewport/scissor, to preserve downstream effect calculations
- **Low-Frequency Detection**: 2Hz detection rate balances responsiveness with CPU efficiency
- **EMA Smoothing**: Exponential moving average with alpha=0.3 reduces jitter from frame-to-frame variance
- **Manual Mode Freedom**: Three independent sliders (Left/Right, Top, Bottom) with -30% to +40% range allow PAL-correct asymmetric crops or creative effects. Horizontal slider controls both left and right equally (C64 content is always horizontally centered).
- **Mode-Based Defaults**: Off mode by default ensures no surprises; users opt-in to auto or manual cropping

### Integration Points

- **WebGL Renderer**: Crop stage integrated into `CrtRenderer` as additional shader uniforms, applied before scanline/vignette processing
- **CRT Effect Wrapper**: Orchestrates detector lifecycle, feeds video frames to detector, applies resulting crop rect to renderer
- **Settings Panel**: Existing `crt-settings-panel` component extended with mode dropdown and manual slider, following established patterns
- **Application Store**: Crop settings stored alongside other CRT settings with localStorage persistence

</details>

---

<details open>
<summary><h2>🧪 Testing Strategy</h2></summary>

### Unit Tests

- [ ] Detector edge scanning produces expected crop percentages
- [ ] Snap-to-known-good selects nearest value from predefined set
- [ ] EMA smoothing reduces frame-to-frame jitter
- [ ] Extreme inputs (all black, no black, partial black) handled gracefully
- [ ] Manual slider values clamped to -30% to +40% range (all three sliders)

### Integration Tests

- [ ] Wrapper instantiates detector and feeds frames correctly
- [ ] Renderer applies crop rect to UV coordinates as expected
- [ ] Mode switching (Off → Auto → Manual) works without errors
- [ ] Settings persistence survives page reload

### E2E Tests

- [ ] User enables auto mode, crop adjusts as content plays
- [ ] User switches to manual mode, slider controls crop
- [ ] User disables crop, full frame visible again
- [ ] Settings persist across browser sessions

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

- [ ] Auto mode detects and crops black bars with <5% CPU overhead
- [ ] Manual mode provides three sliders (Left/Right, Top, Bottom) with -30% to +40% range and real-time preview
- [ ] Crop settings persist across sessions via localStorage
- [ ] WebGL crop integration preserves existing effect quality (scanlines, vignette, curvature)
- [ ] UI controls are intuitive with helpful tooltips
- [ ] All unit, integration, and E2E tests pass successfully
- [ ] Documentation updated with usage examples and known limitations
- [ ] Feature ready for alpha release

</details>

---

<details open>
<summary><h2>🎭 User Scenarios</h2></summary>

### Core Functionality Scenarios

<details open>
<summary><strong>Scenario 1: User Enables Auto Crop on Video with Black Borders</strong></summary>

```gherkin
Given a C64 video is playing with 10% black borders on all sides
When the user selects "Auto" from the crop mode dropdown
Then the black bars are detected within 1-2 seconds
And the viewport crops to the content area with smooth transition
And the crop level snaps to the nearest known-good value (8% or 12%)
```

</details>

<details open>
<summary><strong>Scenario 2: User Switches to Manual Mode</strong></summary>

```gherkin
Given auto crop is active and detecting PAL asymmetric bars {top: 12%, bottom: 8%, left: 0%, right: 0%}
When the user selects "Manual" from the crop mode dropdown
Then three manual sliders appear pre-set to current crop values
And Top slider shows 12%, Bottom shows 8%, Left/Right shows 0%
And the user can adjust each slider independently from -30% to +40%
And the crop updates in real-time as sliders move
```

</details>

<details open>
<summary><strong>Scenario 3: User Creates Creative Effect with Negative Crop</strong></summary>

```gherkin
Given manual mode is selected
When the user moves all three sliders to -20%
Then the viewport zooms out, adding black padding around the content
And the CRT effects apply to the padded frame
And the creative "TV in a room" aesthetic is achieved
```

</details>

---

### Auto-Detection Edge Cases

<details open>
<summary><strong>Scenario 4: Content with Minimal Black Bars</strong></summary>

```gherkin
Given a video with only 2% black bars (compression artifacts)
When auto mode is enabled
Then the detector recognizes bars are below minimum threshold (3%)
And the crop stays at 0% (no crop applied)
And no abnormal micro-corrections occur
```

</details>

<details open>
<summary><strong>Scenario 5: Content with Asymmetric Bars</strong></summary>

```gherkin
Given a video with 10% top/bottom bars and 5% left/right bars
When auto mode is enabled
Then the detector averages the crop values
And snaps to the nearest uniform known-good value
And applies symmetric crop to avoid distortion
```

</details>

<details open>
<summary><strong>Scenario 6: Content Changes from Bordered to Borderless</strong></summary>

```gherkin
Given auto crop is active with 12% crop applied
When the video transitions to a borderless demo scene
Then the detector recognizes content now fills the frame
And smoothly transitions crop back to 0%
And the transition is smoothed via EMA over several frames
```

</details>

---

### Settings Persistence

<details open>
<summary><strong>Scenario 7: Settings Persist Across Sessions</strong></summary>

```gherkin
Given the user sets crop mode to "Manual" with Top=15%, Bottom=10%, Left/Right=5%
When the user closes and reopens the application
Then the crop mode is still "Manual"
And the slider values are Top=15%, Bottom=10%, Left/Right=5%
And the setting is applied immediately on video load
```

</details>

---

### Mode Switching

<details open>
<summary><strong>Scenario 8: Switching from Auto to Off</strong></summary>

```gherkin
Given auto mode is active with 10% crop applied
When the user selects "Off" from the dropdown
Then the crop smoothly transitions back to 0%
And the full frame becomes visible
And the detector stops running (CPU usage drops)
```

</details>

</details>

---

<details open>
<summary><h2>📚 Related Documentation</h2></summary>

- **CRT Effect System**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md#crt-effect-system) - Existing CRT components
- **WebGL Renderer**: [crt-renderer.ts](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Current shader pipeline
- **Settings Panel**: [crt-settings-panel.component.ts](../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts) - UI patterns
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

</details>

---

<details open>
<summary><h2>📝 Notes</h2></summary>

### Design Considerations

- **Performance First**: 2Hz detection rate ensures minimal CPU impact even during continuous playback
- **Smart Snapping Rationale**: Prevents abnormal crop values (e.g., 47% from a tiny logo) that would clip future content
- **Three-Slider Manual Design**: Left/Right + Top + Bottom sliders reflect C64 video reality - horizontal centering is always perfect (left=right), but vertical asymmetry exists in PAL (top≠bottom). This avoids unnecessary complexity of 4 sliders while supporting PAL-correct manual crops.
- **Manual Mode Range**: Extreme -30% to +40% range encourages creative experimentation and "happy accidents"
- **Default Off**: Conservative default ensures no unexpected behavior for new users

### Future Enhancement Ideas

- **Preset Crop Levels**: Add quick-select buttons for common C64 modes (320×200 standard, overscan safe, borderless demo)
- **Detection Confidence UI**: Show visual indicator of detection confidence/stability in debug mode
- **Per-Device Settings**: Remember crop preferences per connected TeensyROM device
- **Individual Left/Right Sliders**: Split Left/Right into two independent sliders for extreme asymmetric effects (currently left=right always)

### Summary of Open Questions

**Phase 1:**
- Luminance threshold tuning for C64 content
- Edge sampling area configurability

**Phase 2:**
- Crop render order relative to distortion effects
- Non-uniform crop aspect ratio handling

**Phase 3:**
- Frame capture strategy for detection
- Crop transition smoothing approach

**Phase 4:**
- Panel layout organization for crop controls
- Live detection feedback visualization

**Phase 5:**
- Edge case handling for intentional border effects
- Failure mode user notification strategy

</details>

---

## 💡 Tips for Implementation

**Incremental Development:**
- Phase 1 delivers testable detector utility with no UI dependencies
- Phase 2 proves WebGL integration without detection logic
- Phase 3 combines detector + renderer with orchestration
- Phase 4 adds user-facing controls and persistence
- Phase 5 validates and polishes the complete system

**Testing Approach:**
- Unit test detector in isolation with synthetic frame data
- Integration test renderer with mock crop rects
- E2E test complete user workflows with real video

**Performance:**
- Profile detection algorithm early (Phase 1) to establish baseline
- Monitor CPU usage during Phase 3 integration
- Optimize only if measurements show issues

**UX:**
- Default Off mode prevents surprises
- Auto mode "just works" for most content
- Manual mode is discoverable for creative users
