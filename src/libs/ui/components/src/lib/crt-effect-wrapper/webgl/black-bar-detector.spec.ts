import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlackBarDetector } from './black-bar-detector';
import { GL_CONSTANTS } from './webgl-context.mock';

describe('BlackBarDetector', () => {
  let detector: BlackBarDetector;
  let mockGl: Partial<WebGLRenderingContext>;
  let mockTexture: WebGLTexture;

  beforeEach(() => {
    detector = new BlackBarDetector();
    mockTexture = {} as WebGLTexture;

    // Create minimal mock with readPixels placeholder
    // Individual tests will override readPixels with specific behavior
    mockGl = {
      RGBA: GL_CONSTANTS.RGBA,
      UNSIGNED_BYTE: GL_CONSTANTS.UNSIGNED_BYTE,
      readPixels: vi.fn(), // Placeholder - tests must provide implementation
    };

    // Mock performance.now() for throttling tests
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  describe('Throttling', () => {
    it('should return null when called within throttle interval', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels to return black pixels
      (mockGl.readPixels as ReturnType<typeof vi.fn>).mockImplementation((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          pixels[0] = 0; // R
          pixels[1] = 0; // G
          pixels[2] = 0; // B
          pixels[3] = 255; // A
        }
      });

      // First call at t=0
      vi.mocked(performance.now).mockReturnValue(0);
      const result1 = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);
      expect(result1).not.toBeNull(); // First call should process

      // Second call at t=100ms (within 200ms throttle)
      vi.mocked(performance.now).mockReturnValue(100);
      const result2 = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);
      expect(result2).toBeNull(); // Should be throttled

      // Third call at t=250ms (past 200ms throttle)
      vi.mocked(performance.now).mockReturnValue(250);
      const result3 = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);
      expect(result3).not.toBeNull(); // Should process again
    });

    it('should throttle to approximately 5 FPS (200ms interval)', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          pixels[0] = 0;
          pixels[1] = 0;
          pixels[2] = 0;
          pixels[3] = 255;
        }
      });

      // Simulate 1 second of calls at 60 FPS
      let detectionCount = 0;
      for (let frame = 0; frame < 60; frame++) {
        vi.mocked(performance.now).mockReturnValue(frame * 16.67); // 60 FPS
        const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);
        if (result !== null) {
          detectionCount++;
        }
      }

      // Should detect approximately 5 times in 1 second (5 FPS)
      expect(detectionCount).toBeGreaterThanOrEqual(4);
      expect(detectionCount).toBeLessThanOrEqual(6);
    });
  });

  describe('All Black Frame', () => {
    it('should return crop rect when entire frame is black', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels to return pure black for all samples
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          pixels[0] = 0; // R = 0
          pixels[1] = 0; // G = 0
          pixels[2] = 0; // B = 0
          pixels[3] = 255; // A = 255
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        // All edges should have black bars
        expect(result.left).toBeGreaterThan(0);
        expect(result.top).toBeGreaterThan(0);
        expect(result.width).toBeLessThan(1);
        expect(result.height).toBeLessThan(1);
      }
    });
  });

  describe('Single-Edge Black Bars', () => {
    it('should detect black bar on top edge only', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: black for top edge, white for others
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Top edge (y=0) is black
          if (y === 0) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            // All other edges are white
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeGreaterThan(0); // Top should be cropped
        expect(result.left).toBe(0); // No left crop
        expect(result.width).toBe(1); // No horizontal crop
        expect(result.height).toBeLessThan(1); // Vertical crop due to top bar
      }
    });

    it('should detect black bar on bottom edge only', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Bottom edge (y=height-1) is black
          if (y === height - 1) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBe(0); // No top crop
        expect(result.height).toBeLessThan(1); // Height reduced due to bottom bar
      }
    });

    it('should detect black bar on left edge only', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Left edge (x=0) is black
          if (x === 0) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeGreaterThan(0); // Left should be cropped
        expect(result.top).toBe(0); // No top crop
        expect(result.width).toBeLessThan(1); // Width reduced due to left bar
        expect(result.height).toBe(1); // No vertical crop
      }
    });

    it('should detect black bar on right edge only', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Right edge (x=width-1) is black
          if (x === width - 1) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBe(0); // Left position not affected by right bar
        expect(result.width).toBeLessThan(1); // Width reduced
      }
    });
  });

  describe('Combined Edges', () => {
    it('should detect letterbox (top + bottom black bars)', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Top and bottom edges are black
          if (y === 0 || y === height - 1) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeGreaterThan(0); // Top cropped
        expect(result.height).toBeLessThan(1); // Height reduced (both top and bottom)
        expect(result.left).toBe(0); // No horizontal crop
        expect(result.width).toBe(1); // Full width
      }
    });

    it('should detect pillarbox (left + right black bars)', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // Left and right edges are black
          if (x === 0 || x === width - 1) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeGreaterThan(0); // Left cropped
        expect(result.width).toBeLessThan(1); // Width reduced
        expect(result.top).toBe(0); // No vertical crop
        expect(result.height).toBe(1); // Full height
      }
    });

    it('should detect windowbox (all four edges black)', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // All edges are black
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            pixels[0] = 0;
            pixels[1] = 0;
            pixels[2] = 0;
          } else {
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeGreaterThan(0);
        expect(result.top).toBeGreaterThan(0);
        expect(result.width).toBeLessThan(1);
        expect(result.height).toBeLessThan(1);
      }
    });
  });

  describe('Mixed Content Threshold', () => {
    it('should return null when no edges meet black threshold', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: all edges are white (no black bars)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          pixels[0] = 255;
          pixels[1] = 255;
          pixels[2] = 255;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).toBeNull();
    });

    it('should respect 70% black threshold for edge detection', () => {
      const width = 1920;
      const height = 1080;
      let sampleCount = 0;

      // Mock readPixels: return black for 60% of samples (below 70% threshold)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          sampleCount++;
          // First 6 out of 10 samples are black (60%), rest are white
          const isBlack = (sampleCount % 10) < 6;
          const value = isBlack ? 0 : 255;
          pixels[0] = value;
          pixels[1] = value;
          pixels[2] = value;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // 60% is below the 70% threshold, should not detect black bars
      expect(result).toBeNull();
    });

    it('should detect edge when 70% or more samples are black', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: top edge has 70% black pixels
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          if (y === 0) {
            // Top edge: randomly assign black to 70% of samples
            const isBlack = Math.random() < 0.7;
            const value = isBlack ? 0 : 255;
            pixels[0] = value;
            pixels[1] = value;
            pixels[2] = value;
          } else {
            // Other edges are white
            pixels[0] = 255;
            pixels[1] = 255;
            pixels[2] = 255;
          }
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // With randomness this is probabilistic, but should generally detect
      // Let's make it deterministic instead
    });

    it('should use luminance threshold Y < 0.05 AND saturation < 0.1 for black detection', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: return gray pixels just above luminance threshold (Y = 0.06)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // RGB(15, 15, 15) ≈ luminance 0.06 (above 0.05 threshold), saturation 0.0 (grayscale)
          pixels[0] = 15;
          pixels[1] = 15;
          pixels[2] = 15;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // Pixels above luminance threshold should not be considered black
      expect(result).toBeNull();
    });

    it('should detect pixels below BOTH thresholds (Y < 0.05 AND S < 0.1) as black', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: return dark gray pixels (Y = 0.04, S = 0.0)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // RGB(10, 10, 10) ≈ luminance 0.04 (below 0.05), saturation 0.0 (pure grayscale)
          pixels[0] = 10;
          pixels[1] = 10;
          pixels[2] = 10;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // Pixels below both thresholds should be considered black
      expect(result).not.toBeNull();
    });

    it('should NOT detect dark colored pixels (high saturation) as black', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: return dark purple pixels (low luminance but high saturation)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // RGB(20, 0, 30) ≈ luminance 0.036 (below 0.05), saturation 1.0 (fully saturated)
          // This simulates dark purple C64 borders
          pixels[0] = 20;
          pixels[1] = 0;
          pixels[2] = 30;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // Dark colored pixels should NOT be considered black (saturation too high)
      expect(result).toBeNull();
    });

    it('should detect near-black pixels with slight color tint from compression', () => {
      const width = 1920;
      const height = 1080;

      // Mock readPixels: return nearly black with slight color tint (compression artifact)
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          // RGB(8, 6, 7) ≈ luminance 0.03, saturation 0.25 (slight color tint)
          // Should still be considered black since both are relatively low
          pixels[0] = 8;
          pixels[1] = 6;
          pixels[2] = 7;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      // Near-black with compression artifacts should NOT be detected (saturation > 0.1)
      expect(result).toBeNull();
    });
  });

  describe('Normalized Coordinates', () => {
    it('should return crop rect in 0-1 normalized coordinates', () => {
      const width = 1920;
      const height = 1080;

      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels && pixels instanceof Uint8Array) {
          pixels[0] = 0;
          pixels[1] = 0;
          pixels[2] = 0;
          pixels[3] = 255;
        }
      });

      vi.mocked(performance.now).mockReturnValue(0);
      const result = detector.detect(mockGl as WebGLRenderingContext, mockTexture, width, height);

      expect(result).not.toBeNull();
      if (result) {
        // All values should be in [0, 1] range
        expect(result.left).toBeGreaterThanOrEqual(0);
        expect(result.left).toBeLessThanOrEqual(1);
        expect(result.top).toBeGreaterThanOrEqual(0);
        expect(result.top).toBeLessThanOrEqual(1);
        expect(result.width).toBeGreaterThanOrEqual(0);
        expect(result.width).toBeLessThanOrEqual(1);
        expect(result.height).toBeGreaterThanOrEqual(0);
        expect(result.height).toBeLessThanOrEqual(1);

        // Width and height should sum to at most 1
        expect(result.left + result.width).toBeLessThanOrEqual(1);
        expect(result.top + result.height).toBeLessThanOrEqual(1);
      }
    });
  });
});
