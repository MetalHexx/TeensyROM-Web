import { describe, it, expect } from 'vitest';
import { FEATURE_DIMENSION_COUNT } from './frame-features';
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

function zeroMatrix(frames: number): FeatureMatrix {
  return { values: new Float32Array(frames * FEATURE_DIMENSION_COUNT), frames };
}

function diagonalIsMaximal(matrix: Float32Array, blockCount: number): boolean {
  for (let i = 0; i < blockCount; i++) {
    if (matrix[i * blockCount + i] !== 1) {
      return false;
    }
  }
  return true;
}

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
