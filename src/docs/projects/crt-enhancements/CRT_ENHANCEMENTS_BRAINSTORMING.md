# CRT Enhancements Brainstorming

## Overview

This document explores enhancements to our CRT emulation system (`lib-crt-effect-wrapper` and `lib-crt-settings-panel`). The goal is to add realism, configurability, and creative presets that emulate different display technologies from the CRT era.

### Current System Capabilities

| Feature | Range | Current Implementation |
|---------|-------|------------------------|
| Scanline Intensity | 0-0.5 | Opacity of horizontal dark bands |
| Scanline Thickness | 1-4px | Height of dark scanline bands |
| Scanline Spacing | 1-8px | Gap between scanline bands |
| Vignette Strength | 0-2 | Edge/corner darkening |
| Screen Curvature | 0-115px | Border radius for curved screen effect |
| Contrast | 0.8-1.5 | CSS filter multiplier |
| Brightness | 0.8-1.5 | CSS filter multiplier |
| Saturation | 0.8-1.5 | CSS filter multiplier |

---

## Priority 1: User-Requested Enhancements

### 1.1 Scanline Opacity/Darkness Control ⭐

**Problem**: Current scanlines use a fixed semi-transparent approach. Purists want pure black scanlines for authentic CRT reproduction.

**Solution**: Add `scanlineOpacity` parameter (0-1) controlling how opaque the dark bands are.

```typescript
interface CrtSettings {
  // ... existing
  scanlineOpacity: number; // 0 = transparent, 1 = pure black
}
```

**CSS Implementation**:
```scss
// Current: rgba(0, 0, 0, var(--scanline-intensity))
// Enhanced: Use both intensity (how visible) and opacity (how dark)
background-image: repeating-linear-gradient(
  0deg,
  rgba(0, 0, 0, calc(var(--scanline-opacity, 0.7) * var(--scanline-intensity, 0.5))) 0px,
  // ...
);
```

**Presets**:
- `scanlineOpacity: 0.6` - Soft/ghostly lines (default, matches current behavior)
- `scanlineOpacity: 1.0` - Pure black lines (purist mode)
- `scanlineOpacity: 0.3` - Very faint lines (subtle enhancement)

---

### 1.2 Color Hue/Tint Adjustment ⭐

**Problem**: Different C64 video adapters (S-Video, RF, composite) produce slightly different color outputs. Users want to match their specific hardware.

**Solution**: Add `hueRotate` and `colorTemperature` parameters.

```typescript
interface CrtSettings {
  // ... existing
  hueRotate: number;        // -180 to 180 degrees
  colorTemperature: number; // -1 (cool/blue) to 1 (warm/yellow-orange)
}
```

**CSS Implementation**:
```scss
.crt-content {
  filter: 
    contrast(var(--crt-contrast, 1))
    brightness(var(--crt-brightness, 1))
    saturate(var(--crt-saturation, 1))
    hue-rotate(calc(var(--crt-hue-rotate, 0) * 1deg))
    sepia(calc(max(0, var(--crt-color-temp, 0)) * 0.3))  // Warm shift
    saturate(calc(1 + max(0, var(--crt-color-temp, 0)) * 0.2)); // Compensate sepia
}
```

**Preset Examples**:
- NTSC C64 Composite: `hueRotate: -5, colorTemperature: 0.2`
- PAL C64 S-Video: `hueRotate: 3, colorTemperature: -0.1`
- Arcade Monitor (warm): `hueRotate: 0, colorTemperature: 0.4`

---

### 1.3 Vertical Scanlines & Grid Patterns ⭐

**Problem**: Current implementation only supports horizontal scanlines. Many CRT types had visible vertical structures:

- **Aperture Grille monitors** (Sony Trinitron, NEC MultiSync) had prominent vertical phosphor stripes
- **Shadow mask CRTs** created a dot/grid pattern from RGB phosphor triads
- **Arcade monitors** (Wells Gardner, Electrohome) often showed both horizontal and vertical line structures
- **Vector displays** (Vectrex, arcade vector games) had no scanlines but had phosphor grid patterns

**Solution**: Add vertical scanline parameters that mirror the horizontal ones, plus a grid blend mode.

