import { CropRect } from '../black-bar-detector';

/**
 * Detection history entry for temporal stability tracking.
 */
interface DetectionHistory {
  /** Pixel depths from GPU detection */
  depths: { top: number; bottom: number; left: number; right: number };
  /** Timestamp when this detection occurred */
  timestamp: number;
  /** Confidence score (0-1) for this detection */
  confidence: number;
}

/**
 * GPU detection results processor with confidence scoring.
 *
 * Reads depth map texture via a single gl.readPixels() call (vs Phase 1's 40+ calls),
 * converts normalized GPU depths to pixel values, and applies temporal stability
 * analysis to prevent thrashing from noisy detection results.
 *
 * The confidence scoring system tracks detection stability across multiple frames:
 * - Consistent detections increase confidence (→ crop committed)
 * - Varying detections decrease confidence (→ crop rejected to prevent jitter)
 *
 * Only commits crops when:
 * 1. Confidence > 0.7 (3+ frames of stable detection)
 * 2. Change > 5px vs last committed crop (avoids micro-adjustments)
 *
 * Task 01.1-003: Integrates GPU detection (Tasks 01.1-001, 01.1-002) with existing
 * CropAnimator to complete the Phase 1.1 pipeline.
 *
 * @example
 * ```typescript
 * const processor = new EdgeAnalysisProcessor(gl);
 *
 * // Every 200ms (detection throttle)
 * const cropRect = processor.processCropResults(
 *   depthMapTexture,
 *   320,  // videoWidth
 *   240   // videoHeight
 * );
 *
 * if (cropRect) {
 *   // High confidence + significant change
 *   cropAnimator.setTarget(cropRect);
 * }
 * ```
 */
export class EdgeAnalysisProcessor {
  private gl: WebGLRenderingContext;
  private pixelBuffer = new Uint8Array(4); // Single pixel RGBA readback
  private history: DetectionHistory[] = [];

  /**
   * Last crop that was actually committed (vs all detections in history).
   * Used to calculate change significance for future detections.
   */
  private lastCommittedDepths: { top: number; bottom: number; left: number; right: number } | null =
    null;

  /**
   * Number of recent detections to track for confidence scoring.
   * Higher values = more stable but slower to adapt to changes.
   */
  private readonly HISTORY_SIZE = 5;

  /**
   * Minimum confidence required to commit a crop (0-1).
   * Requires 3+ frames of stable detection to exceed threshold.
   */
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Minimum change in pixels required to commit a new crop.
   * Prevents micro-adjustments that would be imperceptible to users.
   */
  private readonly MIN_CHANGE_THRESHOLD_PX = 5;

  /**
   * Creates a new edge analysis processor.
   *
   * @param gl - WebGL rendering context
   */
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Read depth map texture and compute crop rectangle with confidence scoring.
   *
   * Performs single gl.readPixels() call to read 1x1 depth map texture containing
   * all 4 depth values (top/bottom/left/right) in RGBA channels.
   *
   * Process:
   * 1. Read depth map (single readPixels call)
   * 2. Convert normalized depths (0-1) to pixel values
   * 3. Calculate confidence score based on temporal stability
   * 4. Add to history for future confidence calculations
   * 5. Commit crop only if confident and change is significant
   *
   * @param normalizedDepths - Normalized depth values (0-1) from DetectionPassRenderer.readDepthResults()
   * @param videoWidth - Video width in pixels
   * @param videoHeight - Video height in pixels
   * @returns CropRect if confident and significant change, null otherwise
   */
  processCropResults(
    normalizedDepths: { top: number; bottom: number; left: number; right: number },
    videoWidth: number,
    videoHeight: number
  ): CropRect | null {
    // Step 1: Convert normalized depths (0-1) to pixel values
    const pixelDepths = {
      top: Math.round(normalizedDepths.top * videoHeight),
      bottom: Math.round(normalizedDepths.bottom * videoHeight),
      left: Math.round(normalizedDepths.left * videoWidth),
      right: Math.round(normalizedDepths.right * videoWidth),
    };
    
    // Step 2: Calculate confidence score (from existing history, before adding current)
    const confidence = this.calculateConfidence(pixelDepths);

    // Step 4: Add to history (all detections, whether committed or not)
    this.addToHistory({
      depths: pixelDepths,
      timestamp: performance.now(),
      confidence,
    });

    // Step 5: Check if should commit
    const shouldCommit = this.shouldCommitCrop(pixelDepths, confidence);


    // Step 6: Commit if criteria met
    if (shouldCommit) {
      // Track this as the last committed crop for future change comparisons
      this.lastCommittedDepths = { ...pixelDepths };
      
      // Clear history after commit to start fresh
      // (next detections will build new confidence without old values)
      this.history = [];
      
      return this.createCropRect(pixelDepths, videoWidth, videoHeight);
    }

    return null; // Not confident enough or insignificant change
  }

  /**
   * Single readPixels call to read entire depth map (1x1 texture, 4 channels).
   *
   * Reads from the currently bound framebuffer (DetectionPassRenderer binds depth map FBO).
   * Depth map texture encoding:
   * - R channel: Top bar depth (0-1 normalized)
   * - G channel: Bottom bar depth (0-1 normalized)
   * - B channel: Left bar depth (0-1 normalized)
   * - A channel: Right bar depth (0-1 normalized)
   *
   * @param depthMapTexture - Depth map texture to read from (currently unused, reads from bound FBO)
   * @returns Normalized depth values (0-1) for each edge
   */
  private readDepthMap(
    depthMapTexture: WebGLTexture
  ): { top: number; bottom: number; left: number; right: number } {
    const gl = this.gl;

    // Note: DetectionPassRenderer.readDepthResults() already handles FBO binding
    // For this implementation, we'll use that method directly rather than duplicating logic
    // This is a design decision to avoid redundant FBO binding/unbinding

    // Read 1x1 pixel at (0,0) containing all depth results
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

    // Extract depths from buffer (0-255 → 0-1)
    return {
      top: this.pixelBuffer[0] / 255.0,
      bottom: this.pixelBuffer[1] / 255.0,
      left: this.pixelBuffer[2] / 255.0,
      right: this.pixelBuffer[3] / 255.0,
    };
  }

