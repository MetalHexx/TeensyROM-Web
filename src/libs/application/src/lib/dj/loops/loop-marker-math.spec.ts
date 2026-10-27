import { describe, it, expect } from 'vitest';
import type { DeckLoopMarker } from '../dj-store';
import { clamp, markerKind, nudgeLimits, oneSecondFrames, resolvedFrame } from './loop-marker-math';

function marker(
  start: { frame: number; offsetFrames?: number },
  end: { frame: number; offsetFrames?: number } | null = null
): DeckLoopMarker {
  return {
    id: 'm',
    name: null,
    start: { frame: start.frame, offsetFrames: start.offsetFrames ?? 0 },
    end: end === null ? null : { frame: end.frame, offsetFrames: end.offsetFrames ?? 0 },
    voices: [0, 1, 2],
    settings: null,
    ownSettings: false,
    ready: false,
  };
}

describe('resolvedFrame', () => {
  it.each([
    { frame: 100, offsetFrames: 0, expected: 100 },
    { frame: 100, offsetFrames: 12, expected: 112 },
    { frame: 100, offsetFrames: -30, expected: 70 },
    { frame: 10, offsetFrames: -50, expected: 0 },
  ])(
    'puts frame $frame with offset $offsetFrames at $expected',
    ({ frame, offsetFrames, expected }) => {
      expect(resolvedFrame({ frame, offsetFrames })).toBe(expected);
    }
  );
});

describe('markerKind', () => {
  it.each([
    { name: 'no end', value: marker({ frame: 100 }), expected: 'cue' },
    {
      name: 'an end after the start',
      value: marker({ frame: 100 }, { frame: 200 }),
      expected: 'loop',
    },
    { name: 'an end at the start', value: marker({ frame: 100 }, { frame: 100 }), expected: 'cue' },
    {
      name: 'an end before the start',
      value: marker({ frame: 100 }, { frame: 80 }),
      expected: 'cue',
    },
    {
      name: 'offsets that put the end after the start',
      value: marker({ frame: 100, offsetFrames: -20 }, { frame: 90, offsetFrames: 5 }),
      expected: 'loop',
    },
    {
      name: 'both ends clamped to frame 0',
      value: marker({ frame: 5, offsetFrames: -50 }, { frame: 5, offsetFrames: -40 }),
      expected: 'cue',
    },
  ])('is a $expected with $name', ({ value, expected }) => {
    expect(markerKind(value)).toBe(expected);
  });
});

describe('oneSecondFrames', () => {
  it.each([
    { intervalUs: 20_000, expected: 50 },
    { intervalUs: 19_950, expected: 50 },
    { intervalUs: 16_667, expected: 60 },
    { intervalUs: null, expected: 0 },
    { intervalUs: 0, expected: 0 },
    { intervalUs: -5, expected: 0 },
    { intervalUs: Number.NaN, expected: 0 },
  ])('is $expected play calls at $intervalUs microseconds each', ({ intervalUs, expected }) => {
    expect(oneSecondFrames(intervalUs)).toBe(expected);
  });
});

describe('nudgeLimits', () => {
  const second = 50;

  it('allows a second either way for a cue start', () => {
    expect(nudgeLimits(marker({ frame: 100 }), 'start', second)).toEqual({ min: -50, max: 50 });
  });

  it('stops a loop start one frame short of its end', () => {
    expect(nudgeLimits(marker({ frame: 100 }, { frame: 120 }), 'start', second)).toEqual({
      min: -50,
      max: 19,
    });
  });

  it('counts the end nudge when limiting the start', () => {
    expect(
      nudgeLimits(marker({ frame: 100 }, { frame: 120, offsetFrames: 10 }), 'start', second)
    ).toEqual({
      min: -50,
      max: 29,
    });
  });

  it('keeps the full second for a start whose end is far away', () => {
    expect(nudgeLimits(marker({ frame: 100 }, { frame: 900 }), 'start', second)).toEqual({
      min: -50,
      max: 50,
    });
  });

  it('stops a loop end one frame past its start', () => {
    expect(nudgeLimits(marker({ frame: 100 }, { frame: 120 }), 'end', second)).toEqual({
      min: -19,
      max: 50,
    });
  });

  it('counts the start nudge when limiting the end', () => {
    expect(
      nudgeLimits(marker({ frame: 100, offsetFrames: 8 }, { frame: 120 }), 'end', second)
    ).toEqual({
      min: -11,
      max: 50,
    });
  });

  it('gives a missing end no room to move', () => {
    expect(nudgeLimits(marker({ frame: 100 }), 'end', second)).toEqual({ min: 0, max: 0 });
  });

  it('allows no nudge while the second is unknown', () => {
    expect(nudgeLimits(marker({ frame: 100 }, { frame: 900 }), 'start', 0)).toEqual({
      min: 0,
      max: 0,
    });
  });
});

describe('clamp', () => {
  it.each([
    { value: 5, expected: 5 },
    { value: -3, expected: 0 },
    { value: 40, expected: 10 },
  ])('holds $value to 0–10 as $expected', ({ value, expected }) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });
});
