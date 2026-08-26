import { FEATURE_DIMENSION_COUNT } from './frame-features';
import type { FeatureMatrix } from './frame-features';
import { dimensionWeightsFor, rowDistance } from './novelty';
import type { FeatureWeights } from './novelty';

export interface StructureResult {
  readonly blockCount: number;
  readonly blockFrames: number; // frames aggregated into each block
  readonly matrix: Float32Array; // blockCount * blockCount, 0..1 similarity
  readonly sectionBoundaries: readonly number[]; // frame numbers
  readonly loopFrame: number | null; // frame-refined; null = no repeat found
}

/** A ceiling-length scan is roughly 15,000 frames; comparing every frame against every other is
 *  over two hundred million cell computations for something drawn a few hundred pixels wide. */
const DEFAULT_BLOCK_COUNT = 256;

/** A block counts as "the same moment" once its distance has closed to within this fraction of the
 *  worst-case distance under the current weights — loose enough to tolerate the block-average
 *  blurring a genuine repeat that doesn't land on a block boundary, tight enough that two otherwise
 *  unrelated blocks don't pass by chance. */
const LOOP_SIMILARITY_THRESHOLD = 0.85;

/** How many consecutive blocks must agree before a coarse candidate is trusted. Isolated matching
 *  blocks are common in repetitive music; requiring a run this long is what keeps a single recurring
 *  drum fill from being mistaken for the tune looping. */
const MIN_SUSTAINED_RUN_BLOCKS = 8;

/** How far back a block's own recent history reaches when judging whether it breaks from it — a
 *  boundary is a departure from a *run*, not from the single previous block. */
const BOUNDARY_RUN_BLOCKS = 4;

/** Only departures within this fraction of the strongest one in the tune count as boundaries, which
 *  is what keeps the boundary set small rather than one entry per block. */
const BOUNDARY_STRENGTH_FRACTION = 0.5;

/**
 * Compares the tune against itself at block resolution to reveal its arrangement (the similarity
 * square, section boundaries) and, from the same comparison, the point where the tune starts
 * repeating itself — its real length. Reuses the shared feature matrix and the novelty curve's own
 * weighted distance rather than building a second notion of "how different are these two moments."
 */
export function computeStructure(matrix: FeatureMatrix, weights: FeatureWeights): StructureResult {
  const { blockCount, blockFrames } = resolveBlocking(matrix.frames);
  const dimensionWeights = dimensionWeightsFor(weights);
  const maxDistance = sumOf(dimensionWeights);

  if (blockCount === 0) {
    return { blockCount: 0, blockFrames: 0, matrix: new Float32Array(0), sectionBoundaries: [], loopFrame: null };
  }

  const blockMatrix = buildBlockMatrix(matrix, blockCount, blockFrames);
  const similarity = buildSimilarityMatrix(blockMatrix, blockCount, dimensionWeights, maxDistance);
  const sectionBoundaries = computeSectionBoundaries(similarity, blockCount, blockFrames);
  const loopFrame = findLoopFrame(similarity, matrix, blockCount, blockFrames, dimensionWeights);

  return { blockCount, blockFrames, matrix: similarity, sectionBoundaries, loopFrame };
}

/** Aggregates however many frames were scanned into a fixed number of blocks — the aggregation that
 *  keeps a ceiling-length scan from costing hundreds of millions of cell comparisons. Below the
 *  default block count, every frame gets its own block: there is nothing left to aggregate. */
function resolveBlocking(frames: number): { blockCount: number; blockFrames: number } {
  if (frames <= 0) {
    return { blockCount: 0, blockFrames: 0 };
  }
  const blockFrames = Math.max(1, Math.ceil(frames / DEFAULT_BLOCK_COUNT));
  const blockCount = Math.ceil(frames / blockFrames);
  return { blockCount, blockFrames };
}

function buildBlockMatrix(matrix: FeatureMatrix, blockCount: number, blockFrames: number): FeatureMatrix {
  const values = new Float32Array(blockCount * FEATURE_DIMENSION_COUNT);
  for (let block = 0; block < blockCount; block++) {
    const start = block * blockFrames;
    const end = Math.min(matrix.frames, start + blockFrames);
    const count = Math.max(1, end - start);
    const outRow = block * FEATURE_DIMENSION_COUNT;
    for (let f = start; f < end; f++) {
      const inRow = f * FEATURE_DIMENSION_COUNT;
      for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
        values[outRow + d] += matrix.values[inRow + d];
      }
    }
    for (let d = 0; d < FEATURE_DIMENSION_COUNT; d++) {
      values[outRow + d] /= count;
    }
  }
  return { values, frames: blockCount };
}

/** Every cell is a bounded distance mapped to 0..1, so the matrix renders directly as opacity without
 *  further scaling. The diagonal is forced to exactly 1 rather than left to fall out of the distance
 *  computation, so it is maximal regardless of floating-point rounding. */
