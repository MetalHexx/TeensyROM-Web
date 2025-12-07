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
 *   showPhosphor: false,
 *   showBloom: false,
 *   showDistortion: false,
 *   showChromaticAberration: false,
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

  // === Advanced Effects (WebGL only) ===

  /**
   * Show phosphor pattern controls (pattern type, intensity).
   * When false, phosphor controls hidden and effect disabled.
   */
  showPhosphor: boolean;

  /**
   * Show bloom/glow controls (enabled toggle, intensity, radius).
   * When false, bloom controls hidden and effect disabled.
   */
  showBloom: boolean;

  /**
   * Show barrel distortion control.
   * When false, distortion control hidden and effect disabled.
   */
  showDistortion: boolean;

  /**
   * Show chromatic aberration control.
   * When false, CA control hidden and effect disabled.
   */
  showChromaticAberration: boolean;
}

/**
 * Re-export CrtSettings, CrtRenderMode, and PhosphorPatternType from domain layer for convenience.
 * The actual interfaces are defined in @teensyrom-nx/domain.
 */
export type { CrtSettings, CrtRenderMode, PhosphorPatternType } from '@teensyrom-nx/domain';
