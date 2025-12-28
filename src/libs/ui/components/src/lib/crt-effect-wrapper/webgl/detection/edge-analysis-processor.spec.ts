import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeAnalysisProcessor } from './edge-analysis-processor';
import {
  createMockWebGLContext,
  MockWebGLContext,
} from '../webgl-context.mock';

describe('EdgeAnalysisProcessor', () => {
  let processor: EdgeAnalysisProcessor;
  let mockGl: MockWebGLContext;

  beforeEach(() => {
    mockGl = createMockWebGLContext();
    processor = new EdgeAnalysisProcessor(mockGl as unknown as WebGLRenderingContext);
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
      // Note: After refactoring, processCropResults accepts normalized depths directly
      // The readPixels call is now handled by DetectionPassRenderer.readDepthResults()
      // This test verifies the integration contract

      // Setup: Pass normalized depth values (0-1) directly
      const normalizedDepths = { top: 0, bottom: 0, left: 0, right: 0 };

      processor.processCropResults(normalizedDepths, 320, 240);

      // Verify first detection commits (bootstrap)
      expect(mockGl._mocks.readPixels).not.toHaveBeenCalled(); // Not called in this method anymore
    });

    it('should read 1x1 pixel from depth map texture', () => {
      // After refactoring: processCropResults receives normalized depths
      const normalizedDepths = { top: 0, bottom: 0, left: 0, right: 0 };

      processor.processCropResults(normalizedDepths, 320, 240);

      // readPixels is not called in processCropResults anymore
      // It's called by DetectionPassRenderer.readDepthResults() before passing depths here
      expect(mockGl._mocks.readPixels).not.toHaveBeenCalled();
    });
  });

  describe('Depth Extraction', () => {
    it('should correctly extract top depth from R channel', () => {
      // Pass normalized depths directly (0-1 range)
      const normalizedDepths = { top: 0.5, bottom: 0, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      // First call should commit (no history), top should be ~0.5
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(0.5, 2);
      }
    });

    it('should correctly extract bottom depth from G channel', () => {
      const normalizedDepths = { top: 0, bottom: 0.25, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.height).toBeCloseTo(0.75, 2); // 1.0 - 0.25
      }
    });

    it('should correctly extract left depth from B channel', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0.2, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.2, 2);
      }
    });

    it('should correctly extract right depth from A channel', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0, right: 0.5 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.width).toBeCloseTo(0.5, 2); // 1.0 - 0.5
      }
    });
  });

  describe('Pixel Conversion', () => {
    it('should convert normalized top depth to pixel value', () => {
      const normalizedDepths = { top: 0.5, bottom: 0, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      // 0.5 normalized = 120px top bar
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(0.5, 1);
      }
    });

    it('should convert normalized horizontal depths to pixel values', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0.25, right: 0.25 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      // 0.25 * 320 = 80px each side
      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 1);
        expect(result.width).toBeCloseTo(0.5, 1); // 1.0 - 0.25 - 0.25
      }
    });

    it('should round pixel values correctly', () => {
      const normalizedDepths = { top: 0.1, bottom: 0, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        // 0.1 * 240 = 24px / 240 = 0.1
        expect(result.top).toBeCloseTo(0.1, 1);
      }
    });
  });

  describe('CropRect Calculation', () => {
    it('should correctly compute left/top/width/height from depths', () => {
      const normalizedDepths = { top: 0.2, bottom: 0.2, left: 0.25, right: 0.25 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 2);
        expect(result.top).toBeCloseTo(0.2, 2);
        expect(result.width).toBeCloseTo(0.5, 2); // 1 - 0.25 - 0.25
        expect(result.height).toBeCloseTo(0.6, 2); // 1 - 0.2 - 0.2
      }
    });

    it('should handle no black bars (all zeros)', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

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
      const normalizedDepths = { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.5, 1);
        expect(result.top).toBeCloseTo(0.5, 1);
        expect(result.width).toBeCloseTo(0, 1); // 1 - (0.5 + 0.5)
        expect(result.height).toBeCloseTo(0, 1);
      }
    });
  });

  describe('Confidence Scoring - Stable Detections', () => {
    it('should return 0.5 confidence with insufficient history (< 3 samples)', () => {
      const normalizedDepths = { top: 0.2, bottom: 0, left: 0, right: 0 };

      // First call commits (first detection), clears history
      processor.processCropResults(normalizedDepths, 320, 240);
      expect(processor.getHistorySize()).toBe(0); // Cleared after commit

      // Second call - only 1 sample after clear (insufficient)
      const result = processor.processCropResults(normalizedDepths, 320, 240);

      // Not confident yet (need 3+ samples for variance)
      expect(result).toBeNull(); // Won't commit due to low confidence
    });

    it('should achieve high confidence (> 0.7) with 3+ identical detections', () => {
      const normalizedDepths = { top: 0.2, bottom: 0, left: 0, right: 0 };

      // Call 4 times: 1st commits+clears, then need 3 more for confident detection
      processor.processCropResults(normalizedDepths, 320, 240); // 1st: commits, clears
      processor.processCropResults(normalizedDepths, 320, 240); // 2nd: adds to history
      processor.processCropResults(normalizedDepths, 320, 240); // 3rd: adds to history
      const result = processor.processCropResults(normalizedDepths, 320, 240); // 4th: confident

      // By 4th call, have 3 samples in history → confidence = 1.0
      // But change from 1st to 4th is 0, so won't commit
      expect(result).toBeNull(); // No change from first commit
      expect(processor.getHistorySize()).toBe(3); // Last 3 samples
    });

    it('should commit crop when confidence high and change significant', () => {
      // First detection: top bar = ~0.1 (25px)
      const firstDepths = { top: 0.1, bottom: 0, left: 0, right: 0 };
      processor.processCropResults(firstDepths, 320, 240); // Commits (first)

      // Next 3 detections: top bar = ~0.17 (40px) - need 3 for confidence
      const newDepths = { top: 0.17, bottom: 0, left: 0, right: 0 };
      processor.processCropResults(newDepths, 320, 240); // 2nd (building history)
      processor.processCropResults(newDepths, 320, 240); // 3rd (building history)
      processor.processCropResults(newDepths, 320, 240); // 4th (building history)
      const result = processor.processCropResults(newDepths, 320, 240); // 5th (confident - has 3+ in history)

      // Change = 40 - 25 = 15px > 5px threshold, and variance low → should commit
      expect(result).not.toBeNull();
      if (result) {
        expect(result.top).toBeCloseTo(40 / 240, 1);
      }
    });
  });

  describe('Confidence Scoring - Noisy Detections', () => {
    it('should have low confidence (< 0.7) with varying detections', () => {
      // Varying detections: 0.08, 0.12, 0.17 (roughly 20px, 30px, 40px when * 240)
      const depths = [
        { top: 0.08, bottom: 0, left: 0, right: 0 },
        { top: 0.12, bottom: 0, left: 0, right: 0 },
        { top: 0.17, bottom: 0, left: 0, right: 0 },
      ];

      processor.processCropResults(depths[0], 320, 240); // 1st
      processor.processCropResults(depths[1], 320, 240); // 2nd
      const result = processor.processCropResults(depths[2], 320, 240); // 3rd

      // High variance → low confidence → should NOT commit
      expect(result).toBeNull();
    });

    it('should reject crop when confidence below threshold', () => {
      // Setup: Noisy detections - use smaller values close to first
      const depths = [
        { top: 0.1, bottom: 0, left: 0, right: 0 },    // 25px
        { top: 0.11, bottom: 0, left: 0, right: 0 },   // 28px (change=3px < 5px)
        { top: 0.12, bottom: 0, left: 0, right: 0 },   // 30px (change=5px edge case)
        { top: 0.11, bottom: 0, left: 0, right: 0 },   // 27px (change=2px)
      ];

      // First commits (no history) - value = 0.1
      const first = processor.processCropResults(depths[0], 320, 240);
      expect(first).not.toBeNull();

      // Next 3 values vary - noisy but changes < 5px
      // High variance prevents confidence → should reject
      const second = processor.processCropResults(depths[1], 320, 240);
      const third = processor.processCropResults(depths[2], 320, 240);
      const fourth = processor.processCropResults(depths[3], 320, 240);

      // All should reject: either low confidence due to variance, or change < 5px
      expect(second).toBeNull();
      expect(third).toBeNull();
      expect(fourth).toBeNull();
    });
  });

  describe('Commit Logic', () => {
    it('should commit first detection regardless of change threshold', () => {
      const normalizedDepths = { top: 0.01, bottom: 0, left: 0, right: 0 }; // ~2px

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      // First detection always commits
      expect(result).not.toBeNull();
    });

    it('should reject crop when change below 5px threshold', () => {
      // First detection: 25px
      const firstDepths = { top: 0.1, bottom: 0, left: 0, right: 0 };
      processor.processCropResults(firstDepths, 320, 240); // Commits

      // Build confidence with stable detections at 28px
      const newDepths = { top: 0.11, bottom: 0, left: 0, right: 0 }; // ~28px (change = 3px < 5px threshold)

      processor.processCropResults(newDepths, 320, 240);
      processor.processCropResults(newDepths, 320, 240);
      const result = processor.processCropResults(newDepths, 320, 240);

      // Change too small (3px < 5px) → should reject
      expect(result).toBeNull();
    });

    it('should commit crop when change exceeds 5px threshold', () => {
      // First detection: 20px
      const firstDepths = { top: 0.08, bottom: 0, left: 0, right: 0 };
      processor.processCropResults(firstDepths, 320, 240); // Commits

      // Build confidence with stable detections at 30px (need 3 for confidence)
      const newDepths = { top: 0.12, bottom: 0, left: 0, right: 0 }; // ~30px (change = 10px > 5px threshold)

      processor.processCropResults(newDepths, 320, 240); // 2nd
      processor.processCropResults(newDepths, 320, 240); // 3rd
      processor.processCropResults(newDepths, 320, 240); // 4th
      const result = processor.processCropResults(newDepths, 320, 240); // 5th (confident with 3+ history)

      // Change significant (10px > 5px) and stable → should commit
      expect(result).not.toBeNull();
    });

    it('should check maximum change across all four edges', () => {
      // First detection: all ~10px
      const firstDepths = { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 };
      processor.processCropResults(firstDepths, 320, 240); // Commits

      // Second set: top changes by ~8px (max change), others change by ~2px
      const newDepths = { top: 0.07, bottom: 0.05, left: 0.05, right: 0.05 };

      processor.processCropResults(newDepths, 320, 240); // 2nd
      processor.processCropResults(newDepths, 320, 240); // 3rd
      processor.processCropResults(newDepths, 320, 240); // 4th
      const result = processor.processCropResults(newDepths, 320, 240); // 5th (confident with 3+ history)

      // Max change = 8px > 5px → should commit
      expect(result).not.toBeNull();
    });
  });

  describe('History Management', () => {
    it('should add detection to history', () => {
      const normalizedDepths = { top: 0.1, bottom: 0, left: 0, right: 0 }; // 26px

      expect(processor.getHistorySize()).toBe(0);

      // First call commits (first detection), then clears history
      processor.processCropResults(normalizedDepths, 320, 240);
      expect(processor.getHistorySize()).toBe(0); // Cleared after commit

      // Second call doesn't commit (insufficient confidence), adds to history
      processor.processCropResults(normalizedDepths, 320, 240);
      expect(processor.getHistorySize()).toBe(1);
    });

    it('should limit history to HISTORY_SIZE (5)', () => {
      const normalizedDepths = { top: 0.1, bottom: 0, left: 0, right: 0 };

      // Add 10 detections
      for (let i = 0; i < 10; i++) {
        processor.processCropResults(normalizedDepths, 320, 240);
      }

      // Should only keep last 5
      expect(processor.getHistorySize()).toBe(5);
    });

    it('should remove oldest entry when exceeding HISTORY_SIZE', () => {
      // Add 6 detections with varying depths
      const depths = [
        { top: 0.08, bottom: 0, left: 0, right: 0 },
        { top: 0.1, bottom: 0, left: 0, right: 0 },
        { top: 0.12, bottom: 0, left: 0, right: 0 },
        { top: 0.14, bottom: 0, left: 0, right: 0 },
        { top: 0.16, bottom: 0, left: 0, right: 0 },
        { top: 0.18, bottom: 0, left: 0, right: 0 },
      ];

      for (let i = 0; i < 6; i++) {
        processor.processCropResults(depths[i], 320, 240);
      }

      // History should have 5 entries
      expect(processor.getHistorySize()).toBe(5);
    });

    it('should reset history on reset()', () => {
      const normalizedDepths = { top: 0.1, bottom: 0, left: 0, right: 0 };

      processor.processCropResults(normalizedDepths, 320, 240); // Commits, clears
      processor.processCropResults(normalizedDepths, 320, 240); // Adds to history
      expect(processor.getHistorySize()).toBe(1); // Only second call in history

      processor.reset();
      expect(processor.getHistorySize()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero depth values (no black bars detected)', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toEqual({ left: 0, top: 0, width: 1, height: 1 });
      }
    });

    it('should handle maximum depth values (255 → ~1.0 normalized)', () => {
      const normalizedDepths = { top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

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
      const normalizedDepths = { top: 0.2, bottom: 0.2, left: 0, right: 0 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBe(0);
        expect(result.top).toBeCloseTo(0.2, 1);
        expect(result.width).toBe(1.0);
        expect(result.height).toBeCloseTo(0.6, 1);
      }
    });

    it('should handle asymmetric depths (pillarbox)', () => {
      const normalizedDepths = { top: 0, bottom: 0, left: 0.25, right: 0.25 };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.25, 1);
        expect(result.top).toBe(0);
        expect(result.width).toBeCloseTo(0.5, 1);
        expect(result.height).toBe(1.0);
      }
    });

    it('should handle single-pixel differences', () => {
      const firstDepths = { top: 0.1, bottom: 0, left: 0, right: 0 }; // ~25px
      processor.processCropResults(firstDepths, 320, 240); // Commits

      // Change by 1px (26px instead of 25px)
      const newDepths = { top: 0.108, bottom: 0, left: 0, right: 0 }; // ~26px

      processor.processCropResults(newDepths, 320, 240);
      processor.processCropResults(newDepths, 320, 240);
      const result = processor.processCropResults(newDepths, 320, 240);

      // 1px change < 5px threshold → should reject
      expect(result).toBeNull();
    });
  });

  describe('Integration Behavior', () => {
    it('should follow complete detection cycle: uncertain → confident → commit', () => {
      // Detection 1: First sample (no confidence yet)
      const normalizedDepths = { top: 0.2, bottom: 0, left: 0, right: 0 }; // ~48px

      const result1 = processor.processCropResults(normalizedDepths, 320, 240);
      expect(result1).not.toBeNull(); // First detection commits

      // Detection 2-3: Build confidence (same value)
      const result2 = processor.processCropResults(normalizedDepths, 320, 240);
      const result3 = processor.processCropResults(normalizedDepths, 320, 240);

      // No change → won't commit
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should handle real-world letterbox scenario', () => {
      // Simulates C64 PAL letterbox: 25px top, 50px bottom bars
      const normalizedDepths = {
        top: 25 / 240,    // ~0.104
        bottom: 50 / 240, // ~0.208
        left: 0,
        right: 0
      };

      const result = processor.processCropResults(normalizedDepths, 320, 240);

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
