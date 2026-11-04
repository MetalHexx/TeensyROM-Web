import { Injectable, inject } from '@angular/core';
import { countAfter, frames, type Frames, type ShadowCount } from '@sidablist/core';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';

/** What starts a departure from the line. */
export type SlipKind = 'live-loop' | 'list-loop' | 'hand';

/** A loop's bounds in play calls. */
export interface SlipLoop {
  readonly startFrame: number;
  readonly endFrame: number;
}

/** One slip departure: a live loop, a list marker loop or the hand, taking the deck off the line
 *  the shadow position keeps. */
export interface SlipDeparture {
  readonly kind: SlipKind;
  /** The loop running when it began, which it returns into (null: the line). */
  readonly returnsInto: SlipLoop | null;
}

/** A departure as this collaborator tracks it: `queued` while it began with a marker still waiting
 *  for its hand-off, so a cancelled queue can take it back. */
interface Run extends SlipDeparture {
  readonly queued: boolean;
}

/** The line a departure started inside, saved while the newer one runs. `count` is the shadow's
 *  count at that start; the run's `returnsInto` is the lap it kept. */
interface Outer {
  readonly run: Run;
  readonly count: ShadowCount;
}

interface SlotSlip {
  run: Run | null;
  outer: Outer | null;
}

/**
 * Slip, per deck: the second playhead that remembers where the line would be while a live loop, a
 * list marker loop or the hand holds the deck somewhere else, and the landing back on it.
 *
 * A departure begins when slip is on and the deck is taken off the line, always before the engine
 * call that moves the playhead, so the engine's shadow position starts from the frame that was
 * sounding. Its end lands the deck on the shadow's count, frame and phase, between ticks, and
 * stops the shadow. When the landing cannot be made — no record, the count past it, the deck not
 * playing — the departure is dropped and the caller ends as it does with slip off.
 *
 * One departure runs at a time. A live loop pushed, or the hand touched, inside a running
 * departure nests: the outer line is kept as the shadow's count at that moment and resumes, folded
 * through the ticks the inner one ran, when the inner one ends. Only one outer level is kept; a
 * third level takes the outer one's place, so the middle departure's line becomes the outer line.
 * The outer one ending first, with the inner still running, ends with no landing and the inner
 * takes over its line. A list marker loop fired inside a departure carries the count on instead.
 *
 * It holds no store state: the painter pulls `returnFrame`. It never reaches `DeckLoops`, which
 * calls it.
 */
