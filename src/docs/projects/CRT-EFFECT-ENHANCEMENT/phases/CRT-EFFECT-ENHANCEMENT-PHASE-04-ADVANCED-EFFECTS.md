# Phase 4: Advanced WebGL Effects

## 🎯 Objective

Enhance the WebGL renderer with additional authentic CRT effects that are impossible with CSS - phosphor patterns, bloom, barrel distortion, and chromatic aberration. Each effect will have individual controls in the settings panel and can be combined to create named presets.

> **⚠️ DEPENDENCY**: This phase requires Phase 2 (WebGL Renderer) to be complete.
> 
> **📍 STATUS**: Ready for implementation - Phases 1-3 complete.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Project Documentation:**

- [ ] [CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md) - Project overview
- [ ] [Phase 2 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-003-REPORT.md) - WebGL implementation
- [ ] [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT component documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - CSS/SCSS conventions

**Reference Materials:**

- [ ] [CRT-Royale shader](https://github.com/libretro/glsl-shaders/tree/master/crt/shaders/crt-royale) - Reference implementation
- [ ] [CRT-Lottes shader](https://www.shadertoy.com/view/XsjSzR) - Simplified CRT shader
- [ ] [daenavan crt-threejs](https://daenavan.github.io/crt-threejs/) - Current scanline inspiration

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
└── crt-settings.model.ts                 📝 Modified - Add advanced effect properties

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.interface.ts             📝 Modified - Add CrtAdvancedConfig
├── crt-settings.defaults.ts              📝 Modified - Add advanced defaults & presets
├── crt-effect-wrapper.component.ts       📝 Modified - Bind new uniforms
└── webgl/
    ├── crt-renderer.ts                   📝 Modified - Add new uniforms
    └── shaders/
        ├── scanline.frag.ts              📝 Modified - Add all advanced effects
        └── passthrough.vert.ts           📝 Modified - Add barrel distortion

libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts       📝 Modified - Add advanced sliders
├── crt-settings-panel.component.html     📝 Modified - Add advanced control groups
└── crt-settings-panel.component.scss     📝 Modified - Style new sections
```

---

## 🏗️ Architecture Overview

### Effect Categories

| Effect | Type | Shader Stage | Performance | Mobile-Safe |
|--------|------|--------------|-------------|-------------|
| Phosphor Pattern | Fragment | Per-pixel | Low | ✅ Yes |
| Bloom/Glow | Fragment | Multi-sample | Medium | ⚠️ Reduced |
| Barrel Distortion | Vertex | Per-vertex | Very Low | ✅ Yes |
| Chromatic Aberration | Fragment | Per-pixel | Low | ✅ Yes |
| Phosphor Persistence | Fragment | Temporal | High | ❌ Desktop only |

### Shader Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fragment Shader Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. UV Transformation (Barrel Distortion)                        │
│     └─ Applies curved screen geometry to texture coordinates     │
│                                                                  │
│  2. Chromatic Aberration                                         │
│     └─ Separates RGB channels based on distance from center      │
│                                                                  │
│  3. Phosphor/Shadow Mask Pattern                                 │
│     └─ Modulates RGB based on subpixel position                  │
│                                                                  │
│  4. Scanlines (existing)                                         │
│     └─ Horizontal dark bands with sine-wave pattern              │
│                                                                  │
│  5. Bloom/Glow                                                   │
│     └─ Adds soft glow around bright areas                        │
│                                                                  │
│  6. Vignette (existing)                                          │
│     └─ Edge/corner darkening                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Domain Model Extensions

```typescript
// New properties to add to CrtSettings
interface CrtSettings {
  // === Existing Properties ===
  scanlineIntensity: number;
  scanlineSize: number;
  vignetteStrength: number;
  screenCurvature: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  renderMode: CrtRenderMode;
  
  // === NEW: Advanced Effects ===
  
  // Phosphor Pattern (0 = off, 1 = aperture grille, 2 = shadow mask, 3 = dot triad)
  phosphorPattern: PhosphorPatternType;
  phosphorIntensity: number;      // 0.0 - 1.0
  
  // Bloom/Glow
  bloomEnabled: boolean;
  bloomIntensity: number;         // 0.0 - 2.0
  bloomRadius: number;            // 1.0 - 10.0
  
  // Barrel Distortion
  barrelDistortion: number;       // 0.0 - 0.5 (0 = flat, higher = more curve)
  
  // Chromatic Aberration
  chromaticAberration: number;    // 0.0 - 5.0 (pixels of RGB separation)
}

type PhosphorPatternType = 'none' | 'aperture-grille' | 'shadow-mask' | 'dot-triad';
```

### Settings Panel Extensions

```typescript
// New CrtSettingsConfig properties
interface CrtSettingsConfig {
  // === Existing ===
  showScanlines: boolean;
  showVignette: boolean;
  showCurvature: boolean;
  showColorFilters: boolean;
  
  // === NEW ===
  showPhosphor: boolean;          // Phosphor pattern controls
  showBloom: boolean;             // Bloom/glow controls
  showDistortion: boolean;        // Barrel distortion control
  showChromaticAberration: boolean; // Chromatic aberration control
}
```

---

## 📋 Implementation Tasks

### Task 04-001: Domain Model & Interface Extensions

**Purpose**: Extend `CrtSettings` with all advanced effect properties.

**Size**: Small (2-3 files)

**Deliverables**:
- Updated `libs/domain/src/lib/models/crt-settings.model.ts`
- Updated `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- Updated `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Key Implementation**:
- Add `PhosphorPatternType` enum/type
- Add all new properties to `CrtSettings` interface
- Add new config flags to `CrtSettingsConfig`
- Update `DEFAULT_CRT_SETTINGS` and `CRT_PRESETS` with new defaults
- Add new preset configurations (Trinitron, Authentic, etc.)

**Acceptance Criteria**:
- [ ] All new properties typed and documented
- [ ] Defaults set for all new properties (effects off by default)
- [ ] At least 3 new named presets created
- [ ] Backward compatible (existing code still works)

---

### Task 04-002: Phosphor/Shadow Mask Pattern

**Purpose**: Add RGB subpixel simulation to emulate CRT phosphor patterns.

**Size**: Medium (4-5 files)

**Deliverables**:
- Updated `scanline.frag.ts` with phosphor pattern functions
- Updated `crt-renderer.ts` with new uniforms
- Unit tests for phosphor rendering
- Updated component library documentation

**Key Implementation**:
```glsl
// Three phosphor pattern types:

// 1. Aperture Grille (Trinitron style)
// Vertical RGB stripes
float apertureGrille(vec2 uv, vec2 resolution) {
  float x = uv.x * resolution.x;
  float stripe = mod(x, 3.0);
  vec3 mask = vec3(
    step(stripe, 1.0),
    step(1.0, stripe) * step(stripe, 2.0),
    step(2.0, stripe)
  );
  return mask;
}

// 2. Shadow Mask (traditional CRT)
// Staggered RGB dot pattern

// 3. Dot Triad (arcade monitors)
// Triangular RGB arrangement
```

**Uniforms to Add**:
- `u_phosphorPattern` (int: 0=none, 1=grille, 2=shadow, 3=triad)
- `u_phosphorIntensity` (float: 0.0-1.0)
- `u_phosphorScale` (vec2: pattern scaling)

**Acceptance Criteria**:
- [ ] All 3 phosphor patterns render correctly
- [ ] Intensity slider smoothly fades effect
- [ ] Pattern scales with resolution
- [ ] No visual artifacts at edges
- [ ] Tests verify pattern application

> **📍 Sub-Tasks for Task 04-002**:
> 
> During implementation, Task 04-002 was expanded into sub-tasks:
> 
> - **Task 04-002A**: [Post-Processing Pipeline Refactor](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-04-002A-POST-PROCESSING-PIPELINE.md) ✅ COMPLETE
>   - Refactored from overlay-based to WebGL texture sampling architecture
>   - Enables true multiplicative color filtering for authentic CRT appearance
> 
> - **Task 04-002B**: [Image Cycling Fix](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-04-002B-IMAGE-CYCLING-FIX.md) 🚧 PENDING
>   - Fixes timing issue where WebGL texture doesn't update when images cycle
>   - Required for production use with `file-image` component

---

### Task 04-003: Bloom/Glow Effect

**Purpose**: Add soft glow around bright areas for authentic CRT phosphor glow.

**Size**: Medium (4-5 files)

**Deliverables**:
- Updated `scanline.frag.ts` with bloom calculation
- Updated `crt-renderer.ts` with bloom uniforms
- Performance profiling for mobile
- Unit tests

**Key Implementation**:
```glsl
// Bloom using box blur approximation (single-pass for performance)
// Sample neighboring pixels and add weighted contribution

vec3 calculateBloom(vec2 uv, float intensity, float radius) {
  vec3 bloom = vec3(0.0);
  float totalWeight = 0.0;
  
  // 9-tap box filter for performance
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) * radius / u_resolution;
      vec3 sample = texture2D(u_texture, uv + offset).rgb;
      float luminance = dot(sample, vec3(0.299, 0.587, 0.114));
      float weight = max(luminance - 0.5, 0.0) * 2.0; // Only bright areas
      bloom += sample * weight;
      totalWeight += weight;
    }
  }
  
  return bloom / max(totalWeight, 1.0) * intensity;
}
```

**Uniforms to Add**:
- `u_bloomEnabled` (bool)
- `u_bloomIntensity` (float: 0.0-2.0)
- `u_bloomRadius` (float: 1.0-10.0)

**Performance Considerations**:
- Single-pass approximation (no multi-pass ping-pong)
- Reduced sample count on mobile
- Optional: LOD-based bloom for lower resolution

**Acceptance Criteria**:
- [ ] Bloom visible on bright areas
- [ ] Intensity and radius sliders work
- [ ] Performance acceptable on mobile (>30fps)
- [ ] Can be disabled completely
- [ ] Tests verify bloom application

---

### Task 04-004: Barrel Distortion

**Purpose**: Add true curved screen geometry via vertex shader.

**Size**: Small (3-4 files)

**Deliverables**:
- Updated `passthrough.vert.ts` with barrel distortion
- Updated `crt-renderer.ts` with distortion uniform
- Unit tests

**Key Implementation**:
```glsl
// Barrel distortion in vertex shader
// More efficient than fragment shader UV distortion

uniform float u_barrelDistortion;

vec2 barrelDistort(vec2 uv) {
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  float distortion = 1.0 + r2 * u_barrelDistortion;
  return centered * distortion + 0.5;
}
```

**Uniforms to Add**:
- `u_barrelDistortion` (float: 0.0-0.5)

**Note**: This is different from `screenCurvature` (border-radius). Barrel distortion actually warps the image, while curvature just clips corners.

**Acceptance Criteria**:
- [ ] Image curves outward at edges
- [ ] No visible seams or artifacts
- [ ] Works with all other effects
- [ ] Slider provides smooth control
- [ ] Tests verify distortion math

---

### Task 04-005: Chromatic Aberration

**Purpose**: Add RGB channel separation at screen edges for lens effect.

**Size**: Small (3-4 files)

**Deliverables**:
- Updated `scanline.frag.ts` with chromatic aberration
- Updated `crt-renderer.ts` with CA uniform
- Unit tests

**Key Implementation**:
```glsl
// Chromatic aberration - separate RGB channels
// Red shifts outward, blue shifts inward

vec3 chromaticAberration(vec2 uv, float amount) {
  vec2 center = uv - 0.5;
  float dist = length(center);
  vec2 direction = normalize(center);
  
  // Scale aberration by distance from center
  float aberration = amount * dist / u_resolution.x;
  
  // Sample each channel with offset
  float r = texture2D(u_texture, uv + direction * aberration).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - direction * aberration).b;
  
  return vec3(r, g, b);
}
```

**Uniforms to Add**:
- `u_chromaticAberration` (float: 0.0-5.0, in pixels)

**Note**: This effect only applies when we're sampling a texture. Since current implementation is an overlay, we may need to rethink the architecture or apply this differently.

**Architecture Decision Needed**:
- Option A: Apply to video element via CSS filter (limited)
- Option B: Render video to texture first, then apply effects (more complex)
- Option C: Skip this effect in overlay mode (simplest)

**Acceptance Criteria**:
- [ ] RGB separation visible at edges
- [ ] No aberration at center
- [ ] Slider provides smooth control
- [ ] Architecture decision documented
- [ ] Tests verify aberration calculation

---

### Task 04-006: Settings Panel Integration

**Purpose**: Add all new effect controls to the settings panel.

**Size**: Medium (4-5 files)

**Deliverables**:
- Updated `crt-settings-panel.component.ts` with new slider configs
- Updated `crt-settings-panel.component.html` with new control groups
- Updated `crt-settings-panel.component.scss` for styling
- Updated unit tests

**Key Implementation**:

```typescript
// New slider configurations

