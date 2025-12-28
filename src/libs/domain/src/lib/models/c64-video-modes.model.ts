/**
 * C64 Video Mode Configuration
 *
 * Defines standardized video output modes from the Commodore 64's VIC-II chip.
 * Used for preset-based black bar cropping instead of runtime detection.
 *
 * The VIC-II produces specific resolutions based on:
 * - Region: PAL (Europe) vs NTSC (Americas)
 * - Border Mode: Standard / Extended / Open Border
 */

/**
 * C64 video mode with preset crop values for black bar removal.
 */
export interface C64VideoMode {
  /**
   * Display name of the mode (e.g., "PAL Standard", "NTSC Extended").
   */
  name: string;

  /**
   * Video standard region.
   */
  region: 'PAL' | 'NTSC';

  /**
   * Preset crop values as normalized percentages (0-1).
   * These crop OUT the black bars, leaving the active content visible.
   */
  cropPercent: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Standard C64 video mode presets based on VIC-II chip specifications.
 *
 * **PAL (Europe/Asia)**:
 * - More vertical resolution (256 lines vs 240)
 * - Symmetric top/bottom borders in standard mode
 *
 * **NTSC (Americas/Japan)**:
 * - Less vertical resolution (240 lines)
 * - Asymmetric top/bottom borders (more on bottom)
 *
 * **Border Modes**:
 * - Standard: Most games, visible black bars
 * - Open Border: Border area shows border color (blue/purple), used for special effects
 * - Open Border also serves as fallback for games with minimal black bars
 */
export const C64_VIDEO_MODE_PRESETS: C64VideoMode[] = [
  // ─────────────────────────────────────────────────────────────────────
  // PAL Modes (50 Hz, Europe/Asia)
  // ─────────────────────────────────────────────────────────────────────

  {
    name: 'PAL Standard',
    region: 'PAL',
    cropPercent: {
      top: 0.08,
      bottom: 0.15,
      left: 0.07,
      right: 0.07,
    },
  },

  {
    name: 'PAL Open Border',
    region: 'PAL',
    cropPercent: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // NTSC Modes (60 Hz, Americas/Japan)
  // ─────────────────────────────────────────────────────────────────────

  {
    name: 'NTSC Standard',
    region: 'NTSC',
    cropPercent: {
      top: 0.02,
      bottom: 0.08,
      left: 0.08,
      right: 0.08,
    },
  },

  {
    name: 'NTSC Open Border',
    region: 'NTSC',
    cropPercent: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  },
];
