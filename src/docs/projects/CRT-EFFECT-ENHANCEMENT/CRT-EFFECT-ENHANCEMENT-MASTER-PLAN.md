# CRT Effect Enhancement - Master Plan

**Project Overview**: Enhance the CRT effect system to eliminate scanline banding artifacts at different zoom levels and add advanced CRT visual effects via WebGL rendering with CSS fallback.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Component Library (CRT)**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md)

---

## 🎯 Project Objective

The current CSS-based CRT effect implementation suffers from **Moiré pattern banding** when users view the application at non-100% zoom levels. This creates visual artifacts where some scanlines appear darker/thicker than others, degrading the retro aesthetic experience.

This project delivers a two-phase solution:
1. **Phase 1 (CSS Fixes)**: Implement anti-aliasing improvements to reduce banding by ~60-70% using CSS-only techniques
2. **Phase 2 (WebGL Enhancement)**: Add WebGL-based scanline rendering that eliminates banding 100% and enables advanced CRT effects (phosphor glow, shadow mask, chromatic aberration)

**User Value**: Users get an authentic, artifact-free CRT experience at any browser zoom level, with optional advanced effects that truly capture the look of vintage monitors. A toggle in the settings panel allows switching between CSS (lightweight) and WebGL (high-fidelity) modes.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: CSS Anti-Aliasing Improvements</h3></summary>

### Objective

Reduce scanline banding artifacts at non-100% zoom levels using CSS-only techniques. This phase delivers immediate improvement without adding complexity.

### Key Deliverables

- [ ] GPU-accelerated compositing hints added to scanline overlay
- [ ] Subtle anti-aliasing blur applied to scanline edges
- [ ] Image rendering optimization for gradient patterns
- [ ] Verified improvement at 110%, 125%, and 150% zoom levels
- [ ] All existing tests passing

### High-Level Tasks

1. **Add GPU Compositing Hints**: Apply `will-change`, `transform: translateZ(0)` to hint browser for GPU acceleration
2. **Add Scanline Anti-Aliasing**: Apply subtle `filter: blur(0.3px)` to soften hard gradient edges
3. **Optimize Image Rendering**: Set `image-rendering: auto` for scanline gradient
4. **Manual Verification**: Test at multiple zoom levels to confirm improvement
5. **Update Documentation**: Document the CSS anti-aliasing approach

### Open Questions for Phase 1

- **Blur Amount**: What blur value (0.2px, 0.3px, 0.5px) provides best anti-aliasing without making scanlines too soft?

</details>

---

<details open>
<summary><h3>Phase 2: WebGL Renderer Implementation</h3></summary>

### Objective

Create a WebGL-based scanline renderer that eliminates banding completely by rendering at device pixel ratio, and enables future advanced CRT effects.

### Key Deliverables

- [x] `CrtRenderer` class encapsulating all WebGL boilerplate *(TASK-02-001 ✅)*
- [x] Scanline fragment shader with anti-aliased rendering *(TASK-02-001 ✅, polish in TASK-02-003A)*
- [x] Canvas overlay properly positioned and sized *(TASK-02-003 ✅)*
- [x] Settings bound to shader uniforms *(TASK-02-003 ✅)*
- [x] Context loss recovery handling *(TASK-02-001 ✅)*
- [x] CSS fallback when WebGL unavailable *(TASK-02-003 ✅)*
- [ ] Shader quality polish - eliminate remaining banding artifacts *(TASK-02-003A 🔄)*

### High-Level Tasks

1. **Create WebGL Infrastructure**: Build `CrtRenderer` class with init/destroy/render lifecycle ✅ *(TASK-02-001 COMPLETE)*
2. **Implement Scanline Shader**: Write GLSL fragment shader with `smoothstep` anti-aliasing ✅ *(TASK-02-001 COMPLETE)*
3. **Integrate with Component**: Add canvas element, bind settings to uniforms ✅ *(TASK-02-003 COMPLETE)*
4. **Handle Edge Cases**: Context loss recovery, resize handling, cleanup ✅ *(TASK-02-003 COMPLETE)*
5. **Test WebGL Mode**: Unit tests with mocked WebGL context ✅ *(111 tests passing)*
6. **Polish Shader Quality**: Refine shader to eliminate banding at all slider positions 🔄 *(TASK-02-003A IN PROGRESS)*

