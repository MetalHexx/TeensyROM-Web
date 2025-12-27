/**
 * Phosphor pattern types for CRT subpixel simulation.
 */
export type PhosphorPatternType = 'none' | 'aperture-grille' | 'shadow-mask' | 'dot-triad';

/**
 * Monochrome phosphor color types for vintage terminal simulation.
 * Converts the entire display to a single-color phosphor style reminiscent of early computer terminals.
 */
export type MonochromePhosphorType = 'none' | 'white' | 'amber' | 'green';

/**
 * Configuration interface for CRT (cathode ray tube) visual effects.
 *
 * All properties are numeric values that map to CSS custom properties.
 * Use neutral values (0 for overlays, 1 for filters) to disable individual effects.
 *
 * @example
 * ```typescript
 * const settings: CrtSettings = {
 *   scanlineIntensity: 0.5,  // 50% opacity scanlines
 *   scanlineSize: 2.5,       // 2.5px scanline bands and gaps
 *   vignetteStrength: 1.3,   // Strong edge darkening
 *   screenCurvature: 115,    // Curved screen corners
 *   contrast: 1.1,           // 10% contrast boost
 *   brightness: 1.5,         // 50% brightness boost
 *   saturation: 1.3,         // 30% saturation boost
 * };
 * ```
 */
export interface CrtSettings {
  /**
   * Opacity of the scanline overlay (0-1).
   * Set to 0 to disable scanlines.
   */
  scanlineIntensity: number;

  /**
   * Size of scanline bands and gaps in pixels (1.0-6.0).
   * Controls both the dark band height and the spacing between bands (1:1 ratio).
   */
  scanlineSize: number;

  /**
   * Intensity of edge/corner darkening (0-2).
   * Set to 0 to disable vignette effect.
   */
  vignetteStrength: number;

  /**
   * Border-radius in pixels for curved screen corner effect.
   * Set to 0 for no curvature.
   */
  screenCurvature: number;

  /**
   * CSS filter contrast multiplier.
   */
  contrast: number;

  /**
   * CSS filter brightness multiplier.
   */
  brightness: number;

  /**
   * CSS filter saturation multiplier.
   */
  saturation: number;

  /**
   * CSS filter hue-rotate in degrees (-60 to 60).
   * Useful for matching color output between different C64 video devices.
   */
  hue: number;

  // === Advanced WebGL Effects ===

  /**
   * Type of phosphor pattern to simulate.
   */
  phosphorPattern: PhosphorPatternType;

  /**
   * Intensity of the phosphor pattern effect (0-1).
   */
  phosphorIntensity: number;

  /**
   * Intensity of bloom glow effect (0-2.0).
   * Creates a soft glowing halo around bright areas using a two-pass algorithm:
   * bright-pass filter + 9-tap Gaussian blur.
   */
  bloomIntensity: number;

  /**
   * Amount of barrel distortion (0-0.5).
   * Different from screenCurvature (border-radius) - this warps the image.
   */
  barrelDistortion: number;

  /**
   * Amount of RGB channel separation at edges (0-10).
   * Simulates lens aberration in CRT monitors.
   */
  chromaticAberration: number;

  /**
   * Monochrome phosphor color for vintage terminal appearance.
   * Uses luminance calculation to preserve brightness while tinting with the selected color.
   */
  monochromePhosphor: MonochromePhosphorType;

  /**
   * Automatically crop black bars from video content.
   * When enabled, uses video mode presets to remove black letterbox/pillarbox bars.
   */
  autoCropBlackBars: boolean;

  /**
   * C64 video standard region (PAL or NTSC).
   * Used for video mode preset matching when autoCropBlackBars is enabled.
   *
   * TODO: Auto-detect from TeensyROM device API.
   */
  videoStandard: 'PAL' | 'NTSC';

  /**
   * Manual override for C64 video mode.
   * When set to 'auto', the system automatically detects the mode from video measurements.
   * When set to a specific mode, that mode is forced (useful when auto-detection gets it wrong).
   */
  videoMode: 'auto' | 'PAL Standard' | 'PAL Open Border' | 'NTSC Standard' | 'NTSC Open Border';
}
