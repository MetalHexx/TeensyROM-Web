import { CrtSettings } from './crt-settings.interface';

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
    scanlineThickness: 3,
    scanlineSpacing: 2,
    vignetteStrength: 1.3,
    screenCurvature: 115,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
  },

  /**
   * Color enhancement only - no overlays or curvature.
   * Best for images or content where scanlines/vignette don't make sense.
   */
  filtersOnly: {
    scanlineIntensity: 0,
    scanlineThickness: 0,
    scanlineSpacing: 0,
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
  },

  /**
   * Scanlines + color enhancement - no vignette or curvature.
   * Good for flat-screen retro aesthetic without the curved monitor look.
   */
  scanlines: {
    scanlineIntensity: 0.5,
    scanlineThickness: 3,
    scanlineSpacing: 2,
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1.1,
    brightness: 1.5,
    saturation: 1.3,
  },

  /**
   * Neutral/off - effectively a pass-through wrapper.
   * All effects disabled, content renders unchanged.
   */
  none: {
    scanlineIntensity: 0,
    scanlineThickness: 0,
    scanlineSpacing: 0,
    vignetteStrength: 0,
    screenCurvature: 0,
    contrast: 1,
    brightness: 1,
    saturation: 1,
  },
} as const satisfies Record<string, CrtSettings>;

/**
 * Default CRT settings - full CRT experience.
 * Matches the original VideoDialogComponent values.
 */
export const DEFAULT_CRT_SETTINGS: CrtSettings = CRT_PRESETS.full;
