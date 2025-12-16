# How to Add a New WebGL Effect

This guide documents the complete process for adding a new WebGL-based visual effect to the CRT system, based on the barrel distortion implementation pattern.

## Overview

Adding a new WebGL effect requires changes across 4 layers:
1. **Domain Model** - Add property to `CrtSettings` interface
2. **WebGL Shader** - Implement effect in GLSL fragment shader
3. **Renderer** - Bind shader uniform in `CrtRenderer`
4. **UI** - Add slider control to settings panel

Each layer has specific files that need to be modified, following established patterns.

---

## Layer 1: Domain Model

### Files to Modify

**1. Domain Interface** (`libs/domain/src/lib/models/crt-settings.model.ts`)

Add your effect property to the `CrtSettings` interface:

```typescript
export interface CrtSettings {
  // ... existing properties ...
  
  /**
   * Your effect description here (range, behavior, default value).
   * Explain what it does and how it differs from similar effects.
   * Note if WebGL-only.
   * @default 0
   */
  yourEffectName: number;
  
  // ... rest of properties ...
}
```

**Key Requirements**:
- Position property logically with related effects
- Document range, default value, and purpose
- Use camelCase naming
- Note if effect is WebGL-only or CSS-based

**2. Config Interface** (`libs/domain/src/lib/models/crt-settings.model.ts`)

If your effect needs a visibility toggle in the settings panel:

```typescript
export interface CrtSettingsConfig {
  // ... existing flags ...
  showYourEffect: boolean;
}
```

**3. Preset Defaults** (`libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`)

Add default values to all preset configurations:

```typescript
export const CRT_PRESETS: Record<CrtPresetName, CrtSettings> = {
  [CRT_PRESET_KEYS.SMALL_WEBGL]: {
    // ... existing settings ...
    yourEffectName: 0.1,  // Conservative value for small displays
  },
  [CRT_PRESET_KEYS.LARGE_WEBGL]: {
    // ... existing settings ...
    yourEffectName: 0.25, // More dramatic value for large displays
  },
  // ... other presets ...
};
```

Add visibility flag to config defaults:

```typescript
export const DEFAULT_CRT_CONFIG: CrtSettingsConfig = {
  // ... existing flags ...
  showYourEffect: true,
};
```

---

## Layer 2: WebGL Shader

### Files to Modify

**1. Fragment Shader** (`libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`)

#### A. Add Uniform Declaration

Add uniform at the top with other effect uniforms:

```glsl
// Uniforms
uniform float u_scanlineIntensity;
uniform float u_scanlineSize;
uniform float u_yourEffectName;  // ADD THIS
uniform vec2 u_resolution;
```

**Naming Convention**: Use `u_` prefix + camelCase

#### B. Implement Effect Function

Add your effect function before `main()`:

```glsl
/**
 * Brief description of your effect.
 * Explain the algorithm and mathematical approach.
 */
vec3 applyYourEffect(vec3 color, vec2 uv, float intensity) {
  // Zero-intensity optimization (CRITICAL for performance)
  if (intensity == 0.0) return color;
  
  // Your effect implementation here
  // ...
  
  return modifiedColor;
}
```

**Best Practices**:
- **Always include zero-intensity optimization** (early return when disabled)
- Use efficient math operations (dot product, built-in GLSL functions)
- Document the algorithm and formula
- Keep calculations per-pixel minimal

#### C. Apply Effect in main()

Integrate your effect into the rendering pipeline:

```glsl
void main() {
  vec2 uv = v_texCoord;
  
  // 1. Apply coordinate-based effects first (distortion, etc.)
  // ...
  
  // 2. Sample texture
  vec4 videoColor = texture2D(u_videoTexture, uv);
  
  // 3. Apply color-based effects
  vec3 color = videoColor.rgb;
  color = applyYourEffect(color, uv, u_yourEffectName);  // ADD THIS
  
  // 4. Apply other effects (scanlines, vignette, etc.)
  // ...
  
  // 5. Output final color
  gl_FragColor = vec4(color, 1.0);
}
```

