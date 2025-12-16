# Barrel Distortion CRT Effect - Master Plan

**Project Overview**: Add barrel distortion (geometric warping) effect to the CRT emulation system to authentically simulate how real curved CRT screens geometrically warped the image to fit curved glass. This effect will be implemented as a WebGL shader effect in the existing `crt-effect-wrapper` component, with a new slider control in `crt-settings-panel` grouped with vignette and screen curvature effects.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **CRT System Documentation**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

Enable users to experience authentic barrel distortion effects that replicate how real CRT monitors geometrically warped images to conform to curved glass surfaces. This visual effect enhances the CRT emulation by adding subtle geometric warping controlled by an intensity parameter, with automatic influence from the existing screen curvature setting.

**First Paragraph**: The barrel distortion effect adds geometric image warping that authentically simulates how real curved CRT screens displayed content. Unlike the CSS border-radius `screenCurvature` effect that merely rounds the container edges, barrel distortion warps the actual image content in a pincushion or barrel pattern, creating a more realistic curved screen appearance.

**Second Paragraph**: Users will control distortion intensity through a new slider in the CRT settings panel, grouped naturally with vignette and screen curvature effects. The distortion amount will automatically respond to the screen curvature setting - higher curvature will increase the base distortion effect, while the user-controlled intensity parameter acts as a multiplier to fine-tune or disable the effect entirely.

**Third Paragraph**: This enhancement integrates seamlessly into the existing WebGL post-processing pipeline, leveraging the GPU for real-time distortion calculations without impacting performance. The feature updates all built-in presets and configurations to include sensible defaults, maintaining backward compatibility while providing a richer, more authentic CRT experience.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Domain Model & Interface Updates</h3></summary>

### Objective

Extend the domain layer with the new `barrelDistortion` property in the `CrtSettings` interface, update all preset configurations with default values, and verify the `CrtSettingsConfig` interface includes the `showDistortion` feature flag. This establishes the contract for the distortion effect across all layers. **All changes are completed in a single cohesive task** to ensure consistency and avoid partial states.

### Key Deliverables

- [ ] `CrtSettings` interface extended with `barrelDistortion: number` property (0-0.5 range)
- [ ] All CRT presets (SMALL_VIDEO_WEBGL, LARGE_VIDEO_WEBGL, SMALL_IMAGE_WEBGL) updated with distortion values
- [ ] `CrtSettingsConfig` interface verified to include `showDistortion` flag
- [ ] CRT_CONFIGS verified to show distortion control with appropriate visibility settings
- [ ] Type definitions and comprehensive JSDoc comments complete
- [ ] Unit tests verify interface integrity, preset values, and config flags

### Implementation Approach

