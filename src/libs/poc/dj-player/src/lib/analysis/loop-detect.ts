import { ASID_SLOT_COUNT } from '../asid/asid-constants';
import type { ScanOutput } from './scan-tune';

/** What the detector found: a verified repeat, a tune that settled into a static idle cycle, or no
 *  answer at all. */
export type LoopDetection =
  | { readonly kind: 'loop'; readonly startFrame: number; readonly periodFrames: number }
  | { readonly kind: 'ended'; readonly endFrame: number }
  | { readonly kind: 'none' };

export interface LoopDetectOptions {
  /** How many frames of verified repeat are demanded before a candidate is believed. */
  readonly minTailFrames: number;
  /** A verified period below this describes a static idle cycle, not a loop — reported as `ended`. */
  readonly idlePeriodFrames: number;
}

/** Seconds of *music*; callers convert with the play-rate seam. */
export const MIN_TAIL_SECONDS = 15;
/** Seconds of *music*; callers convert with the play-rate seam. */
export const IDLE_PERIOD_SECONDS = 2;

/**
 * How many frame indices one hash bucket retains. A tune holding thousands of byte-identical frames
 * would otherwise make the candidate walk quadratic in the bucket; past this many the extra entries
 * describe the same stretch of chip state as the ones already kept.
 */
const MAX_BUCKET_FRAMES = 600;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Finds the frame the recorded chip state starts repeating from, by byte-identical comparison rather
 * than by similarity.
 *
 * For an ASID player the 28-slot register stream is the entire output, so a byte-identical repeat is
 * an identical-sounding repeat: this is an identity, not a heuristic, and it carries no threshold to
 * miscalibrate. A candidate is only believed once *every* frame of the remaining tail has been
 * verified against its counterpart one period earlier — a repeat that holds for a handful of frames
 * is what a held note looks like, and one that holds only because the scan ran out of buffer is not
 * a repeat at all.
 *
 * Earliest start wins: the walk ascends from frame 0 and returns the first candidate that verifies,
 * so an intro is reported as the intro rather than folded into the loop.
 *
 * Pure and Angular-free, and takes its thresholds already converted to frames — the same posture
 * `scanTune` keeps, so it produces the same answer on a worker or on the calling thread.
 */
export function detectLoop(scan: ScanOutput, options: LoopDetectOptions): LoopDetection {
  const { slotValues, frames } = scan;
  if (frames <= 0) {
    return { kind: 'none' };
  }

  const hashes = new Uint32Array(frames);
  const buckets = new Map<number, number[]>();
  for (let f = 0; f < frames; f++) {
    const hash = hashFrame(slotValues, f);
    hashes[f] = hash;
    const bucket = buckets.get(hash);
    if (bucket === undefined) {
      buckets.set(hash, [f]);
    } else if (bucket.length < MAX_BUCKET_FRAMES) {
      bucket.push(f); // appended ascending, so the smallest period at a given `f` is tried first
    }
  }

  for (let f = 0; f < frames; f++) {
    const bucket = buckets.get(hashes[f]);
    if (bucket === undefined) continue;

    for (const later of bucket) {
      if (later <= f) continue;
      const period = later - f;
      const tail = frames - later;
      // A one-frame period is a frame that did not change, not a lap; a tail shorter than the period
      // has no full lap to verify against; and a tail shorter than the guard is the buffer running
      // out rather than the tune repeating.
      if (period < 2 || tail < period || tail < options.minTailFrames) continue;
      // Clears the hash collision before paying for the tail.
      if (!framesEqual(slotValues, f, later)) continue;
      if (!tailRepeats(slotValues, f, later, tail)) continue;

      return period < options.idlePeriodFrames
        ? { kind: 'ended', endFrame: f }
        : { kind: 'loop', startFrame: f, periodFrames: period };
    }
  }

  return { kind: 'none' };
}

/** FNV-1a over the frame's 28 slot bytes, as an unsigned 32-bit value. */
function hashFrame(slotValues: Uint8Array, frame: number): number {
  const base = frame * ASID_SLOT_COUNT;
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < ASID_SLOT_COUNT; i++) {
    hash ^= slotValues[base + i];
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function framesEqual(slotValues: Uint8Array, a: number, b: number): boolean {
  const aBase = a * ASID_SLOT_COUNT;
  const bBase = b * ASID_SLOT_COUNT;
  for (let i = 0; i < ASID_SLOT_COUNT; i++) {
    if (slotValues[aBase + i] !== slotValues[bBase + i]) return false;
  }
  return true;
}

/** Every frame of the tail, never a sample of it — bailing on the first mismatch. Sampling is how a
 *  held note passes for a loop. */
function tailRepeats(slotValues: Uint8Array, f: number, later: number, tail: number): boolean {
  for (let k = 0; k < tail; k++) {
    if (!framesEqual(slotValues, f + k, later + k)) return false;
  }
  return true;
}
