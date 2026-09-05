import { camelotFor, PITCH_CLASS_NAMES } from '../analysis/key';
import type { TuneIndexRecord } from '../analysis/tune-index.model';

/** How the Key knob's readout renders a tune's key. Camelot is the DJ-mixing wheel number a
 *  beatmatching workflow reasons about; note is the compact music-theory name. */
export type KeyDisplayFormat = 'camelot' | 'note';

function wrapPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The Key knob's readout: the tune's detected key, transposed by `semitoneOffset` (the Key knob's
 * own position — a deck pitched up or down sounds in a different key, and this is the tool that
 * lets an operator dial two decks to the same one for harmonic mixing), in the requested format.
 * `null` when there is no confident detection to show — the caller falls back to its own home
 * label (`'0'`, or the signed semitone offset off home) in that case.
 */
export function keyDisplayFor(
  record: TuneIndexRecord | null,
  format: KeyDisplayFormat,
  semitoneOffset = 0
): string | null {
  if (record === null) return null;
  const { tonic, mode, camelot } = record;
  if (tonic === null || mode === null || camelot === null) return null;

  if (semitoneOffset === 0) {
    return format === 'camelot' ? camelot : `${PITCH_CLASS_NAMES[tonic]}${mode === 'minor' ? 'm' : ''}`;
  }

  const shiftedTonic = wrapPitchClass(tonic + semitoneOffset);
  if (format === 'camelot') return camelotFor(shiftedTonic, mode);
  return `${PITCH_CLASS_NAMES[shiftedTonic]}${mode === 'minor' ? 'm' : ''}`;
}
