import { CrtSettings } from './crt-settings.model';
import { CRT_PRESET_PREFIX } from './crt-preset-names.const';

/**
 * Type alias for custom preset names.
 * Custom presets use a 'custom-' prefix to distinguish them from built-in presets.
 * 
 * Template literal type enforces the prefix at compile-time.
 * @example 'custom-My Preset' ✅ | 'My Preset' ❌ (missing prefix)
 */
export type CustomPresetName = `${typeof CRT_PRESET_PREFIX.CUSTOM}${string}`;

/**
 * Represents a user-created CRT preset with custom visual settings.
 * 
 * Custom presets are stored separately from built-in presets and can be
 * managed (saved, renamed, deleted) by the user. They use a 'custom-' prefix
 * to prevent naming conflicts with built-in presets.
 * 
 * @example
 * ```typescript
 * const preset: CustomCrtPreset = {
 *   name: 'custom-my-arcade-setup',
 *   settings: {
 *     scanlineIntensity: 0.7,
 *     phosphorPattern: 'dot-triad',
 *     // ... other CRT settings
 *   },
 *   createdAt: '2025-12-07T10:30:00.000Z'
 * };
 * ```
 */
export interface CustomCrtPreset {
  /**
   * Unique name identifier for the custom preset.
   * Must start with 'custom-' prefix to distinguish from built-in presets.
   * 
   * @example 'custom-my-arcade-setup'
   */
  name: CustomPresetName;

  /**
   * CRT visual effect settings for this preset.
   * Contains all configurable parameters for scanlines, curvature, colors, etc.
   */
  settings: CrtSettings;

  /**
   * ISO 8601 timestamp indicating when the preset was created.
   * Used for sorting and metadata tracking.
   * 
   * @example '2025-12-07T10:30:00.000Z'
   */
  createdAt: string;
}
