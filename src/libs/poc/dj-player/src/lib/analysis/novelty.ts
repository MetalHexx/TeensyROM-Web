import { FEATURE_DIMENSIONS, FEATURE_DIMENSION_COUNT, framesToSeconds } from './frame-features';
import type { FeatureMatrix } from './frame-features';

export interface FeatureWeights {
  readonly pitch: number; // per-voice, log-space
  readonly gate: number; // per-voice gate transitions
  readonly waveform: number; // per-voice waveform changes
  readonly envelope: number; // per-voice attack/decay + sustain/release
  readonly voiceActivity: number; // per-voice sounding-or-silent
  readonly cutoff: number;
  readonly resonance: number;
  readonly filterRouting: number;
  readonly volume: number;
  readonly writeDensity: number;
}

/**
 * A considered ranking, not a flat one: an even weighting is itself a claim that every kind of
 * change matters equally, which is false for this music. `voiceActivity` leads because a drop-out
 * is the case this whole design exists to catch; `gate` and `cutoff` sit close behind as the next
 * most telling events. `pitch` sits mid-pack deliberately — melodic movement is near-constant, so
 * weighting it like an event would let it dominate the curve. `resonance` is last because it rarely
 * carries a musical moment on its own.
 */
export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = {
  voiceActivity: 1.0,
  gate: 0.8,
  cutoff: 0.75,
  volume: 0.55,
  waveform: 0.45,
  pitch: 0.35,
  envelope: 0.2,
  writeDensity: 0.15,
  filterRouting: 0.08,
  resonance: 0.05,
};

export interface Candidate {
  readonly frame: number;
  readonly strength: number; // 0..1, the curve's height at this peak
  readonly contributors: readonly string[]; // dimension names, strongest first, at most 3
}

export interface NoveltyResult {
  readonly curve: Float32Array; // one entry per frame, normalised 0..1
  readonly candidates: readonly Candidate[]; // every local peak, unfiltered by threshold
}

const MAX_CONTRIBUTORS = 3;
const SMOOTHING_WINDOW_SECONDS = 0.1;

// No scan is threaded through this call, so the tune's real per-frame timing isn't available here.
// The smoothing window assumes nominal, single-speed PAL timing — the same simplification this
// codebase already makes elsewhere when per-tune timing isn't at hand (see tune-session.ts).
const NOMINAL_FRAME_INTERVAL_US = 19_950;
const NOMINAL_CALLS_PER_FRAME = 1;

/**
 * The change curve every candidate marker comes from: a weighted, smoothed distance between
 * consecutive rows of the shared feature matrix, normalised to its own maximum. Does no decoding
 * and no emulation of its own — it only walks the matrix P01-T01 already built, which is what keeps
 * this fast enough to call on every weight-slider tick.
 */
export function computeNovelty(matrix: FeatureMatrix, weights: FeatureWeights): NoveltyResult {
  const dimensionWeights = dimensionWeightsFor(weights);
  const raw = rawNoveltyCurve(matrix, dimensionWeights);
  const smoothed = smooth(raw, smoothingWindowRadius());
  const curve = normalise(smoothed);

  const candidates: Candidate[] = findPeaks(curve).map((frame) => ({
    frame,
    strength: curve[frame],
    contributors: topContributors(matrix, frame, dimensionWeights),
  }));

  return { curve, candidates };
}

/** A pure filter over already-computed candidates, so moving a threshold never recomputes the curve. */
export function candidatesAbove(result: NoveltyResult, threshold: number): readonly Candidate[] {
  return result.candidates.filter((candidate) => candidate.strength >= threshold);
}

/** Expands the ten user-facing weights into one entry per matrix dimension — shared with structure.ts
 *  so a block or frame comparison there weighs each dimension exactly as the curve does. */
export function dimensionWeightsFor(weights: FeatureWeights): Float64Array {
  const result = new Float64Array(FEATURE_DIMENSION_COUNT);
  for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
    result[d] = weightForDimension(FEATURE_DIMENSIONS[d], weights);
  }
  return result;
}

/** The weighted distance between any two rows of the shared feature matrix — the primitive the curve
 *  applies to consecutive frames and structure.ts applies to arbitrary block or frame pairs. Reusing
 *  this rather than re-deriving it is what keeps the two readers from drifting into different notions
 *  of "how different are these two moments." */
export function rowDistance(
  matrix: FeatureMatrix,
  rowAFrame: number,
  rowBFrame: number,
  dimensionWeights: Float64Array
): number {
  const rowA = rowAFrame * FEATURE_DIMENSION_COUNT;
  const rowB = rowBFrame * FEATURE_DIMENSION_COUNT;
  let sum = 0;
  for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
    sum += dimensionWeights[d] * Math.abs(matrix.values[rowA + d] - matrix.values[rowB + d]);
  }
  return sum;
}

