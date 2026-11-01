/** 0.01% of 1×: the finest move a slow click makes on speed. */
export const SLOW_TURN_FLOOR = 0.0001;
/** Clicks this close together, or closer, take the full step. A starting value, tuned at the
 *  bench. */
export const SLOW_TURN_FAST_MS = 40;
/** Clicks this far apart, or further, and a lone click, take the floor. A starting value, tuned
 *  at the bench. */
export const SLOW_TURN_SLOW_MS = 200;

/** The move one click makes: `fullStep` at a gap of SLOW_TURN_FAST_MS or less, `floor` at
 *  SLOW_TURN_SLOW_MS or more or with no previous click (`gapMs` null), and between them a
 *  logarithmic fall from one to the other. Never more than `fullStep`; a `fullStep` at or
 *  below `floor` is returned as is. A negative or non-finite gap counts as no previous click. */
export function slowTurnStep(fullStep: number, floor: number, gapMs: number | null): number {
  if (fullStep <= floor) {
    return fullStep;
  }
  if (gapMs === null || !Number.isFinite(gapMs) || gapMs < 0) {
    return floor;
  }
  const t = Math.min(
    1,
    Math.max(0, (SLOW_TURN_SLOW_MS - gapMs) / (SLOW_TURN_SLOW_MS - SLOW_TURN_FAST_MS))
  );
  if (t === 1) {
    return fullStep;
  }
  return Math.min(fullStep, floor * (fullStep / floor) ** t);
}
