import { computePulse, impliedTempo } from './pulse';
import type { Candidate } from './novelty';

describe('pulse analysis', () => {
  describe('computePulse', () => {
    it('returns none with null interval for empty candidate list', () => {
      const result = computePulse([]);
      expect(result.confidence).toBe('none');
      expect(result.dominantInterval).toBe(null);
      expect(result.histogram.length).toBe(0);
    });

    it('returns none with null interval for single candidate', () => {
      const result = computePulse([{ frame: 10, strength: 0.5, contributors: [] }]);
      expect(result.confidence).toBe('none');
      expect(result.dominantInterval).toBe(null);
    });

    it('detects regular intervals with strong confidence', () => {
      // Create candidates at regular 10-frame intervals: frames 0, 10, 20, 30, 40, 50
      const candidates: Candidate[] = [];
      for (let i = 0; i < 6; i++) {
        candidates.push({ frame: i * 10, strength: 0.8, contributors: [] });
      }
      const result = computePulse(candidates);

      expect(result.dominantInterval).toBe(10);
      expect(result.confidence).toBe('strong');
      // 5 intervals of 10 frames
      expect(result.histogram[10]).toBe(5);
    });

    it('detects irregular intervals with weak or none confidence', () => {
      // Irregular intervals: 5, 10, 15, 8, 20
      const candidates: Candidate[] = [
        { frame: 0, strength: 0.8, contributors: [] },
        { frame: 5, strength: 0.7, contributors: [] },
        { frame: 15, strength: 0.6, contributors: [] },
        { frame: 30, strength: 0.7, contributors: [] },
        { frame: 38, strength: 0.8, contributors: [] },
        { frame: 58, strength: 0.9, contributors: [] },
      ];
      const result = computePulse(candidates);

      expect(result.dominantInterval).not.toBeNull();
      // Irregular distribution should yield weak or none, not strong
      expect(['weak', 'none']).toContain(result.confidence);
    });

    it('respects maximum histogram interval cap', () => {
      // Create two candidates very far apart (beyond the cap)
      const candidates: Candidate[] = [
        { frame: 0, strength: 0.8, contributors: [] },
        { frame: 200, strength: 0.8, contributors: [] }, // Way beyond typical cap of ~100
      ];
      const result = computePulse(candidates);

      // The interval should not appear in the histogram
      expect(result.histogram[200]).toBeUndefined();
      // dominant interval should be null (out of range)
      expect(result.dominantInterval).toBe(null);
      expect(result.confidence).toBe('none');
    });

    it('builds histogram with correct counts', () => {
      // Intervals: 10, 10, 10, 5, 5
      const candidates: Candidate[] = [
        { frame: 0, strength: 0.8, contributors: [] },
        { frame: 10, strength: 0.8, contributors: [] },
        { frame: 20, strength: 0.8, contributors: [] },
        { frame: 30, strength: 0.8, contributors: [] },
        { frame: 35, strength: 0.8, contributors: [] },
        { frame: 40, strength: 0.8, contributors: [] },
      ];
      const result = computePulse(candidates);

      expect(result.histogram[10]).toBe(3);
      expect(result.histogram[5]).toBe(2);
      expect(result.dominantInterval).toBe(10);
    });

    it('returns weak confidence for a modest peak in broad distribution', () => {
      // Create a scenario with a modest peak:
      // intervals: 8 (×3), 9 (×1), 10 (×1), 7 (×1)
      const candidates: Candidate[] = [
        { frame: 0, strength: 0.8, contributors: [] },
        { frame: 8, strength: 0.8, contributors: [] },
        { frame: 16, strength: 0.8, contributors: [] },
        { frame: 24, strength: 0.8, contributors: [] },
        { frame: 32, strength: 0.8, contributors: [] },
        { frame: 41, strength: 0.8, contributors: [] },
        { frame: 50, strength: 0.8, contributors: [] },
        { frame: 57, strength: 0.8, contributors: [] },
      ];
      const result = computePulse(candidates);

      expect(result.dominantInterval).toBe(8);
      // Broad distribution (intervals scattered) should yield weak
      expect(['weak', 'none']).toContain(result.confidence);
    });

    it('handles candidates with very close frames', () => {
      const candidates: Candidate[] = [
        { frame: 0, strength: 0.8, contributors: [] },
        { frame: 1, strength: 0.8, contributors: [] },
        { frame: 2, strength: 0.8, contributors: [] },
      ];
      const result = computePulse(candidates);

      expect(result.histogram[1]).toBe(2);
      expect(result.dominantInterval).toBe(1);
    });

    it('ignores zero or negative intervals', () => {
      // This shouldn't happen in practice, but the code should handle it gracefully.
      // If frames somehow went backward, those intervals should be skipped.
      const candidates: Candidate[] = [
        { frame: 10, strength: 0.8, contributors: [] },
        { frame: 10, strength: 0.8, contributors: [] }, // same frame
        { frame: 20, strength: 0.8, contributors: [] },
      ];
      const result = computePulse(candidates);

      // The zero interval should not be counted (remains 0)
      expect(result.histogram[0]).toBe(0);
      // The only real interval is 10
      expect(result.dominantInterval).toBe(10);
      expect(result.histogram[10]).toBe(1);
    });
  });

  describe('impliedTempo', () => {
    it('returns null tempos for null dominant interval', () => {
      const result = impliedTempo(null, 19_950, 1, 1.0);
      expect(result.native).toBe(null);
      expect(result.sounding).toBe(null);
    });

    it('returns null tempos for zero interval', () => {
      const result = impliedTempo(0, 19_950, 1, 1.0);
      expect(result.native).toBe(null);
      expect(result.sounding).toBe(null);
    });

    it('converts frame interval to BPM at nominal PAL timing', () => {
      // At nominal PAL (19,950 µs/frame), an interval of 50 frames is 0.9975 seconds.
      // Tempo = 60 / 0.9975 ≈ 60.15 BPM
      const result = impliedTempo(50, 19_950, 1, 1.0);

      expect(result.native).toBeCloseTo(60.15, 0);
      expect(result.sounding).toBeCloseTo(60.15, 0); // no speed multiplier
    });

    it('accounts for playback speed multiplier', () => {
      // At 2x speed, the same interval sounds twice as fast (double the BPM).
      const native = impliedTempo(50, 19_950, 1, 1.0).native;
      const sounding = impliedTempo(50, 19_950, 1, 2.0).sounding;

      expect(native).not.toBeNull();
      expect(sounding).not.toBeNull();
      expect(sounding).toBeCloseTo((native ?? 0) * 2, 0);
    });

    it('accounts for multispeed (callsPerFrame > 1)', () => {
      // If callsPerFrame is 2, the effective interval is half as long, so BPM should double.
      const result1 = impliedTempo(50, 19_950, 1, 1.0);
      const result2 = impliedTempo(50, 19_950, 2, 1.0);

      expect(result1.native).not.toBeNull();
      expect(result2.native).not.toBeNull();
      expect(result2.native).toBeCloseTo((result1.native ?? 0) * 2, 0);
    });

    it('combines speed multiplier and multispeed correctly', () => {
      const result = impliedTempo(50, 19_950, 2, 2.0);

      // callsPerFrame=2 means native tempo is doubled.
      // speedMultiplier=2 means sounding is double the native.
      // So sounding = native * 2 * 2 = native * 4
      const naiveExpected = impliedTempo(50, 19_950, 1, 1.0).native;
      expect(naiveExpected).not.toBeNull();
      expect(result.native).toBeCloseTo((naiveExpected ?? 0) * 2, 0);
      expect(result.sounding).toBeCloseTo((naiveExpected ?? 0) * 4, 0);
    });

    it('handles very short intervals (high tempos)', () => {
      // 5 frames at nominal PAL = very high BPM
      const result = impliedTempo(5, 19_950, 1, 1.0);
      expect(result.native).toBeGreaterThan(600); // over 600 BPM
    });

    it('handles very long intervals (low tempos)', () => {
      // 200 frames = ~4 seconds = ~15 BPM
      const result = impliedTempo(200, 19_950, 1, 1.0);
      expect(result.native).toBeLessThan(30);
    });
  });
});
