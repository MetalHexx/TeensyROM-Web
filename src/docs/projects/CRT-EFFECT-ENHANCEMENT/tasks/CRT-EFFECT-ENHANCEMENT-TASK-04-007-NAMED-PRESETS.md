# Task 04-007: Named Presets

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-007 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Small (2-3 files) |
| **Priority** | Medium |
| **Dependencies** | TASK-04-006 (Settings Panel) |

---

## 🎯 Objective

Create curated preset configurations that showcase different CRT styles using the new advanced effects. Update the preset dropdown with new options: Trinitron, Arcade, Authentic, and Subtle.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Current presets](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)
- [ ] [Settings panel](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-effect-wrapper/
└── crt-settings.defaults.ts              📝 Add new presets

libs/ui/components/src/lib/crt-settings-panel/
└── crt-settings-panel.component.ts       📝 Update preset list
```

---

## 🏗️ Technical Design

### New Preset Definitions

```typescript
export const CRT_PRESETS = {
  // === EXISTING PRESETS (update with new defaults) ===
  
  full: {
    scanlineIntensity: 0.5,
    scanlineSize: 2.5,
    vignetteStrength: 1.3,
    screenCurvature: 115,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
    renderMode: 'auto' as const,
    // New properties - disabled for backward compatibility
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  standard: {
    scanlineIntensity: 0.5,
    scanlineSize: 2.5,
    vignetteStrength: 1.3,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
    renderMode: 'auto' as const,
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  small: {
    scanlineIntensity: 0.5,
    scanlineSize: 1.0,
    vignetteStrength: 1.5,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.5,
    saturation: 1.25,
    hue: 0,
    renderMode: 'auto' as const,
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  none: {
    scanlineIntensity: 0,
    scanlineSize: 0,
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1,
    brightness: 1,
    saturation: 1,
    hue: 0,
    renderMode: 'css' as const,
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
  
  // === NEW PRESETS ===
  
  /**
   * Trinitron - Sony Trinitron style monitor
   * 
   * Characteristics:
   * - Aperture grille phosphor pattern (vertical RGB stripes)
   * - Subtle bloom for phosphor glow
   * - Flat screen (no barrel distortion)
   * - Minimal chromatic aberration
   * - High color saturation and brightness
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
   * Arcade - Classic arcade CRT monitor
   * 
   * Characteristics:
   * - Shadow mask phosphor pattern
   * - Strong scanlines for arcade aesthetic
   * - Visible bloom for that arcade glow
   * - Slight barrel distortion
   * - Punchy colors
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
   * 
   * Characteristics:
   * - All effects enabled
   * - Maximum nostalgia
   * - Shadow mask phosphors
   * - Pronounced curvature and distortion
   * - Strong chromatic aberration
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
   * Subtle - Light CRT flavor
   * 
   * Characteristics:
   * - Minimal scanlines
   * - No phosphor pattern
   * - Very subtle bloom
   * - No distortion
   * - Clean, modern interpretation
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
} as const satisfies Record<string, CrtSettings>;

export type CrtPresetName = keyof typeof CRT_PRESETS;

export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  // Existing
  full: 'Full CRT',
  standard: 'Standard',
  small: 'Small Screen',
  none: 'No Effects',
  // New
  trinitron: 'Trinitron',
  arcade: 'Arcade',
  authentic: 'Authentic Vintage',
  subtle: 'Subtle',
};
```

### Preset Descriptions for UI

```typescript
/**
 * Descriptions for preset tooltips or info display.
 */
export const CRT_PRESET_DESCRIPTIONS: Record<CrtPresetName, string> = {
  full: 'Classic CRT with scanlines, vignette, and curvature',
  standard: 'Scanlines and vignette without screen curvature',
  small: 'Optimized for small video displays',
  none: 'No CRT effects applied',
  trinitron: 'Sony Trinitron style with aperture grille phosphors',
  arcade: 'Arcade monitor look with strong effects',
  authentic: 'Maximum vintage CRT authenticity',
  subtle: 'Light CRT flavor for modern aesthetic',
};
```

### Config Updates for New Presets

```typescript
export const CRT_CONFIGS = {
  // ... existing configs ...
  
  /**
   * Config for Trinitron preset - shows phosphor and bloom controls
   */
  trinitron: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: false,
    showChromaticAberration: true,
  },
  
  /**
   * Config for Arcade preset - all advanced effects
   */
  arcade: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
  
  /**
   * Config for Authentic preset - all controls visible
   */
  authentic: {
    showScanlines: true,
    showVignette: true,
    showCurvature: true,
    showColorFilters: true,
    showPhosphor: true,
    showBloom: true,
    showDistortion: true,
    showChromaticAberration: true,
  },
  
  /**
   * Config for Subtle preset - minimal controls
   */
  subtle: {
    showScanlines: true,
    showVignette: true,
    showCurvature: false,
    showColorFilters: true,
    showPhosphor: false,
    showBloom: true,
    showDistortion: false,
    showChromaticAberration: false,
  },
} as const satisfies Record<string, CrtSettingsConfig>;
```

---

## 📋 Implementation Steps

### Step 1: Update Preset Definitions

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

1. Update existing presets with new property defaults
2. Add new preset definitions (trinitron, arcade, authentic, subtle)
3. Update `CRT_PRESET_LABELS` with new entries
4. Optionally add `CRT_PRESET_DESCRIPTIONS`

### Step 2: Update Settings Panel

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`

Update preset names array:

```typescript
// Update from:
protected readonly presetNames: CrtPresetName[] = ['full', 'standard', 'small', 'none'];

// To:
protected readonly presetNames: CrtPresetName[] = [
  'full', 
  'standard', 
  'small', 
  'trinitron',
  'arcade',
  'authentic',
  'subtle',
  'none',
];
```

### Step 3: Update Tests

**File**: `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

```typescript
describe('presets', () => {
  it('should include all new preset options', () => {
    expect(spectator.component.presetNames).toContain('trinitron');
    expect(spectator.component.presetNames).toContain('arcade');
    expect(spectator.component.presetNames).toContain('authentic');
    expect(spectator.component.presetNames).toContain('subtle');
  });
  
  it('should emit trinitron preset when selected', () => {
    const spy = spyOn(spectator.component.presetSelected, 'emit');
    spectator.component.onPresetSelect('trinitron');
    expect(spy).toHaveBeenCalledWith('trinitron');
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] All existing presets updated with new property defaults (effects off)
- [ ] 4 new presets added: trinitron, arcade, authentic, subtle
- [ ] Each preset creates a distinct visual style
- [ ] Preset labels appear correctly in dropdown
- [ ] Preset selection works for all new presets
- [ ] New presets require WebGL mode (renderMode: 'webgl')
- [ ] Matching configs created for each new preset
- [ ] All unit tests pass
- [ ] TypeScript compiles without errors

---

## 🧪 Testing

### Unit Tests

```bash
pnpm nx test ui-components --testFile=crt --watch=false
```

### Visual Verification

1. Open settings panel
2. Select each new preset from dropdown
3. Verify each creates distinct visual style:
   - **Trinitron**: Visible aperture grille pattern, subtle glow
   - **Arcade**: Strong scanlines, shadow mask, visible bloom
   - **Authentic**: All effects, curved/distorted
   - **Subtle**: Minimal effects, clean look

---

## 📝 Notes

### Preset Philosophy

Each preset should:
- Have a clear visual identity
- Be useful for different use cases
- Work well with the content (C64 video)
- Not be too extreme (user can customize if desired)

### WebGL Requirement

New presets using advanced effects require WebGL. They set `renderMode: 'webgl'` explicitly. If WebGL is unavailable, fallback to CSS will show basic scanlines only.

### Future Enhancement

Consider adding:
- "Gaming" preset with motion blur simulation
- "VHS" preset with noise and tracking lines
- "PVM" preset (Professional Video Monitor)

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-006: Settings Panel](./CRT-EFFECT-ENHANCEMENT-TASK-04-006-SETTINGS-PANEL.md)
- Presets file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