### Open Questions for Phase 2

- ~~**Shader Complexity**: Start with scanlines-only or include phosphor pattern in v1?~~ → Scanlines only in v1
- **Performance Budget**: What's acceptable GPU overhead for mobile devices?
- **Shader Approach**: Quantized sizes vs improved AA filter vs UI clamping? *(TASK-02-003A)*

</details>

---

<details open>
<summary><h3>Phase 3: Render Mode Toggle & Settings Panel</h3></summary>

### Objective

Add user-facing controls to switch between CSS and WebGL render modes, with intelligent defaults based on device capabilities.

### Key Deliverables

- [ ] `renderMode` property added to `CrtSettings` domain model
- [ ] Toggle control added to `CrtSettingsPanelComponent`
- [ ] Automatic mode detection (WebGL preferred when available)
- [ ] Mode persisted in user settings
- [ ] Documentation updated with new setting

### High-Level Tasks

1. **Extend Domain Model**: Add `renderMode: 'css' | 'webgl' | 'auto'` to `CrtSettings`
2. **Update Settings Panel**: Add toggle/dropdown for render mode selection
3. **Implement Mode Detection**: Auto-detect WebGL availability, default to best option
4. **Persist User Preference**: Store render mode choice in settings
5. **Update Component Library Docs**: Document new render mode feature

### Open Questions for Phase 3

- **Default Behavior**: Should 'auto' be the default, or should users explicitly opt-in to WebGL?
- **UI Presentation**: Toggle switch or dropdown with CSS/WebGL/Auto options?

</details>

---

<details open>
<summary><h3>Phase 4: Advanced WebGL Effects</h3></summary>

### Objective

Enhance WebGL renderer with additional authentic CRT effects that are impossible with CSS - phosphor patterns, bloom, barrel distortion, and chromatic aberration. Each effect has individual controls and can be combined into named presets.

### Key Deliverables

- [x] `PhosphorPatternType` enum and new `CrtSettings` properties *(TASK-04-001 ✅)*
- [x] Phosphor/shadow mask pattern simulation (3 pattern types) *(TASK-04-002 ✅ - overlay approach)*
- [ ] **Post-Processing Pipeline Refactor** - Video texture sampling, multiplicative effects *(TASK-04-002A)* 🔄
- [ ] Dynamic bloom/glow effect for bright areas *(TASK-04-003)*
- [ ] Barrel distortion (true curved geometry via vertex shader) *(TASK-04-004)*
- [ ] Chromatic aberration at screen edges *(TASK-04-005)*
- [ ] Settings panel with all new control groups *(TASK-04-006)*
- [ ] Named presets: Trinitron, Arcade, Authentic, Subtle *(TASK-04-007)*

### High-Level Tasks

| Task | Description | Size | Dependencies |
|------|-------------|------|--------------|
| 04-001 | Domain Model Extensions | Small | None |
| 04-002 | Phosphor Pattern Shader (overlay) | Medium | 04-001 |
| **04-002A** | **Post-Processing Pipeline Refactor** | **Large** | 04-002 |
| 04-003 | Bloom/Glow Effect | Medium | **04-002A** |
| 04-004 | Barrel Distortion | Small | **04-002A** |
| 04-005 | Chromatic Aberration | Small | **04-002A** |
| 04-006 | Settings Panel Integration | Medium | 04-002 thru 04-005 |
| 04-007 | Named Presets | Small | 04-006 |

**Execution Order**: 
- Task 04-001 ✅ → Task 04-002 ✅ → **Task 04-002A** 🔄 → Tasks 04-003/04/05 (parallel) → 04-006 → 04-007

**Note**: Task 04-002A refactors the CRT system from overlay-based rendering to a proper post-processing pipeline where the shader samples the video texture directly. This is a prerequisite for realistic bloom, barrel distortion, and chromatic aberration effects.

### Performance Targets

| Device | Target FPS | Allowed Effects |
|--------|------------|-----------------|
| Desktop | 60 fps | All effects |
| Mobile | 30 fps | Phosphor + scanlines only |

