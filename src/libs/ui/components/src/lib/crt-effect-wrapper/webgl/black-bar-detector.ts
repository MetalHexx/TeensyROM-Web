/**
 * Normalized crop rectangle in 0-1 coordinate space.
 *
 * Represents the visible content area after black bar detection.
 * All values are normalized to [0,1] where:
 * - (0,0) is top-left corner
 * - (1,1) is bottom-right corner
 *
 * @example
 * ```typescript
 * // Letterbox content (black bars on top/bottom)
 * const cropRect = {
 *   left: 0,
 *   top: 0.1,     // 10% black bar on top
 *   width: 1,
 *   height: 0.8    // 10% black bar on bottom
 * };
 * ```
 */
export interface CropRect {
  /** Left edge of visible content (0-1) */
  left: number;
  /** Top edge of visible content (0-1) */
  top: number;
  /** Width of visible content (0-1) */
  width: number;
  /** Height of visible content (0-1) */
  height: number;
}

/**
 * Luminance threshold for black pixel detection.
 *
 * Pixels must be below this luminance AND below saturation threshold to be considered "black".
 * Raised from 0.03 to 0.05 now that we have saturation checking to filter out dark colors.
 *
 * Range: 0.0 (pure black) to 1.0 (pure white)
 * Default: 0.05 (5% brightness threshold)
 */
const BLACK_LUMINANCE_THRESHOLD = 0.05;

/**
 * Saturation threshold for black pixel detection.
 *
 * True black bars are grayscale (zero saturation), while colored content has high saturation.
 * Pixels must be below BOTH luminance and saturation thresholds to be considered "black".
 *
 * This prevents dark colored content (like dark purple C64 borders) from being detected as black bars.
 *
 * Range: 0.0 (pure grayscale) to 1.0 (fully saturated color)
 * Default: 0.1 (10% saturation - allows slight color tint from compression artifacts)
 */
const BLACK_SATURATION_THRESHOLD = 0.1;

/**
 * Number of sample points to take along each edge.
 *
 * More samples = more accurate detection but higher performance cost.
 * 10 samples provides good balance between accuracy and performance.
 */
const SAMPLES_PER_EDGE = 10;

/**
 * Minimum interval between detection runs in milliseconds.
 *
 * Detection is throttled to avoid excessive WebGL readPixels calls.
 * 200ms = 5 FPS detection rate, smoothed by animation at 60 FPS.
 */
const DETECTION_INTERVAL_MS = 200;

/**
 * Percentage of edge samples that must be black to consider the edge as a black bar.
 *
 * Range: 0.0 to 1.0
 * Default: 0.7 (70% of samples must be black)
 */
const BLACK_EDGE_THRESHOLD = 0.7;

/**
 * Black bar detection engine for WebGL video content.
 *
 * Samples edge pixels from a WebGL texture to detect black borders,
 * then computes a normalized crop rectangle. Uses sparse sampling
 * (10 points per edge) and throttling (200ms interval) for performance.
 *
 * Detection algorithm:
 * 1. Read pixel data from edges using gl.readPixels()
 * 2. Convert RGB to luminance: Y = 0.299*R + 0.587*G + 0.114*B
 * 3. Convert RGB to HSV saturation: S = (max - min) / max
 * 4. Count pixels where BOTH luminance < 0.05 AND saturation < 0.1 (true black, not dark colors)
 * 5. If 70%+ of edge samples are black, consider it a black bar
 * 6. Calculate crop rectangle from detected bars
 *
 * @example
 * ```typescript
 * const detector = new BlackBarDetector();
 * const cropRect = detector.detect(gl, texture, 1920, 1080);
 *
 * if (cropRect) {
 *   // black bars detected — cropRect describes the crop region
 * } else {
 *   // no black bars detected
 * }
 * ```
 */
export class BlackBarDetector {
  private lastDetectionTime = -1; // Initialize to -1 to allow first call
  private pixelBuffer: Uint8Array | null = null;

