import { describe, it, expect } from 'vitest';
import { LIVE_LEVEL_STEPS, liveLevelStep } from './live-level';

describe('liveLevelStep', () => {
  it('shows a level in two hundred steps, from empty to full', () => {
    expect(LIVE_LEVEL_STEPS).toBe(200);
    expect(liveLevelStep(0)).toBe(0);
    expect(liveLevelStep(0.5)).toBe(100);
    expect(liveLevelStep(1)).toBe(200);
  });

  it('rounds to the nearest step, so a change inside one is not a new step', () => {
    expect(liveLevelStep(0.502)).toBe(100);
    expect(liveLevelStep(0.503)).toBe(101);
  });

  it('clamps below 0 to empty and above 1 to full', () => {
    expect(liveLevelStep(-1)).toBe(0);
    expect(liveLevelStep(2)).toBe(200);
  });

  it('reads a non-finite level as empty', () => {
    expect(liveLevelStep(Number.NaN)).toBe(0);
    expect(liveLevelStep(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
