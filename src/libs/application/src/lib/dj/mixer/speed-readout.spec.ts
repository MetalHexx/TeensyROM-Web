import { describe, expect, it } from 'vitest';
import { formatSpeedPercent } from './speed-readout';

describe('formatSpeedPercent', () => {
  it('Should sign a faster speed with + and a slower one with the true minus', () => {
    expect(formatSpeedPercent(1.0125)).toBe('+1.25%');
    expect(formatSpeedPercent(0.9)).toBe('−10.00%');
    expect(formatSpeedPercent(1.5)).toBe('+50.00%');
  });

  it('Should read home as 0.00% with no sign', () => {
    expect(formatSpeedPercent(1)).toBe('0.00%');
  });

  it('Should show no sign when the value rounds to zero', () => {
    expect(formatSpeedPercent(1.00004)).toBe('0.00%');
    expect(formatSpeedPercent(0.99996)).toBe('0.00%');
  });

  it('Should keep a 0.01% step visible', () => {
    expect(formatSpeedPercent(1.0001)).toBe('+0.01%');
    expect(formatSpeedPercent(0.9999)).toBe('−0.01%');
  });
});