/** Dimension names are `voiceN.<feature>` for per-voice dimensions and bare for global ones — both
 *  forms resolve to the same ten weights. */
function weightForDimension(dimension: string, weights: FeatureWeights): number {
  const key = dimension.includes('.') ? dimension.slice(dimension.indexOf('.') + 1) : dimension;
  switch (key) {
    case 'pitch':
      return weights.pitch;
    case 'gate':
      return weights.gate;
    case 'waveform':
      return weights.waveform;
    case 'envelope':
      return weights.envelope;
    case 'activity':
      return weights.voiceActivity;
    case 'cutoff':
      return weights.cutoff;
    case 'resonance':
      return weights.resonance;
    case 'filterRouting':
      return weights.filterRouting;
    case 'volume':
      return weights.volume;
    case 'writeDensity':
      return weights.writeDensity;
    default:
      throw new Error(`Unknown feature dimension: ${dimension}`);
  }
}

function rawNoveltyCurve(matrix: FeatureMatrix, dimensionWeights: Float64Array): Float32Array {
  const { frames } = matrix;
  const raw = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    raw[f] = rowDistance(matrix, f, f - 1, dimensionWeights);
  }
  return raw;
}

/** The weighted, per-dimension share of the distance between frame `frame` and its predecessor —
 *  the same numbers that sum to the raw curve and that contributor attribution ranks. */
function frameContributions(
  matrix: FeatureMatrix,
  frame: number,
  dimensionWeights: Float64Array,
  out: Float64Array
): void {
  const row = frame * FEATURE_DIMENSION_COUNT;
  const previousRow = row - FEATURE_DIMENSION_COUNT;
  for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
    out[d] = dimensionWeights[d] * Math.abs(matrix.values[row + d] - matrix.values[previousRow + d]);
  }
}

function topContributors(
  matrix: FeatureMatrix,
  frame: number,
  dimensionWeights: Float64Array
): readonly string[] {
  if (frame === 0) {
    return [];
  }

  const contribution = new Float64Array(FEATURE_DIMENSION_COUNT);
  frameContributions(matrix, frame, dimensionWeights, contribution);

  const ranked: number[] = [];
  for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
    if (contribution[d] > 0) {
      ranked.push(d);
    }
  }
  ranked.sort((a, b) => contribution[b] - contribution[a]);

  return ranked.slice(0, MAX_CONTRIBUTORS).map((d) => FEATURE_DIMENSIONS[d]);
}

/** Roughly a tenth of a second of frames, derived via `framesToSeconds` rather than a hardcoded tick
 *  count so the intent — smooth over real time, not an arbitrary number of rows — stays legible. */
function smoothingWindowRadius(): number {
  const secondsPerFrame = framesToSeconds(1, NOMINAL_FRAME_INTERVAL_US, NOMINAL_CALLS_PER_FRAME);
  const windowFrames = Math.max(1, Math.round(SMOOTHING_WINDOW_SECONDS / secondsPerFrame));
  return Math.max(1, Math.floor(windowFrames / 2));
}

function smooth(raw: Float32Array, radius: number): Float32Array {
  const { length } = raw;
  const result = new Float32Array(length);
  for (let f = 0; f < length; f++) {
    const start = Math.max(0, f - radius);
    const end = Math.min(length - 1, f + radius);
    let sum = 0;
    for (let i = start; i <= end; i++) {
      sum += raw[i];
    }
    result[f] = sum / (end - start + 1);
  }
  return result;
}

/** Normalises to the curve's own maximum so a threshold means the same thing on a quiet tune and a
 *  busy one. */
function normalise(values: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > max) {
      max = values[i];
    }
  }
  if (max === 0) {
    return new Float32Array(values.length);
  }

  const result = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    result[i] = values[i] / max;
  }
  return result;
}

/** Local maxima of `curve`, plateau-aware: a flat-topped bump — the shape a box-smoothed single-frame
 *  event produces — reports once, at its midpoint, rather than not at all. */
function findPeaks(curve: Float32Array): readonly number[] {
  const peaks: number[] = [];
  const { length } = curve;
  let i = 1;
  while (i < length - 1) {
    if (curve[i] > curve[i - 1]) {
      let j = i;
      while (j < length - 1 && curve[j + 1] === curve[j]) {
        j++;
      }
      if (j < length - 1 && curve[j + 1] < curve[j]) {
        peaks.push(Math.floor((i + j) / 2));
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return peaks;
}