### Open Questions for Phase 4

- **Performance Impact**: Which effects can run on mobile without significant battery drain?
- **Effect Presets**: Should we offer CRT-Lottes, CRT-Easy style presets?

</details>

---

<details open>
<summary><h2>🏗️ Architecture Overview</h2></summary>

### Key Design Decisions

- **Single Component with Strategy**: The `CrtEffectWrapperComponent` handles both CSS and WebGL modes internally rather than using child components, because Angular's `ng-content` projection doesn't support conditional wrapper switching cleanly.

- **WebGL Abstraction**: All WebGL boilerplate (context creation, shader compilation, uniform binding, context loss handling) is encapsulated in a `CrtRenderer` class in a separate `webgl/` folder, keeping the component clean.

- **CSS Class Toggling**: Mode switching uses CSS classes (`.mode-css`, `.mode-webgl`) to show/hide effects rather than conditional DOM rendering, since the content must always be projected.

- **Canvas Overlay**: The WebGL canvas is always in the DOM but visibility-toggled via CSS. This avoids expensive WebGL re-initialization when toggling modes.

### Integration Points

- **CrtSettings Domain Model**: Extended with `renderMode` property for mode selection
- **CrtSettingsPanelComponent**: Extended with render mode toggle control
- **Video Player Integration**: Uses existing `contentAspectRatio` input for proper effect positioning
- **Settings Persistence**: Render mode preference stored alongside other CRT settings

### File Structure

```
libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-effect-wrapper.component.ts      # Orchestrates CSS/WebGL modes
├── crt-effect-wrapper.component.scss    # CSS effects (unchanged for fallback)
├── crt-effect-wrapper.component.html    # Template with canvas overlay
├── crt-settings.interface.ts            # +renderMode property
├── crt-settings.defaults.ts             # +renderMode defaults
├── webgl/
│   ├── crt-renderer.ts                  # WebGL lifecycle management
│   ├── crt-renderer.spec.ts             # WebGL tests with mocked context
│   └── shaders/
│       ├── scanline.frag.glsl.ts        # Fragment shader (inline GLSL)
│       └── passthrough.vert.glsl.ts     # Vertex shader (inline GLSL)
└── crt-effect-wrapper.component.spec.ts # Updated tests

libs/domain/src/lib/models/
└── crt-settings.model.ts                # +renderMode property
```

</details>

---

<details open>
<summary><h2>🧪 Testing Strategy</h2></summary>

### Unit Tests

- [ ] CSS anti-aliasing properties applied correctly
- [ ] WebGL renderer initializes and cleans up properly
- [ ] Settings correctly bound to shader uniforms
- [ ] Context loss recovery re-initializes WebGL
- [ ] Mode switching toggles correct effects
- [ ] Fallback to CSS when WebGL unavailable

### Integration Tests

- [ ] CrtEffectWrapper switches modes based on settings
- [ ] CrtSettingsPanel render mode toggle updates settings
- [ ] Settings persistence includes render mode

### Manual Testing

- [ ] Verify banding reduction at 110%, 125%, 150% zoom (Phase 1)
- [ ] Verify zero banding with WebGL mode (Phase 2)
- [ ] Test mode toggle on desktop and mobile browsers
- [ ] Verify no visual regression when CSS mode active

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Phase 1 (CSS Fixes):**
- [ ] Visible reduction in banding at non-100% zoom levels
- [ ] No visual regression at 100% zoom
- [ ] All existing tests pass
- [ ] Performance unchanged

**Phase 2 (WebGL):**
- [ ] Zero banding at any zoom level with WebGL mode
- [ ] Proper cleanup on component destroy
- [ ] Graceful fallback when WebGL unavailable
- [ ] WebGL tests pass with mocked context

**Phase 3 (Settings):**
- [ ] Users can toggle between CSS and WebGL modes
- [ ] Preference persisted across sessions
- [ ] Settings panel clearly indicates current mode

**Overall:**
- [ ] Cross-platform compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile compatibility (iOS Safari, Android Chrome)
- [ ] Documentation updated with render mode feature

</details>

---

<details open>
<summary><h2>🎭 User Scenarios</h2></summary>