**Single Task**: [BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION](phases/BARREL-DISTORTION-PHASE-01-DOMAIN-MODEL.md#task) combines all related work:
1. Add `barrelDistortion` property to `CrtSettings` interface
2. Update all three presets with context-appropriate default values
3. Verify `showDistortion` flag is properly configured in all config variants
4. Write comprehensive unit tests for domain model, presets, and configs

This unified approach ensures all related changes are made together, avoiding coordination overhead and partial implementation states.

### Open Questions for Phase 1

- **Distortion Value Range**: What are appropriate min/max values? Suggest 0-0.5 where 0 = no distortion, 0.5 = strong distortion (align with chromatic aberration range).
- **Preset Default Values**: Should small presets have minimal distortion (0.05)? Should large preset have moderate distortion (0.15)? Or all zero by default for backward compatibility?
- **Screen Curvature Coupling**: Should distortion be automatically influenced by `screenCurvature` in the shader, or should they be independent settings? (Recommendation: automatic coupling - curvature provides base distortion, slider provides multiplier)

</details>

---

<details open>
<summary><h3>Phase 2: WebGL Shader Implementation</h3></summary>

### Objective

Implement the barrel distortion effect as a coordinate transformation in the GLSL fragment shader, applying geometric warping before texture sampling. The distortion calculation should consider the screen curvature setting to automatically adjust the base distortion amount.

**Critical**: Fullscreen displays (like video-dialog) require special handling for aspect ratio mismatches. When displaying 4:3 video content on 16:9 displays with `contentAspectRatio` set and `object-fit: contain`, the distortion effect must be constrained to the visible video area (similar to how vignette and curvature handle letterboxing). Setting `barrelDistortion: 0` must completely disable the effect for zero performance overhead.

### Key Deliverables

- [ ] New `u_barrelDistortion` uniform added to shader
- [ ] Geometric warping function implemented (barrel/pincushion formula)
- [ ] Distortion applied during UV coordinate calculation before texture sampling
- [ ] Screen curvature influence integrated (higher curvature = higher base distortion)
- [ ] Shader properly handles edge cases (coordinates outside 0-1 range)
- [ ] **Aspect ratio handling**: Distortion respects `contentAspectRatio` to avoid warping letterbox/pillarbox areas (like vignette/curvature do)
- [ ] **Zero-intensity optimization**: `barrelDistortion: 0` completely disables distortion calculation for performance
- [ ] Unit tests for CrtRenderer verify uniform binding and update
- [ ] Shader compiles without errors in all WebGL contexts

### High-Level Tasks

1. **Add Shader Uniform**: Add `uniform float u_barrelDistortion;` to fragment shader
2. **Implement Distortion Function**: Create GLSL function that applies barrel/pincushion warping formula to UV coordinates
3. **Integrate with Texture Sampling**: Apply distortion to UV coords before sampling `u_videoTexture`
4. **Add Curvature Coupling**: Use `u_screenCurvature` to modulate base distortion amount
5. **Update CrtRenderer**: Add uniform location binding and update method for `barrelDistortion` setting
6. **Write Tests**: Unit tests for uniform binding, settings update, and shader compilation

### Open Questions for Phase 2

- **Distortion Formula**: Use simple radial formula `r' = r * (1 + k * r²)` where k = distortion amount? Or more complex polynomial?
- **Edge Handling**: Should distorted coordinates outside 0-1 sample black, or clamp to edge? (Recommendation: clamp to edge for seamless appearance)
- **Curvature Influence Formula**: Linear coupling `distortion = barrelDistortion * (1 + screenCurvature * 0.005)`? Or exponential?
- **Aspect Ratio Integration**: Should distortion use the same clip-path system that vignette/curvature use for `contentAspectRatio` handling? Or implement a different approach?

</details>

---

<details open>
<summary><h3>Phase 3: Settings Panel UI Integration</h3></summary>

### Objective

Add a new barrel distortion slider to the `crt-settings-panel`, positioned in the visual effects group alongside vignette and screen curvature controls. The slider provides user control over distortion intensity with appropriate range, step, and formatting.

### Key Deliverables

- [ ] New `SliderConfig` added to `crt-slider-configs.ts` for barrel distortion
- [ ] Slider rendered in settings panel HTML template
- [ ] Slider grouped with vignette and curvature controls
- [ ] Slider respects `config.showDistortion` flag for visibility
- [ ] Value changes emit `settingsChange` event with updated settings
- [ ] Slider displays appropriate units and decimal precision
- [ ] Unit tests verify slider configuration, visibility, and value emission

### High-Level Tasks

1. **Create Slider Config**: Add `DISTORTION_SLIDER` configuration to slider configs with appropriate min/max/step
2. **Update Template**: Add distortion slider to settings panel HTML in the visual effects section
3. **Update Component Logic**: Ensure slider value changes are properly handled and emitted
4. **Update Config Handling**: Verify slider visibility is controlled by `config.showDistortion`
5. **Write Tests**: Unit tests for slider rendering, value changes, config-driven visibility

### Open Questions for Phase 3

- **Slider Range**: Use 0-0.5 with step 0.01 (percentage format)? Or 0-1?
- **Slider Label**: "Barrel Distortion" or "Image Distortion" or "Geometric Warp"?
- **Positioning**: Should distortion be immediately after curvature, or after vignette?

</details>

---

<details open>
<summary><h3>Phase 4: Integration Testing & Documentation</h3></summary>

### Objective

Validate the complete barrel distortion feature through comprehensive integration and E2E testing, update documentation to reflect the new capability, and ensure presets provide a polished user experience.

### Key Deliverables

- [ ] Integration tests verify settings flow from panel → wrapper → renderer → shader
- [ ] E2E tests validate distortion toggle, slider adjustment, preset loading
- [ ] Component library documentation updated with barrel distortion examples
- [ ] CRT system documentation updated with shader architecture details
- [ ] Preset values finalized based on visual testing
- [ ] All tests passing in CI pipeline

### High-Level Tasks

1. **Write Integration Tests**: Test settings panel → effect wrapper → WebGL renderer data flow
2. **Write E2E Tests**: Test user interactions with distortion slider and preset switching
3. **Update Documentation**: Add barrel distortion details to COMPONENT_LIBRARY_CRT.md
4. **Visual Testing**: Manually verify distortion appearance with various curvature values
5. **Finalize Presets**: Adjust preset distortion values based on visual quality
6. **CI Validation**: Ensure all automated tests pass

### Open Questions for Phase 4

- **Preset Values**: After visual testing, should we use non-zero defaults or keep all at 0 for opt-in behavior?
- **Performance Testing**: Should we benchmark the shader performance impact on low-end devices?

</details>

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **WebGL Shader Implementation**: Barrel distortion is implemented as a coordinate transformation in the GLSL fragment shader, applied before texture sampling. This ensures authentic geometric warping rendered by the GPU with zero CPU overhead. The distortion happens in UV-space before the video texture is sampled, creating true image warping rather than post-process filtering.

- **Screen Curvature Coupling**: The barrel distortion effect automatically responds to the `screenCurvature` setting, using curvature as a base multiplier for the distortion amount. This creates a cohesive visual experience where increasing border-radius curvature also increases geometric image warping, mimicking how real CRT screens had both curved glass and distorted images. The user's `barrelDistortion` slider acts as an intensity multiplier on top of this base.

- **Grouped UI Controls**: The distortion slider is positioned in the settings panel alongside vignette and curvature controls, as all three effects are visual/geometric in nature (not scanlines, not color filters, not phosphor patterns). This grouping makes intuitive sense to users - curvature curves the container, vignette darkens the edges, distortion warps the image.

- **Preset Integration**: All built-in presets (small video, large video, small image) are updated with sensible default distortion values. Small presets use minimal distortion to avoid excessive warping on compact displays, while large presets use moderate distortion for immersive fullscreen viewing. This maintains the preset system's philosophy of context-appropriate defaults.

### Integration Points

- **Domain Layer**: The `CrtSettings` interface in `libs/domain/models/crt-settings.model.ts` is extended with the `barrelDistortion` property. This model is shared across all layers via the domain layer's public API, ensuring type safety everywhere the settings object flows.

- **WebGL Renderer**: The `CrtRenderer` class in `libs/ui/components/crt-effect-wrapper/webgl/crt-renderer.ts` is extended to bind a new `u_barrelDistortion` uniform to the shader. The `updateSettings()` method passes the distortion value to the GPU, and the `scanline.frag.ts` shader applies the geometric transformation. The shader must handle aspect ratio constraints (via `contentAspectRatio`) to avoid distorting letterbox/pillarbox areas in fullscreen mode, similar to vignette and curvature effects. When `barrelDistortion: 0`, the shader skips the distortion calculation entirely for optimal performance.

- **Settings Panel**: The `CrtSettingsPanelComponent` in `libs/ui/components/crt-settings-panel/` adds a new slider configuration to `crt-slider-configs.ts`. The slider emits settings changes that flow up to parent components (video dialog, video capture view), which update their CRT settings signal, triggering re-render in the effect wrapper.

- **Effect Wrapper**: The `CrtEffectWrapperComponent` receives updated settings via its `settings` input, passes them to the WebGL renderer, and triggers render. The wrapper itself requires no changes beyond receiving the extended `CrtSettings` object - the renderer handles everything.

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] Domain model tests verify `CrtSettings` interface includes `barrelDistortion` property
- [ ] Preset tests verify all three presets have valid distortion values (0-0.5 range)
- [ ] Config tests verify `showDistortion` flag exists and defaults correctly
- [ ] Shader compilation tests verify uniform is bound correctly
- [ ] Renderer tests verify `updateSettings()` passes distortion to shader
- [ ] Slider config tests verify distortion slider has correct min/max/step/format

