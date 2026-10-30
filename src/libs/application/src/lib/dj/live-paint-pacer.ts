import { LIVE_PAINT_INTERVAL_MS } from './live-paint-clock';

/** The display's frame period assumed until one is measured: 60 Hz. */
const ASSUMED_FRAME_MS = 1000 / 60;

/** A gap between two frames asked for back to back outside this range is not one display frame —
 *  a throttled or hidden page — and teaches nothing. */
const SHORTEST_FRAME_MS = 2;
const LONGEST_FRAME_MS = 50;

/** Frame times are the display's own vsync times, so they barely jitter: a frame this little short
 *  of the interval is still due, and a woken frame this close to a whole number of frames from where
 *  the period put it says the period holds. */
const FRAME_TIME_SLACK_MS = 1;

/** How far into an interval the loop wakes, as a share of a frame: past its vsync, and early enough
 *  that a frame begun then still has the interval to run in. */
const WAKE_INTO_FRAME = 0.25;

/**
 * Picks the frames a deck loop paints on, about 30 a second whatever the display's refresh rate,
 * and says how long the loop can sleep in between. A paint is due on the first frame at least
 * `LIVE_PAINT_INTERVAL_MS` after the last one by the frames' own timestamps: every second frame at
 * 60 Hz, every third at 100 Hz, every fifth at 144 Hz. In between the loop asks for no frame at
 * all: it sleeps, and wakes a quarter of a frame into an interval to ask for the due frame.
 *
 * Which interval depends on Chrome. A page that asks partway through an interval is handed either
 * that interval's frame at once or the next one at its vsync — both are seen, the second while
 * frames run long. So the loop learns it from where its woken frames land: a whole frame late, and
 * it wakes in the interval before the due frame; a whole frame early (too early to paint, so it asks
 * for the next), and it wakes in the due frame's own interval.
 *
 * Waking on time also takes the display's frame period: the median of the last three gaps between
 * frames the loop asked for back to back. It asks for the very next frame whenever that frame is
 * the due one, whenever a frame turns out to be early, and once after any woken frame that landed
 * off the period's whole frames — so a period that is wrong, a move to a display with another
 * refresh rate among them, is measured again within a paint or two. Until then it assumes 60 Hz.
 */
export class LivePaintPacer {
  /** The last three measured periods, the oldest overwritten first. */
  private readonly periods = new Float64Array(3).fill(ASSUMED_FRAME_MS);
  private nextPeriod = 0;
  private frameMs = ASSUMED_FRAME_MS;
  private lastPaintMs = Number.NEGATIVE_INFINITY;
  private takenMs = 0;
  /** The frame time of the frame that asked for the very next one, or null. */
  private askedAfterMs: number | null = null;
  /** Where the period puts the frame the loop is sleeping toward, or null. */
  private expectedMs: number | null = null;
  private measureNext = false;
  /** 1 while Chrome hands a woken page the next vsync's frame, so the loop wakes an interval
   *  early; 0 while it hands that interval's frame at once. */
  private leadFrames = 0;

  /** Takes the frame stamped `frameTimeMs` and says whether the loop paints on it. */
  take(frameTimeMs: number): boolean {
    if (this.askedAfterMs !== null) {
      this.learn(frameTimeMs - this.askedAfterMs);
      this.askedAfterMs = null;
    }
    if (this.expectedMs !== null) {
      this.placeWake(frameTimeMs - this.expectedMs);
      this.expectedMs = null;
    }
    this.takenMs = frameTimeMs;
    if (frameTimeMs - this.lastPaintMs < LIVE_PAINT_INTERVAL_MS - FRAME_TIME_SLACK_MS) {
      return false;
    }
    this.lastPaintMs = frameTimeMs;
    return true;
  }

  /** How long from `nowMs`, after the frame it just took, the loop sleeps before it asks for its
   *  next frame; 0 asks for the very next frame now. */
  waitMs(nowMs: number): number {
    const dueMs = this.lastPaintMs + LIVE_PAINT_INTERVAL_MS - FRAME_TIME_SLACK_MS;
    const framesAway = Math.ceil((dueMs - this.takenMs) / this.frameMs);
    const wakeMs = this.takenMs + (framesAway - this.leadFrames + WAKE_INTO_FRAME) * this.frameMs;
    if (framesAway <= 1 || this.measureNext || wakeMs <= nowMs) {
      this.measureNext = false;
      this.askedAfterMs = this.takenMs;
      return 0;
    }
    this.expectedMs = this.takenMs + framesAway * this.frameMs;
    return wakeMs - nowMs;
  }

  /** The loop stopped: the next frame it takes was neither asked for back to back nor slept
   *  toward. */
  stopped(): void {
    this.askedAfterMs = null;
    this.expectedMs = null;
  }

  /** Reads where a woken frame landed, `offsetMs` from where the period put it. A wake is never more
   *  than a frame out with the period right, so anything else is a reason to measure it. */
  private placeWake(offsetMs: number): void {
    const frames = Math.round(offsetMs / this.frameMs);
    if (Math.abs(frames) > 1 || Math.abs(offsetMs - frames * this.frameMs) > FRAME_TIME_SLACK_MS) {
      this.measureNext = true;
    } else if (frames === 1) {
      this.leadFrames = 1;
    } else if (frames === -1) {
      this.leadFrames = 0;
    }
  }

  private learn(gapMs: number): void {
    if (gapMs < SHORTEST_FRAME_MS || gapMs > LONGEST_FRAME_MS) {
      return;
    }
    const periods = this.periods;
    periods[this.nextPeriod] = gapMs;
    this.nextPeriod = (this.nextPeriod + 1) % periods.length;
    const a = periods[0];
    const b = periods[1];
    const c = periods[2];
    this.frameMs = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
  }
}
