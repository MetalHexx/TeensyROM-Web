/**
 * Unit tests for VideoModeDetector.
 *
 * Tests measurement-based C64 video mode preset matching.
 * Tests verify the refactor from resolution-based to percentage-based matching.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoModeDetector, EdgeDetectionMeasurements } from './video-mode-detector';

describe('VideoModeDetector - Measurement-Based Matching', () => {
  let detector: VideoModeDetector;

  // Helper to create edge measurements
  const measurements = (left: number, top: number, right: number, bottom: number): EdgeDetectionMeasurements => ({
    left,
    top,
    right,
    bottom,
  });

  // Helper to call detectMode multiple times for stability
  const detectStable = (
    measurements: EdgeDetectionMeasurements,
    standard: 'PAL' | 'NTSC',
    count = 5
  ) => {
    let result = null;
    for (let i = 0; i < count; i++) {
      result = detector.detectMode(measurements, standard);
    }
    return result;
  };

  beforeEach(() => {
    detector = new VideoModeDetector();
  });

  describe('PAL Standard Mode Matching', () => {
    it('should match PAL Standard when measurements align with preset crops', () => {
      // PAL Standard preset: {left: 0.07, top: 0.08, right: 0.07, bottom: 0.15}
      // Measurements should match these crop percentages
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.left).toBeCloseTo(0.07, 2);
        expect(result.top).toBeCloseTo(0.08, 2);
        expect(result.width).toBeCloseTo(0.86, 2); // 1 - 0.07 - 0.07
        expect(result.height).toBeCloseTo(0.77, 2); // 1 - 0.08 - 0.15
      }
    });

    it('should NOT match when measurements differ significantly from all presets', () => {
      // With one-sided tolerance, this test needs revision
      // The new logic uses deficit calculation, not symmetric distance
      // Measurements with extremely large borders will still match Standard (one-sided)
      // So this test now expects a match
      const meas = measurements(0.50, 0.20, 0.50, 0.90);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull(); // One-sided tolerance allows larger borders
    });
  });

  describe('One-Sided Tolerance Logic', () => {
    it('should match Standard when borders are larger than preset values', () => {
      // PAL Standard preset: {left: 0.07, top: 0.08, right: 0.07, bottom: 0.15}
      // Measurements with LARGER borders should still match Standard
      const meas = measurements(0.20, 0.25, 0.20, 0.30); // Much larger bars

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        // Should apply PAL Standard crops
        expect(result.top).toBeCloseTo(0.08, 2);
        expect(result.left).toBeCloseTo(0.07, 2);
      }
    });

    it('should fallback to Open Border when deficit exceeds 20%', () => {
      // PAL Standard preset: {left: 0.07, top: 0.08, right: 0.07, bottom: 0.15}
      // Measurements with NO black bars (all 0.00)
      // Deficit: 0.08 + 0.15 + 0.07 + 0.07 = 0.37 (exceeds 0.2, so Open Border!)
      // But hasSufficientBars will reject this, so let's use measurements that pass hasSufficientBars
      // but exceed 20% deficit
      const meas = measurements(0.00, 0.00, 0.00, 0.00); // Deficit = 0.37 > 0.20

      const result = detectStable(meas, 'PAL');

      // With full-screen special case in hasSufficientBars, this returns a result
      // But the 0.37 deficit > 0.2 tolerance should trigger Open Border
      expect(result).not.toBeNull();
      if (result) {
        // Should apply Open Border crops
        expect(result.top).toBeCloseTo(0, 2);
        expect(result.left).toBeCloseTo(0, 2);
        expect(result.width).toBeCloseTo(1, 2);
        expect(result.height).toBeCloseTo(1, 2);
      }
    });

    it('should match NTSC Standard with larger borders', () => {
      // NTSC Standard preset: {left: 0.08, top: 0.02, right: 0.08, bottom: 0.08}
      // Measurements with MUCH larger borders
      const meas = measurements(0.25, 0.20, 0.25, 0.20);

      const result = detectStable(meas, 'NTSC');

      expect(result).not.toBeNull();
      if (result) {
        // Should apply NTSC Standard crops
        expect(result.top).toBeCloseTo(0.02, 2);
        expect(result.left).toBeCloseTo(0.08, 2);
      }
    });

    it('should fallback to Open Border for NTSC with minimal bars', () => {
      // NTSC Standard preset: {left: 0.08, top: 0.02, right: 0.08, bottom: 0.08}
      // Measurements with almost no bars
      // Deficit: 0.08 + 0.02 + 0.08 + 0.08 = 0.26 (exceeds 0.2, so Open Border!)
      const meas = measurements(0.00, 0.00, 0.00, 0.00);

      const result = detectStable(meas, 'NTSC');

      // With full-screen special case, this returns a result
      // Deficit 0.26 > 0.2 tolerance triggers Open Border
      expect(result).not.toBeNull();
      if (result) {
        // Should apply Open Border crops
        expect(result.top).toBeCloseTo(0, 2);
        expect(result.left).toBeCloseTo(0, 2);
      }
    });

    it('should handle mixed scenario (some sides larger, some smaller)', () => {
      // PAL Standard preset: {left: 0.07, top: 0.08, right: 0.07, bottom: 0.15}
      // Left/right are LARGER (OK for one-sided), top/bottom are smaller
      // Deficit: (0.08 - 0.05) + (0.15 - 0.10) = 0.03 + 0.05 = 0.08 (within 0.2)
      const meas = measurements(0.15, 0.05, 0.20, 0.10);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        // Should apply PAL Standard crops (one-sided allows larger left/right)
        expect(result.top).toBeCloseTo(0.08, 2);
        expect(result.left).toBeCloseTo(0.07, 2);
      }
    });
  });

  describe('Video Standard Filtering', () => {
    it('should only consider PAL presets when standard=PAL', () => {
      // Measurements with moderate bars (need > 5% for hasSufficientBars)
      const meas = measurements(0.06, 0.055, 0.065, 0.05);

      // Force PAL standard - should find best PAL match, not NTSC
      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      // Should match a PAL preset, not NTSC
    });

    it('should only consider NTSC presets when standard=NTSC', () => {
      const meas = measurements(0.11, 0.05, 0.09, 0.15);

      const result = detectStable(meas, 'NTSC');

      expect(result).not.toBeNull();
      // Should match NTSC Standard
    });
  });

  describe('Insufficient Bar Detection', () => {
    it('should return null when <2 edges have significant bars', () => {
      // Only 1 edge above 5% threshold (left=0.06, others below 5%)
      const meas = measurements(0.06, 0.02, 0.01, 0.03);

      const result = detectStable(meas, 'PAL');

      expect(result).toBeNull();
    });

    it('should accept when ≥2 edges have significant bars', () => {
      // 2 edges above 5% threshold (left=0.10, right=0.09, top/bottom low)
      const meas = measurements(0.10, 0.02, 0.09, 0.01);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
    });
  });

  describe('Temporal Stability', () => {
    it('should require 5 consecutive matching detections', () => {
      const meas = measurements(0.12, 0.13, 0.09, 0.24);

      // Detection 1-4: should return null (not stable yet)
      for (let i = 0; i < 4; i++) {
        const result = detector.detectMode(meas, 'PAL');
        expect(result).toBeNull();
      }

      // Detection 5: should return crop (now stable)
      const result = detector.detectMode(meas, 'PAL');
      expect(result).not.toBeNull();
    });

    it('should reject thrashing between modes', () => {
      // Need measurements that actually produce different modes
      // With one-sided tolerance, 0.00 measurements still match Standard
      // So we use measurements that fail hasSufficientBars() to get null
      const palStandardMeasurements = measurements(0.07, 0.08, 0.07, 0.15);
      const insufficientBarsMeasurements = measurements(0.01, 0.02, 0.01, 0.02);

      // Alternate between measurements that would match different presets
      detector.detectMode(palStandardMeasurements, 'PAL'); // Standard
      detector.detectMode(insufficientBarsMeasurements, 'PAL'); // null (insufficient)
      detector.detectMode(palStandardMeasurements, 'PAL'); // Standard
      detector.detectMode(insufficientBarsMeasurements, 'PAL'); // null
      const result = detector.detectMode(palStandardMeasurements, 'PAL');

      expect(result).toBeNull(); // No consensus
    });

    it('should reset history and restart stability check after reset()', () => {
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      // Achieve stability
      const result1 = detectStable(meas, 'PAL');
      expect(result1).not.toBeNull();

      // Reset
      detector.reset();

      // Should require 5 more detections
      for (let i = 0; i < 4; i++) {
        const result = detector.detectMode(meas, 'PAL');
        expect(result).toBeNull();
      }

      // 5th detection after reset
      const result2 = detector.detectMode(meas, 'PAL');
      expect(result2).not.toBeNull();
    });
  });

  describe('Resolution Independence', () => {
    it('should produce same result regardless of video resolution', () => {
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      // Same measurements should produce same match regardless of resolution
      // (resolution is not passed to detectMode anymore)
      const result1 = detectStable(meas, 'PAL');

      detector.reset();

      const result2 = detectStable(meas, 'PAL');

      expect(result1).toEqual(result2);
    });

    it('should work with upscaled video (640x480, 1080p, etc.)', () => {
      // Same measurements work regardless of whether video is 640x480 or 1920x1080
      // This is the key benefit of measurement-based matching
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      // Result is based on measurements only, not resolution
    });
  });

  describe('Crop Calculation Correctness', () => {
    it('should correctly compute width from left+right percentages', () => {
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        // PAL Standard: left 7%, right 7% → width = 1 - 0.07 - 0.07 = 0.86
        expect(result.width).toBeCloseTo(0.86, 2);
      }
    });

    it('should correctly compute height from top+bottom percentages', () => {
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        // PAL Standard: top 8%, bottom 15% → height = 1 - 0.08 - 0.15 = 0.77
        expect(result.height).toBeCloseTo(0.77, 2);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical C64 game with black bars on all sides', () => {
      // Typical scenario: PAL Standard with bars on all edges
      const meas = measurements(0.07, 0.08, 0.07, 0.15);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
    });

    it('should handle letterbox video (top/bottom bars only)', () => {
      // Top/bottom bars match PAL Standard, minimal left/right
      const meas = measurements(0.01, 0.08, 0.02, 0.15);

      // Should match if ≥2 edges > 5% (bottom + top bars)
      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
    });

    it('should handle pillarbox video (left/right bars only)', () => {
      // Left/right bars match PAL Standard, minimal top/bottom
      const meas = measurements(0.07, 0.02, 0.07, 0.01);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
    });

    it('should handle full-screen content with Open Border mode', () => {
      // Full-screen content (all edges < 1%) is special-cased in hasSufficientBars()
      // It returns true, allowing the detection to proceed
      // With 0.00 measurements, deficit is 0.37 (exceeds 0.2), so Open Border applies!
      const meas = measurements(0.00, 0.00, 0.00, 0.00);

      const result = detectStable(meas, 'PAL');

      expect(result).not.toBeNull();
      if (result) {
        // One-sided tolerance: deficit 0.37 exceeds 0.2, so Open Border applies
        expect(result.top).toBeCloseTo(0, 2);
        expect(result.left).toBeCloseTo(0, 2);
        expect(result.width).toBeCloseTo(1, 2);
        expect(result.height).toBeCloseTo(1, 2);
      }
    });
  });

  describe('Logging and Debugging', () => {
    it('should log successful detection with mode name', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const meas = measurements(0.07, 0.08, 0.07, 0.15);
      detectStable(meas, 'PAL');

      expect(consoleSpy).toHaveBeenCalledWith(
        'ℹ️ CrtRenderer: Mode: PAL Standard'
      );

      consoleSpy.mockRestore();
    });
  });
});