### Integration Tests

- [ ] Settings panel → effect wrapper data flow (slider change updates wrapper)
- [ ] Effect wrapper → WebGL renderer data flow (wrapper passes settings to renderer)
- [ ] Renderer → shader uniform binding (distortion value reaches GPU)
- [ ] Config-driven visibility (slider hidden when `showDistortion` is false)
- [ ] Preset loading updates distortion value correctly

### E2E Tests

- [ ] User adjusts distortion slider and sees immediate visual effect
- [ ] User toggles CRT effects and distortion toggles with it
- [ ] User switches between presets and distortion value updates
- [ ] User sets curvature to 0 and distortion still functions
- [ ] User sets curvature to max and distortion is appropriately amplified

---

## ✅ Success Criteria

### Phase 1: Domain Model
- [ ] `barrelDistortion` property added to `CrtSettings` interface with JSDoc (0-0.5 range)
- [ ] All three CRT presets include default distortion values (0, 0.15, 0 respectively)
- [ ] `CrtSettingsConfig` verified to include `showDistortion` flag with correct values
- [ ] All Phase 1 unit tests pass

### Phase 2: WebGL Shader (Future)
- [ ] WebGL fragment shader implements geometric warping before texture sampling
- [ ] Shader considers screen curvature when calculating base distortion amount
- [ ] Aspect ratio handling for fullscreen letterboxing (like vignette/curvature)
- [ ] Zero-intensity optimization (barrelDistortion: 0 skips calculation)

