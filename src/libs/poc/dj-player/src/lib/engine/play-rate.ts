import { C64Machine } from '../cpu/c64-machine';
import { PAL_FRAME_INTERVAL_US } from '../asid/asid-constants';
import { MICROSECONDS_PER_SECOND } from './engine-utils';
import { framesToSeconds } from '../analysis/frame-features';

/** Which of a tune's two play rates a conversion divides by. `'exact'` is what a real-time duration
 *  must use — see `PlayRate.callsPerFrame`; `'rounded'` is what R6's toggle switches to. */
export type TimingMode = 'exact' | 'rounded';

export const DEFAULT_TIMING_MODE: TimingMode = 'exact';

/** Both rates a tune's timer describes, plus which one is in force. */
export interface PlayRate {
  /** The rate in force — what a conversion divides by. Either `exactCallsPerFrame` or
   *  `roundedCallsPerFrame`, chosen by `mode`. */
  readonly callsPerFrame: number;
  readonly exactCallsPerFrame: number;
  readonly roundedCallsPerFrame: number;
  readonly mode: TimingMode;
}

/** A non-finite or non-positive interval cannot be divided into safely — fall back to the PAL
 *  nominal rather than let it produce `Infinity` or `NaN` downstream. */
function sanitizedIntervalUs(nominalIntervalUs: number): number {
  return Number.isFinite(nominalIntervalUs) && nominalIntervalUs > 0
    ? nominalIntervalUs
    : PAL_FRAME_INTERVAL_US;
}

/** Reads both of `machine`'s rates and packages the one `mode` selects as the one in force. A null
 *  machine — nothing loaded — reports 1 for all three, same as a tune with no CIA timer latch. */
export function playRateFor(machine: C64Machine | null, mode: TimingMode): PlayRate {
  const exactCallsPerFrame = machine?.exactCallsPerFrame ?? 1;
  const roundedCallsPerFrame = machine?.callsPerFrame ?? 1;
  return {
    callsPerFrame: mode === 'exact' ? exactCallsPerFrame : roundedCallsPerFrame,
    exactCallsPerFrame,
    roundedCallsPerFrame,
    mode,
  };
}

/**
 * The same rates, forced to the rounded one — see the note on detection depth below.
 *
 * A caller that must walk a whole number of play calls — an analysis pass stepping frame by frame
 * toward a fixed depth, say — cannot advance by a fractional one the way a real-time duration can;
 * `asRounded` gives it the integer rate without disturbing the engine's own live mode.
 */
export function asRounded(rate: PlayRate): PlayRate {
  return { ...rate, mode: 'rounded', callsPerFrame: rate.roundedCallsPerFrame };
}

/** µs between play calls, before the speed fader. */
export function playCallIntervalUs(nominalIntervalUs: number, rate: PlayRate): number {
  return sanitizedIntervalUs(nominalIntervalUs) / rate.callsPerFrame;
}

/** A real-time duration as a whole number of play calls. */
export function msToPlayCalls(ms: number, nominalIntervalUs: number, rate: PlayRate): number {
  return Math.round((ms * 1000) / playCallIntervalUs(nominalIntervalUs, rate));
}

/** Play calls as seconds of music. Delegates to `framesToSeconds` — the arithmetic primitive stays
 *  there; this only resolves which rate it divides by. */
export function playCallsToSeconds(calls: number, nominalIntervalUs: number, rate: PlayRate): number {
  return framesToSeconds(calls, sanitizedIntervalUs(nominalIntervalUs), rate.callsPerFrame);
}

/** How many play calls one second of music is — what a seconds-valued constant converts through. */
export function playCallsPerSecond(nominalIntervalUs: number, rate: PlayRate): number {
  return MICROSECONDS_PER_SECOND / playCallIntervalUs(nominalIntervalUs, rate);
}
