import { clamp } from '../engine/engine-utils';

/** −1 = hard A, 0 = centre (both full), +1 = hard B. */
export type CrossfaderPosition = number;
export type CrossfaderSide = 'a' | 'b';

/**
 * Linear response. Centre rests at full for both sides: sixteen output levels are too few to spend
 * half of them at the position the operator occupies most of the time.
 *
 * The seam that exists on purpose: this signature is the whole extension point for a second response
 * later — no selector, no alternative curve, and no curve-shape preview is built now.
 */
export function linearCrossfaderGain(position: CrossfaderPosition, side: CrossfaderSide): number {
  return side === 'a'
    ? clamp(1 - Math.max(position, 0), 0, 1)
    : clamp(1 + Math.min(position, 0), 0, 1);
}