@Injectable({ providedIn: 'root' })
export class DeckSlip {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);

  private readonly states: Record<Slot, SlotSlip> = this.buildStates();

  /**
   * The frame the deck lands on if the departure ends now, or null with no slip departure. Pulled
   * at paint rate; allocates nothing.
   */
  returnFrame(slot: Slot): number | null {
    return this.states[slot].run === null ? null : this.runtime.getShadowPosition(slot);
  }

  /**
   * Begins a departure, when slip is on. Idle, the shadow starts from the player's position and
   * phase, lapping the loop then running. Inside a running departure a live loop or the hand nests,
   * and a list marker loop does nothing: the count carries on and `markerLanded` makes the marker
   * the departure. `queued` marks a marker that waits to land.
   */
  begin(slot: Slot, kind: SlipKind, queued = false): void {
    if (!this.store.decks()[slot].slip) {
      return;
    }
    const state = this.live(slot);
    const run: Run = { kind, returnsInto: this.loopRunning(slot), queued };
    if (state.run === null) {
      if (this.runtime.startShadow(slot, run.returnsInto)) {
        state.run = run;
      }
      return;
    }
    if (kind === 'list-loop') {
      return;
    }
    const count = this.runtime.getShadowCount(slot);
    if (count !== null && this.runtime.startShadow(slot, run.returnsInto)) {
      state.outer = { run: state.run, count };
      state.run = run;
    }
  }

  /** A queued marker was cancelled: a departure that began with it, and has not landed, is over
   *  and the shadow stops. */
  cancel(slot: Slot): void {
    const state = this.states[slot];
    if (state.run?.queued) {
      this.abandon(slot);
    } else if (state.outer?.run.queued) {
      state.outer = null;
    }
  }

  /**
   * A list marker landed — its hand-off, or an immediate jump into it — and is the departure now.
   * The count carries on with no landing. The loop the count was lapping is replaced, and nothing
   * returns into it, so the count moves back to the line without that lap: the outer line resumed
   * through the ticks the inner departure ran, else the same count with no lap. The hand is left
   * to its own lift.
   */
  markerLanded(slot: Slot): void {
    const state = this.states[slot];
    if (state.run === null || state.run.kind === 'hand') {
      return;
    }
    this.resumeOuter(slot);
    const run = state.run;
    if (run.kind === 'hand') {
      return;
    }
    if (run.returnsInto !== null) {
      const count = this.runtime.getShadowCount(slot);
      if (count !== null) {
        this.runtime.startShadow(slot, null, count);
      }
    }
    state.run = { kind: 'list-loop', returnsInto: null, queued: false };
  }

  /** A cue landed. It is a jump, so the departure is over and the line starts again where the deck
   *  is: the shadow stops and any saved outer line is dropped. */
  cueLanded(slot: Slot): void {
    this.abandon(slot);
  }

  /**
   * The end of a departure of `kind`, with a landing: the deck lands on the shadow's count between
   * ticks, then the shadow stops, or resumes the outer line when one was saved. True when the deck
   * landed. False when it did not: the departure running is of another kind, or none runs, which
   * changes nothing but retires the saved outer departure when that is of `kind`, or the landing
   * could not be made, which drops the departure; the caller ends as with slip off.
   */
  land(slot: Slot, kind: SlipKind): boolean {
    const state = this.live(slot);
    if (state.run?.kind !== kind) {
      this.retireOuter(slot, kind);
      return false;
    }
    if (!this.runtime.landOnShadow(slot)) {
      this.abandon(slot);
      return false;
    }
    if (state.outer === null) {
      this.abandon(slot);
    } else {
      this.resumeOuter(slot);
    }
    return true;
  }

  /**
   * The plate's Stop: lands on the outermost departure's line — the saved outer line resumed
   * through the ticks the inner one ran when nested, else the shadow — and ends every departure.
   * Nothing when none runs, and nothing when the outermost is the hand, which lands at its lift.
   */
  landOutermost(slot: Slot): void {
    const state = this.live(slot);
    const outermost = state.outer?.run ?? state.run;
    if (outermost === null || outermost.kind === 'hand') {
      return;
    }
    this.resumeOuter(slot);
    this.runtime.landOnShadow(slot);
    this.abandon(slot);
  }

  /** The end of a departure of `kind` with no landing: the outer line resumes when one was saved,
   *  else the shadow stops. When `kind` is the saved outer line, the newer departure takes it
   *  over, as at a landing. */
  release(slot: Slot, kind: SlipKind): void {
    const state = this.live(slot);
    if (state.run?.kind !== kind) {
      this.retireOuter(slot, kind);
      return;
    }
    if (state.outer === null) {
      this.abandon(slot);
    } else {
      this.resumeOuter(slot);
    }
  }

  /** Ends every departure with no landing: a stop, a load, a subtune switch, a scrub, or slip
   *  switched off. */
  abandon(slot: Slot): void {
    const state = this.states[slot];
    if (state.run === null && state.outer === null) {
      return;
    }
    state.run = null;
    state.outer = null;
    this.runtime.stopShadow(slot);
  }

  /** The slot's state, with a departure forgotten once the engine has stopped its shadow. */
  private live(slot: Slot): SlotSlip {
    const state = this.states[slot];
    if (state.run !== null && this.runtime.getShadowPosition(slot) === null) {
      state.run = null;
      state.outer = null;
    }
    return state;
  }

  /**
   * The end of the departure of `kind` while a newer one, nested inside it, still runs: the older
   * departure is over with no landing, as the deck is not where it would land. The newer one takes
   * over its line — the shadow re-based to the older count through the ticks the newer ran, lapping
   * what the older lapped — so the newer one's own end still lands where the tune would be. Nothing
   * when `kind` is not the saved outer departure.
   */
  private retireOuter(slot: Slot, kind: SlipKind): void {
    const state = this.states[slot];
    const { run, outer } = state;
    if (run === null || outer?.run.kind !== kind) {
      return;
    }
    this.resumeOuter(slot);
    state.run = { ...run, returnsInto: outer.run.returnsInto };
  }

  /** Resumes the saved outer line: the shadow re-based to its lap at the count it has reached,
   *  the ticks the inner departure ran later. Nothing without one. */
  private resumeOuter(slot: Slot): void {
    const state = this.states[slot];
    const { outer } = state;
    if (outer === null) {
      return;
    }
    const lap = outer.run.returnsInto;
    const count = countAfter(
      outer.count,
      this.runtime.getShadowTicks(slot) ?? 0,
      lap === null
        ? this.trackLoop(slot)
        : { startFrame: frames(lap.startFrame), endFrame: frames(lap.endFrame) }
    );
    state.run = outer.run;
    state.outer = null;
    this.runtime.startShadow(slot, lap, count);
  }

  /** The loop the deck runs now: the live loop, else the running marker; null on the line. */
  private loopRunning(slot: Slot): SlipLoop | null {
    const { live, runningBounds } = this.store.loops()[slot];
    if (live !== null) {
      return { startFrame: live.startFrame, endFrame: live.endFrame };
    }
    return runningBounds === null
      ? null
      : { startFrame: runningBounds.start, endFrame: runningBounds.end };
  }

  /** The loop the track wraps at, which a count with no lap of its own follows; null when the
   *  track has no end to wrap at. */
  private trackLoop(slot: Slot): { startFrame: Frames; endFrame: Frames } | null {
    const end = this.runtime.snapshot(slot).basis.trackEndFrame;
    return end === null
      ? null
      : {
          startFrame: frames(this.store.decks()[slot].structure?.loopStartFrame ?? 0),
          endFrame: end,
        };
  }

  private buildStates(): Record<Slot, SlotSlip> {
    const states = {} as Record<Slot, SlotSlip>;
    for (const slot of DECK_SLOTS) {
      states[slot] = { run: null, outer: null };
    }
    return states;
  }
}
