import {
  clamp,
  readSidField,
  SID_FIELD_WIDTHS,
  SID_FILTER_MODE_HIGH_PASS,
  SID_FILTER_MODE_LOW_PASS,
} from '@sidablist/core';
import type { SidField } from '@sidablist/core';

/** Which SID the deck's C64 has. The ASID link is one-way, so the app cannot ask; the user will
 *  say so on a settings page that does not exist yet. */
export type SidChip = '6581' | '8580';

/** Every value below is a starting point, to be tuned by ear — nothing else depends on the numbers. */
export const FILTER_SWEEP = {
  /** Hardcoded until the settings page lets the user pick their chip. */
  chip: '6581' as SidChip,
  /** |position| at or under this is centre: everything released. */
  deadZone: 0.04,
  /** Each side, just outside the dead zone — only on a tune that routes a voice through the filter
   *  itself. A tune that routes none has nothing to glide into, so its sweep starts at the dead
   *  zone's edge. */
  glideZone: 0.1,
  /** Left: falls from the chip's most open cutoff toward this, evenly in octaves. */
  lowPass: { closedHz: 300 },
  /** Right: rises from the chip's lowest cutoff toward this, evenly in octaves. */
  highPass: { thinHz: 4000 },
  /** The volume dip that hides a filter switch flipping: the deck's volume reaches 0 over
   *  `fadeOutFrames` (1 = cut at once), the switch goes out on the frame after, and the volume
   *  comes back over `fadeInFrames` (0 = straight back). */
  dip: { fadeOutFrames: 3, fadeInFrames: 3 },
} as const;

export const RESONANCE_SWEEP = {
  /** Held value just off rest. */
  floor: 4,
  /** > 1 spends more travel at the gentle end. */
  curveExponent: 1.5,
  /** The blend amount runs 0 → 1 over this much travel from rest. */
  glideStretch: 0.15,
} as const;

/**
 * Cutoff register → frequency in Hz, rising, per chip. Approximate averages: individual 6581s
 * differ from each other by a lot, which is one more reason the sweep is tuned by ear. The 6581
 * curve is already roughly exponential through its middle and flat below ~300 Hz; the 8580's is
 * close to a straight line.
 */
const CUTOFF_CURVES: Readonly<Record<SidChip, readonly (readonly [register: number, hz: number])[]>> = {
  '6581': [
    [0, 220],
    [256, 250],
    [384, 300],
    [512, 420],
    [640, 780],
    [768, 1600],
    [832, 2300],
    [896, 3200],
    [960, 4300],
    [992, 5000],
    [1088, 6000],
    [1152, 7200],
    [1280, 9500],
    [1408, 12000],
    [1536, 14500],
    [1664, 16000],
    [1792, 17100],
    [1920, 17700],
    [2047, 18000],
  ],
  '8580': [
    [0, 30],
    [2047, 12000],
  ],
};

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
  /** Whether the tune sends any voice through the filter itself (`$D417` bits 2–0). */
  readonly routesVoice: boolean;
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

/** The cutoff register that sounds closest to `hz` on `chip`, read off its curve. */
function registerForHz(chip: SidChip, hz: number): number {
  const curve = CUTOFF_CURVES[chip];
  const [firstRegister, firstHz] = curve[0];
  if (hz <= firstHz) {
    return firstRegister;
  }
  for (let i = 1; i < curve.length; i++) {
    const [register, pointHz] = curve[i];
    if (hz <= pointHz) {
      const [previousRegister, previousHz] = curve[i - 1];
      const along = (hz - previousHz) / (pointHz - previousHz);
      return Math.round(previousRegister + along * (register - previousRegister));
    }
  }
  return curve[curve.length - 1][0];
}

/** The sweep's cutoff `t` of the way (0…1) from its open end: the chip's most open register on
 *  each side, then evenly in octaves toward the side's far frequency. */
