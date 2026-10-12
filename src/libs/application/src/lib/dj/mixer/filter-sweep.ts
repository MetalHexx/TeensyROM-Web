import {
  clamp,
  readSidField,
  SID_FIELD_WIDTHS,
  SID_FILTER_MODE_HIGH_PASS,
  SID_FILTER_MODE_LOW_PASS,
} from '@sidablist/core';
import type { SidField } from '@sidablist/core';

/** Every value below is a starting point, to be tuned by ear — nothing else depends on the numbers. */
export const FILTER_SWEEP = {
  /** |position| at or under this is centre: everything released. */
  deadZone: 0.04,
  /** Each side, just outside the dead zone. */
  glideZone: 0.1,
  /** Left: falls open → closed toward −1. */
  lowPass: { openCutoff: 1900, closedCutoff: 64 },
  /** Right: rises open → thin toward +1. */
  highPass: { openCutoff: 24, thinCutoff: 1536 },
} as const;

export const RESONANCE_SWEEP = {
  /** Held value just off rest. */
  floor: 4,
  /** > 1 spends more travel at the gentle end. */
  curveExponent: 1.5,
  /** The blend amount runs 0 → 1 over this much travel from rest. */
  glideStretch: 0.15,
} as const;

/** One field the mixer drives: held at `hold.value` blended by `hold.amount`, or released (`null`). */
export interface FieldDrive {
  readonly field: SidField;
  readonly hold: { readonly value: number; readonly amount: number } | null;
}

/** What the tune itself has set, read from its live registers. */
export interface TuneFilterState {
  /** `$D418` bits 6–4 as the tune wrote them, 0…7. */
  readonly filterType: number;
  readonly voice3Off: boolean;
}

type Side = 'lowPass' | 'highPass';

const CUTOFF: SidField = { name: 'cutoff' };
const FILTER_TYPE: SidField = { name: 'filterType' };
const FILTERED_VOICES: readonly SidField[] = [0, 1, 2].map((voice) => ({
  name: 'filtered',
  voice,
}));
const VOICE_3 = 2;

const CUTOFF_CEILING = (1 << SID_FIELD_WIDTHS.cutoff) - 1;
const RESONANCE_CEILING = (1 << SID_FIELD_WIDTHS.resonance) - 1;

function release(field: SidField): FieldDrive {
  return { field, hold: null };
}

function hold(field: SidField, value: number, amount: number): FieldDrive {
  return { field, hold: { value, amount } };
}

/** The most open cutoff for the tune's own filter type, so entering the glide from centre never
 *  closes the filter the tune already had open. A band-pass or mixed type has no open end: it takes
 *  the sweep's own open value, accepting a small step. */
function openFor(side: Side, tuneFilterType: number): number {
  if (tuneFilterType === 0 || tuneFilterType === SID_FILTER_MODE_LOW_PASS) {
    return CUTOFF_CEILING;
  }
  if (tuneFilterType === SID_FILTER_MODE_HIGH_PASS) {
    return 0;
  }
  return FILTER_SWEEP[side].openCutoff;
}

function sweepCutoff(side: Side, t: number): number {
  if (side === 'lowPass') {
    const { openCutoff, closedCutoff } = FILTER_SWEEP.lowPass;
    return Math.round(openCutoff * Math.pow(closedCutoff / openCutoff, t));
  }
  const { openCutoff, thinCutoff } = FILTER_SWEEP.highPass;
  return Math.round(openCutoff * Math.pow(thinCutoff / openCutoff, t));
}

/**
 * The filter-sweep knob's drives: left of centre is a low-pass sweep, right a high-pass sweep.
 * Always five drives, in this order: cutoff, filterType, filtered voice 0, 1, 2.
 *
 * Centre releases everything. Just outside it a glide fades the cutoff hold in at the tune's most
 * open value and leaves the switches with the tune. Past the glide the filter type and the voices'
 * filter routing are held and the cutoff travels an exponential curve. Voice 3 is left alone when
 * the tune has switched it off, since routing it through the filter would bring it back.
 *
 * `tune` is read only when the position is outside the dead zone, at most once per call.
 */
export function cutoffSweepDrives(
  position: number,
  tune: () => TuneFilterState
): readonly FieldDrive[] {
  const side: Side = position < 0 ? 'lowPass' : 'highPass';
  const travel = Math.abs(clamp(position, -1, 1));
  const { deadZone, glideZone } = FILTER_SWEEP;

  if (travel <= deadZone) {
    return [release(CUTOFF), release(FILTER_TYPE), ...FILTERED_VOICES.map(release)];
  }

  if (travel < deadZone + glideZone) {
    return [
      hold(CUTOFF, openFor(side, tune().filterType), (travel - deadZone) / glideZone),
      release(FILTER_TYPE),
      ...FILTERED_VOICES.map(release),
    ];
  }

  const { voice3Off } = tune();
  const t = (travel - (deadZone + glideZone)) / (1 - (deadZone + glideZone));
  return [
    hold(CUTOFF, sweepCutoff(side, t), 1),
    hold(FILTER_TYPE, side === 'lowPass' ? SID_FILTER_MODE_LOW_PASS : SID_FILTER_MODE_HIGH_PASS, 1),
    ...FILTERED_VOICES.map((field, voice) =>
      voice === VOICE_3 && voice3Off ? release(field) : hold(field, 1, 1)
    ),
  ];
}

/** The resonance knob's drive: 0 releases, above 0 holds a value rising along a power curve from
 *  just off rest to the field's maximum at 1, blended in over `glideStretch` of travel. */
export function resonanceDrive(position: number): FieldDrive {
  const field: SidField = { name: 'resonance' };
  const travel = clamp(position, 0, 1);
  if (travel === 0) {
    return release(field);
  }

  const { floor, curveExponent, glideStretch } = RESONANCE_SWEEP;
  const value = Math.round(floor + (RESONANCE_CEILING - floor) * Math.pow(travel, curveExponent));
  return hold(field, value, Math.min(1, travel / glideStretch));
}

/** Reads the filter state the tune itself has set out of its raw, pre-hold register values. */
export function tuneFilterStateFrom(written: ArrayLike<number>): TuneFilterState {
  return {
    filterType: readSidField(written, { name: 'filterType' }),
    voice3Off: readSidField(written, { name: 'voice3Off' }) === 1,
  };
}
