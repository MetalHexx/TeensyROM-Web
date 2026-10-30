import { Injectable, computed, effect, inject, type Signal } from '@angular/core';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type DeckLoopsState } from './dj-store';
import { clamp, resolvedFrame } from './loops/loop-marker-math';
import { formatElapsed } from './selectors/transport-time';
import type { DeckPlayheadTargets } from './playhead-targets';
import type { Slot } from './slot';

/** Marks a readout as never painted, so the first paint writes it. Every number the painter shows
 *  is 0 or more. */
const UNPAINTED = -1;

/** The playhead as a share of the tune's length, held to 0–100; 0 while the length is unknown. */
export function scrubPercent(positionFrames: number, lengthFrames: number | null): number {
  return lengthFrames === null ? 0 : clamp((positionFrames / lengthFrames) * 100, 0, 100);
}

/** The running marker loop's resolved bounds, in play calls, its end after its start. */
interface LapSpan {
  readonly start: number;
  readonly end: number;
}

/** The running marker loop's span, or null when none runs or it has no length. */
function runningLap({ markers, runningId }: DeckLoopsState): LapSpan | null {
  const running = runningId === null ? undefined : markers.find((m) => m.id === runningId);
  if (running === undefined || running.end === null) {
    return null;
  }
  const start = resolvedFrame(running.start);
  const end = resolvedFrame(running.end);
  return end <= start ? null : { start, end };
}

function sameLap(a: LapSpan | null, b: LapSpan | null): boolean {
  return a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);
}

/** How far `positionFrames` is through `lap`, held to 0–100; 0 with no loop running. */
function lapPercent(positionFrames: number, lap: LapSpan | null): number {
  return lap === null
    ? 0
    : clamp(((positionFrames - lap.start) / (lap.end - lap.start)) * 100, 0, 100);
}

/** The deck state a paint reads, each through its own narrow signal. */
interface SlotSources {
  readonly lengthFrames: Signal<number | null>;
  readonly playCallIntervalUs: Signal<number | null>;
  readonly lap: Signal<LapSpan | null>;
}

/** Everything the painter keeps per deck: the targets and what it last wrote to each. */
interface SlotPaint {
  targets: DeckPlayheadTargets | null;
  /** A scrub drag's percent the transport shows instead of the playhead, or null. */
  pin: number | null;
  percent: number;
  elapsedText: string | null;
  /** The frame the frame label last showed. */
  labelFrame: number;
  lapPercent: number;
  stillPaintScheduled: boolean;
}

function createSlotPaint(): SlotPaint {
  return {
    targets: null,
    pin: null,
    percent: UNPAINTED,
    elapsedText: null,
    labelFrame: UNPAINTED,
    lapPercent: UNPAINTED,
    stillPaintScheduled: false,
  };
}

/**
 * Paints a deck's playhead readouts — the transport's bar, elapsed time and frame, and the running
 * marker loop's lap — straight into their targets, bypassing the store and change detection. The
 * decks' animation-frame loop calls `paint` on the frames it paints on, about 30 a second, when the
 * playhead moved; each paint reads the live position from the engine and writes only the readouts
 * whose shown value changed. While the deck is not playing that loop does not paint it, so one
 * extra paint is scheduled for anything that changes what the readouts show in the meantime: a
 * stop, pause, seek or load sampling the playhead into the store, the tune's length or play-call
 * interval, the running loop, a hand letting go. A scrub drag pins the transport to the pointer
 * through `pin`. Never writes the store.
 */
@Injectable({ providedIn: 'root' })
export class PlayheadPainter {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly slots: Record<Slot, SlotPaint> = { A: createSlotPaint(), B: createSlotPaint() };
  private readonly sources: Record<Slot, SlotSources>;

  constructor() {
    this.sources = { A: this.watch('A'), B: this.watch('B') };
  }

