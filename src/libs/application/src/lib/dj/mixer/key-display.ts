import { camelotFor, PITCH_CLASS_NAMES } from '@sidablist/analysis';
import type { DeckDetectedKey, KeyDisplayFormat } from '../dj-store';

function wrapPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The Key knob's readout: the tune's detected key, transposed by `semitoneOffset` (the Key knob's
 * own position — a deck pitched up or down sounds in a different key, and this is the tool that
 * lets an operator dial two decks to the same one for harmonic mixing), in the requested format.
 * `null` when there is no detected key to show — the caller falls back to its own home
 * label (`'0'`, or the signed semitone offset off home) in that case.
 */
export function keyDisplayFor(
  detectedKey: DeckDetectedKey | null,
  format: KeyDisplayFormat,
  semitoneOffset = 0
): string | null {
  if (detectedKey === null) return null;
  const { tonic, mode, camelot } = detectedKey;

  if (semitoneOffset === 0) {
    return format === 'camelot'
      ? camelot
      : `${PITCH_CLASS_NAMES[tonic]}${mode === 'minor' ? 'm' : ''}`;
  }

  const shiftedTonic = wrapPitchClass(tonic + semitoneOffset);
  if (format === 'camelot') return camelotFor(shiftedTonic, mode);
  return `${PITCH_CLASS_NAMES[shiftedTonic]}${mode === 'minor' ? 'm' : ''}`;
}
