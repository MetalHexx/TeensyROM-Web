import { describe, it, expect } from 'vitest';
import type { DeckBeatGrid } from '../dj-store';
import {
  beatAt,
  beatsLabel,
  bpmOf,
  formatBpm,
  inGridSpan,
  lapPhaseOrNone,
  lengthLadder,
  loopLapPhase,
  MOVE_STEPS,
  moveStepLabel,
  nearestBeat,
  nearestRungIndex,
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
  it('runs the powers of two from the shortest of at least 2 frames, whole or not, to 128 beats', () => {
    expect(lengthLadder(28).map((size) => size.frames).slice(0, 4)).toEqual([3.5, 7, 14, 28]);
    expect(lengthLadder(24)[0]).toEqual({ beats: 1 / 8, frames: 3 });
    expect(lengthLadder(40)[0]).toEqual({ beats: 1 / 16, frames: 2.5 });
    expect(lengthLadder(28).at(-1)).toEqual({ beats: 128, frames: 3584 });
  });

  it('has no odd division of the beat below the powers of two', () => {
    expect(lengthLadder(24).map((size) => size.beats)).not.toContain(2 / 24);
    expect(lengthLadder(28).map((size) => size.beats)).not.toContain(2 / 28);
  });
});

describe('nearestRungIndex', () => {
  const ladder = lengthLadder(24);

  it('finds the rung of a size the ladder holds', () => {
    expect(ladder[nearestRungIndex(ladder, 4)].beats).toBe(4);
    expect(ladder[nearestRungIndex(ladder, 0.5)].beats).toBe(0.5);
  });

  it('takes the nearest rung in beats for a size the ladder lacks, the shorter on a tie', () => {
    expect(ladder[nearestRungIndex(ladder, 256)].beats).toBe(128);
    expect(ladder[nearestRungIndex(ladder, 0.01)].beats).toBe(1 / 8);
    expect(ladder[nearestRungIndex(ladder, 1.5)].beats).toBe(1);
  });

  it('snaps a size saved at an odd division the ladder no longer has to the nearest rung left', () => {
    const ladder28 = lengthLadder(28);
    const ladder40 = lengthLadder(40);

    expect(ladder28[nearestRungIndex(ladder28, 1 / 14)].beats).toBe(1 / 8);
    expect(ladder[nearestRungIndex(ladder, 1 / 12)].beats).toBe(1 / 8);
    expect(ladder40[nearestRungIndex(ladder40, 1 / 20)].beats).toBe(1 / 16);
  });

  it('is -1 for an empty ladder', () => {
    expect(nearestRungIndex([], 4)).toBe(-1);
  });
});

describe('beatsLabel', () => {
  it('counts whole beats', () => {
    expect(beatsLabel(1)).toBe('1 BEAT');
    expect(beatsLabel(5)).toBe('5 BEATS');
    expect(beatsLabel(16)).toBe('16 BEATS');
    expect(beatsLabel(48)).toBe('48 BEATS');
  });

  it('writes the ladder fractions, down to its shortest, 1/16', () => {
    expect(beatsLabel(0.5)).toBe('1/2 BEAT');
    expect(beatsLabel(0.25)).toBe('1/4 BEAT');
    expect(beatsLabel(0.125)).toBe('1/8 BEAT');
    expect(beatsLabel(1 / 16)).toBe('1/16 BEAT');
    expect(lengthLadder(40).map((size) => beatsLabel(size.beats)).slice(0, 4)).toEqual([
      '1/16 BEAT',
      '1/8 BEAT',
      '1/4 BEAT',
      '1/2 BEAT',
    ]);
    expect(beatsLabel(1 / 32)).toBe('1/32 BEAT');
  });

  it('writes a division of the beat as one part of it, and anything else as a decimal', () => {
    expect(beatsLabel(2 / 24)).toBe('1/12 BEAT');
    expect(beatsLabel(5 / 25)).toBe('1/5 BEAT');
    expect(beatsLabel(0.375)).toBe('0.375 BEATS');
    expect(beatsLabel(1.5)).toBe('1.5 BEATS');
  });
});

describe('lapPhaseOrNone', () => {
  it('reduces a lap phase to its fractional part, leaving out 0 and null', () => {
    expect(lapPhaseOrNone(38.5)).toBe(0.5);
    expect(lapPhaseOrNone(-0.25)).toBe(0.75);
    expect(lapPhaseOrNone(42)).toBeUndefined();
    expect(lapPhaseOrNone(0)).toBeUndefined();
    expect(lapPhaseOrNone(null)).toBeUndefined();
    expect(lapPhaseOrNone(undefined)).toBeUndefined();
  });
});

describe('loopLapPhase', () => {
  /** 28 frames a beat from frame 0: the 1/8 lines, 3.5 frames apart, round to 0, 4, 7, 11, 14 … */
  const grid28 = grid({ beatFrames: 28, beatOneFrame: 0 });

  it('is the unrounded position of the line of its own length a loop below a beat starts on', () => {
    // 4 is line 1 (3.5), 11 is line 3 (10.5): laps of 3 then 4. 7 and 14 are whole lines.
    expect(loopLapPhase(grid28, 4, 3.5)).toBe(0.5);
    expect(loopLapPhase(grid28, 11, 3.5)).toBe(0.5);
    expect(loopLapPhase(grid28, 39, 3.5)).toBe(0.5);
    expect(loopLapPhase(grid28, 7, 3.5)).toBeUndefined();
    expect(loopLapPhase(grid28, 14, 3.5)).toBeUndefined();
  });

  it('reads a beat line for a loop of a beat or more, and the line of its period otherwise', () => {
    const offBeat = grid({ beatFrames: 28, beatOneFrame: 0.5 });

    expect(loopLapPhase(offBeat, 29, 28)).toBe(0.5);
    expect(loopLapPhase(offBeat, 29, 56)).toBe(0.5);
    expect(loopLapPhase(grid28, 28, 28)).toBeUndefined();
  });

  it('is none for a start on no line of its period, and with no grid', () => {
    expect(loopLapPhase(grid28, 5, 3.5)).toBeUndefined();
    expect(loopLapPhase(grid28, 4, 7)).toBeUndefined();
    expect(loopLapPhase(null, 4, 3.5)).toBeUndefined();
  });
});

describe('the Move steps', () => {
  it('offer one frame first, then one beat to sixteen', () => {
    expect(MOVE_STEPS).toEqual(['frame', 1, 2, 4, 8, 16]);
  });

  it('write the frame step as a frame and the rest as beats', () => {
    expect(moveStepLabel('frame')).toBe('1 FRAME');
    expect(moveStepLabel(1)).toBe('1 BEAT');
    expect(moveStepLabel(16)).toBe('16 BEATS');
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