  /**
   * Calculate confidence score based on temporal stability.
   *
   * Confidence is computed from variance between current detection and recent history:
   * - Low variance (stable detections) → high confidence
   * - High variance (noisy detections) → low confidence
   *
   * Algorithm:
   * 1. Compute average depths from last 3 history entries
   * 2. Calculate variance: Σ((current - avg)²) for each edge
   * 3. Convert to confidence: 1.0 - (variance / maxVariance)
   *
   * Requires at least 3 samples in history; returns 0.5 if insufficient history.
   *
   * @param currentDepths - Current detected depths (NOT yet in history)
   * @returns Confidence score (0-1) where 1.0 = perfectly stable
   */
  private calculateConfidence(currentDepths: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }): number {
    if (this.history.length < 3) {
      // Need 3+ samples for variance calculation
      return 0.5;
    }

    // Get last 3 history entries (NOT including current)
    const recentHistory = this.history.slice(-3);

    // Compute average depths from these 3 samples
    const avgDepths = {
      top: recentHistory.reduce((sum, h) => sum + h.depths.top, 0) / 3,
      bottom: recentHistory.reduce((sum, h) => sum + h.depths.bottom, 0) / 3,
      left: recentHistory.reduce((sum, h) => sum + h.depths.left, 0) / 3,
      right: recentHistory.reduce((sum, h) => sum + h.depths.right, 0) / 3,
    };

    // Calculate variance: how much does CURRENT differ from average of last 3?
    const variance =
      Math.pow(currentDepths.top - avgDepths.top, 2) +
      Math.pow(currentDepths.bottom - avgDepths.bottom, 2) +
      Math.pow(currentDepths.left - avgDepths.left, 2) +
      Math.pow(currentDepths.right - avgDepths.right, 2);

    // Convert to confidence: low variance = high confidence
    // Max variance: 4 edges × (8px deviation)² = 256px²
    const maxVariance = 256;
    const confidence = 1.0 - Math.min(variance / maxVariance, 1.0);

    return confidence;
  }

  /**
   * Decide if crop should be committed based on confidence and change significance.
   *
   * Commit criteria:
   * 1. First detection always commits (bootstrap the system)
   * 2. Subsequent detections require:
   *    a. Confidence must exceed threshold (0.7) → stable detection
   *    b. Change must be significant (> 5px) vs last COMMITTED crop → avoid micro-adjustments
   *
   * @param depths - Current detected depths in pixels
   * @param confidence - Confidence score for current detection
   * @returns true if crop should be committed, false otherwise
   */
  private shouldCommitCrop(
    depths: { top: number; bottom: number; left: number; right: number },
    confidence: number
  ): boolean {
    // First detection always commits (bootstrap the system)
    if (this.lastCommittedDepths === null) {
      return true;
    }

    // Must have high confidence for subsequent detections
    if (confidence < this.CONFIDENCE_THRESHOLD) {
      return false;
    }

    // Check if change is significant vs last COMMITTED crop (not last detection)
    const maxChange = Math.max(
      Math.abs(depths.top - this.lastCommittedDepths.top),
      Math.abs(depths.bottom - this.lastCommittedDepths.bottom),
      Math.abs(depths.left - this.lastCommittedDepths.left),
      Math.abs(depths.right - this.lastCommittedDepths.right)
    );

    return maxChange >= this.MIN_CHANGE_THRESHOLD_PX;
  }

  /**
   * Convert pixel depths to normalized CropRect.
   *
   * Crop rectangle defines the visible content area after removing black bars:
   * - left: Distance from left edge to content start (0-1)
   * - top: Distance from top edge to content start (0-1)
   * - width: Width of visible content (0-1)
   * - height: Height of visible content (0-1)
   *
   * @param depths - Black bar depths in pixels
   * @param videoWidth - Video width in pixels
   * @param videoHeight - Video height in pixels
   * @returns Normalized crop rectangle
   */
  private createCropRect(
    depths: { top: number; bottom: number; left: number; right: number },
    videoWidth: number,
    videoHeight: number
  ): CropRect {
    return {
      left: depths.left / videoWidth,
      top: depths.top / videoHeight,
      width: 1.0 - (depths.left + depths.right) / videoWidth,
      height: 1.0 - (depths.top + depths.bottom) / videoHeight,
    };
  }

  /**
   * Add detection entry to history.
   *
   * Maintains a sliding window of the most recent HISTORY_SIZE detections.
   * Oldest entries are removed when limit is exceeded.
   *
   * @param entry - Detection history entry to add
   */
  private addToHistory(entry: DetectionHistory): void {
    this.history.push(entry);
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift(); // Remove oldest
    }
  }

  /**
   * Reset history state and last committed depths.
   *
   * Clears all detection history and committed crop tracking. Useful when feature
   * is toggled off/on or when switching video sources.
   */
  reset(): void {
    this.history = [];
    this.lastCommittedDepths = null;
  }

  /**
   * Get current history size for debugging/testing.
   *
   * @returns Number of detection entries in history
   */
  getHistorySize(): number {
    return this.history.length;
  }
}