```typescript
interface CrtSettings {
  // ... existing horizontal scanlines
  
  // Vertical scanlines (new)
  verticalScanlineIntensity: number; // 0-0.5 - visibility of vertical lines
  verticalScanlineOpacity: number;   // 0-1 - darkness of vertical lines
  verticalScanlineThickness: number; // 1-4px - width of dark bands
  verticalScanlineSpacing: number;   // 1-8px - gap between bands
  
  // Grid mode (combines horizontal + vertical)
  gridMode: 'none' | 'horizontal' | 'vertical' | 'grid' | 'dot-matrix';
  gridBlendMode: 'multiply' | 'overlay' | 'darken'; // How H+V combine
}
```

**CSS Implementation**:
```scss
// Vertical scanlines overlay (separate from horizontal)
.crt-wrapper.crt-enabled::before {
  background-image: 
    // Horizontal scanlines (existing)
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, calc(var(--scanline-opacity) * var(--scanline-intensity))) 0px,
      rgba(0, 0, 0, calc(var(--scanline-opacity) * var(--scanline-intensity))) var(--scanline-thickness),
      transparent var(--scanline-thickness),
      transparent calc(var(--scanline-thickness) + var(--scanline-spacing))
    ),
    // Vertical scanlines (new)
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, calc(var(--v-scanline-opacity) * var(--v-scanline-intensity))) 0px,
      rgba(0, 0, 0, calc(var(--v-scanline-opacity) * var(--v-scanline-intensity))) var(--v-scanline-thickness),
      transparent var(--v-scanline-thickness),
      transparent calc(var(--v-scanline-thickness) + var(--v-scanline-spacing))
    );
}

// Dot matrix mode - creates circular apertures
.crt-wrapper.dot-matrix::before {
  background-image: radial-gradient(
    circle at center,
    transparent 40%,
    rgba(0, 0, 0, var(--grid-intensity)) 40%
  );
  background-size: 
    calc(var(--scanline-thickness) + var(--scanline-spacing)) 
    calc(var(--v-scanline-thickness) + var(--v-scanline-spacing));
}
```

**Grid Mode Options**:

| Mode | Description | Use Case |
|------|-------------|----------|
| `none` | No grid overlay | Clean, minimal look |
| `horizontal` | Traditional horizontal scanlines only | Classic CRT TV |
| `vertical` | Vertical lines only | Aperture grille emphasis |
| `grid` | Both H+V creating rectangular grid | Shadow mask simulation |
| `dot-matrix` | Circular apertures in grid | LED/early LCD simulation |

**Preset Examples**:
```typescript
// Trinitron with prominent vertical stripes
'trinitron-vertical': {
  scanlineIntensity: 0.25,
  verticalScanlineIntensity: 0.4,
  verticalScanlineOpacity: 0.8,
  verticalScanlineThickness: 1,
  verticalScanlineSpacing: 2,
  gridMode: 'vertical',
}

// Arcade monitor with visible grid
'arcade-grid': {
  scanlineIntensity: 0.4,
  scanlineOpacity: 0.85,
  verticalScanlineIntensity: 0.25,
  verticalScanlineOpacity: 0.7,
  gridMode: 'grid',
  gridBlendMode: 'multiply',
}
```

---

## Priority 2: Enhanced Realism

### 2.1 Phosphor Persistence / Ghosting

**Concept**: Real CRTs had phosphor decay - bright pixels would briefly "ghost" as they faded. This created subtle motion blur effects.

**Implementation Options**:

**A) CSS Filter Approach** (simpler, less authentic):
```scss
.crt-content {
  // Add slight blur that simulates phosphor glow
  filter: ... blur(calc(var(--phosphor-blur, 0) * 0.5px));
}
```

**B) Animation-based Ghosting** (more complex):
```typescript
interface CrtSettings {
  phosphorPersistence: number; // 0-1, how long phosphor "holds"
}
```

This would require a custom WebGL shader or canvas overlay for true persistence - potentially a future advanced feature.

**Recommended**: Start with subtle blur for phosphor "glow" effect.

---

### 2.2 Bloom/Glow Effect

**Concept**: Bright areas on CRTs would "bloom" - creating a soft glow around high-contrast edges. Very common on consumer TVs.

```typescript
interface CrtSettings {
  bloomIntensity: number; // 0-1
  bloomRadius: number;    // 1-10px
}
```

**Implementation**: Dual-layer approach:
1. Original content layer
2. Blurred, brightened copy blended on top (screen blend mode)

