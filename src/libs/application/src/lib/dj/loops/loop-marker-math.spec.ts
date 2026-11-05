import { describe, it, expect } from 'vitest';
import type { DeckLoopMarker } from '../dj-store';
import { clamp, markerKind, markerLabel, oneSecondFrames, resolvedFrame } from './loop-marker-math';

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
    wraps: false,
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

describe('markerLabel', () => {
  const cue = () => marker({ frame: 100 });
  const loop = () => marker({ frame: 100 }, { frame: 200 });
  const named = (name: string) => ({ ...loop(), name });

  it('counts each kind apart, and lets a name stand in for its label', () => {
    const markers = [cue(), loop(), named('Drop'), loop(), cue()];

    expect(markers.map((_, index) => markerLabel(markers, index))).toEqual([
      'Cue 1',
      'Loop 1',
      'Drop',
      'Loop 3',
      'Cue 2',
    ]);
  });

  it('relabels a cue as a loop once it gains an end', () => {
    const before = [loop(), cue()];
    expect(markerLabel(before, 1)).toBe('Cue 1');

    const after = [loop(), loop()];
    expect(markerLabel(after, 1)).toBe('Loop 2');
  });
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

describe('clamp', () => {
  it.each([
    { value: 5, expected: 5 },
    { value: -3, expected: 0 },
    { value: 40, expected: 10 },
  ])('holds $value to 0–10 as $expected', ({ value, expected }) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });
});
