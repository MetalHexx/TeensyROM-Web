/**
 * C64 Video Mode Detector
 *
 * Matches measured black bar percentages to C64 VIC-II video mode presets.
 * Uses measurement-based matching (not resolution-based) to handle upscalers
 * that output fixed resolutions (640x480, 1080p) with letterboxed C64 content.
 *
 * **Why Measurement-Based Matching?**
 * Upscalers and HDMI converters output standardized resolutions regardless of
 * source content. Resolution-based matching fails because 640x480 could contain
 * 320x200 PAL content, 320x240 NTSC content, or any other mode letterboxed/pillarboxed.
 * By matching actual measured bar percentages against preset crop values, the system
 * works reliably with any upscaler resolution.
 *
 * **How It Works**:
 * 1. GPU edge detection measures actual black bar percentages (0-1) on all edges
 * 2. These measurements are compared to preset crop values using similarity scoring
 * 3. Best matching preset is selected regardless of video resolution
 * 4. System is resolution-independent and works with any display device
 */

import { C64VideoMode, C64_VIDEO_MODE_PRESETS } from '@teensyrom-nx/domain';
import { logInfo, LogType } from '@teensyrom-nx/utils';

/**
 * Crop rectangle in normalized coordinates (0-1).
 * These values are passed directly to the fragment shader as uniforms.
 */
export interface CropRect {
  left: number; // 0-1: Percentage from left edge to start content
  top: number; // 0-1: Percentage from top edge to start content
  width: number; // 0-1: Width of content region
  height: number; // 0-1: Height of content region
}

/**
 * Edge detection measurements from GPU edge detection shader.
 * 
 * Each value represents the percentage (0-1) of edge pixels that are black.
 * For example, left: 0.95 means 95% of left edge samples are black.
 * 
 * These raw measurements are used for percentage-based preset matching,
 * not simple boolean thresholds.
 */
export interface EdgeDetectionMeasurements {
  left: number;   // 0-1: Percentage of left edge that is black (e.g., 0.95 = 95%)
  top: number;    // 0-1: Percentage of top edge that is black
  right: number;  // 0-1: Percentage of right edge that is black
  bottom: number; // 0-1: Percentage of bottom edge that is black
}

/**
 * Detects C64 video mode from measured black bar percentages.
 *
 * **Algorithm**:
 * 1. Validate measurements show sufficient black bars (at least 2 edges > 70%)
 * 2. Filter presets by user's selected video standard (PAL or NTSC)
 * 3. Find preset with most similar crop percentages (Manhattan distance)
 * 4. Require temporal stability (5 consecutive matching detections)
 * 5. Return preset crop values for smooth application
 *
 * **Resolution Independence**:
 * Ignores video dimensions entirely. Works with any upscaler output
 * (640x480, 720p, 1080p, 4K) because matching is based on actual measured
 * bar percentages, not resolution assumptions.
 *
 * **Temporal Stability**:
 * Prevents mode thrashing during content changes or noisy detection.
 * Requires 5 consecutive frames to agree on the same mode before committing.
 */
export class VideoModeDetector {
  private detectionHistory: C64VideoMode[] = [];
  private readonly HISTORY_SIZE = 5; // Require stability over 5 frames
  private lastMatchedMode: string | null = null; // Track for change detection