```scss
// Bloom overlay pseudo-element
&::before.bloom-layer {
  content: '';
  position: absolute;
  inset: 0;
  background: inherit; // Copy content
  filter: blur(var(--bloom-radius, 0px)) brightness(var(--bloom-intensity, 1));
  mix-blend-mode: screen;
  opacity: var(--bloom-intensity, 0);
}
```

---

### 2.3 RGB Subpixel Separation (Chromatic Aberration)

**Concept**: CRTs used RGB phosphor triads/stripes. Slight misalignment created color fringing, especially at screen edges.

```typescript
interface CrtSettings {
  chromaticAberration: number; // 0-3px offset
}
```

**CSS Implementation** (using multiple shadows):
```scss
.crt-content {
  // Offset RGB channels slightly
  text-shadow: 
    calc(var(--chromatic-offset, 0) * -1px) 0 0 rgba(255, 0, 0, 0.5),
    calc(var(--chromatic-offset, 0) * 1px) 0 0 rgba(0, 0, 255, 0.5);
  
  // Or use filter for entire content
  filter: ... drop-shadow(calc(var(--chromatic-offset) * -1px) 0 0 rgba(255, 0, 0, 0.3))
              drop-shadow(calc(var(--chromatic-offset) * 1px) 0 0 rgba(0, 0, 255, 0.3));
}
```

---

### 2.4 Interlace/Flicker Simulation

**Concept**: Interlaced displays alternated drawing odd/even lines each frame, creating subtle flicker.

```typescript
interface CrtSettings {
  interlaceMode: 'none' | 'subtle' | 'authentic';
  flickerIntensity: number; // 0-0.1 (brightness variation)
}
```

**Implementation**: CSS animation alternating scanline opacity
```scss
@keyframes interlace-flicker {
  0%, 100% { 
    --scanline-offset: 0px;
    opacity: 1;
  }
  50% { 
    --scanline-offset: var(--scanline-spacing);
    opacity: calc(1 - var(--flicker-intensity, 0));
  }
}

.crt-enabled.interlace-mode::before {
  animation: interlace-flicker 33ms infinite; // ~30Hz flicker
}
```

**Warning**: High flicker can cause discomfort - should include accessibility warning.

---

### 2.5 Barrel Distortion (Geometric Warping)

**Concept**: Real curved CRT screens had slight barrel distortion - the image was geometrically warped to fit the curved glass.

**Implementation**: SVG filter or CSS perspective transforms
```scss
.crt-wrapper.barrel-distortion {
  // Approximate barrel distortion with perspective
  perspective: var(--barrel-depth, 1000px);
  
  .crt-content {
    transform: perspective(var(--barrel-depth)) 
               rotateX(calc(var(--barrel-amount, 0) * 0.5deg))
               scale(calc(1 + var(--barrel-amount, 0) * 0.02));
  }
}
```

**Note**: True barrel distortion requires WebGL/SVG displacement mapping.

---

## Priority 3: Aesthetic Variations

### 3.1 Shadow Mask vs Aperture Grille Patterns

**Concept**: Different CRT technologies had different phosphor arrangements:

- **Shadow Mask**: Dot triads (most consumer TVs)
- **Aperture Grille**: Vertical stripes (Sony Trinitron, professional monitors)
- **Slot Mask**: Hybrid rectangular slots

```typescript
interface CrtSettings {
  phosphorPattern: 'none' | 'shadow-mask' | 'aperture-grille' | 'slot-mask';
  phosphorScale: number; // 1-3 (size multiplier for visibility)
}
```

**CSS Implementation** (simplified shadow mask):
```scss
.phosphor-overlay {
  background-image: 
    // RGB dot pattern (simplified)
    radial-gradient(circle at 33% 50%, rgba(255,0,0,0.15) 30%, transparent 30%),
    radial-gradient(circle at 50% 50%, rgba(0,255,0,0.15) 30%, transparent 30%),
    radial-gradient(circle at 67% 50%, rgba(0,0,255,0.15) 30%, transparent 30%);
  background-size: calc(3px * var(--phosphor-scale)) calc(2px * var(--phosphor-scale));
}
```

---

### 3.2 Static Noise / RF Interference

**Concept**: RF connections and older CRTs had visible static/snow noise.

```typescript
interface CrtSettings {
  noiseIntensity: number; // 0-0.3 (how visible)
  noiseAnimated: boolean; // Static vs animated noise
}
```

**Implementation**: Animated SVG noise filter or canvas-based noise overlay
```scss
.noise-overlay {
  background: url('data:image/svg+xml,...'); // Noise pattern
  opacity: var(--noise-intensity, 0);
  animation: noise-shift 100ms infinite steps(5);
}
```

