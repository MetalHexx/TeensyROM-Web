/**
 * Phosphor pattern types for CRT subpixel simulation.
 * - 'none': No phosphor pattern
 * - 'aperture-grille': Vertical RGB stripes (Sony Trinitron style)
 * - 'shadow-mask': Traditional staggered RGB dots
 * - 'dot-triad': Triangular RGB arrangement (arcade monitors)
 */
export type PhosphorPatternType = 'none' | 'aperture-grille' | 'shadow-mask' | 'dot-triad';

/**
 * Monochrome phosphor color types for vintage terminal simulation.
 * Converts the entire display to a single-color phosphor style reminiscent of early computer terminals.
 * - 'none': Full color (disabled)
 * - 'white': White phosphor (IBM PC monochrome, early workstations)
 * - 'amber': Amber phosphor (classic terminals, warm tone)
 * - 'green': Green phosphor (VT220, IBM 3270, classic hacker aesthetic)
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

  // === Advanced WebGL Effects ===

  /**
   * Type of phosphor pattern to simulate.
   * Only visible in WebGL mode.
   * @default 'none'
   */
  phosphorPattern: PhosphorPatternType;

  /**
   * Intensity of the phosphor pattern effect (0-1).
   * 0 = invisible, 1 = fully visible pattern.
   * @default 0
   */
  phosphorIntensity: number;

  /**
   * Intensity of bloom glow effect (0-2.0).
   * Creates a soft glowing halo around bright areas, simulating the phosphor glow
   * characteristic of CRT displays. Uses two-pass algorithm: bright-pass filter
   * (extracts bright pixels above threshold) + 9-tap Gaussian blur for smooth glow.
   * 
   * - 0 = no bloom (zero performance cost)
   * - 0.5 = subtle glow for small displays
   * - 1.0 = noticeable glow for medium displays
   * - 2.0 = dramatic glow for large fullscreen displays
   * 
   * Only visible in WebGL mode.
   * @default 0
   */
  bloomIntensity: number;

  /**
   * Amount of barrel distortion (0-0.5).
   * 0 = flat screen, higher = more curved/bulging.
   * Different from screenCurvature (border-radius) - this warps the image.
   * Only visible in WebGL mode.
   * @default 0
   */
  barrelDistortion: number;

  /**
   * Amount of RGB channel separation at edges (0-10).
   * Simulates lens aberration in CRT monitors.
   * 0 = no separation, higher = more visible RGB fringing.
   * Only visible in WebGL mode.
   * @default 0
   */
  chromaticAberration: number;

  /**
   * Monochrome phosphor color for vintage terminal appearance.
   * Converts the display to single-color phosphor output:
   * - 'none': Full color (effect disabled)
   * - 'white': White phosphor (IBM PC monochrome, early workstations)
   * - 'amber': Amber phosphor (warm orange tone, classic terminals)
   * - 'green': Green phosphor (VT220, IBM 3270, classic hacker aesthetic)
   * 
   * Uses luminance calculation to preserve brightness relationships while
   * tinting all pixels with the selected phosphor color.
   * Only visible in WebGL mode.
   * @default 'none'
   */
  monochromePhosphor: MonochromePhosphorType;
}
