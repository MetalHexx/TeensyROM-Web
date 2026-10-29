import { Injectable, inject } from '@angular/core';
import type { VarispeedRateSource } from '@sidablist/core';
import { DeckLoops } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { PITCH_BEND_CENTRE, PITCH_BEND_MAX } from './ports';
import type { Slot } from './slot';

/** What a pitch bend strip mapped as a deck's hand drives. */
export interface HandTarget {
  /** A pitch bend value from the strip mapped as this deck's hand; reach and grip in seconds. */
  strip(value: number, timeStampMs: number, reachSeconds: number, gripSeconds: number): void;
  /** The strip's source went away with a finger down: treated as a lift. */
  lose(): void;
}

/** A value this close to the last accepted one is the finger resting, not moving. */
const STILL_BAND = 12;

/** How far back from the newest sample the release speed reaches. */
const RELEASE_WINDOW_MS = 40;

/** The accepted samples kept for the release speed. */
const SAMPLE_CAPACITY = 8;

/** A position this close to where the last tick left it was not moved by anything else. */
const POSITION_EPSILON = 1e-6;

/**
 * `idle`: no finger, the engine is not in varispeed for this deck's hand. `held`: a finger on the
 * strip. `thrown`: the finger lifted and the record is slowing to the deck's speed. `ignoring`: the
 * strip was touched when it could not be taken, or the hand was dropped under a finger; nothing
 * counts until the strip returns to centre.
 */
type HandState = 'idle' | 'held' | 'thrown' | 'ignoring';

/** One deck's hand. Everything the strip's messages and the engine's ticks touch lives here, built
 *  once, so neither path allocates. */
interface SlotHand {
  readonly slot: Slot;
  state: HandState;
  gripSeconds: number;
  /** The strip value, and the deck position, a stroke is measured from. */
  anchorValue: number;
  anchorPosition: number;
  /** The first tick after a touch has not set `anchorPosition` yet. */
  anchorPending: boolean;
  /** The latest value that moved past the still band. */
  acceptedValue: number;
  framesPerCount: number;
  /** Where the previous held tick left the position, if nothing else moved it. */
  expectedPosition: number;
  readonly sampleValues: Float64Array;
  readonly sampleTimes: Float64Array;
  sampleCount: number;
  sampleNext: number;
  /** Counts per millisecond at the lift. */
  releaseSpeed: number;
  /** The throw's first tick has not run yet. */
  launching: boolean;
  /** The throw's rate, in play calls per tick. */
  rate: number;
  /** The throw reached the deck's speed and its arrival is queued. */
  arrived: boolean;
  readonly rateSource: VarispeedRateSource;
  readonly arrival: () => void;
  readonly target: HandTarget;
}

/**
 * The hand on a deck: a pitch bend strip's touch, movement and lift as varispeed. While a finger is
 * on the strip the record's position follows it exactly — each tick the position goes to where the
 * latest accepted value puts it, with no smoothing — and on lift the record carries on at the
 * speed the finger left it and slows, at constant friction, to the deck's own speed (or to a stop
 * on a paused deck). When it gets there the deck leaves varispeed and the engine hands back.
 *
 * The strip's messages only record values; the position is worked out on the engine's tick, which
 * has the position that tick starts from.
 */
@Injectable({ providedIn: 'root' })
export class DeckHand {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly loops = inject(DeckLoops);

  private readonly hands: Record<Slot, SlotHand> = this.buildHands();

  /** What the deck's seek control carries to be driven by a strip. */
  handFor(slot: Slot): HandTarget {
    return this.hands[slot].target;
  }

  /** Lets go with no throw — a stop, a load or a subtune switch. A finger still on the strip is
   *  ignored until it lifts. Takes the deck out of varispeed if it is still in it. */
  drop(slot: Slot): void {
    const hand = this.hands[slot];
    if (hand.state === 'held') {
      hand.state = 'ignoring';
      this.store.setDeckHand({ slot, held: false });
    } else if (hand.state === 'thrown') {
      hand.state = 'idle';
    }
    if (this.runtime.snapshot(slot).tempo.varispeed) {
      this.runtime.leaveVarispeed(slot);
    }
  }

  private buildHands(): Record<Slot, SlotHand> {
    const build = (slot: Slot): SlotHand => {
      const hand: SlotHand = {
        slot,
        state: 'idle',
        gripSeconds: 1,
        anchorValue: PITCH_BEND_CENTRE,
        anchorPosition: 0,
        anchorPending: false,
        acceptedValue: PITCH_BEND_CENTRE,
        framesPerCount: 0,
        expectedPosition: 0,
        sampleValues: new Float64Array(SAMPLE_CAPACITY),
        sampleTimes: new Float64Array(SAMPLE_CAPACITY),
        sampleCount: 0,
        sampleNext: 0,
        releaseSpeed: 0,
        launching: false,
        rate: 0,
        arrived: false,
        rateSource: (position, intervalUs) => this.rate(hand, position, intervalUs),
        arrival: () => this.arrive(hand),
        target: {
          strip: (value, timeStampMs, reachSeconds, gripSeconds) =>
            this.strip(hand, value, timeStampMs, reachSeconds, gripSeconds),
          lose: () => this.lose(hand),
        },
      };
      return hand;
    };
    return { A: build('A'), B: build('B') };
  }

  private strip(
    hand: SlotHand,
    value: number,
    timeStampMs: number,
    reachSeconds: number,
    gripSeconds: number
  ): void {
    hand.gripSeconds = gripSeconds;
    const centred = value === PITCH_BEND_CENTRE;
    switch (hand.state) {
      case 'idle':
      case 'thrown':
        if (!centred) {
          this.touch(hand, value, reachSeconds);
        }
        return;
      case 'held':
        if (centred) {
          this.lift(hand, timeStampMs);
        } else {
          this.move(hand, value, timeStampMs);
        }
        return;
      case 'ignoring':
        if (centred) {
          hand.state = 'idle';
        }
        return;
    }
  }