---

### 3.3 Screen Reflection / Glare

**Concept**: Glass CRT screens had reflections. Adding subtle "room reflection" overlay increases realism.

```typescript
interface CrtSettings {
  reflectionIntensity: number; // 0-0.3
  reflectionAngle: number;     // 0-360 degrees
}
```

**Implementation**: Gradient overlay simulating ambient light reflection
```scss
.reflection-overlay {
  background: linear-gradient(
    calc(var(--reflection-angle, 135) * 1deg),
    transparent 40%,
    rgba(255, 255, 255, var(--reflection-intensity, 0)) 50%,
    transparent 60%
  );
  mix-blend-mode: overlay;
}
```

---

## Priority 4: Creative Presets

### Device/Era-Specific Presets

Based on the parameters above, we can create presets that emulate specific displays:

```typescript
export const CRT_EXTENDED_PRESETS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONSUMER ELECTRONICS
  // ═══════════════════════════════════════════════════════════════════════════

  'commodore-1702': {
    // Classic Commodore monitor - warm, curved, shadow mask
    scanlineIntensity: 0.45,
    scanlineOpacity: 0.8,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.15,
    verticalScanlineOpacity: 0.5,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'grid',
    gridBlendMode: 'multiply',
    vignetteStrength: 1.4,
    screenCurvature: 100,
    contrast: 1.15,
    brightness: 1.3,
    saturation: 1.2,
    hueRotate: -3,
    colorTemperature: 0.15,
    bloomIntensity: 0.15,
    phosphorPattern: 'shadow-mask',
  },

  'sony-trinitron': {
    // Sony Trinitron - sharp, flat, aperture grille with vertical stripes
    scanlineIntensity: 0.35,
    scanlineOpacity: 1.0,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.3,
    verticalScanlineOpacity: 0.6,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'vertical',  // Trinitron is known for vertical stripe pattern
    gridBlendMode: 'multiply',
    vignetteStrength: 0.8,
    screenCurvature: 60,
    contrast: 1.25,
    brightness: 1.4,
    saturation: 1.35,
    hueRotate: 0,
    colorTemperature: -0.1,
    phosphorPattern: 'aperture-grille',
  },

  'jvc-d-series': {
    // JVC D-Series - popular for retro gaming, warm colors
    scanlineIntensity: 0.4,
    scanlineOpacity: 0.85,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.1,
    verticalScanlineOpacity: 0.4,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 3,
    gridMode: 'horizontal',
    vignetteStrength: 1.2,
    screenCurvature: 85,
    contrast: 1.2,
    brightness: 1.35,
    saturation: 1.25,
    hueRotate: 2,
    colorTemperature: 0.2,
    bloomIntensity: 0.1,
    phosphorPattern: 'slot-mask',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCADE MONITORS
  // ═══════════════════════════════════════════════════════════════════════════

  'arcade-cabinet': {
    // Generic arcade CRT - bright, saturated, heavy scanlines
    scanlineIntensity: 0.5,
    scanlineOpacity: 0.9,
    scanlineThickness: 3,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.2,
    verticalScanlineOpacity: 0.6,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'grid',
    gridBlendMode: 'multiply',
    vignetteStrength: 1.8,
    screenCurvature: 115,
    contrast: 1.3,
    brightness: 1.6,
    saturation: 1.4,
    hueRotate: 5,
    colorTemperature: 0.3,
    bloomIntensity: 0.25,
  },

  'wells-gardner': {
    // Wells Gardner K7000 - common arcade monitor
    scanlineIntensity: 0.45,
    scanlineOpacity: 0.95,
    scanlineThickness: 2,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.25,
    verticalScanlineOpacity: 0.7,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'grid',
    gridBlendMode: 'multiply',
    vignetteStrength: 1.5,
    screenCurvature: 100,
    contrast: 1.25,
    brightness: 1.5,
    saturation: 1.3,
    hueRotate: 0,
    colorTemperature: 0.15,
    bloomIntensity: 0.2,
    phosphorPattern: 'shadow-mask',
  },

  'electrohome-g07': {
    // Electrohome G07 - vector/raster arcade monitor
    scanlineIntensity: 0.4,
    scanlineOpacity: 0.9,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.3,
    verticalScanlineOpacity: 0.75,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'grid',
    gridBlendMode: 'darken',
    vignetteStrength: 1.6,
    screenCurvature: 95,
    contrast: 1.35,
    brightness: 1.55,
    saturation: 1.35,
    hueRotate: 3,
    colorTemperature: 0.25,
    bloomIntensity: 0.3,
    phosphorPersistence: 0.15,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL MONITORS
  // ═══════════════════════════════════════════════════════════════════════════

  'pvm-professional': {
    // Sony PVM - broadcast quality, minimal effects
    scanlineIntensity: 0.3,
    scanlineOpacity: 1.0,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.2,
    verticalScanlineOpacity: 0.5,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'vertical',
    gridBlendMode: 'multiply',
    vignetteStrength: 0.5,
    screenCurvature: 40,
    contrast: 1.1,
    brightness: 1.2,
    saturation: 1.1,
    hueRotate: 0,
    colorTemperature: 0,
    phosphorPattern: 'aperture-grille',
  },

  'bvm-broadcast': {
    // Sony BVM - reference monitor, very accurate
    scanlineIntensity: 0.25,
    scanlineOpacity: 1.0,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.15,
    verticalScanlineOpacity: 0.4,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'vertical',
    gridBlendMode: 'multiply',
    vignetteStrength: 0.3,
    screenCurvature: 25,
    contrast: 1.05,
    brightness: 1.1,
    saturation: 1.05,
    hueRotate: 0,
    colorTemperature: 0,
    phosphorPattern: 'aperture-grille',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTER MONITORS
  // ═══════════════════════════════════════════════════════════════════════════

  'amber-monochrome': {
    // Amber phosphor monitor (IBM PC era)
    scanlineIntensity: 0.4,
    scanlineOpacity: 0.9,
    scanlineThickness: 2,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.15,
    verticalScanlineOpacity: 0.5,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'horizontal',
    vignetteStrength: 1.5,
    screenCurvature: 80,
    contrast: 1.3,
    brightness: 1.4,
    saturation: 0.0,
    hueRotate: 30,
    colorTemperature: 0.8,
    phosphorPersistence: 0.3,
    bloomIntensity: 0.15,
  },

  'green-phosphor': {
    // Classic green terminal (VT100 style)
    scanlineIntensity: 0.35,
    scanlineOpacity: 0.85,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.1,
    verticalScanlineOpacity: 0.4,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'horizontal',
    vignetteStrength: 1.3,
    screenCurvature: 70,
    contrast: 1.4,
    brightness: 1.5,
    saturation: 0.0,
    hueRotate: 80,
    colorTemperature: -0.5,
    phosphorPersistence: 0.4,
    bloomIntensity: 0.2,
  },

  'white-phosphor': {
    // White phosphor terminal (paper white)
    scanlineIntensity: 0.3,
    scanlineOpacity: 0.75,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.1,
    verticalScanlineOpacity: 0.35,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'horizontal',
    vignetteStrength: 1.2,
    screenCurvature: 65,
    contrast: 1.2,
    brightness: 1.3,
    saturation: 0.0,
    hueRotate: 0,
    colorTemperature: -0.2,
    phosphorPersistence: 0.2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION QUALITY SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════

  'rf-fuzzy': {
    // Bad RF connection aesthetic
    scanlineIntensity: 0.3,
    scanlineOpacity: 0.5,
    scanlineThickness: 2,
    scanlineSpacing: 3,
    verticalScanlineIntensity: 0.05,
    verticalScanlineOpacity: 0.3,
    verticalScanlineThickness: 2,
    verticalScanlineSpacing: 4,
    gridMode: 'none',
    vignetteStrength: 1.2,
    screenCurvature: 90,
    contrast: 0.95,
    brightness: 1.1,
    saturation: 0.9,
    chromaticAberration: 1.5,
    noiseIntensity: 0.08,
    noiseAnimated: true,
  },

  'composite-bleed': {
    // Composite video with color bleeding
    scanlineIntensity: 0.35,
    scanlineOpacity: 0.6,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0,
    gridMode: 'horizontal',
    vignetteStrength: 1.3,
    screenCurvature: 85,
    contrast: 1.0,
    brightness: 1.2,
    saturation: 1.1,
    chromaticAberration: 0.8,
    bloomIntensity: 0.12,
    hueRotate: -2,
    colorTemperature: 0.1,
  },

  's-video-clean': {
    // Clean S-Video connection
    scanlineIntensity: 0.4,
    scanlineOpacity: 0.75,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.1,
    verticalScanlineOpacity: 0.4,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'horizontal',
    vignetteStrength: 1.1,
    screenCurvature: 80,
    contrast: 1.1,
    brightness: 1.25,
    saturation: 1.15,
    hueRotate: 0,
    colorTemperature: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERN SCALERS / LCD FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  'lcd-scanlines': {
    // Modern LCD with scanline filter (RetroTink style)
    scanlineIntensity: 0.25,
    scanlineOpacity: 0.6,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0,
    gridMode: 'horizontal',
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.0,
    saturation: 1.0,
    hueRotate: 0,
    colorTemperature: 0,
  },

  'lcd-grid': {
    // LCD with visible pixel grid (GBA style)
    scanlineIntensity: 0.2,
    scanlineOpacity: 0.5,
    scanlineThickness: 1,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.2,
    verticalScanlineOpacity: 0.5,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 2,
    gridMode: 'grid',
    gridBlendMode: 'multiply',
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.05,
    saturation: 1.0,
  },

  'dot-matrix-lcd': {
    // Dot matrix display (Game Boy style)
    scanlineIntensity: 0.3,
    scanlineOpacity: 0.6,
    scanlineThickness: 1,
    scanlineSpacing: 1,
    verticalScanlineIntensity: 0.3,
    verticalScanlineOpacity: 0.6,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 1,
    gridMode: 'dot-matrix',
    gridBlendMode: 'multiply',
    vignetteStrength: 0.3,
    screenCurvature: 0,
    contrast: 1.15,
    brightness: 1.1,
    saturation: 0.0,  // Original Game Boy was monochrome
    hueRotate: 70,    // Green tint
    colorTemperature: -0.3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTISTIC / STYLIZED
  // ═══════════════════════════════════════════════════════════════════════════

  'vaporwave': {
    // Aesthetic/artistic mode
    scanlineIntensity: 0.2,
    scanlineOpacity: 0.4,
    scanlineThickness: 2,
    scanlineSpacing: 4,
    verticalScanlineIntensity: 0.15,
    verticalScanlineOpacity: 0.35,
    verticalScanlineThickness: 2,
    verticalScanlineSpacing: 4,
    gridMode: 'grid',
    gridBlendMode: 'overlay',
    vignetteStrength: 2.0,
    screenCurvature: 115,
    contrast: 1.3,
    brightness: 1.2,
    saturation: 1.8,
    hueRotate: -20,
    chromaticAberration: 2,
    bloomIntensity: 0.35,
  },

  'cyberpunk': {
    // Neon-heavy cyberpunk aesthetic
    scanlineIntensity: 0.35,
    scanlineOpacity: 0.7,
    scanlineThickness: 1,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.25,
    verticalScanlineOpacity: 0.6,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 3,
    gridMode: 'grid',
    gridBlendMode: 'overlay',
    vignetteStrength: 1.8,
    screenCurvature: 80,
    contrast: 1.4,
    brightness: 1.3,
    saturation: 1.6,
    hueRotate: 180,  // Shift colors dramatically
    chromaticAberration: 1.5,
    bloomIntensity: 0.4,
    colorTemperature: -0.4,
  },

  'horror-vhs': {
    // Distorted VHS horror aesthetic
    scanlineIntensity: 0.25,
    scanlineOpacity: 0.5,
    scanlineThickness: 3,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.1,
    verticalScanlineOpacity: 0.3,
    verticalScanlineThickness: 2,
    verticalScanlineSpacing: 5,
    gridMode: 'horizontal',
    vignetteStrength: 2.2,
    screenCurvature: 100,
    contrast: 1.5,
    brightness: 0.9,
    saturation: 0.7,
    chromaticAberration: 2.5,
    noiseIntensity: 0.15,
    noiseAnimated: true,
    flickerIntensity: 0.05,
    interlaceMode: 'authentic',
  },

  'synthwave': {
    // 80s synthwave aesthetic
    scanlineIntensity: 0.3,
    scanlineOpacity: 0.6,
    scanlineThickness: 2,
    scanlineSpacing: 2,
    verticalScanlineIntensity: 0.2,
    verticalScanlineOpacity: 0.5,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 3,
    gridMode: 'grid',
    gridBlendMode: 'overlay',
    vignetteStrength: 1.6,
    screenCurvature: 90,
    contrast: 1.25,
    brightness: 1.15,
    saturation: 1.5,
    hueRotate: -30,
    colorTemperature: 0.3,
    bloomIntensity: 0.3,
    chromaticAberration: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR / SPECIALTY DISPLAYS
  // ═══════════════════════════════════════════════════════════════════════════

  'vectrex': {
    // Vectrex vector display
    scanlineIntensity: 0,  // Vector displays have no scanlines
    verticalScanlineIntensity: 0,
    gridMode: 'none',
    vignetteStrength: 1.4,
    screenCurvature: 70,
    contrast: 1.5,
    brightness: 1.6,
    saturation: 0.0,  // Monochrome
    hueRotate: 0,
    colorTemperature: -0.3,  // Cool white
    phosphorPersistence: 0.5,  // Vector displays had long persistence
    bloomIntensity: 0.4,
  },

  'oscilloscope': {
    // Oscilloscope-style display
    scanlineIntensity: 0,
    verticalScanlineIntensity: 0,
    gridMode: 'none',
    vignetteStrength: 1.2,
    screenCurvature: 60,
    contrast: 1.6,
    brightness: 1.7,
    saturation: 0.0,
    hueRotate: 80,  // Green phosphor
    colorTemperature: -0.4,
    phosphorPersistence: 0.6,
    bloomIntensity: 0.5,
  },

  'led-matrix': {
    // LED matrix display (stadium scoreboard style)
    scanlineIntensity: 0.15,
    scanlineOpacity: 0.8,
    scanlineThickness: 1,
    scanlineSpacing: 3,
    verticalScanlineIntensity: 0.15,
    verticalScanlineOpacity: 0.8,
    verticalScanlineThickness: 1,
    verticalScanlineSpacing: 3,
    gridMode: 'dot-matrix',
    gridBlendMode: 'darken',
    vignetteStrength: 0.5,
    screenCurvature: 0,
    contrast: 1.3,
    brightness: 1.4,
    saturation: 1.3,
    bloomIntensity: 0.25,
  },
};
```

