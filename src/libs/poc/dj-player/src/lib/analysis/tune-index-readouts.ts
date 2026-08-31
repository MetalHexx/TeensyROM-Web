import { positionBasisFor } from '../engine/engine-utils';
import { playCallsToSeconds } from '../engine/play-rate';
import type { PlayRate } from '../engine/play-rate';
import { PITCH_CLASS_NAMES } from './key';
import { formatDuration } from './format';
import type { TuneIndexRecord } from './tune-index.model';

export const TUNE_INDEX_ANALYZING_LABEL = 'analyzing…';
export const TUNE_INDEX_UNKNOWN_LABEL = '—';
export const TUNE_INDEX_NOT_FOUND_LABEL = 'not found';
/** A tune detection proved stops rather than repeats. A completed answer, and a different one from
 *  "no answer" — the two must not both collapse to the same text. */
export const TUNE_INDEX_ENDED_LABEL = 'ends, no loop';

/** Below this, a byte-verified repeat is almost certainly an ostinato or an idle cycle rather than
 *  the tune's musical loop. Informational only — the loop still drives playback unsuppressed; see
 *  the note in `DjPlayerEngine.setTuneIndex`. The bar sits at the top of the range investigation
 *  pointed at, because showing the label on a genuine loop costs nothing and missing one costs the
 *  diagnosis the label exists to give. */
const IMPLAUSIBLE_PERIOD_SECONDS = 15;

/** What every duration-valued readout below converts frames through — the nominal interval and play
 *  rate currently in force for the deck the record describes. Every duration is derived at read time
 *  from the record's stored frames and this rate, never from a stored number of seconds, which is
 *  what makes a readout follow its deck's Timing selector rather than freeze whatever was in force
 *  when the tune was scanned. */
export interface TuneIndexRate {
  readonly nominalIntervalUs: number;
  readonly playRate: PlayRate;
}

/** Either a verified loop worth rendering field by field, or the one placeholder both loop rows show
 *  for every other outcome. */
type LoopReadout =
  | { readonly kind: 'placeholder'; readonly label: string }
  | { readonly kind: 'loop'; readonly startFrame: number; readonly periodFrames: number };

function toSeconds(frames: number, rate: TuneIndexRate): number {
  return playCallsToSeconds(frames, rate.nominalIntervalUs, rate.playRate);
}

/** '{tonic} {mode} · {camelot}', or the honest answer. Never a key name without the Camelot number
 *  beside it — the wheel is what a DJ mixes on. Reports the native key only; the sounding key stays
 *  the Track Analysis panel's job. */
function keyLabelFor(record: TuneIndexRecord): string {
  const { tonic, mode, camelot } = record;
  return tonic === null || mode === null || camelot === null
    ? 'no clear key'
    : `${PITCH_CLASS_NAMES[tonic]} ${mode} · ${camelot}`;
}

function loopReadoutFor(record: TuneIndexRecord | null, pending: boolean): LoopReadout {
  if (pending) return { kind: 'placeholder', label: TUNE_INDEX_ANALYZING_LABEL };
  if (record === null) return { kind: 'placeholder', label: TUNE_INDEX_UNKNOWN_LABEL };

  const { loopStartFrame, loopPeriodFrames } = record;
  if (loopStartFrame === null || loopPeriodFrames === null) {
    const label = record.endedAtFrame === null ? TUNE_INDEX_NOT_FOUND_LABEL : TUNE_INDEX_ENDED_LABEL;
    return { kind: 'placeholder', label };
  }
  return { kind: 'loop', startFrame: loopStartFrame, periodFrames: loopPeriodFrames };
}

/** The tune's native length: one intro plus one lap for a verified loop, the detected end point for a
 *  tune that stops, or the honest placeholder for every other outcome. */
export function tuneIndexLengthLabel(
  record: TuneIndexRecord | null,
  pending: boolean,
  rate: TuneIndexRate
): string {
  if (pending) return TUNE_INDEX_ANALYZING_LABEL;
  if (record === null) return TUNE_INDEX_UNKNOWN_LABEL;
  const basis = positionBasisFor(record);
  return basis === null ? TUNE_INDEX_NOT_FOUND_LABEL : formatDuration(toSeconds(basis, rate));
}

/** The verified loop's start frame, or the placeholder for every other outcome — a frame count, not a
 *  duration, so it needs no rate to render. */
export function tuneIndexLoopStartLabel(record: TuneIndexRecord | null, pending: boolean): string {
  const readout = loopReadoutFor(record, pending);
  return readout.kind === 'placeholder' ? readout.label : readout.startFrame.toLocaleString();
}

/** The verified loop's period as a duration, or the placeholder for every other outcome. */
export function tuneIndexLoopPeriodLabel(
  record: TuneIndexRecord | null,
  pending: boolean,
  rate: TuneIndexRate
): string {
  const readout = loopReadoutFor(record, pending);
  return readout.kind === 'placeholder'
    ? readout.label
    : formatDuration(toSeconds(readout.periodFrames, rate));
}

/** R4: a verified loop whose period is short enough to read as an ostinato or an idle cycle rather
 *  than the tune's arrangement — the short-repeat note's own threshold test. Purely informational;
 *  see `IMPLAUSIBLE_PERIOD_SECONDS` above. */
export function tuneIndexLoopIsImplausible(
  record: TuneIndexRecord | null,
  pending: boolean,
  rate: TuneIndexRate
): boolean {
  const readout = loopReadoutFor(record, pending);
  return readout.kind === 'loop' && toSeconds(readout.periodFrames, rate) < IMPLAUSIBLE_PERIOD_SECONDS;
}

export function tuneIndexKeyLabel(record: TuneIndexRecord | null, pending: boolean): string {
  if (pending) return TUNE_INDEX_ANALYZING_LABEL;
  return record === null ? TUNE_INDEX_UNKNOWN_LABEL : keyLabelFor(record);
}

export function tuneIndexKeyConfidenceLabel(record: TuneIndexRecord | null, pending: boolean): string {
  if (pending) return TUNE_INDEX_ANALYZING_LABEL;
  return record === null ? TUNE_INDEX_UNKNOWN_LABEL : record.keyConfidence;
}
