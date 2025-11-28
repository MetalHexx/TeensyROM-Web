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
 *   scanlineThickness: 3,    // 3px dark bands
 *   scanlineSpacing: 2,      // 2px gaps between bands
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
   * Pixel height of dark scanline bands.
   * Typically 2-4px for realistic CRT look.
   */
  scanlineThickness: number;

  /**
   * Pixel gap between scanline bands.
   * Typically 1-3px for realistic CRT look.
   */
  scanlineSpacing: number;

  /**
   * Intensity of edge/corner darkening (0-2).
   * Set to 0 to disable vignette effect.
   */
  vignetteStrength: number;

  /**
   * Border-radius in pixels for curved screen effect.
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
}
