import { CrtSettings, CrtSettingsConfig } from './crt-settings.interface';

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
 * Preset configurations for feature visibility.
 * Match these with CRT_PRESETS for cohesive behavior.
 *
 * @example
 * ```typescript
 * // Use matching config with preset
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS.standard" [config]="CRT_CONFIGS.standard">
 * <lib-crt-settings-panel [settings]="settings()" [config]="CRT_CONFIGS.standard">
 * ```
 */
export const CRT_CONFIGS = {
  /**
   * Full CRT experience - all controls visible.
   */
  full: {
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
   * Standard CRT - scanlines, vignette, and color filters (no curvature).
   * Good for embedded previews where screen curvature isn't desired.
   */
  standard: {
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
   * Small CRT - subtle scanlines for compact displays.
   * Minimal scanline thickness for smaller video components.
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
   * No controls - empty panel (typically used with CRT_PRESETS.none).
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
 * Preset configurations for common CRT effect use cases.
 *
 * Use these presets directly or spread them to customize:
 * ```typescript
 * // Use preset directly
 * settings = CRT_PRESETS.full;
 *
 * // Customize a preset
 * settings = { ...CRT_PRESETS.scanlines, brightness: 1.2 };
 * ```
 */
export const CRT_PRESETS = {
  /**
   * Full Screen (CSS) - Immersive fullscreen CRT with CSS rendering.
   * Strong scanlines, vignette, curvature for retro monitor feel.
   * Uses lightweight CSS mode.
   */
  'fullscreen-css': {
    scanlineIntensity: 0.6,
    scanlineSize: 2.5,
    vignetteStrength: 1.5,
    screenCurvature: 115,
    contrast: 1.15,
    brightness: 1.5,
    saturation: 1.3,
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

  /**
   * Full Screen (WebGL) - Immersive fullscreen CRT with GPU-accelerated rendering.
   * Strong scanlines, vignette, curvature, phosphor patterns for maximum authenticity.
   * Uses WebGL for best quality and no zoom banding artifacts.
   */
  'fullscreen-webgl': {
    scanlineIntensity: 0.6,
    scanlineSize: 2.5,
    vignetteStrength: 1.5,
    screenCurvature: 115,
    contrast: 1.15,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'aperture-grille' as const,
    phosphorIntensity: 0.4,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },

  /**
   * Dialog (CSS) - Moderate CRT effect for dialog/modal contexts.
   * Balanced scanlines without curvature, subtle vignette.
   * Uses lightweight CSS mode.
   */
  'dialog-css': {
    scanlineIntensity: 0.4,
    scanlineSize: 2.0,
    vignetteStrength: 1.0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.4,
    saturation: 1.2,
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

  /**
   * Dialog (WebGL) - Moderate CRT effect for dialog/modal contexts.
   * Balanced scanlines without curvature, subtle vignette, phosphor pattern.
   * Uses WebGL for crisp rendering without banding.
   */
  'dialog-webgl': {
    scanlineIntensity: 0.4,
    scanlineSize: 2.0,
    vignetteStrength: 1.0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.4,
    saturation: 1.2,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'aperture-grille' as const,
    phosphorIntensity: 0.2,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },

  /**
   * Image (CSS) - Subtle CRT effect for still images.
   * Light scanlines, minimal vignette, no curvature.
   * Uses lightweight CSS mode.
   */
  'image-css': {
    scanlineIntensity: 0.3,
    scanlineSize: 1.5,
    vignetteStrength: 0.7,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.3,
    saturation: 1.15,
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

  /**
   * Image (WebGL) - Subtle CRT effect for still images.
   * Light scanlines, minimal vignette, no curvature, delicate phosphor pattern.
   * Uses WebGL for pristine rendering.
   */
  'image-webgl': {
    scanlineIntensity: 0.3,
    scanlineSize: 1.5,
    vignetteStrength: 0.7,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.3,
    saturation: 1.15,
    hue: 0,
    renderMode: 'webgl' as const,
    phosphorPattern: 'aperture-grille' as const,
    phosphorIntensity: 0.1,
    bloomEnabled: false,
    bloomIntensity: 0,
    bloomRadius: 1,
    barrelDistortion: 0,
    chromaticAberration: 0,
  },
} as const satisfies Record<string, CrtSettings>;

/** Type for valid preset names */
export type CrtPresetName = keyof typeof CRT_PRESETS;

/**
 * Human-readable labels for CRT presets.
 * Use these for UI display in dropdown menus.
 */
export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  'fullscreen-css': 'Full Screen (CSS)',
  'fullscreen-webgl': 'Full Screen (WebGL)',
  'dialog-css': 'Dialog (CSS)',
  'dialog-webgl': 'Dialog (WebGL)',
  'image-css': 'Image (CSS)',
  'image-webgl': 'Image (WebGL)',
};

/**
 * Default CRT settings - Full Screen WebGL experience.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = CRT_PRESETS['fullscreen-webgl'];
