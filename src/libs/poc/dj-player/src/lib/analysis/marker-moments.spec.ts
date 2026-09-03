import { describe, it, expect } from 'vitest';
import { nextMomentOffset, reachableMomentOffsets } from './marker-moments';
import type { DetectedMoment } from './tune-index.model';

function moment(frame: number, strength = 0.8): DetectedMoment {
  return { frame, strength };
}

/** A realistic scatter of detected moments — clustered around a handful of musical changes rather
 *  than spaced evenly, the way a real tune's novelty peaks actually land: a pair of hits early on,
 *  a lone one further out, a tight triple mid-tune, and a straggler near the end. */
const CLUSTERED_MOMENTS: readonly DetectedMoment[] = [
  moment(118),
  moment(126),
  moment(127),
  moment(340),
  moment(4_012),
  moment(4_015),
  moment(4_016),
  moment(9_987),
];

/** A second cluster sitting right at the start of a tune, standing in for markers captured early —
 *  where the reachable window's negative edge runs past frame 0. */
const NEAR_START_MOMENTS: readonly DetectedMoment[] = [
  moment(4),
  moment(9),
  moment(10),
  moment(500),
];

describe('reachableMomentOffsets', () => {
  it('returns offsets on both sides of the captured frame, ascending', () => {
    expect(reachableMomentOffsets(CLUSTERED_MOMENTS, 4_014, 50)).toEqual([-2, 1, 2]);
  });

  it('includes an offset exactly at the boundary and excludes one frame beyond it', () => {
    expect(reachableMomentOffsets([moment(150)], 100, 50)).toEqual([50]);
    expect(reachableMomentOffsets([moment(151)], 100, 50)).toEqual([]);
    expect(reachableMomentOffsets([moment(50)], 100, 50)).toEqual([-50]);
    expect(reachableMomentOffsets([moment(49)], 100, 50)).toEqual([]);
  });

  it('collapses duplicate frames to a single offset', () => {
    const offsets = reachableMomentOffsets(
      [moment(4_012), moment(4_012), moment(4_012, 0.3)],
      4_000,
      50
    );
    expect(offsets).toEqual([12]);
  });

  it('returns an empty list when every moment is out of range', () => {
    expect(reachableMomentOffsets(CLUSTERED_MOMENTS, 0, 50)).toEqual([]);
  });

  it('returns an empty list for an empty moment list', () => {
    expect(reachableMomentOffsets([], 4_000, 50)).toEqual([]);
  });

  it('produces negative offsets for a capture near the start of the tune', () => {
    expect(reachableMomentOffsets(NEAR_START_MOMENTS, 12, 20)).toEqual([-8, -3, -2]);
  });
});

describe('nextMomentOffset', () => {
  it('steps outward through successive moments and disables at the edge, mirrored in both directions', () => {
    const capturedFrame = 4_000;
    const range = 50;

    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 0, range, 1)).toBe(12);
    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 12, range, 1)).toBe(15);
    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 15, range, 1)).toBe(16);
    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 16, range, 1)).toBeNull();

    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 16, range, -1)).toBe(15);
    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 15, range, -1)).toBe(12);
    expect(nextMomentOffset(CLUSTERED_MOMENTS, capturedFrame, 12, range, -1)).toBeNull();
  });

  it('skips a moment sitting exactly on the current offset, in both directions', () => {
    const moments = [moment(4_012)];
    expect(nextMomentOffset(moments, 4_000, 12, 50, 1)).toBeNull();
    expect(nextMomentOffset(moments, 4_000, 12, 50, -1)).toBeNull();
  });

  it('treats the window boundary as reachable, and one frame beyond it as not', () => {
    const moments = [moment(4_050)];
    expect(nextMomentOffset(moments, 4_000, 40, 50, 1)).toBe(50);
    expect(nextMomentOffset(moments, 4_000, 50, 50, 1)).toBeNull();
  });

  it('returns null for an empty moment list regardless of direction', () => {
    expect(nextMomentOffset([], 4_000, 0, 50, 1)).toBeNull();
    expect(nextMomentOffset([], 4_000, 0, 50, -1)).toBeNull();
  });

  it('walks negative offsets outward for a capture near the start of the tune', () => {
    expect(nextMomentOffset(NEAR_START_MOMENTS, 12, 0, 20, -1)).toBe(-2);
    expect(nextMomentOffset(NEAR_START_MOMENTS, 12, -2, 20, -1)).toBe(-3);
    expect(nextMomentOffset(NEAR_START_MOMENTS, 12, -3, 20, -1)).toBe(-8);
    expect(nextMomentOffset(NEAR_START_MOMENTS, 12, -8, 20, -1)).toBeNull();
  });
});