**Effect Order Guidelines**:
- **Coordinate effects** (distortion, warping): Before texture sampling
- **Color effects** (filters, phosphor): After texture sampling
- **Multiplicative effects** (scanlines, vignette): After color effects

**2. Shader Tests** (`libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.spec.ts`)

Add comprehensive test suite for your effect:

```typescript
describe('Your Effect - Shader Implementation', () => {
  describe('shader structure', () => {
    it('should declare u_yourEffectName uniform', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('uniform float u_yourEffectName');
    });

    it('should define applyYourEffect function', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('applyYourEffect');
    });
  });

  describe('zero-intensity optimization', () => {
    it('should have early return when intensity is 0.0', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('if (intensity == 0.0) return');
    });
  });

  describe('effect formula', () => {
    it('should implement correct algorithm', () => {
      // Test for specific formula patterns
      const formulaPattern = /your expected formula regex/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(formulaPattern);
    });
  });

  describe('main() integration', () => {
    it('should call applyYourEffect in main()', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('applyYourEffect');
    });
  });
});
```

---

## Layer 3: Renderer Integration

### Files to Modify

**1. Renderer Implementation** (`libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`)

#### A. Add Uniform to Interface

```typescript
interface CrtUniforms {
  scanlineIntensity: WebGLUniformLocation | null;
  scanlineSize: WebGLUniformLocation | null;
  yourEffectName: WebGLUniformLocation | null;  // ADD THIS
  resolution: WebGLUniformLocation | null;
  // ... other uniforms ...
}
```

#### B. Initialize Uniform Location

In the `uniforms` object initialization:

```typescript
private uniforms: CrtUniforms = {
  scanlineIntensity: null,
  scanlineSize: null,
  yourEffectName: null,  // ADD THIS
  resolution: null,
  // ... other uniforms ...
};
```

#### C. Retrieve Uniform Location

In `setupShaders()` method, after shader compilation:

```typescript
// Get uniform locations
this.uniforms.scanlineIntensity = this.gl.getUniformLocation(program, 'u_scanlineIntensity');
this.uniforms.scanlineSize = this.gl.getUniformLocation(program, 'u_scanlineSize');
this.uniforms.yourEffectName = this.gl.getUniformLocation(program, 'u_yourEffectName');  // ADD THIS
this.uniforms.resolution = this.gl.getUniformLocation(program, 'u_resolution');
```

**Critical**: Uniform name string must match shader declaration exactly (`'u_yourEffectName'`)

#### D. Bind Uniform Value

In `updateSettings()` method:

```typescript
// Group with related effect uniforms (geometric, color, etc.)
if (this.uniforms.yourEffectName !== null) {
  this.gl.uniform1f(this.uniforms.yourEffectName, settings.yourEffectName);
}
```

**Requirements**:
- Always check for null before binding (shader optimizer may remove unused uniforms)
- Use correct `gl.uniform*()` method:
  - `uniform1f()` for single float
  - `uniform2f()` for vec2
  - `uniform3f()` for vec3
  - `uniform4f()` for vec4
  - `uniform1i()` for int/sampler

#### E. Reset on Destroy

In `destroy()` method:

```typescript
this.uniforms = {
  scanlineIntensity: null,
  scanlineSize: null,
  yourEffectName: null,  // ADD THIS
  resolution: null,
  // ... other uniforms ...
};
```

**2. Renderer Tests** (`libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`)

Add tests for uniform binding:

```typescript
describe('CrtRenderer - Your Effect Uniform', () => {
  it('should retrieve yourEffectName uniform location', () => {
    renderer.init(mockCanvas);
    
    expect(mockGl.getUniformLocation).toHaveBeenCalledWith(
      expect.anything(),
      'u_yourEffectName'
    );
  });

  it('should bind yourEffectName uniform in updateSettings()', () => {
    const settings: CrtSettings = {
      ...testSettings,
      yourEffectName: 0.25,
    };
    
    renderer.updateSettings(settings);
    
    expect(mockGl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.25);
  });

  it('should update uniform when value changes', () => {
    renderer.updateSettings({ ...testSettings, yourEffectName: 0.1 });
    expect(mockGl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.1);
    
    mockGl.uniform1f.mockClear();
    
    renderer.updateSettings({ ...testSettings, yourEffectName: 0.3 });
    expect(mockGl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.3);
  });

  it('should handle zero value', () => {
    renderer.updateSettings({ ...testSettings, yourEffectName: 0 });
    expect(mockGl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0);
  });
});
```

