import { FEATURE_DIMENSION_COUNT } from './frame-features';
import type { FeatureMatrix } from './frame-features';
import { dimensionWeightsFor, rowDistance } from './novelty';
import type { FeatureWeights } from './novelty';

export interface StructureResult {
  readonly blockCount: number;
  readonly blockFrames: number; // frames aggregated into each block
  readonly matrix: Float32Array; // blockCount * blockCount, 0..1 similarity
  readonly sectionBoundaries: readonly number[]; // frame numbers
}

/** A ceiling-length scan is roughly 15,000 frames; comparing every frame against every other is
 *  over two hundred million cell computations for something drawn a few hundred pixels wide. */
const DEFAULT_BLOCK_COUNT = 256;

/** How far back a block's own recent history reaches when judging whether it breaks from it — a
 *  boundary is a departure from a *run*, not from the single previous block. */
const BOUNDARY_RUN_BLOCKS = 4;

/** Only departures within this fraction of the strongest one in the tune count as boundaries, which
 *  is what keeps the boundary set small rather than one entry per block. */
const BOUNDARY_STRENGTH_FRACTION = 0.5;

/**
 * Compares the tune against itself at block resolution to reveal its arrangement: the similarity
 * square the panel paints, and the section boundaries the per-section key detection runs against.
 * Reuses the shared feature matrix and the novelty curve's own weighted distance rather than building
 * a second notion of "how different are these two moments."
 *
 * Perceptual work only — how the tune is *arranged*. Where it starts repeating is a separate,
 * byte-exact question over the raw register stream; see `detectLoop`.
 */
export function computeStructure(matrix: FeatureMatrix, weights: FeatureWeights): StructureResult {
  const { blockCount, blockFrames } = resolveBlocking(matrix.frames);
  const dimensionWeights = dimensionWeightsFor(weights);
  const maxDistance = sumOf(dimensionWeights);

  if (blockCount === 0) {
    return { blockCount: 0, blockFrames: 0, matrix: new Float32Array(0), sectionBoundaries: [] };
  }

  const blockMatrix = buildBlockMatrix(matrix, blockCount, blockFrames);
  const similarity = buildSimilarityMatrix(blockMatrix, blockCount, dimensionWeights, maxDistance);
  const sectionBoundaries = computeSectionBoundaries(similarity, blockCount, blockFrames);

  return { blockCount, blockFrames, matrix: similarity, sectionBoundaries };
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
