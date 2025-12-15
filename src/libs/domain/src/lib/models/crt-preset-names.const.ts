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
 * Built-in CRT preset identifiers using context-based naming.
 *
 * Video presets: Optimized for video content (video-capture, video-dialog)
 * - SMALL_VIDEO_WEBGL: Compact video displays
 * - LARGE_VIDEO_WEBGL: Fullscreen video displays
 *
 * Image presets: Optimized for static image content (file-image viewer)
 * - SMALL_IMAGE_WEBGL: Static image displays
 *
 * All presets use WebGL rendering for high-fidelity output.
 */
export const CRT_PRESET_KEYS = {
  SMALL_VIDEO_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}small-video-webgl`,
  LARGE_VIDEO_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}large-video-webgl`,
  SMALL_IMAGE_WEBGL: `${CRT_PRESET_PREFIX.DEFAULT}small-image-webgl`,
} as const;

/**
 * Type-safe preset key values derived from CRT_PRESET_KEYS constant.
 * Ensures only valid preset keys can be used at compile-time.
 */
export type PresetKey = typeof CRT_PRESET_KEYS[keyof typeof CRT_PRESET_KEYS];