---

## Implementation Phases

### Phase 1: Core Additions (Priority 1 - User Requested)
1. Add `scanlineOpacity` parameter (pure black lines for purists)
2. Add `hueRotate` parameter (color shift for hardware matching)
3. Add `colorTemperature` parameter (warm/cool adjustment)
4. Add vertical scanline parameters:
   - `verticalScanlineIntensity`
   - `verticalScanlineOpacity`
   - `verticalScanlineThickness`
   - `verticalScanlineSpacing`
5. Add `gridMode` selector ('none', 'horizontal', 'vertical', 'grid', 'dot-matrix')
6. Add `gridBlendMode` selector ('multiply', 'overlay', 'darken')
7. Update `CrtSettingsConfig` for new control groups
8. Update settings panel with new sliders
9. Update presets with new parameters

### Phase 2: Visual Enhancements (Priority 2)
1. Add `bloomIntensity` and `bloomRadius`
2. Add `chromaticAberration` for RGB fringing
3. Add `phosphorPattern` selector (simplified patterns)
4. Add `phosphorPersistence` for ghosting effect
5. Add `barrelDistortion` for geometric warping

### Phase 3: Advanced Effects (Priority 3)
1. Static noise overlay (optional)
2. Screen reflection (optional)
3. Interlace flicker (with accessibility warning)

