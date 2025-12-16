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
  showMonochromePhosphor: true,
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
    showMonochromePhosphor: true,
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
    showMonochromePhosphor: true,
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
    showMonochromePhosphor: false,
  },
} as const satisfies Record<string, CrtSettingsConfig>;

/**
 * Built-in CRT effect presets using context-based naming.
 *
 * Video presets: Optimized for video content
 * - SMALL_VIDEO_WEBGL: Compact video displays (no curvature, subtle effects)
 * - LARGE_VIDEO_WEBGL: Fullscreen video displays (curvature enabled, immersive effects)
 *
 * Image presets: Optimized for static image content
 * - SMALL_IMAGE_WEBGL: Static image displays (no curvature, balanced effects for clarity)
 *
 * All presets use WebGL rendering for high-fidelity output.
 *
 * Use these presets with CRT_PRESET_KEYS constants for type safety:
 * ```typescript
 * // ✅ Use preset with constant (type-safe)
 * settings = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL];
 *
 * // ✅ Customize a preset
 * settings = { ...CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL], brightness: 1.2 };
 * ```
 */
export const CRT_PRESETS = {
  /**
   * Small Video (WebGL) - Subtle CRT effect for compact video displays.
   * Light scanlines, minimal vignette, no curvature, delicate phosphor pattern.
   * Uses WebGL for pristine rendering.
   * Ideal for: compact video players, video thumbnails, embedded video content.
   */
  [CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]: {
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
    bloomIntensity: 0,
    barrelDistortion: 0,
    chromaticAberration: 0,
    monochromePhosphor: 'none',
  },

  /**
   * Large Video (WebGL) - Immersive fullscreen CRT for video content.
   * Strong scanlines, vignette, curvature, phosphor patterns for maximum authenticity.
   * Uses WebGL for best quality and no zoom banding artifacts.
   * Ideal for: fullscreen video displays, video dialog, immersive video viewing.
   */
  [CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]: {
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
    bloomIntensity: 0.3,
    barrelDistortion: 0,
    chromaticAberration: 0,
    monochromePhosphor: 'none',
  },

  /**
   * Small Image (WebGL) - Balanced CRT effect for static image displays.
   * Medium scanlines, moderate vignette, no curvature, refined phosphor pattern.
   * Uses WebGL for sharp, artifact-free rendering.
   * Ideal for: static image viewers, photo galleries, screenshot displays.
   */
  [CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]: {
    scanlineIntensity: 0.4,
    scanlineSize: 2.0,
    vignetteStrength: 1.0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.4,
    saturation: 1.2,
    hue: 0,
    phosphorPattern: CRT_PHOSPHOR_PATTERNS.APERTURE_GRILLE,
    phosphorIntensity: 0.2,
    bloomIntensity: 0,
    barrelDistortion: 0,
    chromaticAberration: 0,
    monochromePhosphor: 'none',
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
 * These are fallback labels used when components don't provide their own context-appropriate labels.
 * Components should pass their own labels via the currentPresetLabel input for better UX.
 * 
 * NOTE: WebGL-only architecture - CSS rendering has been removed.
 */
export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  [CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]: 'Small Video (WebGL)',
  [CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]: 'Large Video (WebGL)',
  [CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]: 'Small Image (WebGL)',
};

/**
 * Default CRT settings - Large Video WebGL experience for fullscreen viewing.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL];