function buildSimilarityMatrix(
  blockMatrix: FeatureMatrix,
  blockCount: number,
  dimensionWeights: Float64Array,
  maxDistance: number
): Float32Array {
  const similarity = new Float32Array(blockCount * blockCount);
  for (let i = 0; i < blockCount; i++) {
    similarity[i * blockCount + i] = 1;
    for (let j = i + 1; j < blockCount; j++) {
      const distance = rowDistance(blockMatrix, i, j, dimensionWeights);
      const value = maxDistance <= 0 ? 1 : clamp01(1 - distance / maxDistance);
      similarity[i * blockCount + j] = value;
      similarity[j * blockCount + i] = value;
    }
  }
  return similarity;
}

interface DiagonalRun {
  readonly length: number;
  readonly start: number; // block index where the run begins
}

/** The longest consecutive run of blocks whose similarity at `offset` stays at or above `threshold` —
 *  a diagonal stripe parallel to the main diagonal, the shape a repeating section draws in the matrix. */
function longestRunAtOffset(
  similarity: Float32Array,
  blockCount: number,
  offset: number,
  threshold: number
): DiagonalRun {
  let longest = 0;
  let longestStart = 0;
  let currentStart = 0;
  let current = 0;
  for (let i = 0; i + offset < blockCount; i++) {
    if (similarity[i * blockCount + (i + offset)] >= threshold) {
      if (current === 0) {
        currentStart = i;
      }
      current++;
      if (current > longest) {
        longest = current;
        longestStart = currentStart;
      }
    } else {
      current = 0;
    }
  }
  return { length: longest, start: longestStart };
}

/**
 * The coarse-then-refine search the loop point comes from. The block comparison finds the smallest
 * offset at which the block sequence starts matching itself over a sustained run; that offset is only
 * accurate to `blockFrames`, so refinement then scans every individual frame offset within one block
 * width of it and takes whichever compares closest — a few hundred comparisons, not thousands.
 */
function findLoopFrame(
  similarity: Float32Array,
  matrix: FeatureMatrix,
  blockCount: number,
  blockFrames: number,
  dimensionWeights: Float64Array
): number | null {
  for (let offsetBlocks = 1; offsetBlocks < blockCount; offsetBlocks++) {
    const run = longestRunAtOffset(similarity, blockCount, offsetBlocks, LOOP_SIMILARITY_THRESHOLD);
    if (run.length < MIN_SUSTAINED_RUN_BLOCKS) {
      continue;
    }
    const anchorFrame = run.start * blockFrames;
    const refined = refineLoopOffset(matrix, anchorFrame, offsetBlocks * blockFrames, blockFrames, dimensionWeights);
    if (refined !== null) {
      return refined;
    }
  }
  return null;
}

/** Picks the frame offset with the smallest weighted distance within `±blockFrames` of the coarse
 *  block-level estimate, anchored at the frame where the sustained block-level run begins. */
function refineLoopOffset(
  matrix: FeatureMatrix,
  anchorFrame: number,
  coarseFrameOffset: number,
  blockFrames: number,
  dimensionWeights: Float64Array
): number | null {
  let bestOffset: number | null = null;
  let bestDistance = Infinity;
  const from = Math.max(1, coarseFrameOffset - blockFrames);
  const to = coarseFrameOffset + blockFrames;
  for (let offset = from; offset <= to; offset++) {
    const otherFrame = anchorFrame + offset;
    if (otherFrame >= matrix.frames) {
      continue;
    }
    const distance = rowDistance(matrix, anchorFrame, otherFrame, dimensionWeights);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/** A boundary is a block whose similarity to its own recent run of predecessors drops sharply — the
 *  block-scale equivalent of the novelty curve, but measured against a short run rather than a single
 *  previous block, and reported only at its strongest departures so the set stays small. */
function computeSectionBoundaries(
  similarity: Float32Array,
  blockCount: number,
  blockFrames: number
): readonly number[] {
  if (blockCount < 2) {
    return [];
  }

  const runLength = Math.min(BOUNDARY_RUN_BLOCKS, blockCount - 1);
  const departure = new Float32Array(blockCount);
  let maxDeparture = 0;
  for (let block = 1; block < blockCount; block++) {
    const windowStart = Math.max(0, block - runLength);
    let sum = 0;
    for (let j = windowStart; j < block; j++) {
      sum += similarity[block * blockCount + j];
    }
    const value = 1 - sum / (block - windowStart);
    departure[block] = value;
    if (value > maxDeparture) {
      maxDeparture = value;
    }
  }

  if (maxDeparture <= 0) {
    return [];
  }

  const threshold = maxDeparture * BOUNDARY_STRENGTH_FRACTION;
  const candidates: number[] = [];
  for (let block = 1; block < blockCount; block++) {
    const next = block + 1 < blockCount ? departure[block + 1] : -Infinity;
    if (departure[block] >= threshold && departure[block] >= departure[block - 1] && departure[block] >= next) {
      candidates.push(block);
    }
  }

  candidates.sort((a, b) => departure[b] - departure[a]);
  const accepted: number[] = [];
  for (const candidate of candidates) {
    if (accepted.every((existing) => Math.abs(existing - candidate) >= runLength)) {
      accepted.push(candidate);
    }
  }
  accepted.sort((a, b) => a - b);
  return accepted.map((block) => block * blockFrames);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sumOf(values: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum;
}
