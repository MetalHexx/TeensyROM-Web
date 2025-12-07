# Task 04-005: Chromatic Aberration

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-005 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Small (3-4 files) |
| **Priority** | Low (nice-to-have) |
| **Dependencies** | TASK-04-001 (Domain Model) |

---

## 🎯 Objective

Add chromatic aberration effect that separates RGB channels at screen edges, simulating the lens distortion found in CRT monitors. Red channel shifts outward, blue channel shifts inward.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current scanline shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)
- [ ] [CrtRenderer class](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-effect-wrapper/webgl/
├── crt-renderer.ts                       📝 Add CA uniform
├── crt-renderer.spec.ts                  📝 Add CA tests
└── shaders/
    └── scanline.frag.ts                  📝 Add CA calculation

libs/ui/components/src/lib/crt-settings-panel/
├── crt-slider-configs.ts                 📝 Add chromatic aberration slider config
├── crt-settings-panel.component.ts       📝 Add CA slider
├── crt-settings-panel.component.html     📝 Add CA UI control
└── crt-settings-panel.component.spec.ts  📝 Add CA control tests
```

> **📌 Testing Strategy**: We add the settings panel controls as part of this task so we can immediately test the shader effect manually via the UI after implementation.

---

## 🏗️ Technical Design

### Chromatic Aberration Concept

```
Without CA                        With Chromatic Aberration
┌─────────────────────┐           ┌─────────────────────┐
│                     │           │R                   B│
│    WHITE TEXT       │     →     │R   WHITE TEXT     B│
│                     │           │R                   B│
└─────────────────────┘           └─────────────────────┘
  Clean edges                       RGB fringing at edges
```

### Architecture Challenge

**Problem**: Our current implementation is an overlay shader. We don't sample the actual video texture - we just draw dark scanlines on top.

**Chromatic aberration requires**: Sampling the underlying content at different positions for each RGB channel.

### Implementation Options

| Option | Complexity | Quality | Recommendation |
|--------|------------|---------|----------------|
| A: Skip CA | None | N/A | Simplest, defer to future |
| B: Fake CA on overlay | Low | Low | Visible but approximate |
| C: Video to texture | High | High | True CA, major refactor |

**Recommendation**: Option B for Phase 4, with Option C noted for future enhancement.

### Option B: Fake CA on Overlay

Instead of true chromatic aberration, we create an approximation by:
1. Shifting the overlay's vignette/scanlines slightly per channel
2. Creating colored edge tinting that suggests CA

```glsl
uniform float u_chromaticAberration;  // 0.0 - 5.0 (pixels)

/**
 * Simulated chromatic aberration for overlay mode.
 * 
 * Since we can't sample the actual video, we approximate CA by:
 * - Adding subtle red tint to one edge
 * - Adding subtle blue tint to opposite edge
 * - Scaling the effect by distance from center
 * 
 * This creates the impression of CA without true channel separation.
 */
vec3 fakeChromaticAberration(vec2 uv, float amount) {
  if (amount <= 0.0) {
    return vec3(0.0);
  }
  
  // Distance from center (0 at center, ~0.7 at corners)
  vec2 center = uv - 0.5;
  float dist = length(center);
  
  // Direction from center (normalized)
  vec2 dir = center / max(dist, 0.001);
  
  // Scale amount to be subtle
  float scale = amount * 0.01;
  
  // Red shifts outward (positive in direction from center)
  // Blue shifts inward (negative)
  float redShift = dist * scale;
  float blueShift = -dist * scale;
  
  // Create color tint based on direction
  // This creates edge coloring that suggests CA
  vec3 tint = vec3(0.0);
  
  // Horizontal component: red on right edge, blue on left
  tint.r = max(center.x, 0.0) * scale;
  tint.b = max(-center.x, 0.0) * scale;
  
  // Vertical component: adds to the effect
  tint.r += max(center.y, 0.0) * scale * 0.5;
  tint.b += max(-center.y, 0.0) * scale * 0.5;
  
  return tint * dist * 2.0;
}
```

### Shader Integration

Apply CA tint to the overlay output:

```glsl
void main() {
  // ... existing calculations ...
  
  float alpha = max(scanlineAlpha, vignetteAlpha);
  
  // Calculate CA color tint
  vec3 caTint = fakeChromaticAberration(v_texCoord, u_chromaticAberration);
  
  // Apply tint to overlay color
  // Instead of pure black, add subtle RGB fringing
  vec3 overlayColor = caTint;
  
  gl_FragColor = vec4(overlayColor, alpha);
}
```

### Alternative: True CA (Future Work)

For true chromatic aberration, we would need to:

1. Create a framebuffer texture
2. Render video to the texture
3. Sample texture at offset positions per channel:

```glsl
// TRUE chromatic aberration (requires texture access)
vec3 trueChromaticAberration(sampler2D tex, vec2 uv, float amount) {
  vec2 center = uv - 0.5;
  float dist = length(center);
  vec2 dir = normalize(center);
  
  // Offset in pixels, scaled to UV
  float offset = amount * dist / u_resolution.x;
  
  // Sample each channel at different positions
  float r = texture2D(tex, uv + dir * offset).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - dir * offset).b;
  
  return vec3(r, g, b);
}
```

This would be Phase 5 work requiring significant architectural changes.

---

## 📋 Implementation Steps

### Step 1: Add Uniform to CrtRenderer

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`

