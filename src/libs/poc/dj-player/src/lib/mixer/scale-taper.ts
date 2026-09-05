import { clamp } from '../engine/engine-utils';

/** A knob's position: −1 … +1, resting at 0. Full resolution; never rounded. */
export type ScalePosition = number;

/**
 * Exponential taper, stated in octaves so it is literally the same curve family as Key below:
 * position −1 → 1/16, position 0 → exactly 1, position +1 → 16. A curve, not a behaviour —
 * reshapeable by ear later without touching anything else. Exact at home by construction
 * (`Math.pow(2, 0) === 1`), which is what makes the frame's bypass engage.
 */
export const SCALE_TAPER_OCTAVES = 4;

/** Converts a knob's position to the multiplicative coefficient `RegisterFrame.setRegisterScale`
 *  applies. Ratio-symmetric about home: equal travel either way multiplies and divides by the same
 *  factor, so the same taper serves cutoff, resonance and pulse width identically under the hand.
 *  Clamps to ±1 itself — the same defensive bound `keyCoefficientFor` applies below — so this
 *  conversion never depends on a caller having applied it first. */
export function scaleCoefficientFor(position: ScalePosition): number {
  const bounded = clamp(position, -1, 1);
  return Math.pow(2, bounded * SCALE_TAPER_OCTAVES);
}

/** ±12 semitones, integer. 0 → exactly 1 (`Math.pow(2, 0) === 1`). */
export const KEY_SEMITONE_RANGE = 12;

/** Converts a Key control's semitone offset to the multiplicative coefficient
 *  `RegisterFrame.setRegisterScale('frequency', ...)` applies. Clamps to ±`KEY_SEMITONE_RANGE` and
 *  rounds to the nearest integer semitone itself — the same bound `MixerService.setKeySemitones`
 *  enforces on the stored value, restated here so this conversion never depends on a caller having
 *  applied it first. */
export function keyCoefficientFor(semitones: number): number {
  const bounded = clamp(Math.round(semitones), -KEY_SEMITONE_RANGE, KEY_SEMITONE_RANGE);
  return Math.pow(2, bounded / KEY_SEMITONE_RANGE);
}