---

## Layer 4: UI Integration

### Files to Modify

**1. Slider Configuration** (`libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`)

Add slider configuration constant:

```typescript
export const YOUR_EFFECT_SLIDER: SliderConfig = {
  key: 'yourEffectName',
  label: 'Your Effect Name',
  min: 0,
  max: 1.0,
  step: 0.01,
  format: 'percentage',  // or 'px', 'decimal', 'deg'
  decimalPlaces: 0,
};
```

**Format Options**:
- `'percentage'` - Displays as 0% to 100%
- `'px'` - Appends "px" suffix
- `'decimal'` - Raw decimal value
- `'deg'` - Displays with degree symbol

**2. Slider Configuration Tests** (`libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.spec.ts`)

```typescript
describe('YOUR_EFFECT_SLIDER', () => {
  it('should have correct key property', () => {
    expect(YOUR_EFFECT_SLIDER.key).toBe('yourEffectName');
  });

  it('should have correct label', () => {
    expect(YOUR_EFFECT_SLIDER.label).toBe('Your Effect Name');
  });

  it('should have correct range', () => {
    expect(YOUR_EFFECT_SLIDER.min).toBe(0);
    expect(YOUR_EFFECT_SLIDER.max).toBe(1.0);
  });

  it('should have correct step', () => {
    expect(YOUR_EFFECT_SLIDER.step).toBe(0.01);
  });

  it('should have percentage format', () => {
    expect(YOUR_EFFECT_SLIDER.format).toBe('percentage');
    expect(YOUR_EFFECT_SLIDER.decimalPlaces).toBe(0);
  });
});
```

**3. Component TypeScript** (`libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`)

Import and expose the slider config:

```typescript
import {
  SCANLINE_SLIDERS,
  VIGNETTE_SLIDER,
  YOUR_EFFECT_SLIDER,  // ADD THIS
  // ... other sliders
} from './crt-slider-configs';

export class CrtSettingsPanelComponent {
  // ... existing code ...
  
  protected readonly yourEffectSlider = YOUR_EFFECT_SLIDER;  // ADD THIS
  
  // ... rest of component ...
}
```

**4. Component Template** (`libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`)

Add slider markup in the appropriate section:

```html
<!-- Your Effect Control -->
@if (config().showYourEffect) {
  <div class="crt-control-group">
    <span class="control-label">{{ yourEffectSlider.label }}</span>
    <mat-slider
      [min]="yourEffectSlider.min"
      [max]="yourEffectSlider.max"
      [step]="yourEffectSlider.step"
      discrete
    >
      <input
        matSliderThumb
        [ngModel]="settings()[yourEffectSlider.key]"
        (ngModelChange)="onSliderChange(yourEffectSlider.key, $event)"
      />
    </mat-slider>
    <span class="control-value">{{ formatValue(settings()[yourEffectSlider.key], yourEffectSlider) }}</span>
  </div>
}
```

**Positioning Guidelines**:
- **Scanline effects** - Top of panel
- **Visual effects** (vignette, distortion, curvature) - Middle section
- **Color filters** (contrast, brightness, saturation, hue) - After visual effects
- **Advanced effects** (phosphor, bloom, chromatic aberration) - Bottom section

**5. Component Tests** (`libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`)

```typescript
describe('Your Effect Slider', () => {
  it('should render slider when config.showYourEffect is true', () => {
    fixture.componentRef.setInput('config', {
      ...component.config(),
      showYourEffect: true,
    });
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll('.control-label');
    const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Your Effect Name');
  });

  it('should not render slider when config.showYourEffect is false', () => {
    fixture.componentRef.setInput('config', {
      ...component.config(),
      showYourEffect: false,
    });
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll('.control-label');
    const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
    expect(labelTexts).not.toContain('Your Effect Name');
  });

  it('should emit settingsChange when slider value changes', () => {
    const settingsChangeSpy = vi.fn();
    component.settingsChange.subscribe(settingsChangeSpy);
    fixture.detectChanges();

    callOnSliderChange('yourEffectName', 0.5);

    expect(settingsChangeSpy).toHaveBeenCalledWith({
      ...DEFAULT_CRT_SETTINGS,
      yourEffectName: 0.5,
    });
  });
});
```

