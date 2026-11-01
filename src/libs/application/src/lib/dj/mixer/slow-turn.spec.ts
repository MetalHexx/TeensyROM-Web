import { describe, expect, it } from 'vitest';
import { SLOW_TURN_FAST_MS, SLOW_TURN_FLOOR, SLOW_TURN_SLOW_MS, slowTurnStep } from './slow-turn';

const FULL = 0.01;

describe('slowTurnStep', () => {
  it('Should take the full step at or under the fast gap', () => {
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, SLOW_TURN_FAST_MS)).toBe(FULL);
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, 0)).toBe(FULL);
  });

  it('Should return the sensitivity exactly for any sensitivity, never above it', () => {
    for (let k = 1; k <= 1000; k++) {
      const full = k / 1000;
      expect(slowTurnStep(full, SLOW_TURN_FLOOR, 0)).toBeLessThanOrEqual(full);
      expect(slowTurnStep(full, SLOW_TURN_FLOOR, 0)).toBe(full);
    }
  });

  it('Should take the floor at or over the slow gap, and for a lone click', () => {
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, SLOW_TURN_SLOW_MS)).toBeCloseTo(SLOW_TURN_FLOOR, 12);
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, 5000)).toBe(SLOW_TURN_FLOOR);
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, null)).toBe(SLOW_TURN_FLOOR);
  });

  it('Should count a negative or non-finite gap as no previous click', () => {
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, -5)).toBe(SLOW_TURN_FLOOR);
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, Number.NaN)).toBe(SLOW_TURN_FLOOR);
    expect(slowTurnStep(FULL, SLOW_TURN_FLOOR, Number.POSITIVE_INFINITY)).toBe(SLOW_TURN_FLOOR);
  });

  it('Should return a full step at or below the floor as is', () => {
    expect(slowTurnStep(0.00005, SLOW_TURN_FLOOR, null)).toBe(0.00005);
    expect(slowTurnStep(SLOW_TURN_FLOOR, SLOW_TURN_FLOOR, 500)).toBe(SLOW_TURN_FLOOR);
  });

  it('Should rise steadily from the slow gap to the fast one, never above the full step', () => {
    let previous = slowTurnStep(FULL, SLOW_TURN_FLOOR, SLOW_TURN_SLOW_MS);
    for (let gap = SLOW_TURN_SLOW_MS - 10; gap >= SLOW_TURN_FAST_MS; gap -= 10) {
      const step = slowTurnStep(FULL, SLOW_TURN_FLOOR, gap);
      expect(step).toBeGreaterThan(previous);
      expect(step).toBeLessThanOrEqual(FULL);
      previous = step;
    }
  });
});
