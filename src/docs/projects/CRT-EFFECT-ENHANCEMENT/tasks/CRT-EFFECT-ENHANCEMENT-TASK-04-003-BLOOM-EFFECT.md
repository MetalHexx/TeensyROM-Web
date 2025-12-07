# Task 04-003: Bloom/Glow Effect

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-003 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Medium (4-5 files) |
| **Priority** | Medium |
| **Dependencies** | TASK-04-001 (Domain Model) |

---

## 🎯 Objective

Add a bloom/glow effect to the WebGL shader that creates soft light bleeding around bright areas, simulating the phosphor glow of CRT monitors. The effect should be performant enough for mobile devices while providing authentic visual enhancement.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current scanline shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)
- [ ] [CrtRenderer class](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-effect-wrapper/webgl/
├── crt-renderer.ts                       📝 Add bloom uniforms
├── crt-renderer.spec.ts                  📝 Add bloom tests
└── shaders/
    └── scanline.frag.ts                  📝 Add bloom calculation

libs/ui/components/src/lib/crt-settings-panel/
├── crt-slider-configs.ts                 📝 Add bloom slider configs
├── crt-settings-panel.component.ts       📝 Add bloom toggle and sliders
├── crt-settings-panel.component.html     📝 Add bloom UI controls
└── crt-settings-panel.component.spec.ts  📝 Add bloom control tests
```

> **📌 Testing Strategy**: We add the settings panel controls as part of this task so we can immediately test the shader effect manually via the UI after implementation.

---

## 🏗️ Technical Design

### Bloom Effect Concept

```
Without Bloom                      With Bloom
┌─────────────────────┐            ┌─────────────────────┐
│                     │            │    ░░░░░░░░░        │
│    ████████████     │            │  ░░████████████░░   │
│    ████████████     │     →      │  ░░████████████░░   │
│    ████████████     │            │  ░░████████████░░   │
│                     │            │    ░░░░░░░░░        │
└─────────────────────┘            └─────────────────────┘
  Sharp bright area                  Soft glow around edges
```

### Architecture Challenge

**Current Overlay Approach**: Our shader renders a dark overlay on top of video content. We don't have direct access to the video pixels.

**Bloom Options**:

1. **Additive Glow (Recommended)**: Instead of darkening, bloom areas become slightly lighter/transparent, creating a glow illusion.
2. **Texture Sampling (Complex)**: Render video to texture first, sample for bloom, then overlay.
3. **CSS Filter Fallback**: Apply CSS blur filter to video element for bloom approximation.

**Recommendation**: Use Option 1 (additive glow) - simpler to implement within current architecture.

### GLSL Implementation

```glsl
// Bloom uniforms
uniform bool u_bloomEnabled;
uniform float u_bloomIntensity;   // 0.0 - 2.0
uniform float u_bloomRadius;      // 1.0 - 10.0 (in pixels)

// Bloom using additive transparency reduction
// Since we're an overlay, "bloom" = reducing overlay darkness in bright areas
// This creates the illusion of light bleeding through

float calculateBloom(vec2 uv, vec2 resolution, float radius, float intensity) {
  if (!u_bloomEnabled || intensity <= 0.0) {
    return 0.0;
  }
  
  // Sample multiple points around current pixel
  // Accumulate "brightness" (inverse of overlay darkness)
  float bloom = 0.0;
  float totalWeight = 0.0;
  
  // 9-tap box filter for performance (3x3 grid)
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) * radius / resolution;
      vec2 sampleUV = uv + offset;
      
      // Weight by distance from center (gaussian-like)
      float dist = length(vec2(float(x), float(y)));
      float weight = 1.0 / (1.0 + dist);
      
      // Since we don't have the actual video texture,
      // we simulate bloom based on scanline gaps (bright areas)
      // Areas between scanlines are "brighter" and should glow
      float scanlinePos = sampleUV.y * resolution.y;
      float scanlineBrightness = calculateScanline(sampleUV, u_scanlineSize, resolution);
      
      // Invert: high scanline darkness = low brightness
      float brightness = 1.0 - scanlineBrightness;
      
      bloom += brightness * weight;
      totalWeight += weight;
    }
  }
  
  bloom = bloom / totalWeight;
  
  // Apply intensity and return as alpha reduction
  return bloom * intensity * 0.3; // Scale factor for subtle effect
}

