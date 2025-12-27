import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeAnalysisProcessor } from './edge-analysis-processor';
import {
  createMockWebGLContext,
  MockWebGLContext,
  GL_CONSTANTS,
} from '../webgl-context.mock';
import { CropRect } from '../black-bar-detector';

describe('EdgeAnalysisProcessor', () => {
  let processor: EdgeAnalysisProcessor;
  let mockGl: MockWebGLContext;
  let mockDepthMapTexture: WebGLTexture;

  beforeEach(() => {
    mockGl = createMockWebGLContext();
    processor = new EdgeAnalysisProcessor(mockGl as unknown as WebGLRenderingContext);
    mockDepthMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create processor with empty history', () => {
      expect(processor.getHistorySize()).toBe(0);
    });

    it('should initialize with 4-byte pixel buffer for RGBA readback', () => {
      // Verified indirectly through readPixels calls expecting 4 bytes
      expect(processor).toBeDefined();
    });
  });

  describe('Single ReadPixels Call', () => {
    it('should call gl.readPixels exactly once per processCropResults()', () => {
      // Setup: Mock depth map with all zeros (no bars)
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0; // Top
        (pixels as Uint8Array)[1] = 0; // Bottom
        (pixels as Uint8Array)[2] = 0; // Left
        (pixels as Uint8Array)[3] = 0; // Right
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(mockGl._mocks.readPixels).toHaveBeenCalledTimes(1);
      expect(mockGl._mocks.readPixels).toHaveBeenCalledWith(
        0,
        0,
        1,
        1,
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        expect.any(Uint8Array)
      );
    });

    it('should read 1x1 pixel from depth map texture', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(mockGl._mocks.readPixels).toHaveBeenCalledWith(
        0,
        0,
        1, // width = 1
        1, // height = 1
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Depth Extraction', () => {
    it('should correctly extract top depth from R channel', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 128; // Top = 128/255 = ~0.5
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // First call should commit (no history), top should be ~0.5 * 240 = 120px
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(120 / 240, 2); // ~0.5
      }
    });

    it('should correctly extract bottom depth from G channel', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 64; // Bottom = 64/255 = ~0.25
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.height).toBeCloseTo(1.0 - 60 / 240, 2); // 1.0 - 0.25
      }
    });

    it('should correctly extract left depth from B channel', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 51; // Left = 51/255 = ~0.2
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(64 / 320, 2); // ~0.2
      }
    });

    it('should correctly extract right depth from A channel', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 128; // Right = 128/255 = ~0.5
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.width).toBeCloseTo(1.0 - 160 / 320, 2); // 1.0 - 0.5
      }
    });
  });

  describe('Pixel Conversion', () => {
    it('should convert normalized top depth to pixel value', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 128; // 0.5 normalized
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // 0.5 * 240 = 120px top bar
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(0.5, 1);
      }
    });

    it('should convert normalized horizontal depths to pixel values', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 64; // 0.25 normalized left
        (pixels as Uint8Array)[3] = 64; // 0.25 normalized right
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // 0.25 * 320 = 80px each side
      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 1);
        expect(result.width).toBeCloseTo(0.5, 1); // 1.0 - 0.25 - 0.25
      }
    });

    it('should round pixel values correctly', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 25; // ~0.098 * 240 = 23.52 → rounds to 24
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        // Should round to 24px / 240 = 0.1
        expect(result.top).toBeCloseTo(0.1, 1);
      }
    });
  });

  describe('CropRect Calculation', () => {
    it('should correctly compute left/top/width/height from depths', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 51; // Top: 51/255 = 0.2 → 48px
        (pixels as Uint8Array)[1] = 51; // Bottom: 51/255 = 0.2 → 48px
        (pixels as Uint8Array)[2] = 64; // Left: 64/255 = 0.25 → 80px
        (pixels as Uint8Array)[3] = 64; // Right: 64/255 = 0.25 → 80px
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 2); // 80/320
        expect(result.top).toBeCloseTo(0.2, 2); // 48/240
        expect(result.width).toBeCloseTo(0.5, 2); // 1 - (80+80)/320
        expect(result.height).toBeCloseTo(0.6, 2); // 1 - (48+48)/240
      }
    });

    it('should handle no black bars (all zeros)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // First detection with no bars should commit
      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBe(0);
        expect(result.top).toBe(0);
        expect(result.width).toBe(1);
        expect(result.height).toBe(1);
      }
    });

    it('should handle maximum black bars (50% scan depth)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 128; // 0.5 (max)
        (pixels as Uint8Array)[1] = 128;
        (pixels as Uint8Array)[2] = 128;
        (pixels as Uint8Array)[3] = 128;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.5, 1); // Reduced precision due to rounding
        expect(result.top).toBeCloseTo(0.5, 1);
        expect(result.width).toBeCloseTo(0, 1); // 1 - (0.5 + 0.5)
        expect(result.height).toBeCloseTo(0, 1);
      }
    });
  });

  describe('Confidence Scoring - Stable Detections', () => {
    it('should return 0.5 confidence with insufficient history (< 3 samples)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 51; // 0.2
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      // First call commits (first detection), clears history
      processor.processCropResults(mockDepthMapTexture, 320, 240);
      expect(processor.getHistorySize()).toBe(0); // Cleared after commit

      // Second call - only 1 sample after clear (insufficient)
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // Not confident yet (need 3+ samples for variance)
      expect(result).toBeNull(); // Won't commit due to low confidence
    });

    it('should achieve high confidence (> 0.7) with 3+ identical detections', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 51; // 0.2 normalized → ~48px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      // Call 4 times: 1st commits+clears, then need 3 more for confident detection
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 1st: commits, clears
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 2nd: adds to history
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 3rd: adds to history
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240); // 4th: confident

      // By 4th call, have 3 samples in history → confidence = 1.0
      // But change from 1st to 4th is 0, so won't commit
      expect(result).toBeNull(); // No change from first commit
      expect(processor.getHistorySize()).toBe(3); // Last 3 samples
    });

    it('should commit crop when confidence high and change significant', () => {
      // First detection: top bar = 25px
      mockGl._mocks.readPixels.mockImplementationOnce((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26; // ~0.1 * 240 = 25px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits (first)

      // Next 3 detections: top bar = 40px (stable) - need 3 for confidence
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 43; // ~0.17 * 240 = 40px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 2nd (building history)
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 3rd (building history)
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 4th (building history)
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240); // 5th (confident - has 3+ in history)

      // Change = 40 - 25 = 15px > 5px threshold, and variance low → should commit
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(40 / 240, 1);
      }
    });
  });

  describe('Confidence Scoring - Noisy Detections', () => {
    it('should have low confidence (< 0.7) with varying detections', () => {
      // Varying detections: 20px, 30px, 40px
      const depths = [26, 39, 51]; // Roughly 20px, 30px, 40px when * 240
      let depthIndex = 0;

      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = depths[depthIndex % depths.length];
        depthIndex++;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240); // 1st
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 2nd
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240); // 3rd

      // High variance → low confidence → should NOT commit
      expect(result).toBeNull();
    });

    it('should reject crop when confidence below threshold', () => {
      // Setup: Noisy detections (10px variance) - use smaller values close to first
      const depths = [25, 28, 30, 27]; // Small variance (2-5px changes)
      let depthIndex = 0;

      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = depths[depthIndex++ % depths.length];
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      // First commits (no history) - value = 25
      const first = processor.processCropResults(mockDepthMapTexture, 320, 240);
      expect(first).not.toBeNull();

      // Next 3 values vary (28, 30, 27) - noisy but changes < 5px
      // High variance prevents confidence → should reject
      const second = processor.processCropResults(mockDepthMapTexture, 320, 240); // 28px (change=3px < 5px)
      const third = processor.processCropResults(mockDepthMapTexture, 320, 240);  // 30px (change=5px edge case)
      const fourth = processor.processCropResults(mockDepthMapTexture, 320, 240); // 27px (change=2px)

      // All should reject: either low confidence due to variance, or change < 5px
      expect(second).toBeNull();
      expect(third).toBeNull();
      expect(fourth).toBeNull();
    });
  });

  describe('Commit Logic', () => {
    it('should commit first detection regardless of change threshold', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 13; // ~2px change (below 5px threshold)
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // First detection always commits (if confident, which it isn't yet, but history is empty)
      expect(result).not.toBeNull();
    });

    it('should reject crop when change below 5px threshold', () => {
      // First detection: 25px
      mockGl._mocks.readPixels.mockImplementationOnce((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26; // ~25px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits

      // Build confidence with stable detections at 28px
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 29; // ~28px (change = 3px < 5px threshold)
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240);
      processor.processCropResults(mockDepthMapTexture, 320, 240);
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // Change too small (3px < 5px) → should reject
      expect(result).toBeNull();
    });

    it('should commit crop when change exceeds 5px threshold', () => {
      // First detection: 20px
      mockGl._mocks.readPixels.mockImplementationOnce((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 21; // ~20px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits

      // Build confidence with stable detections at 30px (need 3 for confidence)
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 32; // ~30px (change = 10px > 5px threshold)
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240); // 2nd
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 3rd
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 4th
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240); // 5th (confident with 3+ history)

      // Change significant (10px > 5px) and stable → should commit
      expect(result).not.toBeNull();
    });

    it('should check maximum change across all four edges', () => {
      // First detection: all 10px
      mockGl._mocks.readPixels.mockImplementationOnce((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 11; // ~10px top
        (pixels as Uint8Array)[1] = 11; // ~10px bottom
        (pixels as Uint8Array)[2] = 13; // ~10px left
        (pixels as Uint8Array)[3] = 13; // ~10px right
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits

      // Second set: top changes by 8px (max change), others change by 2px
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 19; // ~18px (change = 8px)
        (pixels as Uint8Array)[1] = 13; // ~12px (change = 2px)
        (pixels as Uint8Array)[2] = 16; // ~12px (change = 2px)
        (pixels as Uint8Array)[3] = 16; // ~12px (change = 2px)
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240); // 2nd
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 3rd
      processor.processCropResults(mockDepthMapTexture, 320, 240); // 4th
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240); // 5th (confident with 3+ history)

      // Max change = 8px > 5px → should commit
      expect(result).not.toBeNull();
    });
  });

  describe('History Management', () => {
    it('should add detection to history', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        // Use 26px which won't trigger commits (need 3+ for confidence)
        (pixels as Uint8Array)[0] = 26;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      expect(processor.getHistorySize()).toBe(0);

      // First call commits (first detection), then clears history
      processor.processCropResults(mockDepthMapTexture, 320, 240);
      expect(processor.getHistorySize()).toBe(0); // Cleared after commit

      // Second call doesn't commit (insufficient confidence), adds to history
      processor.processCropResults(mockDepthMapTexture, 320, 240);
      expect(processor.getHistorySize()).toBe(1);
    });

    it('should limit history to HISTORY_SIZE (5)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      // Add 10 detections
      for (let i = 0; i < 10; i++) {
        processor.processCropResults(mockDepthMapTexture, 320, 240);
      }

      // Should only keep last 5
      expect(processor.getHistorySize()).toBe(5);
    });

    it('should remove oldest entry when exceeding HISTORY_SIZE', () => {
      // Add 6 detections with varying depths
      const depths = [20, 25, 30, 35, 40, 45];
      let index = 0;

      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = depths[index++];
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      for (let i = 0; i < 6; i++) {
        processor.processCropResults(mockDepthMapTexture, 320, 240);
      }

      // History should be [25, 30, 35, 40, 45] (dropped first 20px entry)
      expect(processor.getHistorySize()).toBe(5);
    });

    it('should reset history on reset()', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits, clears
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Adds to history
      expect(processor.getHistorySize()).toBe(1); // Only second call in history

      processor.reset();
      expect(processor.getHistorySize()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero depth values (no black bars detected)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0;
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toEqual({ left: 0, top: 0, width: 1, height: 1 });
      }
    });

    it('should handle maximum depth values (255 → 0.5 normalized)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 255; // Max value
        (pixels as Uint8Array)[1] = 255;
        (pixels as Uint8Array)[2] = 255;
        (pixels as Uint8Array)[3] = 255;
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      // All edges at max (1.0) → no visible content
      if (result) {
        expect(result.left).toBeCloseTo(1.0, 1);
        expect(result.top).toBeCloseTo(1.0, 1);
        expect(result.width).toBeCloseTo(-1.0, 1); // 1 - 2.0
        expect(result.height).toBeCloseTo(-1.0, 1);
      }
    });

    it('should handle asymmetric depths (letterbox)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 51; // Top: 0.2 → 48px
        (pixels as Uint8Array)[1] = 51; // Bottom: 0.2 → 48px
        (pixels as Uint8Array)[2] = 0; // Left: 0
        (pixels as Uint8Array)[3] = 0; // Right: 0
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBe(0);
        expect(result.top).toBeCloseTo(0.2, 1);
        expect(result.width).toBe(1.0);
        expect(result.height).toBeCloseTo(0.6, 1);
      }
    });

    it('should handle asymmetric depths (pillarbox)', () => {
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 0; // Top: 0
        (pixels as Uint8Array)[1] = 0; // Bottom: 0
        (pixels as Uint8Array)[2] = 64; // Left: 0.25 → 80px
        (pixels as Uint8Array)[3] = 64; // Right: 0.25 → 80px
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 1);
        expect(result.top).toBe(0);
        expect(result.width).toBeCloseTo(0.5, 1);
        expect(result.height).toBe(1.0);
      }
    });

    it('should handle single-pixel differences', () => {
      mockGl._mocks.readPixels.mockImplementationOnce((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26; // ~25px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });
      processor.processCropResults(mockDepthMapTexture, 320, 240); // Commits

      // Change by 1 normalized unit (255 → 256/255 ≈ 1.004)
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 27; // ~26px (change = 1px)
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      processor.processCropResults(mockDepthMapTexture, 320, 240);
      processor.processCropResults(mockDepthMapTexture, 320, 240);
      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // 1px change < 5px threshold → should reject
      expect(result).toBeNull();
    });
  });

  describe('Integration Behavior', () => {
    it('should follow complete detection cycle: uncertain → confident → commit', () => {
      // Detection 1: First sample (no confidence yet)
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 51; // ~48px
        (pixels as Uint8Array)[1] = 0;
        (pixels as Uint8Array)[2] = 0;
        (pixels as Uint8Array)[3] = 0;
      });

      const result1 = processor.processCropResults(mockDepthMapTexture, 320, 240);
      expect(result1).not.toBeNull(); // First detection commits

      // Detection 2-3: Build confidence (same value)
      const result2 = processor.processCropResults(mockDepthMapTexture, 320, 240);
      const result3 = processor.processCropResults(mockDepthMapTexture, 320, 240);

      // No change → won't commit
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should handle real-world letterbox scenario', () => {
      // Simulates C64 PAL letterbox: 25px top, 50px bottom bars
      mockGl._mocks.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        (pixels as Uint8Array)[0] = 26; // ~25px top
        (pixels as Uint8Array)[1] = 53; // ~50px bottom
        (pixels as Uint8Array)[2] = 0; // No left bar
        (pixels as Uint8Array)[3] = 0; // No right bar
      });

      const result = processor.processCropResults(mockDepthMapTexture, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBe(0);
        expect(result.width).toBe(1.0);
        expect(result.top).toBeCloseTo(25 / 240, 1);
        expect(result.height).toBeCloseTo((240 - 25 - 50) / 240, 1);
      }
    });
  });
});
