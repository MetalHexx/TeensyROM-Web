import { describe, it, expect } from 'vitest';
import type { DeckBeatGrid } from '../dj-store';
import {
  beatAt,
  beatsInReach,
  beatsLabel,
  bpmOf,
  formatBpm,
  inGridSpan,
  lengthLadder,
  MOVE_STEPS,
  nearestBeat,
  nextBeat,
  onBeat,
} from './beat-math';

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

describe('lengthLadder', () => {
  it('starts at an eighth of a beat when 1/16 would be a fraction of a frame', () => {
    const sizes = lengthLadder(24);

    expect(sizes.map((size) => size.beats)).toEqual([0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32]);
    expect(sizes.map((size) => size.frames)).toEqual([3, 6, 12, 24, 48, 96, 192, 384, 768]);
  });

  it('reaches 1/32 of a beat when the beat is long enough to hold it in whole frames', () => {
    const sizes = lengthLadder(32);

    expect(sizes[0]).toEqual({ beats: 1 / 32, frames: 1 });
    expect(sizes).toHaveLength(11);
  });

  it('leaves out every size shorter than a frame or not a whole number of them', () => {
    expect(lengthLadder(25).map((size) => size.beats)).toEqual([1, 2, 4, 8, 16, 32]);
    expect(lengthLadder(1).map((size) => size.beats)).toEqual([1, 2, 4, 8, 16, 32]);
    expect(lengthLadder(24.5).map((size) => size.beats)).toEqual([2, 4, 8, 16, 32]);
  });
});

describe('beatsLabel', () => {
  it('counts whole beats', () => {
    expect(beatsLabel(1)).toBe('1 BEAT');
    expect(beatsLabel(5)).toBe('5 BEATS');
    expect(beatsLabel(16)).toBe('16 BEATS');
    expect(beatsLabel(48)).toBe('48 BEATS');
  });

  it('writes the ladder fractions', () => {
    expect(beatsLabel(0.5)).toBe('½ BEAT');
    expect(beatsLabel(0.25)).toBe('¼ BEAT');
    expect(beatsLabel(0.125)).toBe('⅛ BEAT');
    expect(beatsLabel(1 / 16)).toBe('1/16 BEAT');
    expect(beatsLabel(1 / 32)).toBe('1/32 BEAT');
  });
});

describe('nextBeat', () => {
  it('steps to the beat strictly beyond the frame, from a beat or between two', () => {
    expect(nextBeat(grid(), 35, 1)).toBe(60);
    expect(nextBeat(grid(), 35, -1)).toBe(10);
    expect(nextBeat(grid(), 40, 1)).toBe(60);
    expect(nextBeat(grid(), 40, -1)).toBe(35);
  });

  it('stops at the first and last beat of the span', () => {
    const spanned = grid({ startFrame: 100, endFrame: 200 });

    expect(nextBeat(spanned, 110, -1)).toBeNull();
    expect(nextBeat(spanned, 185, 1)).toBeNull();
    expect(nextBeat(spanned, 160, 1)).toBe(185);
    expect(nextBeat(spanned, 120, -1)).toBe(110);
  });

  it('never returns a frame before 0', () => {
    expect(nextBeat(grid({ beatOneFrame: 5 }), 5, -1)).toBeNull();
    expect(nextBeat(grid({ beatOneFrame: 5 }), 0, 1)).toBe(5);
  });
});

describe('onBeat', () => {
  it('holds for a beat inside the span only', () => {
    const spanned = grid({ startFrame: 100, endFrame: 200 });

    expect(onBeat(spanned, 110)).toBe(true);
    expect(onBeat(spanned, 111)).toBe(false);
    expect(onBeat(spanned, 35)).toBe(false);
  });
});

describe('beatsInReach', () => {
  it('lists the offsets of the beats within the range either way, ascending', () => {
    expect(beatsInReach(grid(), 40, 30)).toEqual([-30, -5, 20]);
    expect(beatsInReach(grid(), 35, 25)).toEqual([-25, 0, 25]);
  });

  it('leaves out beats outside the span and before 0', () => {
    expect(beatsInReach(grid({ startFrame: 0, endFrame: 50 }), 40, 30)).toEqual([-30, -5]);
    expect(beatsInReach(grid({ beatOneFrame: 5 }), 10, 20)).toEqual([-5, 20]);
  });
});

describe('MOVE_STEPS', () => {
  it('runs from one beat to sixteen', () => {
    expect(MOVE_STEPS).toEqual([1, 2, 4, 8, 16]);
  });
});
