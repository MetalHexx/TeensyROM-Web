import { describe, it, expect } from 'vitest';
import { detectLoop } from './loop-detect';
import type { LoopDetectOptions } from './loop-detect';
import type { ScanOutput } from './scan-tune';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';

/** Roughly 6 seconds of tail and 2 seconds of idle period at a 50 Hz play rate — small enough to keep
 *  the synthetic streams below short, and far enough apart that neither guard shadows the other. */
const OPTIONS: LoopDetectOptions = { minTailFrames: 300, idlePeriodFrames: 100 };

/** Writes a frame whose 28 bytes are fully determined by `seed`: two frames sharing a seed are
 *  byte-identical, two with different seeds differ. */
function writeFrame(slotValues: Uint8Array, frame: number, seed: number): void {
  const base = frame * ASID_SLOT_COUNT;
  slotValues[base] = seed & 0xff;
  slotValues[base + 1] = (seed >>> 8) & 0xff;
  slotValues[base + 2] = (seed >>> 16) & 0xff;
  slotValues[base + 3] = (seed >>> 24) & 0xff;
  for (let i = 4; i < ASID_SLOT_COUNT; i++) {
    slotValues[base + i] = (seed + i * 13) & 0xff;
  }
}

/** A scan whose frame content is named entirely by `seedFor` — no emulation, just the register stream
 *  the detector actually reads. */
function scanOf(frames: number, seedFor: (frame: number) => number): ScanOutput {
  const slotValues = new Uint8Array(frames * ASID_SLOT_COUNT);
  for (let f = 0; f < frames; f++) {
    writeFrame(slotValues, f, seedFor(f));
  }
  return { slotValues, writeCounts: new Uint8Array(frames), frames, callsPerFrame: 1 };
}

/** Seeds no periodic construction below ever produces, so an intro can never accidentally agree with
 *  the body that follows it. */
function introSeed(frame: number): number {
  return 1_000_000 + frame;
}

describe('detectLoop', () => {
  it('finds a tune that repeats from the very first frame', () => {
    const scan = scanOf(1000, (f) => f % 200);

    expect(detectLoop(scan, OPTIONS)).toEqual({
      kind: 'loop',
      startFrame: 0,
      periodFrames: 200,
    });
  });

  it('reports the intro length as the loop start for a tune that only repeats after one', () => {
    const introFrames = 100;
    const scan = scanOf(1000, (f) =>
      f < introFrames ? introSeed(f) : (f - introFrames) % 200
    );

    expect(detectLoop(scan, OPTIONS)).toEqual({
      kind: 'loop',
      startFrame: introFrames,
      periodFrames: 200,
    });
  });

  it('declines to answer for a tune that never repeats', () => {
    const scan = scanOf(1000, (f) => f);

    expect(detectLoop(scan, OPTIONS)).toEqual({ kind: 'none' });
  });

  it('reports a run of identical adjacent frames as ended rather than as a very short loop', () => {
    // A held note leaves every register untouched, so adjacent frames are byte-identical and any
    // short window looks like a perfect repeat.
    const scan = scanOf(1000, () => 42);

    expect(detectLoop(scan, OPTIONS)).toEqual({ kind: 'ended', endFrame: 0 });
  });

  it('reports a short idle cycle the tune settles into as ended, naming where it settled', () => {
    const settlesAt = 200;
    const scan = scanOf(1000, (f) => (f < settlesAt ? introSeed(f) : 900_000 + (f % 2)));

    expect(detectLoop(scan, OPTIONS)).toEqual({ kind: 'ended', endFrame: settlesAt });
  });

  it('declines a repeat that holds only because the scan ran out of buffer', () => {
    // The last 100 frames replay the 100 before them and the scan then stops — far short of the tail
    // the guard demands, so there is no evidence the tune actually repeats.
    const scan = scanOf(1000, (f) => (f < 900 ? f : f - 100));

    expect(detectLoop(scan, OPTIONS)).toEqual({ kind: 'none' });
  });

  it('returns an identical answer for identical input', () => {
    const scan = scanOf(1000, (f) => (f < 100 ? introSeed(f) : (f - 100) % 200));

    expect(detectLoop(scan, OPTIONS)).toEqual(detectLoop(scan, OPTIONS));
  });

  describe('option boundaries', () => {
    it('treats a period exactly at idlePeriodFrames as a loop, and one frame below it as ended', () => {
      const atThreshold = scanOf(1000, (f) => f % OPTIONS.idlePeriodFrames);
      const belowThreshold = scanOf(1000, (f) => f % (OPTIONS.idlePeriodFrames - 1));

      expect(detectLoop(atThreshold, OPTIONS)).toEqual({
        kind: 'loop',
        startFrame: 0,
        periodFrames: OPTIONS.idlePeriodFrames,
      });
      expect(detectLoop(belowThreshold, OPTIONS)).toEqual({ kind: 'ended', endFrame: 0 });
    });

    it('accepts a tail exactly at minTailFrames, and declines the same stream one frame short', () => {
      const frames = 900;
      const period = 200;
      // The last repeat begins at `frames - minTailFrames`, so the verified tail is exactly the guard.
      const loopStart = frames - OPTIONS.minTailFrames - period;
      const scan = scanOf(frames, (f) =>
        f < loopStart ? introSeed(f) : (f - loopStart) % period
      );

      expect(detectLoop(scan, OPTIONS)).toEqual({
        kind: 'loop',
        startFrame: loopStart,
        periodFrames: period,
      });
      expect(detectLoop(scan, { ...OPTIONS, minTailFrames: OPTIONS.minTailFrames + 1 })).toEqual({
        kind: 'none',
      });
    });
  });
});
