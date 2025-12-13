/**
 * Preset name prefixes to avoid magic strings and namespace collisions.
 * - DEFAULT: Built-in presets that ship with the library
 * - CUSTOM: User-created presets stored in localStorage
 */
export const CRT_PRESET_PREFIX = {
  DEFAULT: 'default-',
  CUSTOM: 'custom-',
} as const;

/**
 * Strongly-typed preset key constants to eliminate magic strings.
 * Use these throughout the codebase instead of string literals.
 */
export const CRT_PRESET_KEYS = {
  FULLSCREEN_CSS: `${CRT_PRESET_PREFIX.DEFAULT}fullscreen-css`,
  FULLSCREEN_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}fullscreen-webgl`,
  DIALOG_CSS: `${CRT_PRESET_PREFIX.DEFAULT}dialog-css`,
  DIALOG_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}dialog-webgl`,
  IMAGE_CSS: `${CRT_PRESET_PREFIX.DEFAULT}image-css`,
  IMAGE_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}image-webgl`,
} as const;

/**
 * Type-safe preset key values derived from CRT_PRESET_KEYS constant.
 * Ensures only valid preset keys can be used at compile-time.
 */
export type PresetKey = typeof CRT_PRESET_KEYS[keyof typeof CRT_PRESET_KEYS];