### Phase 3: Settings Panel UI (Future)
- [ ] Settings panel renders distortion slider grouped with vignette and curvature
- [ ] Slider respects `showDistortion` config flag for visibility
- [ ] Slider value changes flow correctly through settings → wrapper → renderer → shader

### Phase 4: Integration & Documentation (Future)
- [ ] Integration tests verify data flow across component boundaries
- [ ] E2E tests validate user interactions with distortion controls
- [ ] Documentation updated to reflect new distortion capability
- [ ] All tests passing in CI pipeline
- [ ] Feature ready for production deployment

---

## 🎭 User Scenarios

### Visual Effects Configuration

<details open>
<summary><strong>Scenario 1: User Enables Barrel Distortion on Fullscreen Video</strong></summary>

```gherkin
Given a user is viewing fullscreen video with CRT effects enabled
And screen curvature is set to 115px (curved corners)
When the user increases the barrel distortion slider from 0 to 0.2
Then the video image warps outward in a barrel shape
And the distortion is more pronounced at the edges than the center
And the curvature automatically amplifies the distortion effect
And the video content remains smooth without pixelation
```

</details>

<details open>
<summary><strong>Scenario 1a: Fullscreen 4:3 Video on 16:9 Display with Distortion</strong></summary>

```gherkin
Given a user is viewing 4:3 video in fullscreen video-dialog on a 16:9 display
And the video uses object-fit: contain (letterboxed with black bars on sides)
And contentAspectRatio is set to 4/3
And barrel distortion is set to 0.2
When the video renders
Then the distortion effect warps only the visible 4:3 video area
And the black letterbox bars remain flat and undistorted
And the effect is constrained to the video content (like vignette and curvature)
And the transition between video and letterbox is seamless
```

</details>

<details open>
<summary><strong>Scenario 2: User Adjusts Curvature and Sees Distortion Change</strong></summary>

```gherkin
Given a user has barrel distortion set to 0.15
And screen curvature is set to 50px
When the user increases screen curvature to 115px
Then the barrel distortion automatically increases proportionally
And the image warps more noticeably to match the higher curvature
And the user can still adjust the distortion slider to fine-tune the effect
```

</details>

<details open>
<summary><strong>Scenario 3: User Disables Distortion on Small Display</strong></summary>

```gherkin
Given a user is viewing video in compact mode (small preset)
And the small preset has distortion disabled by default (0)
When the user confirms barrel distortion slider is at 0
Then the image displays without any geometric warping
And only the screen curvature border-radius remains visible
And the shader completely skips distortion calculation for zero performance overhead
And GPU usage is identical to having no distortion code at all
```

</details>

---

### Preset and Configuration Management

<details open>
<summary><strong>Scenario 4: User Switches to Large Video Preset</strong></summary>

```gherkin
Given a user is viewing fullscreen video
And CRT effects are enabled
When the user selects the "Large Video (WebGL)" preset from the menu
Then all settings update to the large preset values
And barrel distortion is set to the large preset default (0.15)
And the image displays with moderate geometric warping
And the distortion slider reflects the preset value
```

</details>

<details open>
<summary><strong>Scenario 5: User Creates Custom Preset with High Distortion</strong></summary>

```gherkin
Given a user has adjusted barrel distortion to 0.4 (high distortion)
And other CRT settings are customized
When the user saves the settings as a custom preset named "Retro Arcade"
Then the custom preset includes the barrel distortion value
And selecting "Retro Arcade" later restores all settings including distortion
```

</details>

---

### Settings Panel Visibility and Grouping

<details open>
<summary><strong>Scenario 6: User Opens Settings Panel and Sees Distortion Grouped Correctly</strong></summary>

```gherkin
Given a user opens the CRT settings panel
And the config has showDistortion = true
When the panel renders
Then the barrel distortion slider appears in the visual effects section
And it is positioned near the vignette and curvature sliders
And the slider label reads "Barrel Distortion" with percentage format
And the slider range is 0-50% with 1% increments
```

</details>

<details open>
<summary><strong>Scenario 7: Config Hides Distortion Control</strong></summary>

```gherkin
Given the application uses a config with showDistortion = false
When the CRT settings panel renders
Then the barrel distortion slider is not visible
And no distortion is applied to the image regardless of the settings value
```

</details>

---

### Edge Cases and Error Handling

<details open>
<summary><strong>Scenario 8: Extreme Distortion Values</strong></summary>

