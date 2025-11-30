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
  },

  /**
   * No controls - empty panel (typically used with CRT_PRESETS.none).
   */
  none: {
    showScanlines: false,
    showVignette: false,
    showCurvature: false,
    showColorFilters: false,
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
   * Full CRT monitor experience - scanlines, vignette, curvature, and color boost.
   * Best for video streams and terminal-like displays.
   */
  full: {
    scanlineIntensity: 0.5,
    scanlineSize: 2.5,
    vignetteStrength: 1.3,
    screenCurvature: 115,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
  },

  /**
   * Standard CRT - scanlines, vignette, and color enhancement (no curvature).
   * Good for embedded previews where flat-screen aesthetic is preferred.
   */
  standard: {
    scanlineIntensity: 0.5,
    scanlineSize: 2.5,
    vignetteStrength: 1.3,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
    hue: 0,
  },

  /**
   * Small CRT - subtle scanlines for compact video displays.
   * Minimal scanline thickness (1px) for smaller video components.
   */
  small: {
    scanlineIntensity: 0.5,
    scanlineSize: 1.0,
    vignetteStrength: 1.5,
    screenCurvature: 0,
    contrast: 1.05,
    brightness: 1.5,
    saturation: 1.25,
    hue: 0,
  },

  /**
   * Neutral/off - effectively a pass-through wrapper.
   * All effects disabled, content renders unchanged.
   */
  none: {
    scanlineIntensity: 0,
    scanlineSize: 0,
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1,
    brightness: 1,
    saturation: 1,
    hue: 0,
  },
} as const satisfies Record<string, CrtSettings>;

/** Type for valid preset names */
export type CrtPresetName = keyof typeof CRT_PRESETS;

/**
 * Human-readable labels for CRT presets.
 * Use these for UI display in dropdown menus.
 */
export const CRT_PRESET_LABELS: Record<CrtPresetName, string> = {
  full: 'Full CRT',
  standard: 'Standard CRT',
  small: 'Small CRT',
  none: 'No Effects',
};

/**
 * Default CRT settings - full CRT experience.
 * Matches the original VideoDialogComponent values.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = CRT_PRESETS.full;