---

## Documentation Updates

### Files to Modify

**1. Component Library** (`docs/COMPONENT_LIBRARY_CRT.md`)

Add entry in "Visual Effects Reference" section:

```markdown
### Your Effect Name

Brief description of what the effect does and how it works.

- **Implementation**: WebGL fragment shader using [describe algorithm]
- **Properties**: `yourEffectName` controls intensity (0-1.0, where 0 = disabled)
- **Algorithm**: 
  1. Step 1 description
  2. Step 2 description
  3. Step 3 description
- **Visual Effect**: Describe how the effect appears to users
- **Performance**: Note any performance characteristics (GPU-accelerated, operation count)
```

Add property to CSS Custom Properties table:

```markdown
| `--your-effect-name` | `settings.yourEffectName` |
```

---

## Testing Checklist

Before considering the implementation complete, verify:

### Domain Layer
- [ ] Property added to `CrtSettings` interface with JSDoc
- [ ] Config flag added to `CrtSettingsConfig` (if needed)
- [ ] All presets include the new property with appropriate values
- [ ] TypeScript compilation succeeds

### Shader Layer
- [ ] Uniform declared in fragment shader
- [ ] Effect function implemented with zero-intensity optimization
- [ ] Effect applied correctly in `main()` function
- [ ] Shader compiles in browser without errors
- [ ] Shader tests pass (33+ tests expected)

### Renderer Layer
- [ ] Uniform location property added to `CrtUniforms` interface
- [ ] Uniform initialized to null
- [ ] Uniform location retrieved in `setupShaders()`
- [ ] Uniform value bound in `updateSettings()`
- [ ] Uniform reset in `destroy()`
- [ ] Renderer tests pass (55+ tests expected)

### UI Layer
- [ ] Slider configuration created with correct properties
- [ ] Slider configuration tests pass
- [ ] Component exposes slider configuration
- [ ] Template includes slider markup with conditional rendering
- [ ] Component tests pass (95+ tests expected)

### Visual Validation
- [ ] Effect visible at non-zero intensity values
- [ ] Effect disabled when intensity is zero (no performance cost)
- [ ] Slider changes update effect in real-time
- [ ] Preset selection applies correct values
- [ ] No visual artifacts or rendering errors

### Performance
- [ ] Zero-intensity optimization confirmed (effect skipped when disabled)
- [ ] Frame rate maintained at 60fps with effect enabled
- [ ] No console errors or WebGL warnings

---

## Common Patterns and Best Practices

### Performance Optimization

**Zero-Intensity Check** (CRITICAL):
```glsl
if (intensity == 0.0) return color;  // or return uv for coordinate effects
```
This single line can provide 10-100x performance improvement when effect is disabled.

**Efficient Math Operations**:
- Use `dot(v, v)` instead of `length(v) * length(v)` for squared distance
- Use built-in GLSL functions (`smoothstep`, `mix`, `clamp`) instead of manual math
- Minimize per-pixel operations (move calculations outside loops when possible)

### Naming Conventions

- **Domain**: `yourEffectName` (camelCase)
- **Shader Uniform**: `u_yourEffectName` (u_ prefix + camelCase)
- **Shader Function**: `applyYourEffect` (camelCase)
- **Slider Config**: `YOUR_EFFECT_SLIDER` (SCREAMING_SNAKE_CASE)
- **Config Flag**: `showYourEffect` (camelCase)

### Effect Types

**Coordinate Effects** (Apply before texture sampling):
- Distortion, warping, displacement
- Modify UV coordinates
- Return `vec2` from effect function

