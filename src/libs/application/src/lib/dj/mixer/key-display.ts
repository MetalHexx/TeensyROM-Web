import { camelotFor, PITCH_CLASS_NAMES } from '@sidablist/analysis';
import type { DeckDetectedKey, KeyDisplayFormat } from '../dj-store';

function wrapPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The detected key moved by the Key knob's semitone offset and wrapped to 0-11, same mode; `null`
 * when there is no detected key. The one shift both the readout and the key match read, so they
 * can never disagree.
 */
export function shiftedKeyFor(
  detectedKey: DeckDetectedKey | null,
  semitoneOffset: number
): { readonly tonic: number; readonly mode: 'major' | 'minor' } | null {
  if (detectedKey === null) return null;
  return { tonic: wrapPitchClass(detectedKey.tonic + semitoneOffset), mode: detectedKey.mode };
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
  const shifted = shiftedKeyFor(detectedKey, semitoneOffset);
  if (detectedKey === null || shifted === null) return null;

  if (semitoneOffset === 0 && format === 'camelot') return detectedKey.camelot;
  if (format === 'camelot') return camelotFor(shifted.tonic, shifted.mode);
  return `${PITCH_CLASS_NAMES[shifted.tonic]}${shifted.mode === 'minor' ? 'm' : ''}`;
}
