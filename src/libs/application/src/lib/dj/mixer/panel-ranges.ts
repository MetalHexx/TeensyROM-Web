import { KEY_SEMITONE_RANGE } from './pitch';

/** One panel knob's travel. A knob's position is its raw offset in the field's own units, so full
 *  travel each way spans the field's whole range. `step` is the snap for a stepped knob, `null` for
 *  a continuous one. */
export interface PanelRange {
  readonly min: number;
  readonly max: number;
  readonly home: number;
  readonly step: number | null;
}

export const PANEL_RANGES = {
  /** The chip's whole range, ±8 octaves, snapped to semitones. */
  coarse: { min: -96, max: 96, home: 0, step: 1 },
  /** Cents, continuous. */
  fine: { min: -50, max: 50, home: 0, step: null },
  pulseWidth: { min: -4095, max: 4095, home: 0, step: 1 },
  attack: { min: -15, max: 15, home: 0, step: 1 },
  decay: { min: -15, max: 15, home: 0, step: 1 },
  sustain: { min: -15, max: 15, home: 0, step: 1 },
  release: { min: -15, max: 15, home: 0, step: 1 },
  cutoff: { min: -2047, max: 2047, home: 0, step: 1 },
  resonance: { min: -15, max: 15, home: 0, step: 1 },
  key: { min: -KEY_SEMITONE_RANGE, max: KEY_SEMITONE_RANGE, home: 0, step: 1 },
} as const satisfies Record<string, PanelRange>;