### Phase 4: Presets & Polish
1. Create device-specific presets (30+ presets organized by category)
2. Add preset categories:
   - Consumer Electronics
   - Arcade Monitors
   - Professional Monitors
   - Computer Monitors
   - Connection Quality Simulation
   - Modern Scalers / LCD Filters
   - Artistic / Stylized
   - Vector / Specialty Displays
3. Preset comparison UI / gallery mode
4. Preset import/export functionality

---

## Settings Panel UI Considerations

### New Control Groups

```typescript
interface CrtSettingsConfig {
  // Existing
  showScanlines: boolean;
  showVignette: boolean;
  showCurvature: boolean;
  showColorFilters: boolean;
  
  // New groups
  showAdvancedScanlines: boolean;   // Opacity control for horizontal
  showVerticalScanlines: boolean;   // Vertical scanline controls
  showGridMode: boolean;            // Grid mode selector
  showColorTint: boolean;           // Hue/temperature
  showBloom: boolean;               // Bloom intensity/radius
  showChromaticAberration: boolean; // RGB fringing
  showPhosphor: boolean;            // Phosphor pattern, persistence
  showNoise: boolean;               // Static/RF noise
  showReflection: boolean;          // Screen glare/reflection
  showInterlace: boolean;           // Interlace mode, flicker
  showBarrelDistortion: boolean;    // Geometric warping
}
```