**Color Effects** (Apply after texture sampling):
- Color filters, phosphor patterns, color grading
- Modify RGB values
- Return `vec3` or `vec4` from effect function

**Multiplicative Effects** (Darken/lighten):
- Scanlines, vignette, brightness
- Multiply by factor (0-1 darkens, >1 brightens)
- Apply last in pipeline

---

## Reference Implementations

Two complete reference implementations demonstrate all the patterns described in this guide:

### 1. Barrel Distortion (Coordinate Effect)

The barrel distortion effect demonstrates a **coordinate-based effect** that modifies UV coordinates before texture sampling:

- **Domain**: `barrelDistortion` property in `CrtSettings` (0-0.5 range)
- **Shader**: `applyBarrelDistortion()` function with zero-check and efficient r² calculation using dot product
- **Renderer**: Uniform binding in `CrtRenderer` with proper null checks
- **UI**: Slider with percentage format (0-0.5 → 0%-50%)
- **Effect Type**: Coordinate transformation (returns `vec2`, applied before texture sampling)
- **Tests**: Comprehensive test coverage across all layers

**Key Implementation Details**:
- Efficient radial distortion using quadratic formula: `centered * (1.0 + intensity * r²)`
- Performance optimization: Uses `dot(centered, centered)` instead of `length()` + square
- Out-of-bounds handling: Renders black pixels for coordinates outside [0,1]

### 2. Chromatic Aberration (Color Effect)

The chromatic aberration effect demonstrates a **color-based effect** that samples texture channels separately:

- **Domain**: `chromaticAberration` property in `CrtSettings` (0-10 range)
- **Shader**: `applyChromaticAberration()` function with horizontal RGB channel separation
- **Renderer**: Uniform binding with `uniform1f()` call
- **UI**: Slider with decimal format (0-10 with 0.1 step, 1 decimal place)
- **Effect Type**: Color transformation (returns `vec3`, applied after texture sampling)
- **Algorithm**: Horizontal offset technique inspired by modern CRT shaders

**Key Implementation Details**:
```glsl
vec3 applyChromaticAberration(sampler2D videoTexture, vec2 uv, float intensity) {
  // Zero-intensity optimization - single texture sample when disabled
  if (intensity <= 0.0) {
    return texture2D(videoTexture, uv).rgb;
  }
  
  // Convert intensity (0-10 user range) to horizontal UV offset
  vec2 offset = vec2(intensity * 0.001, 0.0);
  
  // Sample RGB channels with horizontal offset
  float r = texture2D(videoTexture, uv - offset).r;  // Red shifts left
  float g = texture2D(videoTexture, uv).g;           // Green anchors center
  float b = texture2D(videoTexture, uv + offset).b;  // Blue shifts right
  
  return vec3(r, g, b);
}
```

**Performance Characteristics**:
- 3 texture samples when enabled (one per RGB channel)
- 1 texture sample when disabled (zero-intensity optimization)
- Uniform across entire screen (no distance calculations)
- Creates visible color fringing at all intensity levels above 1.0

**Visual Effect**:
- Simulates lens aberration where RGB channels separate horizontally
- Most visible on high-contrast edges, vertical lines, and text
- Authentic to classic CRT display optical characteristics
- Technique based on https://daenavan.github.io/crt-threejs/

---

Review these implementation files for complete working examples of the patterns described in this document.

---

## Troubleshooting

**Shader won't compile**:
- Check uniform name matches declaration exactly (case-sensitive)
- Verify GLSL ES 1.0 syntax (no modern features)
- Check for missing semicolons or mismatched braces

**Effect not visible**:
- Confirm uniform is bound in `updateSettings()`
- Verify preset values are non-zero
- Check effect function is called in `main()`
- Use browser DevTools → Console for WebGL errors

**Performance issues**:
- Add zero-intensity optimization
- Profile with browser DevTools → Performance → GPU
- Minimize per-pixel calculations
- Use efficient math operations (dot product, built-ins)

**Tests failing**:
- Run baseline tests before changes to identify pre-existing issues
- Check test patterns match existing tests (copy from similar effect)
- Verify mock WebGL context properly configured
- Ensure TypeScript types are correct
