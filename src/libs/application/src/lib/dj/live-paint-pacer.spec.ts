import { describe, it, expect } from 'vitest';
import { LivePaintPacer } from './live-paint-pacer';

interface Run {
  readonly paints: number;
  readonly frames: number;
  /** The last frame's time, where a run on another display picks up. */
  readonly endMs: number;
}

/** What Chrome hands a page that asks for a frame partway through an interval: that interval's
 *  frame, begun at once, or the next vsync's. Both are seen. */
type Handing = 'at once' | 'next vsync';

/**
 * Drives `pacer` against a display refreshing at `hz` from `startMs` for `durationMs`, the way
 * Chrome hands frames to a page: asked for at once, the next frame is the next vsync; asked for
 * after a wait, it is the frame `handing` says — never one already run. The loop takes each frame a
 * millisecond into it.
 */
function run(
  pacer: LivePaintPacer,
  hz: number,
  startMs: number,
  durationMs: number,
  handing: Handing = 'at once'
): Run {
  const periodMs = 1000 / hz;
  let frame = 0;
  let frameMs = startMs;
  let paints = 0;
  let frames = 0;
  while (frameMs < startMs + durationMs) {
    frames++;
    if (pacer.take(frameMs)) {
      paints++;
    }
    const nowMs = frameMs + 1;
    const waitMs = pacer.waitMs(nowMs);
    const wakeInterval = Math.floor((nowMs + waitMs - startMs) / periodMs + 1e-9);
    frame = Math.max(frame + 1, handing === 'at once' ? wakeInterval : wakeInterval + 1);
    frameMs = startMs + frame * periodMs;
  }
  return { paints, frames, endMs: frameMs };
}

describe('LivePaintPacer', () => {
  it('paints on the first frame at least the interval after the last, by frame time', () => {
    const pacer = new LivePaintPacer();

    expect(pacer.take(1000)).toBe(true);
    expect(pacer.take(1010)).toBe(false);
    expect(pacer.take(1020)).toBe(false);
    expect(pacer.take(1029)).toBe(true);
    expect(pacer.take(1050)).toBe(false);
  });

  it('sleeps until a quarter frame past the vsync it will paint on, assuming 60 Hz until it has measured', () => {
    const pacer = new LivePaintPacer();
    pacer.take(1000);

    // Due at 1029: two 60 Hz frames on, at 1033.3; a quarter frame past that is 1037.5.
    expect(pacer.waitMs(1001)).toBeCloseTo(36.5, 6);
  });

  it('asks for the very next frame when that one is due, or when the frame it woke to is early', () => {
    const pacer = new LivePaintPacer();
    pacer.take(1000);
    pacer.waitMs(1001);

    expect(pacer.take(1020)).toBe(false);
    expect(pacer.waitMs(1021)).toBe(0);
  });

  it('wakes an interval early once a woken frame comes a vsync late, and back once one comes early', () => {
    const pacer = new LivePaintPacer();
    run(pacer, 100, 1000, 1000);
    pacer.stopped();
    pacer.take(5000);
    expect(pacer.waitMs(5001)).toBeCloseTo(31.5, 6);

    // Woken in the 5030 interval, handed the 5040 frame: the next wake is in the interval before
    // the due frame, a quarter frame past 5060.
    expect(pacer.take(5040)).toBe(true);
    expect(pacer.waitMs(5041)).toBeCloseTo(21.5, 6);

    // Handed the 5060 frame at once: too early, so the very next frame, and past its vsync again.
    expect(pacer.take(5060)).toBe(false);
    expect(pacer.waitMs(5061)).toBe(0);
    expect(pacer.take(5070)).toBe(true);
    expect(pacer.waitMs(5071)).toBeCloseTo(31.5, 6);
  });

  describe.each<Handing>(['at once', 'next vsync'])('handed a woken frame %s', (handing) => {
    it.each([30, 50, 60, 75, 90, 100, 120, 144, 165, 240])(
      'paints about 30 times a second at %i Hz, and once settled asks for no frame it does not paint on',
      (hz) => {
        const pacer = new LivePaintPacer();
        const settling = run(pacer, hz, 1000, 1000, handing);

        const settled = run(pacer, hz, settling.endMs, 2000, handing);

        expect(settled.paints / 2).toBeGreaterThanOrEqual(24);
        expect(settled.paints / 2).toBeLessThanOrEqual(35);
        expect(settled.frames - settled.paints).toBeLessThanOrEqual(1);
      }
    );

    it.each([
      [144, 60],
      [60, 144],
      [240, 50],
      [50, 240],
    ])('follows a move from a %i Hz display to a %i Hz one within a few paints', (from, to) => {
      const pacer = new LivePaintPacer();
      const before = run(pacer, from, 1000, 2000, handing);

      const moved = run(pacer, to, before.endMs, 200, handing);
      const after = run(pacer, to, moved.endMs, 2000, handing);

      expect(moved.frames - moved.paints).toBeLessThanOrEqual(4);
      expect(after.frames - after.paints).toBeLessThanOrEqual(1);
    });
  });

  it.each<[Handing, Handing]>([
    ['at once', 'next vsync'],
    ['next vsync', 'at once'],
  ])('follows Chrome from handing a woken frame %s to handing it %s', (from, to) => {
    const pacer = new LivePaintPacer();
    const before = run(pacer, 100, 1000, 1000, from);

    const switched = run(pacer, 100, before.endMs, 200, to);
    const after = run(pacer, 100, switched.endMs, 2000, to);

    expect(switched.frames - switched.paints).toBeLessThanOrEqual(2);
    expect(after.paints / 2).toBeGreaterThanOrEqual(32);
    expect(after.frames - after.paints).toBeLessThanOrEqual(1);
  });

  it('does not take the first frame after a stop for a mistimed wake', () => {
    const pacer = new LivePaintPacer();
    // The run ends with the loop sleeping toward a frame, the way a stop finds it.
    run(pacer, 100, 1000, 1000);

    pacer.stopped();

    // The 100 Hz period still holds, and the frame is no reason to measure it again: due three
    // frames on, woken a quarter frame past that.
    expect(pacer.take(5000)).toBe(true);
    expect(pacer.waitMs(5001)).toBeCloseTo(31.5, 6);
  });
});