### Scanline Banding Scenarios

<details open>
<summary><strong>Scenario 1: User Views at Non-100% Zoom (CSS Mode)</strong></summary>

```gherkin
Given a user is viewing video with CRT effects enabled
And the browser is at 125% zoom
When the CSS anti-aliasing improvements are applied
Then the scanline banding artifacts should be noticeably reduced
And the scanlines should appear more uniform across the screen
```

</details>

<details open>
<summary><strong>Scenario 2: User Views at Non-100% Zoom (WebGL Mode)</strong></summary>

```gherkin
Given a user is viewing video with CRT effects enabled
And render mode is set to WebGL
And the browser is at any zoom level
When the WebGL renderer draws scanlines
Then there should be zero visible banding artifacts
And scanlines should appear perfectly uniform
```

</details>

---

### Mode Switching Scenarios

<details open>
<summary><strong>Scenario 3: User Switches from CSS to WebGL Mode</strong></summary>

```gherkin
Given a user has CRT effects enabled in CSS mode
When the user opens settings and toggles render mode to WebGL
Then the WebGL canvas should become visible
And the CSS scanline overlay should be hidden
And the visual appearance should remain consistent
```

</details>

<details open>
<summary><strong>Scenario 4: WebGL Unavailable Fallback</strong></summary>

```gherkin
Given a user's browser does not support WebGL
When render mode is set to 'auto' or 'webgl'
Then the system should fall back to CSS mode
And the user should see CSS-based scanlines
And no errors should appear in the console
```

</details>

---

### Settings Persistence Scenarios

<details open>
<summary><strong>Scenario 5: Render Mode Preference Persists</strong></summary>

```gherkin
Given a user has changed render mode to WebGL
When the user refreshes the page or returns later
Then the render mode should still be WebGL
And the CRT effects should render using WebGL immediately
```

</details>

</details>

---

<details open>
<summary><h2>📚 Related Documentation</h2></summary>

- **Component Library (CRT)**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h2>📝 Notes</h2></summary>

### Design Considerations

- **Mobile Battery**: WebGL rendering consumes more battery than CSS. Consider recommending CSS mode for mobile users or implementing power-saving detection.
- **Context Loss**: Mobile browsers aggressively reclaim GPU resources. Robust context loss handling is essential.
- **SSR Compatibility**: Skip WebGL initialization during server-side rendering if applicable.

### Future Enhancement Ideas

- **CRT Presets**: Offer named presets like "CRT-Lottes", "CRT-Easy", "Trinitron" with curated effect combinations
- **Phosphor Persistence**: Ghost trails from slow phosphor decay for authentic motion blur
- **NTSC Artifacts**: Optional composite video color bleeding for ultimate authenticity
- **Performance Modes**: Low/Medium/High quality presets for different device capabilities

### Summary of Open Questions

**Phase 1:**
- Optimal blur value for anti-aliasing (0.2px, 0.3px, 0.5px)

**Phase 2:**
- Start with scanlines-only or include phosphor pattern?
- Performance budget for mobile

**Phase 3:**
- Default to 'auto' or require explicit opt-in?
- Toggle switch vs dropdown for mode selection

**Phase 4:**
- Which advanced effects are mobile-safe?
- Offer CRT shader presets?

</details>

---

## 📊 Execution Summary

### Phase Dependencies

```
Phase 1 (CSS Fixes) ──────────────────────────────────┐
                                                       ↓
Phase 2 (WebGL Renderer) ← Can start after Phase 1 verified
                                                       ↓
Phase 3 (Settings Toggle) ← Requires Phase 2 complete
                                                       ↓
Phase 4 (Advanced Effects) ← Future enhancement
```

### Recommended Execution Order

1. **Start with Phase 1** - Quick wins, validates improvement approach
2. **Evaluate results** - Decide if WebGL is needed based on Phase 1 outcome
3. **Phase 2 if proceeding** - Core WebGL infrastructure
4. **Phase 3** - User-facing controls
5. **Phase 4** - Future enhancement backlog

### First Task

**CRT-EFFECT-ENHANCEMENT-TASK-01-001-CSS-ANTIALIAS** - Implement CSS anti-aliasing fixes to reduce scanline banding.