// In main():
void main() {
  float scanlineAlpha = ...;
  float vignetteAlpha = ...;
  
  // Calculate bloom (reduces overall darkness)
  float bloomReduction = calculateBloom(
    v_texCoord, 
    u_resolution, 
    u_bloomRadius, 
    u_bloomIntensity
  );
  
  // Combine effects
  float alpha = max(scanlineAlpha, vignetteAlpha);
  
  // Bloom reduces the overlay alpha, creating glow effect
  alpha = max(0.0, alpha - bloomReduction);
  
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
```

### Alternative: Simple Edge Glow

If sampling-based bloom is too expensive, use a simpler edge-glow approach:

```glsl
// Simple glow based on distance from scanline center
float simpleGlow(vec2 uv, vec2 resolution, float scanlineSize, float intensity) {
  float y = uv.y * resolution.y;
  float frequency = 3.14159 / max(scanlineSize, 0.5);
  
  // Distance from scanline center (peak of sine wave)
  float wave = sin(y * frequency);
  
  // Glow is stronger near bright areas (peaks)
  float glow = pow(max(wave, 0.0), 2.0) * intensity * 0.2;
  
  return glow;
}
```

---

## 📋 Implementation Steps

### Step 1: Add Uniforms to CrtRenderer

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`

1. Add uniform locations:
   ```typescript
   interface CrtUniforms {
     // ... existing ...
     bloomEnabled: WebGLUniformLocation | null;
     bloomIntensity: WebGLUniformLocation | null;
     bloomRadius: WebGLUniformLocation | null;
   }
   ```

2. Get locations in `setupShaders()`:
   ```typescript
   this.uniforms.bloomEnabled = gl.getUniformLocation(this.program, 'u_bloomEnabled');
   this.uniforms.bloomIntensity = gl.getUniformLocation(this.program, 'u_bloomIntensity');
   this.uniforms.bloomRadius = gl.getUniformLocation(this.program, 'u_bloomRadius');
   ```

3. Update in `updateSettings()`:
   ```typescript
   gl.uniform1i(this.uniforms.bloomEnabled, settings.bloomEnabled ? 1 : 0);
   gl.uniform1f(this.uniforms.bloomIntensity, settings.bloomIntensity);
   gl.uniform1f(this.uniforms.bloomRadius, settings.bloomRadius);
   ```

### Step 2: Update Fragment Shader

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`

1. Add bloom uniform declarations
2. Add `calculateBloom` or `simpleGlow` function
3. Integrate bloom into `main()` function

### Step 3: Performance Optimization

Consider adding a quality level:

```typescript
// In CrtRenderer
private bloomQuality: 'low' | 'medium' | 'high' = 'medium';

// Adjust sample count based on quality
// low: 5-tap (cross pattern)
// medium: 9-tap (3x3 grid)
// high: 25-tap (5x5 grid)
```

### Step 4: Add Settings Panel Controls

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`

Add bloom slider configurations:

```typescript
/** Bloom slider configurations */
export const BLOOM_SLIDERS: SliderConfig[] = [
  {
    key: 'bloomIntensity',
    label: 'Bloom Intensity',
    min: 0,
    max: 2,
    step: 0.1,
    format: 'percentage',
    decimalPlaces: 0,
  },
  {
    key: 'bloomRadius',
    label: 'Bloom Radius',
    min: 1,
    max: 10,
    step: 0.5,
    format: 'px',
    decimalPlaces: 1,
  },
];
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

Add bloom toggle and import:

```typescript
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BLOOM_SLIDERS } from './crt-slider-configs';