const PHOSPHOR_SLIDERS: SliderConfig[] = [
  {
    key: 'phosphorIntensity',
    label: 'Phosphor Intensity',
    min: 0, max: 1, step: 0.05,
    format: 'percentage',
  },
];

const BLOOM_SLIDERS: SliderConfig[] = [
  {
    key: 'bloomIntensity',
    label: 'Bloom Intensity',
    min: 0, max: 2, step: 0.1,
    format: 'percentage',
  },
  {
    key: 'bloomRadius',
    label: 'Bloom Radius',
    min: 1, max: 10, step: 0.5,
    format: 'px',
  },
];

const DISTORTION_SLIDER: SliderConfig = {
  key: 'barrelDistortion',
  label: 'Barrel Distortion',
  min: 0, max: 0.5, step: 0.01,
  format: 'decimal',
};

const CHROMATIC_SLIDER: SliderConfig = {
  key: 'chromaticAberration',
  label: 'Chromatic Aberration',
  min: 0, max: 5, step: 0.1,
  format: 'px',
};
```

**UI Layout**:
```
┌─────────────────────────────────┐
│ CRT Effect             [⚙️] [↺] │
├─────────────────────────────────┤
│ ── Scanlines ──                 │
│ Intensity     [━━━━━●━━] 50%    │
│ Size          [━━━●━━━━] 2.5px  │
│                                 │
│ ── Phosphor ──                  │
│ Pattern       [▼ Aperture Grill]│
│ Intensity     [━━●━━━━━] 30%    │
│                                 │
│ ── Bloom ──                     │
│ Enabled       [✓]               │
│ Intensity     [━━━●━━━━] 40%    │
│ Radius        [━━━●━━━━] 4px    │
│                                 │
│ ── Distortion ──                │
│ Barrel        [━━━●━━━━] 0.15   │
│ Chromatic     [━━━●━━━━] 2px    │
│                                 │
│ ── Vignette ──                  │
│ Strength      [━━━━●━━━] 65%    │
│                                 │
│ ── Color Filters ──             │
│ Contrast      [━━━●━━━━] 110%   │
│ Brightness    [━━━━●━━━] 150%   │
│ Saturation    [━━━●━━━━] 130%   │
│ Hue           [━━━━●━━━] 0°     │
└─────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] All new sliders render correctly
- [ ] Phosphor pattern dropdown works
- [ ] Bloom enable toggle works
- [ ] Config flags hide/show sections
- [ ] All sliders emit correct values
- [ ] Tests verify all new controls