1. Add uniform location:
   ```typescript
   interface CrtUniforms {
     // ... existing ...
     chromaticAberration: WebGLUniformLocation | null;
   }
   ```

2. Get location in `setupShaders()`:
   ```typescript
   this.uniforms.chromaticAberration = gl.getUniformLocation(this.program, 'u_chromaticAberration');
   ```

3. Update in `updateSettings()`:
   ```typescript
   gl.uniform1f(this.uniforms.chromaticAberration, settings.chromaticAberration);
   ```

### Step 2: Update Fragment Shader

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`

1. Add `u_chromaticAberration` uniform declaration
2. Add `fakeChromaticAberration()` function
3. Apply CA tint in `main()`

### Step 3: Add Settings Panel Controls

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`

Add chromatic aberration slider configuration:

```typescript
/** Chromatic aberration slider configuration */
export const CHROMATIC_ABERRATION_SLIDER: SliderConfig = {
  key: 'chromaticAberration',
  label: 'Chromatic Aberration',
  min: 0,
  max: 5,
  step: 0.1,
  format: 'px',
  decimalPlaces: 1,
};
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

Add slider reference:

```typescript
import { CHROMATIC_ABERRATION_SLIDER } from './crt-slider-configs';

// In component class:
protected readonly chromaticAberrationSlider = CHROMATIC_ABERRATION_SLIDER;
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`

Add CA control:

```html
<!-- Chromatic Aberration Control -->
@if (config().showChromaticAberration) {
  <div class="crt-control-group">
    <span class="control-label">{{ chromaticAberrationSlider.label }}</span>
    <mat-slider
      [min]="chromaticAberrationSlider.min"
      [max]="chromaticAberrationSlider.max"
      [step]="chromaticAberrationSlider.step"
      discrete>
      <input
        matSliderThumb
        [ngModel]="settings()[chromaticAberrationSlider.key]"
        (ngModelChange)="onSliderChange(chromaticAberrationSlider.key, $event)" />
    </mat-slider>
    <span class="control-value">{{ formatValue(settings()[chromaticAberrationSlider.key], chromaticAberrationSlider) }}</span>
  </div>
}
```

### Step 4: Add Unit Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`

```typescript
describe('chromatic aberration', () => {
  it('should set chromatic aberration uniform', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      chromaticAberration: 2.5,
    });
    
    expect(mockGl.uniform1f).toHaveBeenCalledWith(
      expect.anything(),
      2.5
    );
  });
  
  it('should disable CA when set to 0', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      chromaticAberration: 0,
    });
    
    expect(mockGl.uniform1f).toHaveBeenCalledWith(
      expect.anything(),
      0
    );
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] CA creates visible RGB fringing at edges
- [ ] Effect is subtle (not overwhelming)
- [ ] `chromaticAberration = 0` disables effect
- [ ] Effect scales with slider value
- [ ] No center distortion (effect only at edges)
- [ ] Unit tests verify uniform setting
- [ ] TypeScript compiles without errors

**Note**: This is a simulated CA effect. True CA would require texture sampling architecture changes (future work).

---

## 🧪 Testing

### Unit Tests

```bash
pnpm nx test ui-components --testFile=crt-renderer --watch=false
```

### Manual Testing via Settings Panel

After implementing the shader and settings panel controls:

1. **Start dev server**: `pnpm start`
2. **Navigate to player view** with active video/media content
3. **Open CRT settings panel**
4. **Test chromatic aberration slider**:
   - Set to `0` → Verify NO color fringing visible
   - Gradually increase to `3` → Observe subtle RGB fringing at screen edges
   - Set to max `5` → Verify effect is visible but not overwhelming
   - Ensure screen center has no color shift (effect is edge-only)
5. **Test with different content**:
   - Bright content (white backgrounds) - effect may be less visible
   - Dark content with bright edges - effect should be more noticeable
   - High contrast content - best for verifying color separation
6. **Verify real-time updates** - Slider changes apply immediately without flicker

### Visual Verification

1. Set `chromaticAberration: 3`
2. Look for subtle color fringing at edges
3. Verify center of screen has no color shift
4. Test with bright content to see effect

---

## 📝 Notes

### Limitations

The fake CA effect has limitations:
- Does not actually separate video RGB channels
- Creates colored overlay instead of true lens aberration
- Effect is more visible on dark content than bright content

### Future Enhancement

True chromatic aberration would require:
1. Render video to WebGL texture
2. Sample texture with per-channel offset
3. Major architectural change to rendering pipeline

Consider this for Phase 5 if user feedback indicates desire for more authentic CA.

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-001: Domain Model](./CRT-EFFECT-ENHANCEMENT-TASK-04-001-DOMAIN-MODEL.md)
- Current shader: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
