import type { Candidate } from './novelty';
import { framesToSeconds } from './frame-features';

export interface PulseResult {
  readonly histogram: Uint32Array;
  readonly dominantInterval: number | null;
  readonly confidence: 'strong' | 'weak' | 'none';
}

/** Maximum interval to track in frames — roughly 2 seconds at nominal PAL timing (19,950 µs).
 *  At PAL, this is about 100 frames; at NTSC, about 83 frames. Keeps the histogram array small
 *  and the chart readable. */
const MAX_HISTOGRAM_INTERVAL_US = 2_000_000;
const NOMINAL_INTERVAL_US = 19_950;
const NOMINAL_CALLS_PER_FRAME = 1;

/**
 * Analyzes the intervals between consecutive candidates to determine if there is a regular pulse.
 *
 * Returns a histogram of frame intervals between candidates, the dominant (most frequent) interval,
 * and a confidence rating based on how sharply that interval stands above the rest.
 *
 * - `strong`: a tall, isolated spike
 * - `weak`: a modest bump in a broad distribution
 * - `none`: flat or near-flat histogram, or fewer than 2 candidates (no intervals to measure)
 *
 * Edge cases (empty or single-candidate lists) return `none` with a null interval.
 */
export function computePulse(candidates: readonly Candidate[]): PulseResult {
  if (candidates.length < 2) {
    return {
      histogram: new Uint32Array(0),
      dominantInterval: null,
      confidence: 'none',
    };
  }

  // Maximum interval size for histogram in frames, derived from the nominal PAL timing.
  const maxIntervalFrames = Math.ceil(
    (MAX_HISTOGRAM_INTERVAL_US / NOMINAL_INTERVAL_US) * NOMINAL_CALLS_PER_FRAME
  );

  // Build histogram of intervals between consecutive candidates.
  const histogram = new Uint32Array(maxIntervalFrames);
  for (let i = 1; i < candidates.length; i++) {
    const interval = candidates[i].frame - candidates[i - 1].frame;
    if (interval > 0 && interval < maxIntervalFrames) {
      histogram[interval]++;
    }
  }

  // Find the dominant interval (histogram peak).
  let dominantInterval: number | null = null;
  let dominantCount = 0;
  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > dominantCount) {
      dominantCount = histogram[i];
      dominantInterval = i;
    }
  }

  // If no intervals recorded or the dominant is empty, return none.
  if (dominantInterval === null || dominantCount === 0) {
    return {
      histogram,
      dominantInterval: null,
      confidence: 'none',
    };
  }

  // Calculate confidence based on how sharply the dominant interval stands above the rest.
  // Strategy:
  // - Strong: dominant peak is clearly isolated and significantly higher than neighbors.
  // - Weak: dominant peak exists but sits in a broader distribution.
  // - None: no clear peak.

  const confidence = calculateConfidence(histogram, dominantInterval, dominantCount);

  return {
    histogram,
    dominantInterval,
    confidence,
  };
}

/**
 * Calculates confidence level by comparing the dominant peak to its neighbors and the overall
 * distribution spread.
 *
 * The algorithm examines:
 * 1. How much higher the dominant is than its immediate neighbors
 * 2. How concentrated the overall distribution is
 *
 * Strong: dominant is >60% of total and >2x any neighbor, and 70%+ of weight is within 2 intervals
 * Weak: has a clear peak but broader distribution
 * None: no clear concentration
 */
function calculateConfidence(
  histogram: Uint32Array,
  dominantInterval: number,
  dominantCount: number
): 'strong' | 'weak' | 'none' {
  let totalCount = 0;
  for (let i = 0; i < histogram.length; i++) {
    totalCount += histogram[i];
  }

  if (totalCount === 0) {
    return 'none';
  }

  const dominantRatio = dominantCount / totalCount;

  // Check neighbor heights (one interval on each side).
  let maxNeighbor = 0;
  if (dominantInterval > 0) {
    maxNeighbor = Math.max(maxNeighbor, histogram[dominantInterval - 1]);
  }
  if (dominantInterval < histogram.length - 1) {
    maxNeighbor = Math.max(maxNeighbor, histogram[dominantInterval + 1]);
  }

  // Calculate how much of the distribution sits within a 2-interval band around the dominant.
  let concentrationCount = 0;
  for (let i = Math.max(0, dominantInterval - 2); i <= Math.min(histogram.length - 1, dominantInterval + 2); i++) {
    concentrationCount += histogram[i];
  }
  const concentrationRatio = concentrationCount / totalCount;

  // Strong: dominant >60%, and at least 2x taller than neighbors, and concentrated.
  if (dominantRatio > 0.6 && (maxNeighbor === 0 || dominantCount > 2 * maxNeighbor) && concentrationRatio > 0.7) {
    return 'strong';
  }

  // Weak: dominant >20%, or at least 1.5x taller than neighbors.
  if (dominantRatio > 0.2 || (maxNeighbor > 0 && dominantCount > 1.5 * maxNeighbor)) {
    return 'weak';
  }

  return 'none';
}

/**
 * Derives the implied tempo in BPM from a dominant interval and the tune's timing parameters.
 * Accounts for playback speed.
 *
 * @param dominantInterval frame interval (null if no pulse detected)
 * @param nominalIntervalUs nominal timing in microseconds
 * @param callsPerFrame play-routine calls per frame (multispeed factor)
 * @param speedMultiplier current playback speed multiplier
 * @returns object with native and sounding tempos in BPM, either may be null
 */
export function impliedTempo(
  dominantInterval: number | null,
  nominalIntervalUs: number,
  callsPerFrame: number,
  speedMultiplier: number
): { native: number | null; sounding: number | null } {
  if (dominantInterval === null || dominantInterval <= 0) {
    return { native: null, sounding: null };
  }

  // Convert interval to seconds, then to tempo.
  // Tempo = 60 / (interval in seconds)
  const nativeSeconds = framesToSeconds(dominantInterval, nominalIntervalUs, callsPerFrame);
  const nativeTempo = nativeSeconds > 0 ? 60 / nativeSeconds : null;

  // Sounding tempo accounts for speed multiplier.
  // Higher speed multiplier = faster playback = higher perceived tempo.
  const soundingTempo = nativeTempo !== null ? nativeTempo * speedMultiplier : null;

  return { native: nativeTempo, sounding: soundingTempo };
}
