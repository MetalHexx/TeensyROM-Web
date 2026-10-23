import { describe, it, expect } from 'vitest';
import { KEY_SEMITONE_RANGE, voicePitchMultiplier } from './pitch';

describe('voicePitchMultiplier', () => {
  it('is exactly 1 at home, which is what lets the library bypass the voice', () => {
    expect(voicePitchMultiplier(0, 0, 0)).toBe(1);
  });

  it('is 2^(key / 12) for Key alone, the multiplier Key has always been', () => {
    for (let key = -KEY_SEMITONE_RANGE; key <= KEY_SEMITONE_RANGE; key++) {
      expect(voicePitchMultiplier(key, 0, 0)).toBe(2 ** (key / 12));
    }
    expect(voicePitchMultiplier(12, 0, 0)).toBe(2);
    expect(voicePitchMultiplier(-12, 0, 0)).toBe(0.5);
  });

  it('composes Key, Coarse and Fine as one sum of semitones', () => {
    expect(voicePitchMultiplier(3, 4, 50)).toBeCloseTo(2 ** (7.5 / 12), 12);
    expect(voicePitchMultiplier(-5, 5, 0)).toBe(1);
    expect(voicePitchMultiplier(0, -96, 0)).toBeCloseTo(2 ** -8, 12);
    expect(voicePitchMultiplier(0, 0, -50)).toBeCloseTo(2 ** (-0.5 / 12), 12);
  });
});
