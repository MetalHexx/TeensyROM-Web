# Task 04-002: Phosphor/Shadow Mask Pattern

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-002 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Medium (4-5 files) |
| **Priority** | High |
| **Dependencies** | TASK-04-001 (Domain Model) |

---

## 🎯 Objective

Implement RGB subpixel simulation in the WebGL fragment shader to emulate CRT phosphor patterns. Support three pattern types: Aperture Grille (Trinitron), Shadow Mask (traditional), and Dot Triad (arcade).

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current scanline shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)
- [ ] [CrtRenderer class](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)
- [ ] [CRT-Lottes shader reference](https://www.shadertoy.com/view/XsjSzR)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-effect-wrapper/webgl/
├── crt-renderer.ts                       📝 Add phosphor uniforms
├── crt-renderer.spec.ts                  📝 Add phosphor tests
└── shaders/
    └── scanline.frag.ts                  📝 Add phosphor pattern functions

libs/ui/components/src/lib/crt-settings-panel/
├── crt-slider-configs.ts                 📝 Add phosphor slider config
├── crt-settings-panel.component.ts       📝 Add phosphor controls
├── crt-settings-panel.component.html     📝 Add phosphor UI (dropdown + slider)
└── crt-settings-panel.component.spec.ts  📝 Add phosphor control tests
```

> **📌 Testing Strategy**: We add the settings panel controls as part of this task so we can immediately test the shader effect manually via the UI after implementation.

---

## 🏗️ Technical Design

### Phosphor Pattern Types

```
Aperture Grille (Trinitron)     Shadow Mask (Traditional)     Dot Triad (Arcade)
┌─────────────────────┐         ┌─────────────────────┐       ┌─────────────────────┐
│ R G B R G B R G B   │         │ R G B   R G B       │       │  R   G   B          │
│ R G B R G B R G B   │         │   R G B   R G B     │       │    G   B   R        │
│ R G B R G B R G B   │         │ R G B   R G B       │       │  R   G   B          │
│ R G B R G B R G B   │         │   R G B   R G B     │       │    G   B   R        │
└─────────────────────┘         └─────────────────────┘       └─────────────────────┘
  Vertical stripes                Staggered rows               Triangular layout
```

### GLSL Implementation

```glsl
// Phosphor pattern uniforms
uniform int u_phosphorPattern;      // 0=none, 1=grille, 2=shadow, 3=triad
uniform float u_phosphorIntensity;  // 0.0 - 1.0
uniform vec2 u_phosphorScale;       // Pattern scaling factor

// === Aperture Grille (Trinitron) ===
// Vertical RGB stripes, each column is R, G, or B
vec3 apertureGrille(vec2 uv, vec2 resolution) {
  float x = uv.x * resolution.x;
  float col = mod(floor(x), 3.0);
  
  // Each stripe lights one channel at full, others dimmed
  vec3 mask;
  if (col < 1.0) {
    mask = vec3(1.0, 0.0, 0.0); // Red stripe
  } else if (col < 2.0) {
    mask = vec3(0.0, 1.0, 0.0); // Green stripe
  } else {
    mask = vec3(0.0, 0.0, 1.0); // Blue stripe
  }
  
  return mask;
}

// === Shadow Mask (Traditional CRT) ===
// Staggered RGB dot pattern, alternating row offset
vec3 shadowMask(vec2 uv, vec2 resolution) {
  float x = uv.x * resolution.x;
  float y = uv.y * resolution.y;
  
  // Offset every other row by 1.5 pixels
  float offset = mod(floor(y), 2.0) * 1.5;
  float col = mod(floor(x + offset), 3.0);
  
  vec3 mask;
  if (col < 1.0) {
    mask = vec3(1.0, 0.0, 0.0);
  } else if (col < 2.0) {
    mask = vec3(0.0, 1.0, 0.0);
  } else {
    mask = vec3(0.0, 0.0, 1.0);
  }
  
  return mask;
}

// === Dot Triad (Arcade) ===
// Triangular RGB arrangement
vec3 dotTriad(vec2 uv, vec2 resolution) {
  float x = uv.x * resolution.x;
  float y = uv.y * resolution.y;
  
  // Create triangular pattern
  float row = mod(floor(y), 2.0);
  float col = mod(floor(x + row * 0.5), 3.0);
  
  // Use smoother blending for dots
  vec2 cellUV = fract(vec2(x, y));
  float dot = smoothstep(0.5, 0.3, length(cellUV - 0.5));
  
  vec3 mask;
  if (col < 1.0) {
    mask = vec3(dot, 0.0, 0.0);
  } else if (col < 2.0) {
    mask = vec3(0.0, dot, 0.0);
  } else {
    mask = vec3(0.0, 0.0, dot);
  }
  
  return mask;
}

// === Main phosphor function ===
vec3 calculatePhosphor(vec2 uv, vec2 resolution, int pattern, float intensity) {
  if (pattern == 0 || intensity <= 0.0) {
    return vec3(1.0); // No pattern, full brightness
  }
  
  vec3 mask;
  if (pattern == 1) {
    mask = apertureGrille(uv, resolution);
  } else if (pattern == 2) {
    mask = shadowMask(uv, resolution);
  } else {
    mask = dotTriad(uv, resolution);
  }
  
  // Blend between full white (no effect) and pattern
  // intensity = 0: pure white (no pattern visible)
  // intensity = 1: full pattern (each pixel only shows one channel)
  return mix(vec3(1.0), mask, intensity);
}
```

### Shader Integration

The phosphor pattern modulates the overlay alpha per-channel. In the main function:

```glsl
void main() {
  // Calculate existing effects
  float scanlineAlpha = ...;
  float vignetteAlpha = ...;
  
  // Calculate phosphor mask
  vec3 phosphorMask = calculatePhosphor(
    v_texCoord, 
    u_resolution, 
    u_phosphorPattern, 
    u_phosphorIntensity
  );
  
  // Apply phosphor to output
  // The mask dims channels that aren't "lit" for this pixel
  vec3 color = vec3(0.0);
  float alpha = max(scanlineAlpha, vignetteAlpha);
  
  // Phosphor modulates the transparency per channel
  // This creates the RGB subpixel effect
  gl_FragColor = vec4(
    color.r * (1.0 - phosphorMask.r),
    color.g * (1.0 - phosphorMask.g),
    color.b * (1.0 - phosphorMask.b),
    alpha
  );
}
```

**Note**: Since we're rendering an overlay (not the actual video), the phosphor effect works by making certain channels more or less transparent. This creates the illusion of RGB subpixels.

---

## 📋 Implementation Steps

### Step 1: Add Uniforms to CrtRenderer

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`

1. Add uniform locations to `CrtUniforms` interface:
   ```typescript
   interface CrtUniforms {
     // ... existing ...
     phosphorPattern: WebGLUniformLocation | null;
     phosphorIntensity: WebGLUniformLocation | null;
   }
   ```

2. Get uniform locations in `setupShaders()`:
   ```typescript
   this.uniforms.phosphorPattern = gl.getUniformLocation(this.program, 'u_phosphorPattern');
   this.uniforms.phosphorIntensity = gl.getUniformLocation(this.program, 'u_phosphorIntensity');
   ```

3. Update uniforms in `updateSettings()`:
   ```typescript
   // Map pattern type to integer
   const patternMap: Record<PhosphorPatternType, number> = {
     'none': 0,
     'aperture-grille': 1,
     'shadow-mask': 2,
     'dot-triad': 3,
   };
   
   gl.uniform1i(this.uniforms.phosphorPattern, patternMap[settings.phosphorPattern]);
   gl.uniform1f(this.uniforms.phosphorIntensity, settings.phosphorIntensity);
   ```

### Step 2: Update Fragment Shader

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`

1. Add uniform declarations
2. Add all three pattern functions
3. Add `calculatePhosphor` function
4. Integrate phosphor into `main()`

### Step 3: Add Settings Panel Controls

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`

Add phosphor slider configuration:

```typescript
/** Phosphor intensity slider configuration */
export const PHOSPHOR_SLIDER: SliderConfig = {
  key: 'phosphorIntensity',
  label: 'Phosphor Intensity',
  min: 0,
  max: 1,
  step: 0.05,
  format: 'percentage',
  decimalPlaces: 0,
};
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

Add phosphor pattern dropdown options and handler:

```typescript
import { PhosphorPatternType } from '@teensyrom-nx/domain';
import { PHOSPHOR_SLIDER } from './crt-slider-configs';

// Phosphor dropdown options
interface PhosphorOption {
  value: PhosphorPatternType;
  label: string;
}

const PHOSPHOR_OPTIONS: PhosphorOption[] = [
  { value: 'none', label: 'None' },
  { value: 'aperture-grille', label: 'Aperture Grille (Trinitron)' },
  { value: 'shadow-mask', label: 'Shadow Mask' },
  { value: 'dot-triad', label: 'Dot Triad (Arcade)' },
];

// In component class:
protected readonly phosphorOptions = PHOSPHOR_OPTIONS;
protected readonly phosphorSlider = PHOSPHOR_SLIDER;

protected onPhosphorPatternChange(pattern: PhosphorPatternType): void {
  const updatedSettings: CrtSettings = {
    ...this.settings(),
    phosphorPattern: pattern,
  };
  this.settingsChange.emit(updatedSettings);
}
```

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`

Add phosphor controls section:

```html
<!-- Phosphor Controls -->
@if (config().showPhosphor) {
  <div class="crt-control-group">
    <span class="control-label">Phosphor Pattern</span>
    <select
      class="phosphor-select"
      [ngModel]="settings().phosphorPattern"
      (ngModelChange)="onPhosphorPatternChange($event)">
      @for (option of phosphorOptions; track option.value) {
        <option [value]="option.value">{{ option.label }}</option>
      }
    </select>
  </div>
  
  @if (settings().phosphorPattern !== 'none') {
    <div class="crt-control-group">
      <span class="control-label">{{ phosphorSlider.label }}</span>
      <mat-slider
        [min]="phosphorSlider.min"
        [max]="phosphorSlider.max"
        [step]="phosphorSlider.step"
        discrete>
        <input
          matSliderThumb
          [ngModel]="settings()[phosphorSlider.key]"
          (ngModelChange)="onSliderChange(phosphorSlider.key, $event)" />
      </mat-slider>
      <span class="control-value">{{ formatValue(settings()[phosphorSlider.key], phosphorSlider) }}</span>
    </div>
  }
}
```

### Step 4: Add Unit Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`

```typescript
describe('phosphor pattern', () => {
  it('should set phosphor uniforms when pattern is aperture-grille', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      phosphorPattern: 'aperture-grille',
      phosphorIntensity: 0.5,
    });
    
    expect(mockGl.uniform1i).toHaveBeenCalledWith(
      expect.anything(),
      1 // aperture-grille = 1
    );
    expect(mockGl.uniform1f).toHaveBeenCalledWith(
      expect.anything(),
      0.5
    );
  });
  
  it('should disable phosphor when pattern is none', () => {
    renderer.updateSettings({
      ...DEFAULT_CRT_SETTINGS,
      phosphorPattern: 'none',
      phosphorIntensity: 0,
    });
    
    expect(mockGl.uniform1i).toHaveBeenCalledWith(
      expect.anything(),
      0 // none = 0
    );
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] All 3 phosphor patterns render correctly (visual verification)
- [ ] `phosphorIntensity` slider smoothly fades effect (0 = invisible, 1 = full)
- [ ] Pattern scales correctly with resolution
- [ ] No visual artifacts at screen edges
- [ ] Phosphor disabled when `phosphorPattern = 'none'`
- [ ] Phosphor disabled in CSS mode (WebGL only)
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
4. **Test each phosphor pattern**:
   - Select "Aperture Grille (Trinitron)" → Verify vertical RGB stripes
   - Select "Shadow Mask" → Verify staggered RGB dots
   - Select "Dot Triad (Arcade)" → Verify triangular RGB pattern
5. **Test intensity slider**:
   - Set to 0% → Pattern should be invisible
   - Set to 50% → Subtle pattern visible
   - Set to 100% → Maximum pattern visibility
6. **Verify interaction with other effects**:
   - Enable scanlines + phosphor → Both should render together
   - Adjust vignette → Should layer correctly

---

## 📝 Notes

- **Performance**: Phosphor pattern is a simple per-pixel calculation, very GPU-friendly.
- **Scaling**: Pattern may look different at different zoom levels. Consider adding a scale uniform.
- **Color Accuracy**: The overlay approach creates approximate phosphor effect. True phosphor simulation would require rendering video to texture first.

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-001: Domain Model](./CRT-EFFECT-ENHANCEMENT-TASK-04-001-DOMAIN-MODEL.md)
- Current shader: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
