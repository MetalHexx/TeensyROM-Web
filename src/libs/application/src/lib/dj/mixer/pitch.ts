/** ±12 semitones, integer. The Key control's range. */
export const KEY_SEMITONE_RANGE = 12;

/** Key, Coarse and Fine as one multiplier on a voice's frequency: 2^((key + coarse + fine/100) / 12).
 *  Exactly 1 at home (`Math.pow(2, 0) === 1`), which is what lets the library bypass the voice. */
export function voicePitchMultiplier(
  keySemitones: number,
  coarseSemitones: number,
  fineCents: number
): number {
  return Math.pow(2, (keySemitones + coarseSemitones + fineCents / 100) / 12);
}
