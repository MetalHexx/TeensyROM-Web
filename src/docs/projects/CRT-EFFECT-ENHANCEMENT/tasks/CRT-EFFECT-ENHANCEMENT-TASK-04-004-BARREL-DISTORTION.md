# Task 04-004: Barrel Distortion

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-004 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Small (3-4 files) |
| **Priority** | Medium |
| **Dependencies** | TASK-04-001 (Domain Model) |

---

## 🎯 Objective

Add barrel distortion to the WebGL shader to create true curved screen geometry. This warps the image outward at the edges, simulating the curvature of CRT glass. This is different from `screenCurvature` (border-radius) which only clips corners.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current vertex shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/passthrough.vert.ts)
- [ ] [CrtRenderer class](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-effect-wrapper/webgl/
├── crt-renderer.ts                       📝 Add distortion uniform
├── crt-renderer.spec.ts                  📝 Add distortion tests
└── shaders/
    ├── passthrough.vert.ts               📝 Add barrel distortion (option A)
    └── scanline.frag.ts                  📝 Add UV distortion (option B)

libs/ui/components/src/lib/crt-settings-panel/
├── crt-slider-configs.ts                 📝 Add barrel distortion slider config
├── crt-settings-panel.component.ts       📝 Add distortion slider
├── crt-settings-panel.component.html     📝 Add distortion UI control
└── crt-settings-panel.component.spec.ts  📝 Add distortion control tests
```

> **📌 Testing Strategy**: We add the settings panel controls as part of this task so we can immediately test the shader effect manually via the UI after implementation.

---

## 🏗️ Technical Design

### Barrel Distortion Concept

```
Without Distortion               With Barrel Distortion
┌─────────────────────┐          ┌─────────────────────┐
│ ┌─────────────────┐ │          │ ╭─────────────────╮ │
│ │                 │ │          │ │╲               ╱│ │
│ │     CONTENT     │ │    →     │ │ ╲   CONTENT   ╱ │ │
│ │                 │ │          │ │  ╲           ╱  │ │
│ └─────────────────┘ │          │ ╰─────────────────╯ │
└─────────────────────┘          └─────────────────────┘
  Flat image                       Bulging outward at edges
```

### Implementation Options

**Option A: Vertex Shader Distortion**
- Modify vertex positions to create curved geometry
- Very efficient (only 4 vertices)
- Works well for overlay that covers full viewport

**Option B: Fragment Shader UV Distortion**
- Distort texture coordinates in fragment shader
- More flexible, can adjust per-pixel
- Slightly less efficient but more control

**Recommendation**: Option B (Fragment shader) - easier to integrate with existing overlay and allows per-pixel control.

### GLSL Implementation (Fragment Shader)

```glsl
// Barrel distortion uniform
uniform float u_barrelDistortion;  // 0.0 - 0.5

/**
 * Apply barrel distortion to UV coordinates.
 * 
 * The formula pushes pixels outward from center based on distance squared.
 * This creates the characteristic "bulging" of CRT screens.
 * 
 * @param uv Original texture coordinates (0-1 range)
 * @param amount Distortion strength (0 = none, 0.5 = maximum)
 * @return Distorted UV coordinates
 */
vec2 barrelDistort(vec2 uv, float amount) {
  if (amount <= 0.0) {
    return uv;
  }
  
  // Center UV around origin (-0.5 to 0.5)
  vec2 centered = uv - 0.5;
  
  // Calculate distance squared from center
  float r2 = dot(centered, centered);
  
  // Apply radial distortion
  // The formula: uv' = uv * (1 + k * r²)
  // where k is the distortion amount
  float distortion = 1.0 + r2 * amount * 4.0; // Scale factor for visible effect
  
  // Apply distortion and re-center
  vec2 distorted = centered * distortion + 0.5;
  
  return distorted;
}

/**
 * Check if UV is outside valid range after distortion.
 * Used to clip corners that extend beyond the original bounds.
 */
bool isOutOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}
```

### Shader Integration

Apply barrel distortion first, before all other effects:

```glsl
void main() {
  // Apply barrel distortion to UV
  vec2 uv = barrelDistort(v_texCoord, u_barrelDistortion);
  
  // Check bounds - pixels outside should be fully transparent
  if (isOutOfBounds(uv)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  
  // Use distorted UV for all subsequent calculations
  float scanlineAlpha = u_scanlineIntensity * calculateScanline(uv, u_scanlineSize, u_resolution);
  float vignetteAlpha = calculateVignette(uv, u_vignetteStrength) * 0.5;
  
  // ... rest of shader
}
```

### Visual Effect

With `barrelDistortion = 0.15`:
- Center of screen: minimal distortion
- Edges: pushed outward ~3-5%
- Corners: most distortion, may be clipped

---

## 📋 Implementation Steps

### Step 1: Add Uniform to CrtRenderer

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`

1. Add uniform location:
   ```typescript
   interface CrtUniforms {
     // ... existing ...
     barrelDistortion: WebGLUniformLocation | null;
   }
   ```

2. Get location in `setupShaders()`:
   ```typescript
   this.uniforms.barrelDistortion = gl.getUniformLocation(this.program, 'u_barrelDistortion');
   ```

3. Update in `updateSettings()`:
   ```typescript
   gl.uniform1f(this.uniforms.barrelDistortion, settings.barrelDistortion);
   ```

### Step 2: Update Fragment Shader

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`

1. Add `u_barrelDistortion` uniform declaration
2. Add `barrelDistort()` function
3. Add `isOutOfBounds()` helper
4. Apply distortion at start of `main()`
5. Use distorted UV for all effect calculations

### Step 3: Add Settings Panel Controls

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`

Add barrel distortion slider configuration:

```typescript
/** Barrel distortion slider configuration */
export const BARREL_DISTORTION_SLIDER: SliderConfig = {
  key: 'barrelDistortion',
  label: 'Barrel Distortion',
  min: 0,
  max: 0.5,
  step: 0.01,
  format: 'decimal',
  decimalPlaces: 2,
};
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

Add slider reference:

```typescript
import { BARREL_DISTORTION_SLIDER } from './crt-slider-configs';

// In component class:
protected readonly barrelDistortionSlider = BARREL_DISTORTION_SLIDER;
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`

Add distortion control:

```html
<!-- Barrel Distortion Control -->
@if (config().showDistortion) {
  <div class="crt-control-group">
    <span class="control-label">{{ barrelDistortionSlider.label }}</span>
    <mat-slider
      [min]="barrelDistortionSlider.min"
      [max]="barrelDistortionSlider.max"
      [step]="barrelDistortionSlider.step"
      discrete>
      <input
        matSliderThumb
        [ngModel]="settings()[barrelDistortionSlider.key]"
        (ngModelChange)="onSliderChange(barrelDistortionSlider.key, $event)" />
    </mat-slider>
    <span class="control-value">{{ formatValue(settings()[barrelDistortionSlider.key], barrelDistortionSlider) }}</span>
  </div>
}
```

### Step 4: Add Unit Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`

```typescript
describe('barrel distortion', () => {
  it('should set barrel distortion uniform', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      barrelDistortion: 0.15,
    });
    
    expect(mockGl.uniform1f).toHaveBeenCalledWith(
      expect.anything(),
      0.15
    );
  });
  
  it('should disable distortion when set to 0', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      barrelDistortion: 0,
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

- [ ] Barrel distortion creates visible curvature effect
- [ ] Center of screen remains relatively undistorted
- [ ] Edges bulge outward naturally
- [ ] Corners may clip (expected behavior)
- [ ] `barrelDistortion = 0` produces flat (no distortion)
- [ ] `barrelDistortion = 0.5` produces maximum curvature
- [ ] No visual artifacts or seams
- [ ] All other effects (scanlines, vignette) follow distorted coordinates
- [ ] Unit tests verify uniform setting
- [ ] TypeScript compiles without errors

---

## 🧪 Testing

### Unit Tests

```bash
pnpm nx test ui-components --testFile=crt-renderer --watch=false
pnpm nx test ui-components --testFile=crt-settings-panel --watch=false
```

### Manual Testing via Settings Panel

> **📌 Key**: Use the settings panel controls added in this task to verify the shader effect works correctly.

1. **Start the dev server**: `pnpm start`
2. **Navigate to a video player** with CRT effects enabled
3. **Open the CRT settings panel**
4. **Test barrel distortion slider**:
   - Set to 0 → Flat screen, no distortion
   - Set to 0.15 → Moderate curvature visible at edges
   - Set to 0.3 → Strong curvature
   - Set to 0.5 → Maximum distortion
5. **Verify distortion characteristics**:
   - Center of screen should remain relatively undistorted
   - Edges should bulge outward
   - Corners may clip (expected)
6. **Verify interaction with other effects**:
   - Enable scanlines → They should follow the curved coordinates
   - Enable vignette → Should layer on distorted image
   - Combine with screenCurvature (border-radius) → Both should work together

### Edge Cases

- Very high distortion (0.5) should not crash
- Corners should gracefully clip to transparent
- Combined with screenCurvature should work together

---

## 📝 Notes

### Difference from screenCurvature

| Property | `screenCurvature` | `barrelDistortion` |
|----------|-------------------|-------------------|
| Type | CSS border-radius | WebGL UV warp |
| Effect | Clips corners | Warps entire image |
| Where | Component styling | Shader |
| Mode | CSS and WebGL | WebGL only |

These can be used together for maximum effect.

### Performance

Barrel distortion is very cheap - just a few math operations per pixel. No performance concerns.

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-001: Domain Model](./CRT-EFFECT-ENHANCEMENT-TASK-04-001-DOMAIN-MODEL.md)
- Current shader: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