### Complete Extended CrtSettings Interface

```typescript
interface CrtSettings {
  // === Existing Parameters ===
  scanlineIntensity: number;    // 0-0.5 - visibility of scanlines
  scanlineThickness: number;    // 1-4px - height of dark bands
  scanlineSpacing: number;      // 1-8px - gap between bands
  vignetteStrength: number;     // 0-2 - edge darkening
  screenCurvature: number;      // 0-115px - border radius
  contrast: number;             // 0.8-1.5 - CSS filter
  brightness: number;           // 0.8-1.5 - CSS filter
  saturation: number;           // 0.8-1.5 - CSS filter

  // === Priority 1: User-Requested ===
  scanlineOpacity: number;      // 0-1 - how dark the lines are (0.6=soft, 1=pure black)
  hueRotate: number;            // -180 to 180 degrees - color shift
  colorTemperature: number;     // -1 (cool/blue) to 1 (warm/orange)

  // === Priority 1: Vertical Scanlines & Grid ===
  verticalScanlineIntensity: number; // 0-0.5 - visibility of vertical lines
  verticalScanlineOpacity: number;   // 0-1 - darkness of vertical lines  
  verticalScanlineThickness: number; // 1-4px - width of vertical dark bands
  verticalScanlineSpacing: number;   // 1-8px - gap between vertical bands
  gridMode: 'none' | 'horizontal' | 'vertical' | 'grid' | 'dot-matrix';
  gridBlendMode: 'multiply' | 'overlay' | 'darken';

  // === Priority 2: Enhanced Realism ===
  bloomIntensity: number;       // 0-1 - glow around bright areas
  bloomRadius: number;          // 1-10px - size of bloom effect
  chromaticAberration: number;  // 0-3px - RGB channel offset
  phosphorPersistence: number;  // 0-1 - motion blur/ghosting
  
  // === Priority 2: Interlace ===
  interlaceMode: 'none' | 'subtle' | 'authentic';
  flickerIntensity: number;     // 0-0.1 - brightness variation

  // === Priority 2: Barrel Distortion ===
  barrelDistortion: number;     // 0-1 - geometric warping amount

  // === Priority 3: Aesthetic Variations ===
  phosphorPattern: 'none' | 'shadow-mask' | 'aperture-grille' | 'slot-mask';
  phosphorScale: number;        // 1-3 - size multiplier for visibility
  
  noiseIntensity: number;       // 0-0.3 - static/snow visibility
  noiseAnimated: boolean;       // static vs animated noise
  
  reflectionIntensity: number;  // 0-0.3 - glass glare strength
  reflectionAngle: number;      // 0-360 degrees - light source direction
}
```

