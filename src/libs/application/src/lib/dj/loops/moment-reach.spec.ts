import { describe, it, expect } from 'vitest';
import { nextOffset, reachableOffsets } from './moment-reach';

const CLUSTERED = [118, 126, 127, 340, 4_012, 4_015, 4_016, 9_987];

describe('reachableOffsets', () => {
  it('lists offsets on both sides of the anchor, ascending', () => {
    expect(reachableOffsets(CLUSTERED, 4_014, 50)).toEqual([-2, 1, 2]);
  });

  it('includes an offset exactly at the range and excludes one frame beyond it', () => {
    expect(reachableOffsets([150], 100, 50)).toEqual([50]);
    expect(reachableOffsets([151], 100, 50)).toEqual([]);
    expect(reachableOffsets([50], 100, 50)).toEqual([-50]);
    expect(reachableOffsets([49], 100, 50)).toEqual([]);
  });

  it('collapses repeated frames to one offset', () => {
    expect(reachableOffsets([4_012, 4_012, 4_012], 4_000, 50)).toEqual([12]);
  });

  it('is empty when every moment is out of range or there are none', () => {
    expect(reachableOffsets(CLUSTERED, 0, 50)).toEqual([]);
    expect(reachableOffsets([], 4_000, 50)).toEqual([]);
  });

  it('reaches only an exact hit when the range is zero', () => {
    expect(reachableOffsets([100, 101], 100, 0)).toEqual([0]);
  });
});

describe('nextOffset', () => {
  it('steps outward through successive moments and ends at the edge in both directions', () => {
    expect(nextOffset(CLUSTERED, 4_000, 0, 50, 'next')).toBe(12);
    expect(nextOffset(CLUSTERED, 4_000, 12, 50, 'next')).toBe(15);
    expect(nextOffset(CLUSTERED, 4_000, 15, 50, 'next')).toBe(16);
    expect(nextOffset(CLUSTERED, 4_000, 16, 50, 'next')).toBeNull();

    expect(nextOffset(CLUSTERED, 4_000, 16, 50, 'previous')).toBe(15);
    expect(nextOffset(CLUSTERED, 4_000, 15, 50, 'previous')).toBe(12);
    expect(nextOffset(CLUSTERED, 4_000, 12, 50, 'previous')).toBeNull();
  });

  it('goes strictly beyond the current offset, even when it is not itself a moment', () => {
    expect(nextOffset(CLUSTERED, 4_000, 13, 50, 'next')).toBe(15);
    expect(nextOffset(CLUSTERED, 4_000, 13, 50, 'previous')).toBe(12);
  });

  it('is null with nothing in reach', () => {
    expect(nextOffset([], 4_000, 0, 50, 'next')).toBeNull();
    expect(nextOffset(CLUSTERED, 0, 0, 50, 'previous')).toBeNull();
  });
});