function sweepCutoff(side: Side, t: number): number {
  const curve = CUTOFF_CURVES[FILTER_SWEEP.chip];
  if (side === 'lowPass') {
    const openHz = curve[curve.length - 1][1];
    return registerForHz(FILTER_SWEEP.chip, openHz * Math.pow(FILTER_SWEEP.lowPass.closedHz / openHz, t));
  }
  const openHz = curve[0][1];
  return registerForHz(FILTER_SWEEP.chip, openHz * Math.pow(FILTER_SWEEP.highPass.thinHz / openHz, t));
}

/** The most open cutoff for the tune's own filter type, so entering the glide from centre never
 *  closes the filter the tune already had open. A band-pass or mixed type has no open end: it takes
 *  the sweep's own open end, accepting a small step. */
function openFor(side: Side, tuneFilterType: number): number {
  if (tuneFilterType === 0 || tuneFilterType === SID_FILTER_MODE_LOW_PASS) {
    return CUTOFF_CEILING;
  }
  if (tuneFilterType === SID_FILTER_MODE_HIGH_PASS) {
    return 0;
  }
  return sweepCutoff(side, 0);
}

/**
 * The filter-sweep knob's drives: left of centre is a low-pass sweep, right a high-pass sweep.
 * Always five drives, in this order: cutoff, filterType, filtered voice 0, 1, 2.
 *
 * Centre releases everything. On a tune that routes a voice through the filter, a glide just
 * outside centre fades the cutoff hold in at the tune's most open value and leaves the switches
 * with the tune. Past it — or straight past the dead zone, on a tune that routes nothing — the
 * filter type and the voices' filter routing are held and the cutoff travels the chip's curve from
 * its open end. Voice 3 is left alone when the tune has switched it off, since routing it through
 * the filter would bring it back.
 *
 * `tune` is read only when the position is outside the dead zone, at most once per call.
 */
export function cutoffSweepDrives(
  position: number,
  tune: () => TuneFilterState
): readonly FieldDrive[] {
  const side: Side = position < 0 ? 'lowPass' : 'highPass';
  const travel = Math.abs(clamp(position, -1, 1));
  const { deadZone } = FILTER_SWEEP;

  if (travel <= deadZone) {
    return [release(CUTOFF), release(FILTER_TYPE), ...FILTERED_VOICES.map(release)];
  }

  const state = tune();
  const glideZone = state.routesVoice ? FILTER_SWEEP.glideZone : 0;

  if (travel < deadZone + glideZone) {
    return [
      hold(CUTOFF, openFor(side, state.filterType), (travel - deadZone) / glideZone),
      release(FILTER_TYPE),
      ...FILTERED_VOICES.map(release),
    ];
  }

  const t = (travel - (deadZone + glideZone)) / (1 - (deadZone + glideZone));
  return [
    hold(CUTOFF, sweepCutoff(side, t), 1),
    hold(FILTER_TYPE, side === 'lowPass' ? SID_FILTER_MODE_LOW_PASS : SID_FILTER_MODE_HIGH_PASS, 1),
    ...FILTERED_VOICES.map((field, voice) =>
      voice === VOICE_3 && state.voice3Off ? release(field) : hold(field, 1, 1)
    ),
  ];
}

/**
 * The volume dip's frame-by-frame gain factors and the step its switches go out on. Each factor
 * is held for at least one frame; the switches go out on step `flipAt`, together with that step's
 * factor (or full volume, past the end of `factors`).
 */
export function dipSteps(): { readonly factors: readonly number[]; readonly flipAt: number } {
  const { fadeOutFrames, fadeInFrames } = FILTER_SWEEP.dip;
  const out = Math.max(1, fadeOutFrames);
  const factors: number[] = [];
  for (let step = 1; step <= out; step++) {
    factors.push(1 - step / out);
  }
  for (let step = 1; step <= fadeInFrames; step++) {
    factors.push(step / (fadeInFrames + 1));
  }
  return { factors, flipAt: out };
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
    routesVoice: FILTERED_VOICES.some((field) => readSidField(written, field) === 1),
  };
}
