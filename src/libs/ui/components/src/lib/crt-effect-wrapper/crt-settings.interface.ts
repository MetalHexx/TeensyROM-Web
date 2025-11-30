/**
 * Configuration interface for which CRT effect groups are enabled.
 *
 * Use this to control which sliders appear in the settings panel
 * and which effects are applied by the effect wrapper.
 *
 * @example
 * ```typescript
 * // Show only scanlines and color filters
 * const config: CrtSettingsConfig = {
 *   showScanlines: true,
 *   showVignette: false,
 *   showCurvature: false,
 *   showColorFilters: true,
 * };
 * ```
 */
export interface CrtSettingsConfig {
  /**
   * Show scanline controls (intensity, thickness, spacing).
   * When false, scanline effect is disabled and sliders hidden.
   */
  showScanlines: boolean;

  /**
   * Show vignette control (edge darkening strength).
   * When false, vignette effect is disabled and slider hidden.
   */
  showVignette: boolean;

  /**
   * Show screen curvature control (border radius).
   * When false, curvature effect is disabled and slider hidden.
   */
  showCurvature: boolean;

  /**
   * Show color filter controls (contrast, brightness, saturation).
   * When false, color filters are disabled and sliders hidden.
   */
  showColorFilters: boolean;
}

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
