import { describe, it, expect } from 'vitest';
import { keyCoefficientFor, scaleCoefficientFor } from './scale-taper';

describe('scaleCoefficientFor', () => {
  it('returns exactly 1 at home', () => {
    expect(scaleCoefficientFor(0)).toBe(1);
  });

  it('is the exact reciprocal pair at full travel', () => {
    expect(scaleCoefficientFor(1)).toBe(16);
    expect(scaleCoefficientFor(-1)).toBe(0.0625);
  });

  it('is ratio-symmetric about home across the travel', () => {
    for (const position of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(scaleCoefficientFor(position) * scaleCoefficientFor(-position)).toBeCloseTo(1, 10);
    }
  });

  it('is strictly increasing across the travel', () => {
    const positions = [-1, -0.5, -0.1, 0, 0.1, 0.5, 1];
    const coefficients = positions.map(scaleCoefficientFor);
    for (let i = 1; i < coefficients.length; i++) {
      expect(coefficients[i]).toBeGreaterThan(coefficients[i - 1]);
    }
  });
});

describe('keyCoefficientFor', () => {
  it('returns exactly 1 at home', () => {
    expect(keyCoefficientFor(0)).toBe(1);
  });

  it('is the exact reciprocal pair at the ±12 semitone bound', () => {
    expect(keyCoefficientFor(12)).toBe(2);
    expect(keyCoefficientFor(-12)).toBe(0.5);
  });

  it('clamps a semitone offset past ±12 to the bound', () => {
    expect(keyCoefficientFor(24)).toBe(keyCoefficientFor(12));
    expect(keyCoefficientFor(-24)).toBe(keyCoefficientFor(-12));
  });

  it('rounds a non-integer semitone offset to the nearest semitone', () => {
    expect(keyCoefficientFor(7.4)).toBe(keyCoefficientFor(7));
    expect(keyCoefficientFor(7.6)).toBe(keyCoefficientFor(8));
  });
});