  /**
   * Detect C64 video mode from measured black bar percentages.
   *
   * Logic:
   * 1. If manualVideoMode is set (not 'auto'), use that mode directly (skip detection)
   * 2. Check if measurements show sufficient black bars to warrant cropping
   * 3. Filter presets by video standard (PAL or NTSC)
   * 4. Find preset with most similar crop percentages (Manhattan distance)
   * 5. Require temporal stability (5 consecutive matching detections)
   * 6. Return null if no stable match found (caller handles fallback)
   *
   * NOTE: The scanner returns measurements that may be inverted (1.0 = no black bars).
   * This method inverts them if needed: 1.0 → 0.0 (no black bars), 0.0 → 1.0 (full black bars).
   *
   * @param measurements - Measured black bar percentages (0-1) for each edge
   * @param videoStandard - User-selected video standard (PAL or NTSC)
   * @param manualVideoMode - User-selected video mode override ('auto' for automatic detection)
   * @returns Crop rectangle if stable match found or manual mode set, null otherwise
   */
  detectMode(
    measurements: EdgeDetectionMeasurements,
    videoStandard: 'PAL' | 'NTSC',
    manualVideoMode: 'auto' | 'PAL Standard' | 'PAL Open Border' | 'NTSC Standard' | 'NTSC Open Border' = 'auto'
  ): CropRect | null {
    // Step 1: If manual video mode is set (not 'auto'), use it directly
    if (manualVideoMode !== 'auto') {
      const manualMode = C64_VIDEO_MODE_PRESETS.find(preset => preset.name === manualVideoMode);

      if (manualMode) {
        // Only apply manual mode if it matches the current video standard
        if (manualMode.region === videoStandard) {
          const crop = this.convertToCropRect(manualMode);

          if (this.lastMatchedMode !== manualMode.name) {
            logInfo(LogType.Info, `VideoModeDetector: Manual Mode: ${manualMode.name}`);
            this.lastMatchedMode = manualMode.name;
          }

          return crop;
        } else {
          console.warn(`[VideoModeDetector] Manual mode ${manualVideoMode} doesn't match video standard ${videoStandard}, ignoring`);
        }
      }
    }

    // Step 2: Invert measurements if they're inverted (scanner may return 1.0 = no black bars)
    const avgMeasurement = (measurements.left + measurements.top + measurements.right + measurements.bottom) / 4;
    const normalizedMeasurements = avgMeasurement > 0.5 ? {
      left: 1 - measurements.left,
      top: 1 - measurements.top,
      right: 1 - measurements.right,
      bottom: 1 - measurements.bottom
    } : measurements;

    // Step 2: Check if we have sufficient black bars to warrant cropping
    if (!this.hasSufficientBars(normalizedMeasurements)) {
      // Not enough black bars - this is likely Open Border content
      // Reset history and return null to trigger Open Border fallback
      this.detectionHistory = [];
      return null;
    }

    // Step 3: Filter presets by video standard
    const presets = C64_VIDEO_MODE_PRESETS.filter(
      (mode) => mode.region === videoStandard
    );

    // Step 4: Find best matching preset
    const matchedMode = this.findBestMatchByPercentage(normalizedMeasurements, presets);

    if (!matchedMode) {
      // No preset matched within tolerance
      this.detectionHistory = [];
      return null;
    }

    // Step 5: Require temporal stability
    this.detectionHistory.push(matchedMode);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }

    // Check for stability
    if (this.hasStableMode()) {
      const crop = this.convertToCropRect(matchedMode);

      if (this.lastMatchedMode !== matchedMode.name) {
        logInfo(LogType.Info, `CrtRenderer: Mode: ${matchedMode.name}`);
        this.lastMatchedMode = matchedMode.name;
        this.detectionHistory = [];
      }

      return crop;
    }

    // Not stable yet

