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
   * 0 = no scanlines, 1 = fully opaque (black) scanlines.
   * Set to 0 to disable scanlines.
   */
  scanlineIntensity: number;

  /**
   * Size of scanline bands and gaps in pixels (1.0-6.0).
   * Controls both the dark band height and the spacing between bands (1:1 ratio).
   * Lower values = finer/subtler lines, higher values = thicker/bolder lines.
   * Typical values: 1.0 (fine), 2.5 (standard), 4.0 (heavy).
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
   * 1 = no change, >1 = increased contrast.
   */
  contrast: number;

  /**
   * CSS filter brightness multiplier.
   * 1 = no change, >1 = brighter.
   */
  brightness: number;

  /**
   * CSS filter saturation multiplier.
   * 1 = no change, >1 = more saturated.
   */
  saturation: number;

  /**
   * CSS filter hue-rotate in degrees (-60 to 60).
   * 0 = no rotation, positive = shift towards red/yellow, negative = shift towards blue/cyan.
   * Useful for matching color output between different C64 video devices.
   */
  hue: number;
}
