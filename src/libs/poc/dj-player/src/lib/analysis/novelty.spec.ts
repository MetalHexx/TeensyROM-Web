import { describe, it, expect } from 'vitest';
import { FEATURE_DIMENSIONS, FEATURE_DIMENSION_COUNT } from './frame-features';
import type { FeatureMatrix } from './frame-features';
import {
  computeNovelty,
  candidatesAbove,
  DEFAULT_CANDIDATE_THRESHOLD,
  DEFAULT_FEATURE_WEIGHTS,
} from './novelty';
import type { Candidate, FeatureWeights } from './novelty';

/** A stable, mid-range value for every dimension — distinct from 0 or 1 so a dimension that never
 *  changes never contributes to the curve, and edits to a single dimension in a test are unambiguous. */
function baselineRow(): number[] {
  const voice = [0.5, 1, 0.3, 0.4, 1]; // pitch, gate, waveform, envelope, activity
  return [...voice, ...voice, ...voice, 0.5, 0.2, 0.1, 0.6, 0.2]; // + cutoff, resonance, filterRouting, volume, writeDensity
}

function buildMatrix(rows: readonly (readonly number[])[]): FeatureMatrix {
  const frames = rows.length;
  const values = new Float32Array(frames * FEATURE_DIMENSION_COUNT);
  rows.forEach((row, f) => {
    if (row.length !== FEATURE_DIMENSION_COUNT) {
      throw new Error(`row ${f} has ${row.length} values, expected ${FEATURE_DIMENSION_COUNT}`);
    }
    values.set(row, f * FEATURE_DIMENSION_COUNT);
  });
  return { values, frames };
}

function dimensionIndex(name: string): number {
  const index = FEATURE_DIMENSIONS.indexOf(name);
  if (index < 0) {
    throw new Error(`unknown dimension ${name}`);
  }
  return index;
}

function findPeakNear(
  candidates: readonly Candidate[],
  target: number,
  tolerance: number
): Candidate {
  const found = candidates.find((c) => Math.abs(c.frame - target) <= tolerance);
  if (!found) {
    throw new Error(`no candidate within ${tolerance} frames of ${target}`);
  }
  return found;
}

describe('computeNovelty — drop-out (load-bearing)', () => {
  it('produces a peak exactly where every voice drops out and nothing else changes', () => {
    const frames = 40;
    const dropoutFrame = 20;
    const rows: number[][] = [];
    for (let f = 0; f < frames; f++) {
      const row = baselineRow();
      if (f >= dropoutFrame) {
        row[dimensionIndex('voice0.activity')] = 0;
        row[dimensionIndex('voice1.activity')] = 0;
        row[dimensionIndex('voice2.activity')] = 0;
      }
      rows.push(row);
    }
    const matrix = buildMatrix(rows);

    const result = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);

    expect(result.candidates.map((c) => c.frame)).toContain(dropoutFrame);
    const peak = findPeakNear(result.candidates, dropoutFrame, 0);
    expect(peak.strength).toBeGreaterThan(0);
    expect(peak.contributors).toEqual(
      expect.arrayContaining(['voice0.activity', 'voice1.activity', 'voice2.activity'])
    );

    // A design built on note onsets would see nothing here: no gate ever fires, no waveform or
    // pitch register moves — only the activity dimensions fall silent. The curve is flat everywhere
    // but the smoothed neighbourhood of the drop-out.
    expect(result.curve[0]).toBe(0);
    expect(result.curve[frames - 1]).toBe(0);
  });
});

describe('computeNovelty — filter sweep and weighting', () => {
  function sweepMatrix(): FeatureMatrix {
    const frames = 60;
    const gateEventFrame = 10;
    const sweepStart = 30;
    const sweepEnd = 40;
    const rows: number[][] = [];
    for (let f = 0; f < frames; f++) {
      const row = baselineRow();
      if (f >= gateEventFrame) {
        row[dimensionIndex('voice0.gate')] = 0;
      }
      if (f >= sweepStart && f <= sweepEnd) {
        const t = (f - sweepStart) / (sweepEnd - sweepStart);
        row[dimensionIndex('cutoff')] = 0.1 + t * 0.8;
      } else if (f > sweepEnd) {
        row[dimensionIndex('cutoff')] = 0.9;
      }
      rows.push(row);
    }
    return buildMatrix(rows);
  }

  it('produces a peak over the sweep, attributed to cutoff', () => {
    const matrix = sweepMatrix();

    const result = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);

    const sweepPeak = findPeakNear(result.candidates, 35, 6);
    expect(sweepPeak.contributors).toEqual(['cutoff']);
  });

  it('raising the cutoff weight makes the sweep peak stronger relative to the rest of the curve', () => {
    const matrix = sweepMatrix();

    const defaultResult = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);
    const defaultGatePeak = findPeakNear(defaultResult.candidates, 10, 4);
    const defaultSweepPeak = findPeakNear(defaultResult.candidates, 35, 6);
    const defaultRatio = defaultSweepPeak.strength / defaultGatePeak.strength;

    const boostedWeights: FeatureWeights = { ...DEFAULT_FEATURE_WEIGHTS, cutoff: 6 };
    const boostedResult = computeNovelty(matrix, boostedWeights);
    const boostedGatePeak = findPeakNear(boostedResult.candidates, 10, 4);
    const boostedSweepPeak = findPeakNear(boostedResult.candidates, 35, 6);
    const boostedRatio = boostedSweepPeak.strength / boostedGatePeak.strength;

    expect(boostedRatio).toBeGreaterThan(defaultRatio);
  });
});

describe('candidatesAbove', () => {
  // The one place this constant's value is pinned — every other reader imports it rather than
  // re-asserting the number.
  it('defaults "strong enough to be a real moment" to 0.5', () => {
    expect(DEFAULT_CANDIDATE_THRESHOLD).toBe(0.5);
  });

  it('filters purely: the candidate count changes with the threshold, the curve never does', () => {
    const frames = 40;
    const rows: number[][] = [];
    for (let f = 0; f < frames; f++) {
      const row = baselineRow();
      if (f === 10) {
        row[dimensionIndex('voice0.gate')] = 0;
      }
      if (f === 25) {
        row[dimensionIndex('voice0.activity')] = 0;
        row[dimensionIndex('voice1.activity')] = 0;
        row[dimensionIndex('voice2.activity')] = 0;
      }
      rows.push(row);
    }
    const matrix = buildMatrix(rows);
    const result = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);
    const curveBefore = result.curve;

    const lenient = candidatesAbove(result, 0.05);
    const strict = candidatesAbove(result, 0.95);

    expect(lenient.length).toBeGreaterThan(strict.length);
    expect(result.curve).toBe(curveBefore);
  });
});