---

### Task 04-007: Named Presets

**Purpose**: Create curated effect presets for common CRT styles.

**Size**: Small (2-3 files)

**Deliverables**:
- Updated `crt-settings.defaults.ts` with new presets
- Updated preset labels and dropdown
- Documentation of each preset

**Preset Definitions**:

```typescript
export const CRT_PRESETS = {
  // === Existing ===
  full: { /* current values */ },
  standard: { /* current values */ },
  small: { /* current values */ },
  none: { /* current values */ },
  
  // === NEW PRESETS ===
  
  /**
   * Trinitron - Sony Trinitron style
   * Aperture grille phosphors, subtle bloom, no barrel distortion
   */
  trinitron: {
    scanlineIntensity: 0.4,
    scanlineSize: 2.0,
    vignetteStrength: 0.8,
    screenCurvature: 0,
    contrast: 1.15,
    brightness: 1.4,
    saturation: 1.25,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'aperture-grille' as const,
    phosphorIntensity: 0.25,
    bloomEnabled: true,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0.5,
  },
  
  /**
   * Arcade - Classic arcade monitor
   * Shadow mask, strong scanlines, visible bloom
   */
  arcade: {
    scanlineIntensity: 0.6,
    scanlineSize: 3.0,
    vignetteStrength: 1.5,
    screenCurvature: 0,
    contrast: 1.2,
    brightness: 1.6,
    saturation: 1.4,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'shadow-mask' as const,
    phosphorIntensity: 0.35,
    bloomEnabled: true,
    bloomIntensity: 0.5,
    bloomRadius: 4,
    barrelDistortion: 0.1,
    chromaticAberration: 1.0,
  },
  
  /**
   * Authentic - Full vintage CRT experience
   * All effects enabled for maximum nostalgia
   */
  authentic: {
    scanlineIntensity: 0.55,
    scanlineSize: 2.5,
    vignetteStrength: 1.3,
    screenCurvature: 115,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'shadow-mask' as const,
    phosphorIntensity: 0.3,
    bloomEnabled: true,
    bloomIntensity: 0.4,
    bloomRadius: 3.5,
    barrelDistortion: 0.15,
    chromaticAberration: 1.5,
  },
  
  /**
   * Subtle - Light CRT flavor without going overboard
   * Minimal scanlines, no phosphor pattern, slight bloom
   */
  subtle: {
    scanlineIntensity: 0.25,
    scanlineSize: 1.5,
    vignetteStrength: 0.5,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.3,
    saturation: 1.1,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: true,
    bloomIntensity: 0.2,
    bloomRadius: 2,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
};

export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  full: 'Full CRT',
  standard: 'Standard',
  small: 'Small Screen',
  none: 'No Effects',
  trinitron: 'Trinitron',
  arcade: 'Arcade',
  authentic: 'Authentic Vintage',
  subtle: 'Subtle',
};
```