### Collapsible Sections
Consider making sections collapsible to prevent panel overflow:
- **Scanlines**: Horizontal intensity/opacity/thickness/spacing
- **Vertical Lines**: Vertical intensity/opacity/thickness/spacing, Grid mode
- **Screen**: Vignette, Curvature, Barrel distortion
- **Color**: Brightness, Contrast, Saturation, Hue, Temperature  
- **Effects**: Bloom, Chromatic Aberration, Phosphor persistence
- **Advanced**: Phosphor pattern, Noise, Reflection, Interlace/flicker

---

## Technical Considerations

### Performance
- All proposed effects use CSS/SVG (GPU-accelerated)
- Avoid JavaScript-based per-frame effects for battery/CPU
- Noise animation should use CSS steps() for efficiency

### Accessibility
- Flicker effects should have a "reduced motion" check
- High chromatic aberration may affect readability
- Consider `prefers-reduced-motion` media query

### Browser Support
- CSS `filter` is widely supported
- SVG filters have good support
- `mix-blend-mode` has minor gaps in older browsers

---

## References

- [Lottes CRT Shader](https://www.shadertoy.com/view/XsjSzR) - Classic GLSL implementation
- [CRT Royale](https://github.com/libretro/glsl-shaders/tree/master/crt/shaders/crt-royale) - Comprehensive CRT shader
- [RetroArch CRT Shaders](https://docs.libretro.com/shader/crt/) - Various CRT effect approaches
- [Shadow Mask vs Aperture Grille](https://www.rtings.com/tv/learn/what-is-a-shadow-mask) - Technical explanation
