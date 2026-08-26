import { describe, it, expect } from 'vitest';
import { FEATURE_DIMENSION_COUNT, framesToSeconds } from './frame-features';
import type { FeatureMatrix } from './frame-features';
import { computeStructure } from './structure';
import type { FeatureWeights } from './novelty';

/** Every dimension weighed the same, so a block or frame's distance from another is just the plain
 *  sum of per-dimension differences — the simplest possible lens for reasoning about the synthetic
 *  matrices below. */
const UNIFORM_WEIGHTS: FeatureWeights = {
  pitch: 1,
  gate: 1,
  waveform: 1,
  envelope: 1,
  voiceActivity: 1,
  cutoff: 1,
  resonance: 1,
  filterRouting: 1,
  volume: 1,
  writeDensity: 1,
};

/** A deterministic hash, spread enough across (index, dimension) pairs that two unrelated indices
 *  never resemble each other by chance. */
function pseudoRandom(index: number, dimension: number): number {
  const x = Math.sin(index * 12.9898 + dimension * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function zeroMatrix(frames: number): FeatureMatrix {
  return { values: new Float32Array(frames * FEATURE_DIMENSION_COUNT), frames };
}

/** `blockFrames` depends only on frame count, never on content, so it can be read off a throwaway
 *  matrix before the real content — built to a known block width — is constructed. */
function discoverBlockFrames(frames: number): number {
  return computeStructure(zeroMatrix(frames), UNIFORM_WEIGHTS).blockFrames;
}

/**
 * Content that is constant within each `blockFrames`-wide window (so block-averaging never blurs it)
 * and unique from one window to the next, with one dimension reserved for a within-window ramp. A
 * repeat built from this content at an offset that isn't a multiple of `blockFrames` is recovered by
 * the frame-level refinement but not by the block-level coarse pass alone, which is exactly the case
 * "refined to frame resolution rather than the nearest block" needs to exercise.
 */
function buildStructuredValues(frames: number, blockFrames: number, period: number): Float32Array {
  const values = new Float32Array(frames * FEATURE_DIMENSION_COUNT);
  for (let f = 0; f < frames; f++) {
    const x = f % period;
    const block = Math.floor(x / blockFrames);
    const phase = x % blockFrames;
    const row = f * FEATURE_DIMENSION_COUNT;
    for (let d = 0; d < FEATURE_DIMENSION_COUNT - 1; d++) {
      values[row + d] = pseudoRandom(block, d);
    }
    values[row + FEATURE_DIMENSION_COUNT - 1] = phase / blockFrames;
  }
  return values;
}

/** The same block-constant construction with no period at all — every window is unique for the
 *  entire length of the matrix, so no offset ever agrees with itself. */
function buildNonRepeatingValues(frames: number, blockFrames: number): Float32Array {
  return buildStructuredValues(frames, blockFrames, frames + blockFrames);
}

function diagonalIsMaximal(matrix: Float32Array, blockCount: number): boolean {
  for (let i = 0; i < blockCount; i++) {
    if (matrix[i * blockCount + i] !== 1) {
      return false;
    }
  }
  return true;
}

describe('computeStructure — loop point', () => {
  it('finds a repeat offset that falls between block boundaries and refines it to the exact frame', () => {
    const frames = 3000;
    const blockFrames = discoverBlockFrames(frames);
    const offsetBlocks = 10; // comfortably above the sustained-run guard
    const blockMisalignment = 1; // keeps the true offset off the block grid
    const trueOffset = offsetBlocks * blockFrames + blockMisalignment;

    const matrix: FeatureMatrix = {
      values: buildStructuredValues(frames, blockFrames, trueOffset),
      frames,
    };

    const result = computeStructure(matrix, UNIFORM_WEIGHTS);

    expect(result.loopFrame).toBe(trueOffset);
    expect(result.loopFrame).not.toBe(offsetBlocks * blockFrames); // not merely the block-quantized guess
    expect(result.matrix.length).toBe(result.blockCount * result.blockCount);
    expect(diagonalIsMaximal(result.matrix, result.blockCount)).toBe(true);
    expect(result.sectionBoundaries.length).toBeLessThan(result.blockCount);
  });

  it('reports no loop point for a tune that never repeats', () => {
    const frames = 2000;
    const blockFrames = discoverBlockFrames(frames);
    const matrix: FeatureMatrix = { values: buildNonRepeatingValues(frames, blockFrames), frames };

    const result = computeStructure(matrix, UNIFORM_WEIGHTS);

    expect(result.loopFrame).toBeNull();
  });

  it('does not report a loop point when the agreement is brief rather than sustained', () => {
    const frames = 2000;
    const blockFrames = discoverBlockFrames(frames);
    const values = buildNonRepeatingValues(frames, blockFrames);

    // Copies a couple of blocks' worth of frames from earlier in the tune to a later position —
    // an isolated coincidence, well short of the sustained-run guard.
    const briefOffsetFrames = 40 * blockFrames;
    const briefLengthFrames = 2 * blockFrames;
    const copyStart = 80 * blockFrames;
    for (let i = 0; i < briefLengthFrames; i++) {
      const src = (copyStart - briefOffsetFrames + i) * FEATURE_DIMENSION_COUNT;
      const dst = (copyStart + i) * FEATURE_DIMENSION_COUNT;
      values.copyWithin(dst, src, src + FEATURE_DIMENSION_COUNT);
    }
    const matrix: FeatureMatrix = { values, frames };

    const result = computeStructure(matrix, UNIFORM_WEIGHTS);

    expect(result.loopFrame).toBeNull();
  });

  it('halves the reported duration for a multispeed tune with callsPerFrame doubled', () => {
    const frames = 3000;
    const blockFrames = discoverBlockFrames(frames);
    const trueOffset = 10 * blockFrames + 1;
    const matrix: FeatureMatrix = {
      values: buildStructuredValues(frames, blockFrames, trueOffset),
      frames,
    };

    const result = computeStructure(matrix, UNIFORM_WEIGHTS);
    expect(result.loopFrame).not.toBeNull();
    const loopFrame = result.loopFrame as number;

    const singleSpeedSeconds = framesToSeconds(loopFrame, 20_000, 1);
    const doubleSpeedSeconds = framesToSeconds(loopFrame, 20_000, 2);

    expect(doubleSpeedSeconds).toBeCloseTo(singleSpeedSeconds / 2);
  });
});

describe('computeStructure — matrix dimensions', () => {
  it('keeps the matrix at blockCount² entries and bounds blockCount regardless of scan length', () => {
    const small = computeStructure(zeroMatrix(40), UNIFORM_WEIGHTS);
    expect(small.matrix.length).toBe(small.blockCount * small.blockCount);

    const ceilingLength = computeStructure(zeroMatrix(15_000), UNIFORM_WEIGHTS);
    expect(ceilingLength.matrix.length).toBe(ceilingLength.blockCount * ceilingLength.blockCount);
    expect(ceilingLength.blockCount).toBeLessThanOrEqual(256);
    expect(ceilingLength.blockCount).toBeLessThan(15_000 / 10);
    expect(diagonalIsMaximal(ceilingLength.matrix, ceilingLength.blockCount)).toBe(true);
  });
});
