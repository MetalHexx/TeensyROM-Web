import { describe, it, expect } from 'vitest';
import type { DeckBeatGrid } from '../dj-store';
import { beatAt, bpmOf, formatBpm, inGridSpan, nearestBeat } from './beat-math';

function grid(overrides: Partial<DeckBeatGrid> = {}): DeckBeatGrid {
  return {
    beatFrames: 25,
    beatOneFrame: 10,
    startFrame: 0,
    endFrame: null,
    source: 'scan',
    ...overrides,
  };
}

describe('inGridSpan', () => {
  it('includes the start frame and excludes the end frame', () => {
    const spanned = grid({ startFrame: 100, endFrame: 200 });

    expect(inGridSpan(spanned, 99)).toBe(false);
    expect(inGridSpan(spanned, 100)).toBe(true);
    expect(inGridSpan(spanned, 199)).toBe(true);
    expect(inGridSpan(spanned, 200)).toBe(false);
  });

  it('runs to the end of the tune with no end frame', () => {
    expect(inGridSpan(grid(), 10_000_000)).toBe(true);
  });
});

describe('bpmOf', () => {
  it('turns a beat length in play calls into beats per minute', () => {
    // 25 calls of 20 ms is half a second a beat.
    expect(bpmOf(25, 20_000, 1)).toBeCloseTo(120);
  });

  it('scales with the played speed and follows the play call interval', () => {
    expect(bpmOf(25, 20_000, 1.5)).toBeCloseTo(180);
    expect(bpmOf(50, 10_000, 1)).toBeCloseTo(120);
  });
});

describe('formatBpm', () => {
  it('shows two decimals, and dashes with no tempo', () => {
    expect(formatBpm(125.3125)).toBe('125.31 BPM');
    expect(formatBpm(null)).toBe('---.-- BPM');
  });
});

describe('beatAt', () => {
  it('counts beats from beat one with the phase through the beat', () => {
    expect(beatAt(grid(), 10)).toEqual({ beat: 0, phase: 0 });
    expect(beatAt(grid(), 22.5).beat).toBe(0);
    expect(beatAt(grid(), 22.5).phase).toBeCloseTo(0.5);
    expect(beatAt(grid(), 35)).toEqual({ beat: 1, phase: 0 });
  });

  it('counts negative beats before beat one', () => {
    const before = beatAt(grid(), -5);

    expect(before.beat).toBe(-1);
    expect(before.phase).toBeCloseTo(0.4);
  });
});

describe('nearestBeat', () => {
  it('returns the closest beat frame', () => {
    expect(nearestBeat(grid(), 20)).toBe(10);
    expect(nearestBeat(grid(), 26)).toBe(35);
    expect(nearestBeat(grid(), 60)).toBe(60);
  });

  it('never returns a frame before 0', () => {
    expect(nearestBeat(grid({ beatOneFrame: 5 }), 1)).toBe(5);
    expect(nearestBeat(grid({ beatOneFrame: 5, beatFrames: 20 }), 0)).toBe(5);
  });

  it('is null outside the span', () => {
    const spanned = grid({ startFrame: 100, endFrame: 200 });

    expect(nearestBeat(spanned, 99)).toBeNull();
    expect(nearestBeat(spanned, 200)).toBeNull();
  });

  it('stays inside the span at its edges', () => {
    const spanned = grid({ startFrame: 100, endFrame: 200 });

    expect(nearestBeat(spanned, 100)).toBe(110);
    expect(nearestBeat(spanned, 199)).toBe(185);
  });
});
