import { CrtSettings, CrtSettingsConfig, CRT_PRESET_KEYS, CRT_PHOSPHOR_PATTERNS, CRT_PRESET_PREFIX } from './crt-settings.interface';
export { CRT_PRESET_KEYS, CRT_PHOSPHOR_PATTERNS } from './crt-settings.interface';

/**
 * Default configuration - all CRT effect groups enabled.
 * Use this when you want full control over all CRT settings.
 */
export const DEFAULT_CRT_CONFIG: CrtSettingsConfig = {
  showScanlines: true,
  showVignette: true,
  showCurvature: true,
  showColorFilters: true,
  showPhosphor: true,
  showBloom: true,
  showDistortion: true,
  showChromaticAberration: true,
};

/**
 * CRT settings panel configuration variants.
 * 
 * Controls which sliders and controls are visible in the settings panel.
 * 
 * - small: For compact displays (file-image, video-capture)
 *   - Hides curvature control (not relevant for small displays)
 *   - Shows all other controls
 * 
 * - large: For fullscreen displays (video-dialog)
 *   - Shows all controls including curvature
 *   - Full immersive CRT experience
 * 
 * - none: Completely hides settings panel
 *   - All controls disabled
 *   - Edge case for completely static CRT effects
 * 
 * @example
 * ```typescript
 * // Use matching config with preset
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]" [config]="CRT_CONFIGS.small">
 * <lib-crt-settings-panel [settings]="settings()" [config]="CRT_CONFIGS.large">
 * ```
 */
// NOTE: Phase 2 will update component references from old 'full'/'standard' keys to 'small'/'large'
export const CRT_CONFIGS = {
  /**
   * Small config - for compact displays.
   * Hides curvature control (not relevant for small displays), shows all other controls.
   */
  small: {
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
   * Large config - for fullscreen displays.
   * Shows all controls including curvature for full immersive CRT experience.
   */
  large: {
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
   * No controls - empty panel.
   * All controls disabled for completely static CRT effects.
   */
  none: {
    showScanlines: false,
    showVignette: false,
    showCurvature: false,
    showColorFilters: false,
    showPhosphor: false,
    showBloom: false,
    showDistortion: false,
    showChromaticAberration: false,
  },
} as const satisfies Record<string, CrtSettingsConfig>;

/**
 * Built-in CRT effect presets using size-based naming.
 *
 * SMALL presets: Optimized for compact displays (thumbnails, compact video)
 * - No screen curvature (screenCurvature: 0)
 * - Subtle scanlines and vignette
 *
 * LARGE presets: Optimized for fullscreen displays (video dialog, fullscreen images)
 * - Screen curvature enabled (screenCurvature: 115)
 * - Strong scanlines and vignette for immersion
 *
 * CSS vs WebGL:
 * - CSS: Pure CSS implementation, phosphor patterns disabled
 * - WebGL: Advanced effects with phosphor patterns and bloom
 *
 * Use these presets with CRT_PRESET_KEYS constants for type safety:
 * ```typescript
 * // ✅ Use preset with constant (type-safe)
 * settings = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL];
 *
 * // ✅ Customize a preset
 * settings = { ...CRT_PRESETS[CRT_PRESET_KEYS.SMALL_CSS], brightness: 1.2 };
 * ```
 */
export const CRT_PRESETS = {
  /**
   * Small (WebGL) - Subtle CRT effect for compact displays with WebGL enhancements.
   * Light scanlines, minimal vignette, no curvature, delicate phosphor pattern.
   * Uses WebGL for pristine rendering.
   * Ideal for: thumbnails, compact video players, embedded content.
   */
  [CRT_PRESET_KEYS.SMALL_WEBGL]: {
    scanlineIntensity: 0.3,
    scanlineSize: 1.5,
    vignetteStrength: 0.7,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.3,
    saturation: 1.15,
    hue: 0,
    phosphorPattern: CRT_PHOSPHOR_PATTERNS.APERTURE_GRILLE,
    phosphorIntensity: 0.1,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },

  /**
   * Large (WebGL) - Immersive fullscreen CRT with GPU-accelerated rendering.
   * Strong scanlines, vignette, curvature, phosphor patterns for maximum authenticity.
   * Uses WebGL for best quality and no zoom banding artifacts.
   * Ideal for: fullscreen video, large images, immersive viewing.
   */
  [CRT_PRESET_KEYS.LARGE_WEBGL]: {
    scanlineIntensity: 0.6,
    scanlineSize: 2.5,
    vignetteStrength: 1.5,
    screenCurvature: 115,
    contrast: 1.15,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
    phosphorPattern: CRT_PHOSPHOR_PATTERNS.APERTURE_GRILLE,
    phosphorIntensity: 0.4,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
} as const satisfies Record<string, CrtSettings>;

/** Type alias for built-in preset names (provides single source of truth) */
export type BuiltInPresetName = keyof typeof CRT_PRESETS;

/**
 * Template literal type for custom preset names.
 * Custom presets must start with 'custom-' prefix.
 * @example 'custom-My Preset' ✅ | 'My Preset' ❌
 */
export type CustomPresetName = `${typeof CRT_PRESET_PREFIX.CUSTOM}${string}`;

/**
 * Union type for any valid preset name (built-in or custom).
 * Use this when a function accepts both preset types.
 */
export type AnyPresetName = BuiltInPresetName | CustomPresetName;

/**
 * Type for valid preset names.
 * Maintained as alias to BuiltInPresetName for backward compatibility.
 * Use AnyPresetName when you need to support custom presets.
 */
export type CrtPresetName = BuiltInPresetName;

/**
 * Human-readable labels for CRT presets.
 * Use these for UI display in dropdown menus.
 */
export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  [CRT_PRESET_KEYS.SMALL_WEBGL]: 'Small (WebGL)',
  [CRT_PRESET_KEYS.LARGE_WEBGL]: 'Large (WebGL)',
};

/**
 * Default CRT settings - Large WebGL experience for fullscreen viewing.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL];