**Acceptance Criteria**:
- [ ] All presets defined with new properties
- [ ] Preset labels updated in dropdown
- [ ] Each preset creates distinct visual style
- [ ] Documentation describes each preset
- [ ] Tests verify preset values

---

## 🔗 Task Dependencies

```
Task 04-001 (Domain Model)
    │
    ├──► Task 04-002 (Phosphor Pattern)
    │         │
    ├──► Task 04-003 (Bloom Effect)
    │         │
    ├──► Task 04-004 (Barrel Distortion)
    │         │
    ├──► Task 04-005 (Chromatic Aberration)
    │         │
    └─────────┴─────────────────────────┐
                                        ▼
                           Task 04-006 (Settings Panel)
                                        │
                                        ▼
                           Task 04-007 (Named Presets)
```

**Parallel Execution**: Tasks 04-002 through 04-005 can be worked in parallel after 04-001.

---

## 🎯 Performance Targets

| Device Class | Target FPS | Max Effect Complexity |
|--------------|------------|----------------------|
| Desktop | 60 fps | All effects enabled |
| Laptop | 60 fps | All effects enabled |
| Tablet | 45 fps | Bloom reduced, no persistence |
| Mobile | 30 fps | Phosphor + scanlines only |

**Performance Mitigations**:
- Detect device capability on init
- Auto-reduce bloom quality on mobile
- Provide "Performance Mode" preset
- Skip multi-pass effects on low-power devices

