/**
 * The resolution a live level (0…1) is shown at. The painter that decides when a level has changed
 * and the indicator that draws it both quantise through here, so they always agree on what counts
 * as a step. Two hundred steps put one at under a CSS pixel along the SID panel's live rings (about
 * 0.4 px on the smallest, 0.7 px on the largest); a finer step changes nothing on screen yet still
 * costs a DOM write.
 */
export const LIVE_LEVEL_STEPS = 200;

/**
 * The step, `0…LIVE_LEVEL_STEPS`, that `level` is shown at: the nearest one, with `level` clamped
 * to 0…1 and a non-finite level read as 0.
 *
 * @example
 * liveLevelStep(0.5) // 100
 * liveLevelStep(0.502) // 100 — the same step as 0.5
 * liveLevelStep(2) // 200
 */
export function liveLevelStep(level: number): number {
  const clamped = Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : 0;
  return Math.round(clamped * LIVE_LEVEL_STEPS);
}
