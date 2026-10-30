import { InjectionToken } from '@angular/core';

/** The decks' animation-frame loop paints at most once this often, which caps it at about 30 Hz.
 *  A few milliseconds under the 33.3 ms period, so the frame landing nearest it still paints:
 *  every second frame at 60 Hz, every third at 90 or 100 Hz, every fourth at 120 Hz.
 *  `LivePaintPacer` picks the frames by it. */
export const LIVE_PAINT_INTERVAL_MS = 30;

/**
 * The clock the decks' animation-frame loop times its sleeps by, in milliseconds, on the same
 * timeline as an animation frame's timestamp. `performance.now()` by default; a spec provides its
 * own to step time without waiting.
 */
export const LIVE_PAINT_CLOCK = new InjectionToken<() => number>('LIVE_PAINT_CLOCK', {
  providedIn: 'root',
  factory: () => () => performance.now(),
});