---

## ✅ Success Criteria

### Functional Requirements

- [ ] Phosphor pattern renders all 3 types correctly
- [ ] Bloom adds visible glow to bright areas
- [ ] Barrel distortion curves the image
- [ ] Chromatic aberration separates RGB at edges (if feasible)
- [ ] All effects have individual toggle/intensity controls
- [ ] Settings panel shows all new controls
- [ ] At least 4 new presets available

### Performance Requirements

- [ ] Desktop: 60 fps with all effects
- [ ] Mobile: 30 fps with phosphor + scanlines
- [ ] No memory leaks from effect toggles
- [ ] Graceful degradation on low-power devices

### Quality Requirements

- [ ] All existing tests still pass
- [ ] New unit tests for each effect
- [ ] Documentation updated
- [ ] Component library updated

---

## 📝 Open Questions

1. **Chromatic Aberration Architecture**: Since we render an overlay, how do we apply chromatic aberration to the underlying video? Options:
   - Skip this effect (simplest)
   - Render video to texture first (complex)
   - Apply via CSS filter on video element (limited)

2. **Phosphor Persistence**: Should we implement this in Phase 4 or defer?
   - Requires temporal blending (previous frame access)
   - High performance cost
   - Recommendation: Defer to Phase 5

3. **Mobile Detection**: How do we detect mobile for performance scaling?
   - User agent parsing (fragile)
   - WebGL capability detection
   - Touch detection + screen size heuristic

4. **Preset Persistence**: Should advanced presets be stored separately from basic settings?
   - Single flat object (current approach)
   - Nested structure (advanced: { phosphor: {...}, bloom: {...} })

---

## 📊 Estimated Effort

| Task | Size | Estimate | Parallel? |
|------|------|----------|-----------|
| 04-001: Domain Model | Small | 2-3 hours | No (first) |
| 04-002: Phosphor Pattern | Medium | 4-6 hours | Yes |
| 04-003: Bloom Effect | Medium | 4-6 hours | Yes |
| 04-004: Barrel Distortion | Small | 2-3 hours | Yes |
| 04-005: Chromatic Aberration | Small | 2-3 hours | Yes |
| 04-006: Settings Panel | Medium | 4-6 hours | After 04-002-005 |
| 04-007: Named Presets | Small | 2-3 hours | After 04-006 |

**Total Estimated**: 20-30 hours

**Critical Path**: 04-001 → 04-002 → 04-006 → 04-007

---

## 🔄 Related Documentation

- [CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md)
- [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md)
- [Phase 2 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-003-REPORT.md)