    return null;
  }

  /**
   * Find preset with crop percentages most similar to measured bar percentages.
   *
   * Uses **one-sided tolerance** matching:
   * - Standard mode: Matches when measurements are AT LEAST the preset values OR within 60% cumulative deficit
   * - No upper limit on border sizes (larger borders always match Standard)
   * - Falls back to Open Border when deficit exceeds 60%
   *
   * Note: Measurements are edge percentages (how much of edge is black).
   *       Preset cropPercent are crop amounts (how much to trim).
   *       These values should correlate: high edge percentage → significant crop needed.
   *
   * @param measurements - Measured black bar percentages
   * @param presets - Filtered list of presets (by video standard)
   * @returns Best matching preset (Standard or Open Border), or Open Border if Standard doesn't match
   */
  private findBestMatchByPercentage(
    measurements: EdgeDetectionMeasurements,
    presets: C64VideoMode[]
  ): C64VideoMode | null {
    const MAX_ACCEPTABLE_DEFICIT = 0.2; // Max 20% cumulative deficit (only when measurements < preset)

    // Find Standard and Open Border presets
    const standardPreset = presets.find(p => p.name.includes('Standard'));
    const openBorderPreset = presets.find(p => p.name.includes('Open Border'));

    if (!standardPreset || !openBorderPreset) {
      console.warn('[VideoModeDetector] Missing Standard or Open Border preset');
      return null;
    }

    // Calculate cumulative deficit (only count when measurement is SMALLER than preset)
    let cumulativeDeficit = 0;
    if (measurements.top < standardPreset.cropPercent.top) {
      cumulativeDeficit += standardPreset.cropPercent.top - measurements.top;
    }
    if (measurements.bottom < standardPreset.cropPercent.bottom) {
      cumulativeDeficit += standardPreset.cropPercent.bottom - measurements.bottom;
    }
    if (measurements.left < standardPreset.cropPercent.left) {
      cumulativeDeficit += standardPreset.cropPercent.left - measurements.left;
    }
    if (measurements.right < standardPreset.cropPercent.right) {
      cumulativeDeficit += standardPreset.cropPercent.right - measurements.right;
    }

    // Standard matches if deficit is within tolerance
    // (Larger borders than preset are always OK - one-sided tolerance)
    if (cumulativeDeficit <= MAX_ACCEPTABLE_DEFICIT) {
      return standardPreset;
    }

    // Fallback to Open Border when borders are too small
    return openBorderPreset;
  }

  /**
   * Check if measurements show sufficient black bars to warrant cropping.
   *
   * Requires at least 2 edges with >5% black pixels to avoid false positives.
   * SPECIAL CASE: Full screen content (all edges <1%) is also valid (Open Border mode).
   *
   * @param measurements - Measured black bar percentages
   * @returns True if sufficient bars detected or full screen
   */
  private hasSufficientBars(measurements: EdgeDetectionMeasurements): boolean {
    // Special case: Full screen (all edges < 1%) - valid Open Border mode
    const isFullScreen = measurements.left < 0.01 &&
                        measurements.top < 0.01 &&
                        measurements.right < 0.01 &&
                        measurements.bottom < 0.01;
    if (isFullScreen) {
      return true;
    }

    // Normal case: Need at least 2 edges with >5% black bars
    const THRESHOLD = 0.05; // 5% minimum black bar to warrant cropping

    const detectedCount = [
      measurements.left > THRESHOLD,
      measurements.top > THRESHOLD,
      measurements.right > THRESHOLD,
      measurements.bottom > THRESHOLD,
    ].filter(Boolean).length;

    return detectedCount >= 2;
  }

  /**
   * Check if detection history shows stable mode consensus.
   *
   * Requires majority (80%) of recent detections to agree on the same mode name.
   * Allows for 1 fluctuating frame out of 5, making it more robust to measurement noise.
   *
   * @returns True if history is full and majority entries match
   */
  private hasStableMode(): boolean {
    if (this.detectionHistory.length < this.HISTORY_SIZE) {
      return false;
    }

    // Count occurrences of each mode in history
    const modeCounts = new Map<string, number>();
    for (const mode of this.detectionHistory) {
      modeCounts.set(mode.name, (modeCounts.get(mode.name) || 0) + 1);
    }

    // Find the most common mode
    let maxCount = 0;
    for (const count of modeCounts.values()) {
      maxCount = Math.max(maxCount, count);
    }

    // Require majority (4 out of 5 = 80%)
    return maxCount >= 4;
  }

  /**
   * Convert preset crop percentages to normalized CropRect.
   *
   * Preset percentages define how much to CROP OUT (the black bars).
   * CropRect defines the CONTENT REGION to keep.
   *
   * @param mode - Matched video mode with crop percentages
   * @returns Crop rectangle in normalized 0-1 coordinates
   */
  private convertToCropRect(mode: C64VideoMode): CropRect {
    const { top, bottom, left, right } = mode.cropPercent;

    return {
      left: left, // Start content at this % from left
      top: top, // Start content at this % from top
      width: 1 - left - right, // Content width = 100% - left bar - right bar
      height: 1 - top - bottom, // Content height = 100% - top bar - bottom bar
    };
  }

  /**
   * Reset detection history.
   * Call this when video source changes or user changes video standard setting.
   */
  reset(): void {
    this.detectionHistory = [];
    this.lastMatchedMode = null;
  }

  /**
   * Get the current matched mode name (for debug visualization).
   *
   * @returns Current mode name, or null if no mode matched yet
   */
  getCurrentMode(): string | null {
    return this.lastMatchedMode;
  }
}
