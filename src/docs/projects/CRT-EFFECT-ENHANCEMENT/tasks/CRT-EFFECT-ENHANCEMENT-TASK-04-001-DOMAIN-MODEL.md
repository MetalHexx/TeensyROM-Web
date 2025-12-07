# Task 04-001: Domain Model & Interface Extensions

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-001 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Small (2-3 files) |
| **Priority** | High (blocks all other Phase 4 tasks) |
| **Dependencies** | None (first task in Phase 4) |

---

## 🎯 Objective

Extend the `CrtSettings` domain model with properties for all advanced WebGL effects: phosphor pattern, bloom, barrel distortion, and chromatic aberration. Also extend `CrtSettingsConfig` to support showing/hiding new control groups.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current CrtSettings model](../../../../libs/domain/src/lib/models/crt-settings.model.ts)
- [ ] [Current CrtSettings defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)

---

## 📂 Files to Modify

```
libs/domain/src/lib/models/
└── crt-settings.model.ts                 📝 Add new properties + PhosphorPatternType

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.interface.ts             📝 Add new CrtSettingsConfig flags
└── crt-settings.defaults.ts              📝 Update defaults and presets
```

---

## 📋 Implementation Steps

### Step 1: Update Domain Model

**File**: `libs/domain/src/lib/models/crt-settings.model.ts`

Add the following after the existing `CrtRenderMode` type:

```typescript
/**
 * Phosphor pattern types for CRT subpixel simulation.
 * - 'none': No phosphor pattern
 * - 'aperture-grille': Vertical RGB stripes (Sony Trinitron style)
 * - 'shadow-mask': Traditional staggered RGB dots
 * - 'dot-triad': Triangular RGB arrangement (arcade monitors)
 */
export type PhosphorPatternType = 'none' | 'aperture-grille' | 'shadow-mask' | 'dot-triad';
```

Add the following properties to `CrtSettings` interface:

```typescript
export interface CrtSettings {
  // === Existing Properties (keep all) ===
  scanlineIntensity: number;
  scanlineSize: number;
  vignetteStrength: number;
  screenCurvature: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  renderMode: CrtRenderMode;
  
  // === NEW: Phosphor Pattern ===
  
  /**
   * Type of phosphor pattern to simulate.
   * Only visible in WebGL mode.
   * @default 'none'
   */
  phosphorPattern: PhosphorPatternType;
  
  /**
   * Intensity of the phosphor pattern effect (0-1).
   * 0 = invisible, 1 = fully visible pattern.
   * @default 0
   */
  phosphorIntensity: number;
  
  // === NEW: Bloom/Glow ===
  
  /**
   * Whether bloom effect is enabled.
   * Only visible in WebGL mode.
   * @default false
   */
  bloomEnabled: boolean;
  
  /**
   * Intensity of bloom glow (0-2).
   * Higher values = more pronounced glow around bright areas.
   * @default 0.3
   */
  bloomIntensity: number;
  
  /**
   * Radius of bloom spread in pixels (1-10).
   * Higher values = softer, wider glow.
   * @default 3
   */
  bloomRadius: number;
  
  // === NEW: Barrel Distortion ===
  
  /**
   * Amount of barrel distortion (0-0.5).
   * 0 = flat screen, higher = more curved/bulging.
   * Different from screenCurvature (border-radius) - this warps the image.
   * Only visible in WebGL mode.
   * @default 0
   */
  barrelDistortion: number;
  
  // === NEW: Chromatic Aberration ===
  
  /**
   * Amount of RGB channel separation at edges (0-5).
   * Simulates lens aberration in CRT monitors.
   * 0 = no separation, higher = more visible RGB fringing.
   * Only visible in WebGL mode.
   * @default 0
   */
  chromaticAberration: number;
}
```

### Step 2: Update Settings Interface

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

Add re-export for new type:

```typescript
export type { CrtSettings, CrtRenderMode, PhosphorPatternType } from '@teensyrom-nx/domain';
```

Add new config flags to `CrtSettingsConfig`:

```typescript
export interface CrtSettingsConfig {
  // === Existing ===
  showScanlines: boolean;
  showVignette: boolean;
  showCurvature: boolean;
  showColorFilters: boolean;
  
  // === NEW: Advanced Effects ===
  
  /**
   * Show phosphor pattern controls (pattern type, intensity).
   * When false, phosphor controls hidden and effect disabled.
   */
  showPhosphor: boolean;
  
  /**
   * Show bloom/glow controls (enabled toggle, intensity, radius).
   * When false, bloom controls hidden and effect disabled.
   */
  showBloom: boolean;
  
  /**
   * Show barrel distortion control.
   * When false, distortion control hidden and effect disabled.
   */
  showDistortion: boolean;
  
  /**
   * Show chromatic aberration control.
   * When false, CA control hidden and effect disabled.
   */
  showChromaticAberration: boolean;
}
```

### Step 3: Update Defaults and Presets

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

Update `DEFAULT_CRT_CONFIG`:

```typescript
export const DEFAULT_CRT_CONFIG: CrtSettingsConfig = {
  showScanlines: true,
  showVignette: true,
  showCurvature: true,
  showColorFilters: true,
  // New flags - default to false for backward compatibility
  showPhosphor: false,
  showBloom: false,
  showDistortion: false,
  showChromaticAberration: false,
};
```

Add new config for full advanced mode:

```typescript
export const CRT_CONFIGS = {
  // ... existing configs ...
  
  /**
   * Advanced CRT - all controls including advanced WebGL effects.
   * Only useful when renderMode is 'webgl'.
   */
  advanced: {
    showScanlines: true,
    showVignette: true,
    showCurvature: true,
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
} as const satisfies Record<string, CrtSettingsConfig>;
```

Update all existing presets with new properties (set to disabled defaults):

```typescript
export const CRT_PRESETS = {
  full: {
    // ... existing properties ...
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  standard: {
    // ... existing properties ...
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  small: {
    // ... existing properties ...
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  none: {
    // ... existing properties ...
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
} as const satisfies Record<string, CrtSettings>;
```

---

## ✅ Acceptance Criteria

- [ ] `PhosphorPatternType` type exported from domain
- [ ] All new properties added to `CrtSettings` interface with JSDoc
- [ ] All new config flags added to `CrtSettingsConfig`
- [ ] `DEFAULT_CRT_CONFIG` updated (new flags default to `false`)
- [ ] `CRT_CONFIGS.advanced` created with all flags `true`
- [ ] All existing presets updated with new properties (effects off)
- [ ] TypeScript compiles without errors
- [ ] Existing tests still pass
- [ ] No breaking changes to existing code

---

## 🧪 Testing

### Verification Steps

1. Run build: `pnpm nx build teensyrom-ui`
2. Run existing tests: `pnpm nx test ui-components --testFile=crt --watch=false`
3. Verify imports work:
   ```typescript
   import { CrtSettings, PhosphorPatternType } from '@teensyrom-nx/domain';
   import { CrtSettingsConfig, CRT_CONFIGS } from '@teensyrom-nx/ui-components';
   ```

### No New Tests Required

This task only adds types and defaults. Tests will be added in subsequent tasks when the shader implementation uses these values.

---

## 📝 Notes

- **Backward Compatibility**: All new properties have defaults that disable effects, so existing code continues to work unchanged.
- **WebGL Only**: Document that advanced effects only work in WebGL mode. CSS mode ignores these properties.
- **Future Tasks**: This model will be consumed by Tasks 04-002 through 04-007.

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Master Plan](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md)
- Existing: `libs/domain/src/lib/models/crt-settings.model.ts`
- Existing: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