```gherkin
Given a user sets barrel distortion to maximum (0.5)
And screen curvature is also at maximum (115px)
When the video renders
Then the geometric warping is extreme but still renders correctly
And the image remains within the canvas bounds
And no shader errors or visual artifacts occur
```

</details>

<details open>
<summary><strong>Scenario 9: WebGL Context Loss and Recovery</strong></summary>

```gherkin
Given a user has barrel distortion enabled at 0.2
And the video is rendering with distortion effects
When the WebGL context is lost (GPU driver crash, context limit)
And the context is restored
Then the CrtRenderer re-initializes the shader
And the barrel distortion effect is restored with the previous value (0.2)
And the video continues rendering with distortion
```

</details>

<details open>
<summary><strong>Scenario 10: Zero Curvature with Distortion</strong></summary>

```gherkin
Given a user sets screen curvature to 0 (flat screen)
And barrel distortion is set to 0.2
When the video renders
Then the image has subtle distortion independent of curvature
And the container has no rounded corners (flat edges)
And the distortion effect functions correctly without curvature coupling
```

</details>

---

## 📚 Related Documentation

- **Feature-Specific Design**: N/A (this is the master plan)
- **CRT System Documentation**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md)
- **Architecture Overview**: [OVERVIEW_CONTEXT.md](../../OVERVIEW_CONTEXT.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 📝 Notes

### Design Considerations

- **Distortion Formula Selection**: The barrel distortion uses a simple radial polynomial formula `r' = r * (1 + k * r²)` where `r` is the distance from center and `k` is the distortion coefficient. This formula is computationally efficient in the shader and provides authentic-looking barrel/pincushion warping. More complex polynomials (quartic, quintic) could be explored if the simple formula is insufficient.

- **Performance Impact**: Barrel distortion adds one additional distance calculation and UV coordinate transformation per pixel in the fragment shader. On modern GPUs this is negligible (< 1% performance impact), but low-end integrated GPUs may see slight framerate dips at high resolutions. **Critical optimization**: When `barrelDistortion: 0`, the shader must completely skip the distortion calculation using early-out conditional logic, ensuring zero performance overhead when the effect is disabled.

- **Fullscreen Aspect Ratio Handling**: The video-dialog component displays 4:3 video content on potentially 16:9 displays using `contentAspectRatio` and `object-fit: contain`. The barrel distortion effect must respect the same aspect ratio constraints that vignette and curvature effects use. When letterboxing or pillarboxing occurs, the distortion should only warp the visible video area, leaving black bars flat and undistorted. This requires either clip-path coordination or shader-based masking that aligns with the existing aspect ratio handling system in `CrtEffectWrapperComponent`.

- **Curvature Coupling Strength**: The coupling formula between screen curvature and barrel distortion uses a scaling factor that may need tuning. Initial recommendation is `baseDist = curvature * 0.001` to provide subtle influence without overwhelming the user's slider value. This should be validated through visual testing in Phase 4.

- **Edge Clamping vs. Black Borders**: When distortion warps UV coordinates outside the 0-1 range, the shader must decide whether to clamp to the edge texture color or sample black. Clamping creates a seamless effect but may show stretched pixels at extreme distortion. Black borders create a framed appearance. Recommendation: clamp to edge for better integration with other CRT effects.

### Future Enhancement Ideas

- **Pincushion vs. Barrel Toggle**: Add a boolean or enum to switch between barrel distortion (outward bulge) and pincushion distortion (inward pinch). Real CRTs could exhibit either depending on calibration.

- **Asymmetric Distortion**: Allow independent horizontal and vertical distortion amounts for more precise control over the warping shape. Some CRTs had stronger horizontal than vertical distortion.

- **Distortion Animation**: Subtle animated distortion (breathing effect) could simulate magnetic field variations in real CRTs. This would require time-based uniforms and could be a future "advanced" effect.

### Summary of Open Questions

**Phase 1:**

- Distortion value range: 0-0.5? 0-1?
- Preset default values: minimal for small (0.05), moderate for large (0.15)? Or all zero?
- Automatic curvature coupling or independent settings?

**Phase 2:**

- Distortion formula: simple quadratic or complex polynomial?
- Edge handling: clamp to edge or render black?
- Curvature influence formula: linear, exponential, or custom?

**Phase 3:**

- Slider range and step: 0-0.5 with 0.01 step?
- Slider label: "Barrel Distortion", "Image Distortion", "Geometric Warp"?
- Slider positioning: after curvature or after vignette?

**Phase 4:**

- Final preset values after visual testing
- Performance benchmarking on low-end devices?