  private lose(hand: SlotHand): void {
    if (hand.state === 'held') {
      this.lift(hand, performance.now());
    } else if (hand.state === 'ignoring') {
      hand.state = 'idle';
    }
  }

  private touch(hand: SlotHand, value: number, reachSeconds: number): void {
    const { slot } = hand;
    if (hand.state === 'idle') {
      const deck = this.store.decks()[slot];
      if (
        deck.busy ||
        deck.loaded === null ||
        !this.runtime.enterVarispeed(slot, hand.rateSource)
      ) {
        hand.state = 'ignoring';
        return;
      }
    }

    hand.anchorValue = value;
    hand.acceptedValue = value;
    hand.framesPerCount =
      (reachSeconds * 1e6) / this.runtime.playCallIntervalUs(slot) / PITCH_BEND_MAX;
    hand.anchorPending = true;
    hand.sampleCount = 0;
    hand.sampleNext = 0;
    hand.launching = false;
    hand.arrived = false;
    hand.state = 'held';
    this.store.setDeckHand({ slot, held: true });
  }

  private move(hand: SlotHand, value: number, timeStampMs: number): void {
    if (Math.abs(value - hand.acceptedValue) <= STILL_BAND) {
      return;
    }
    hand.acceptedValue = value;
    const at = hand.sampleNext;
    hand.sampleValues[at] = value;
    hand.sampleTimes[at] = timeStampMs;
    hand.sampleNext = (at + 1) % SAMPLE_CAPACITY;
    if (hand.sampleCount < SAMPLE_CAPACITY) {
      hand.sampleCount++;
    }
  }

  private lift(hand: SlotHand, liftTimeMs: number): void {
    hand.releaseSpeed = this.releaseSpeed(hand, liftTimeMs);
    hand.launching = true;
    hand.arrived = false;
    hand.state = 'thrown';
    this.store.setDeckHand({ slot: hand.slot, held: false });
  }

  /** Counts per millisecond between the newest sample and the oldest one within the release
   *  window of it; 0 without two samples in the window, or when the newest is already older than
   *  the window at the lift. */
  private releaseSpeed(hand: SlotHand, liftTimeMs: number): number {
    const { sampleValues: values, sampleTimes: times, sampleCount: count } = hand;
    if (count < 2) {
      return 0;
    }
    const newest = (hand.sampleNext + SAMPLE_CAPACITY - 1) % SAMPLE_CAPACITY;
    if (liftTimeMs - times[newest] > RELEASE_WINDOW_MS) {
      return 0;
    }
    let oldest = newest;
    for (let back = 1; back < count; back++) {
      const index = (newest + SAMPLE_CAPACITY - back) % SAMPLE_CAPACITY;
      if (times[newest] - times[index] > RELEASE_WINDOW_MS) {
        break;
      }
      oldest = index;
    }
    const span = times[newest] - times[oldest];
    return span > 0 ? (values[newest] - values[oldest]) / span : 0;
  }

  /** The engine's once-a-tick question: how many play calls to move this tick. */
  private rate(hand: SlotHand, position: number, intervalUs: number): number {
    switch (hand.state) {
      case 'held':
        return this.heldRate(hand, position);
      case 'thrown':
        return this.thrownRate(hand, intervalUs);
      default:
        return 0;
    }
  }

  /** The rate that puts the position where the finger says. Something else moving the position —
   *  a mouse seek, or the record's end — moves the anchor with it, so the hand carries on from
   *  there. */
  private heldRate(hand: SlotHand, position: number): number {
    if (hand.anchorPending) {
      hand.anchorPending = false;
      hand.anchorPosition = position;
    } else if (Math.abs(position - hand.expectedPosition) > POSITION_EPSILON) {
      hand.anchorPosition += position - hand.expectedPosition;
    }
    const rate =
      hand.anchorPosition +
      (hand.acceptedValue - hand.anchorValue) * hand.framesPerCount -
      position;
    hand.expectedPosition = position + rate;
    return rate;
  }

  /** The release speed on the throw's first tick, then constant friction toward the deck's own
   *  speed: 1 on a playing deck, 0 on any other. */
  private thrownRate(hand: SlotHand, intervalUs: number): number {
    const target = this.runtime.snapshot(hand.slot).transport === 'playing' ? 1 : 0;
    if (hand.launching) {
      hand.launching = false;
      hand.rate = hand.releaseSpeed * hand.framesPerCount * (intervalUs / 1000);
    } else {
      const step = intervalUs / 1e6 / hand.gripSeconds;
      const gap = target - hand.rate;
      hand.rate = Math.abs(gap) <= step ? target : hand.rate + Math.sign(gap) * step;
    }
    if (hand.rate === target && !hand.arrived) {
      hand.arrived = true;
      queueMicrotask(hand.arrival);
    }
    return hand.rate;
  }

  /** The throw reached the deck's speed, outside the tick. A marker loop the throw ended past is
   *  released first, since the engine would otherwise pull the playhead straight back into it. */
  private arrive(hand: SlotHand): void {
    if (hand.state !== 'thrown' || !hand.arrived) {
      return;
    }
    const { slot } = hand;
    const loop = this.runtime.snapshot(slot).loop;
    if (
      this.store.loops()[slot].runningId !== null &&
      loop !== null &&
      this.runtime.position(slot) >= loop.endFrame
    ) {
      this.loops.stop(slot);
    }
    this.runtime.leaveVarispeed(slot);
    hand.state = 'idle';
  }
}
