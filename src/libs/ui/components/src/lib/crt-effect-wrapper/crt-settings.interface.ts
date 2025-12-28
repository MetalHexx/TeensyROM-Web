// Import and re-export preset constants from domain layer (single source of truth)
import { CRT_PRESET_PREFIX, CRT_PRESET_KEYS, type PresetKey } from '@teensyrom-nx/domain';
export { CRT_PRESET_PREFIX, CRT_PRESET_KEYS, type PresetKey };

// Import types from defaults (must come before functions that use them)
import type { BuiltInPresetName, CustomPresetName, AnyPresetName, CrtPresetName } from './crt-settings.defaults';
export type { BuiltInPresetName, CustomPresetName, AnyPresetName, CrtPresetName };

/**
 * Type guard to check if a preset name is a built-in preset.
 * Built-in presets start with 'default-' prefix.
 * 
 * @param name - Preset name to check
 * @returns True if name is a built-in preset, false otherwise
 * @example
 * ```typescript
 * isBuiltInPreset('default-large-webgl') // true
 * isBuiltInPreset('custom-My Preset') // false
 * ```
 */
export function isBuiltInPreset(name: string): name is BuiltInPresetName {
  return name.startsWith(CRT_PRESET_PREFIX.DEFAULT);
}

/**
 * Type guard to check if a preset name is a custom preset.
 * Custom presets start with 'custom-' prefix.
 * 
 * @param name - Preset name to check
 * @returns True if name is a custom preset, false otherwise
 * @example
 * ```typescript
 * isCustomPreset('custom-My Preset') // true
 * isCustomPreset('default-large-webgl') // false
 * ```
 */
export function isCustomPreset(name: string): name is CustomPresetName {
  return name.startsWith(CRT_PRESET_PREFIX.CUSTOM);
}

/**
 * Removes the 'custom-' prefix from a custom preset name for display purposes.
 * Returns the original string if it doesn't start with 'custom-'.
 * 
 * @param name - Custom preset name to strip prefix from
 * @returns Name without 'custom-' prefix
 * @example
 * ```typescript
 * stripCustomPrefix('custom-My Preset') // 'My Preset'
 * stripCustomPrefix('My Preset') // 'My Preset' (no prefix to strip)
 * stripCustomPrefix('default-large-webgl') // 'default-large-webgl'
 * ```
 */
export function stripCustomPrefix(name: string): string {
  return name.startsWith(CRT_PRESET_PREFIX.CUSTOM)
    ? name.slice(CRT_PRESET_PREFIX.CUSTOM.length)
    : name;
}

/**
 * Adds the 'custom-' prefix to a user-entered preset name.
 * Does not add prefix if already present (idempotent).
 * 
 * @param name - User-entered preset name
 * @returns Name with 'custom-' prefix
 * @example
 * ```typescript
 * addCustomPrefix('My Preset') // 'custom-My Preset'
 * addCustomPrefix('custom-My Preset') // 'custom-My Preset' (already has prefix)
 * ```
 */
export function addCustomPrefix(name: string): CustomPresetName {
  return name.startsWith(CRT_PRESET_PREFIX.CUSTOM)
    ? (name as CustomPresetName)
    : (`${CRT_PRESET_PREFIX.CUSTOM}${name}` as CustomPresetName);
}

/**
 * Phosphor pattern constants to eliminate magic strings.
 * Use these instead of string literals in code.
 * 
 * Patterns:
 * - APERTURE_GRILLE: Vertical RGB stripes (Sony Trinitron style)
 * - SHADOW_MASK: Traditional staggered RGB dots
 * - DOT_TRIAD: Triangular RGB arrangement (arcade monitors)
 * - NONE: No phosphor pattern
 */
export const CRT_PHOSPHOR_PATTERNS = {
  APERTURE_GRILLE: 'aperture-grille',
  SHADOW_MASK: 'shadow-mask',
  DOT_TRIAD: 'dot-triad',
  NONE: 'none',
} as const;

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

  /**
   * Show monochrome phosphor control.
   * When false, monochrome phosphor dropdown hidden and effect disabled.
   */
  showMonochromePhosphor: boolean;

  /**
   * Show Advanced Detection panel (PAL/NTSC selection, video mode selection).
   * When false, advanced detection controls hidden and auto-detection uses defaults.
   * Used for static image displays where video detection is not applicable.
   */
  showAdvancedDetection: boolean;
}

/**
 * Re-export CrtSettings and PhosphorPatternType from domain layer for convenience.
 * The actual interfaces are defined in @teensyrom-nx/domain.
 */
export type { CrtSettings, PhosphorPatternType, MonochromePhosphorType } from '@teensyrom-nx/domain';