  /** Registers a deck's readouts, forgets what was last painted and any pin, and paints once now.
   *  Returns the detach; detaching a target set that has since been replaced does nothing. */
  attach(slot: Slot, targets: DeckPlayheadTargets): () => void {
    const state = this.slots[slot];
    state.targets = targets;
    state.pin = null;
    state.percent = UNPAINTED;
    state.elapsedText = null;
    state.labelFrame = UNPAINTED;
    state.lapPercent = UNPAINTED;
    this.paint(slot);
    return () => {
      if (state.targets === targets) {
        state.targets = null;
      }
    };
  }

  /** Pins the transport to a scrub drag's `percent` — the bar, the elapsed time and the frame show
   *  the pointer, not the playhead — or, with null, hands it back to the playhead. Paints at once
   *  either way. The lap keeps following the playhead. */
  pin(slot: Slot, percent: number | null): void {
    this.slots[slot].pin = percent;
    this.paint(slot);
  }

  /** One read of the playhead and a paint of whatever changed, now. A no-op with nothing
   *  attached. */
  paint(slot: Slot): void {
    const state = this.slots[slot];
    const targets = state.targets;
    if (targets === null) {
      return;
    }
    const { lengthFrames, playCallIntervalUs, lap } = this.sources[slot];
    const position = this.runtime.position(slot);
    const length = lengthFrames();
    const pin = state.pin;
    const shownFrames = pin === null ? position : (pin / 100) * (length ?? 0);

    const percent = pin ?? scrubPercent(position, length);
    if (state.percent !== percent) {
      state.percent = percent;
      targets.transport.setLivePosition(percent);
    }

    const elapsedText = formatElapsed(shownFrames, playCallIntervalUs());
    if (state.elapsedText !== elapsedText) {
      state.elapsedText = elapsedText;
      targets.transport.setLiveElapsed(elapsedText);
    }

    const labelFrame = Math.round(shownFrames);
    if (state.labelFrame !== labelFrame) {
      state.labelFrame = labelFrame;
      targets.transport.setLiveFrame(`frame ${labelFrame}`);
    }

    const progress = lapPercent(position, lap());
    if (state.lapPercent !== progress) {
      state.lapPercent = progress;
      targets.loops.setLiveProgress(progress);
    }
  }

  /** The narrow signals a paint reads for `slot`, and the effect that schedules a still paint when
   *  any of them, or anything else the readouts show, changes while the deck is not playing. */
  private watch(slot: Slot): SlotSources {
    // Narrow on purpose: `deck(slot)` carries every deck field — speed, voices, the hand — and an
    // effect reading it whole would rerun for each of them.
    const deck = this.store.deck(slot);
    const status = computed(() => deck().status);
    const loaded = computed(() => deck().loaded);
    const varispeed = computed(() => deck().varispeed);
    const lengthFrames = computed(() => deck().lengthFrames);
    const playCallIntervalUs = computed(() => deck().playCallIntervalUs);
    const loops = this.store.deckLoops(slot);
    const lap = computed<LapSpan | null>(() => runningLap(loops()), { equal: sameLap });
    // Sampled only on a transport transition — a stop, pause, seek, load or a hand letting go —
    // never per frame.
    const sampled = this.store.positions[slot];

    effect(() => {
      const current = status();
      loaded();
      varispeed();
      sampled();
      lengthFrames();
      playCallIntervalUs();
      lap();
      if (current !== 'playing') {
        this.scheduleStillPaint(slot);
      }
    });

    return { lengthFrames, playCallIntervalUs, lap };
  }

  /** Schedules one paint on the next animation frame, at most one pending per deck. */
  private scheduleStillPaint(slot: Slot): void {
    const state = this.slots[slot];
    if (state.stillPaintScheduled) {
      return;
    }
    state.stillPaintScheduled = true;
    requestAnimationFrame(() => {
      state.stillPaintScheduled = false;
      this.paint(slot);
    });
  }
}