// Add to imports array
imports: [
  // ... existing ...
  MatSlideToggleModule,
],

// In component class:
protected readonly bloomSliders = BLOOM_SLIDERS;

protected onBloomToggle(enabled: boolean): void {
  const updatedSettings: CrtSettings = {
    ...this.settings(),
    bloomEnabled: enabled,
  };
  this.settingsChange.emit(updatedSettings);
}
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`

Add bloom controls section:

```html
<!-- Bloom Controls -->
@if (config().showBloom) {
  <div class="crt-control-group crt-toggle-group">
    <span class="control-label">Bloom</span>
    <mat-slide-toggle
      [checked]="settings().bloomEnabled"
      (change)="onBloomToggle($event.checked)">
    </mat-slide-toggle>
  </div>
  
  @if (settings().bloomEnabled) {
    @for (slider of bloomSliders; track slider.key) {
      <div class="crt-control-group">
        <span class="control-label">{{ slider.label }}</span>
        <mat-slider
          [min]="slider.min"
          [max]="slider.max"
          [step]="slider.step"
          discrete>
          <input
            matSliderThumb
            [ngModel]="settings()[slider.key]"
            (ngModelChange)="onSliderChange(slider.key, $event)" />
        </mat-slider>
        <span class="control-value">{{ formatValue(settings()[slider.key], slider) }}</span>
      </div>
    }
  }
}
```

### Step 5: Add Unit Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`

```typescript
describe('bloom effect', () => {
  it('should enable bloom when bloomEnabled is true', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      bloomEnabled: true,
      bloomIntensity: 0.5,
      bloomRadius: 3,
    });
    
    expect(mockGl.uniform1i).toHaveBeenCalledWith(
      expect.anything(),
      1 // true
    );
  });
  
  it('should disable bloom when bloomEnabled is false', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      bloomEnabled: false,
    });
    
    expect(mockGl.uniform1i).toHaveBeenCalledWith(
      expect.anything(),
      0 // false
    );
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] Bloom creates visible glow effect around bright areas
- [ ] `bloomEnabled` toggle turns effect on/off completely
- [ ] `bloomIntensity` slider controls glow strength (0 = none, 2 = strong)
- [ ] `bloomRadius` slider controls glow spread (1 = tight, 10 = diffuse)
- [ ] Performance acceptable on mobile (>30fps with bloom enabled)
- [ ] No visual artifacts at screen edges
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
4. **Test bloom toggle**:
   - Toggle OFF → No bloom visible
   - Toggle ON → Sliders appear, bloom becomes visible
5. **Test intensity slider**:
   - Set to 0% → Minimal glow
   - Set to 100% → Strong glow effect
   - Set to 200% → Maximum glow
6. **Test radius slider**:
   - Set to 1px → Tight, sharp glow
   - Set to 5px → Soft, medium spread
   - Set to 10px → Wide, diffuse glow
7. **Verify interaction with other effects**:
   - Enable scanlines + bloom → Both should render together
   - Add phosphor pattern → All three should layer correctly

### Performance Testing

1. Enable bloom with maximum settings
2. Run on mobile device or throttled CPU
3. Verify >30fps maintained
4. If too slow, implement quality degradation

---

## 📝 Notes

### Architecture Decision: Overlay vs Texture

**Current approach (overlay)**: Bloom simulated by reducing overlay darkness near "bright" areas. This is an approximation since we don't sample actual video content.

**Future enhancement**: For true bloom, render video to texture first, detect bright pixels, then apply gaussian blur. This would be Phase 5 work.

### Mobile Considerations

- Reduce sample count to 5-tap on mobile
- Consider making bloom optional/disabled by default on mobile
- Monitor frame time and auto-disable if performance suffers

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-001: Domain Model](./CRT-EFFECT-ENHANCEMENT-TASK-04-001-DOMAIN-MODEL.md)
- Current shader: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