  /**
   * Detect black bars in a WebGL texture and return a crop rectangle.
   *
   * This method is throttled to run at most once per DETECTION_INTERVAL_MS.
   * If called more frequently, it returns null to skip redundant work.
   *
   * @param gl WebGL rendering context
   * @param texture Source texture to analyze (must be currently bound)
   * @param width Texture width in pixels
   * @param height Texture height in pixels
   * @returns Normalized crop rectangle (0-1 coords) or null if no black bars detected
   */
  detect(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    width: number,
    height: number
  ): CropRect | null {
    const now = performance.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;

    if (this.lastDetectionTime >= 0 && timeSinceLastDetection < DETECTION_INTERVAL_MS) {
      return null;
    }
    this.lastDetectionTime = now;

    const bufferSize = Math.max(width, height) * 4;
    if (!this.pixelBuffer || this.pixelBuffer.length < bufferSize) {
      this.pixelBuffer = new Uint8Array(bufferSize);
    }

    const topBlackDepth = this.detectEdge(gl, width, height, 'top');
    const bottomBlackDepth = this.detectEdge(gl, width, height, 'bottom');
    const leftBlackDepth = this.detectEdge(gl, width, height, 'left');
    const rightBlackDepth = this.detectEdge(gl, width, height, 'right');

    if (
      topBlackDepth === 0 &&
      bottomBlackDepth === 0 &&
      leftBlackDepth === 0 &&
      rightBlackDepth === 0
    ) {
      return null;
    }

    const left = leftBlackDepth / width;
    const top = topBlackDepth / height;
    const right = rightBlackDepth / width;
    const bottom = bottomBlackDepth / height;

    return {
      left,
      top,
      width: 1 - left - right,
      height: 1 - top - bottom,
    };
  }

  /**
   * Sample pixels along one edge and detect black bar depth.
   *
   * Takes SAMPLES_PER_EDGE samples along the specified edge and counts
   * how many are below the black threshold. If 70%+ are black, calculates
   * the depth of the black bar in pixels.
   *
   * @param gl WebGL rendering context
   * @param width Texture width in pixels
   * @param height Texture height in pixels
   * @param edge Which edge to sample ('top' | 'bottom' | 'left' | 'right')
   * @returns Depth of black bar in pixels, or 0 if no black bar detected
   */
  private detectEdge(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    edge: 'top' | 'bottom' | 'left' | 'right'
  ): number {
    const samples = this.sampleEdge(gl, width, height, edge);
    const blackCount = samples.filter((sample) => sample.isBlack).length;

    if (blackCount / samples.length < BLACK_EDGE_THRESHOLD) {
      return 0;
    }

    return 8;
  }

  /**
   * Sample pixels along an edge and calculate luminance + saturation.
   *
   * Uses gl.readPixels() to read SAMPLES_PER_EDGE points along the specified edge,
   * converts RGB to luminance and HSV saturation, then determines if each pixel is "black".
   *
   * @param gl WebGL rendering context
   * @param width Texture width in pixels
   * @param height Texture height in pixels
   * @param edge Which edge to sample
   * @returns Array of PixelSample objects with luminance, saturation, and isBlack flag
   */
  private sampleEdge(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    edge: 'top' | 'bottom' | 'left' | 'right'
  ): PixelSample[] {
    const samples: PixelSample[] = [];

    for (let i = 0; i < SAMPLES_PER_EDGE; i++) {
      let x: number;
      let y: number;

      switch (edge) {
        case 'top':
          x = Math.floor((width * i) / SAMPLES_PER_EDGE);
          y = 0;
          break;
        case 'bottom':
          x = Math.floor((width * i) / SAMPLES_PER_EDGE);
          y = height - 1;
          break;
        case 'left':
          x = 0;
          y = Math.floor((height * i) / SAMPLES_PER_EDGE);
          break;
        case 'right':
          x = width - 1;
          y = Math.floor((height * i) / SAMPLES_PER_EDGE);
          break;
      }

      if (this.pixelBuffer) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

        const r = this.pixelBuffer[0] / 255;
        const g = this.pixelBuffer[1] / 255;
        const b = this.pixelBuffer[2] / 255;

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        const saturation = this.calculateSaturation(r, g, b);
        const isBlack =
          luminance < BLACK_LUMINANCE_THRESHOLD && saturation < BLACK_SATURATION_THRESHOLD;

        samples.push({ luminance, saturation, isBlack });
      }
    }

    return samples;
  }

  /**
   * Calculate HSV saturation from RGB values.
   *
   * Saturation measures the "colorfulness" of a pixel:
   * - 0.0 = pure grayscale (black/white/gray)
   * - 1.0 = fully saturated color
   *
   * Formula: S = (max - min) / max, where max and min are the largest and smallest RGB components.
   * Special case: If max = 0 (pure black), saturation is 0.
   *
   * @param r Red component [0,1]
   * @param g Green component [0,1]
   * @param b Blue component [0,1]
   * @returns Saturation value [0,1]
   */
  private calculateSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max === 0) {
      return 0;
    }

    return (max - min) / max;
  }
}

/**
 * Pixel sample data with luminance, saturation, and black detection flag.
 */
interface PixelSample {
  /** Luminance (brightness) value [0,1] */
  luminance: number;
  /** Saturation (colorfulness) value [0,1] */
  saturation: number;
  /** True if pixel is considered "black" (low luminance AND low saturation) */
  isBlack: boolean;
}
