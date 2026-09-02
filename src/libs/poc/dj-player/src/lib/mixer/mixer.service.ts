import { computed, Injectable, signal, type Signal } from '@angular/core';
import { clamp } from '../engine/engine-utils';
import { DECKS } from '../deck/deck.config';
import { linearCrossfaderGain } from './crossfader-curve';
import type { CrossfaderPosition } from './crossfader-curve';

/**
 * Page-level: the mixer modelled as gain per deck, with the crossfader as one contributor writing
 * into it — the shape a third deck needs anyway, since three decks have three faders and there is no
 * meaningful three-way crossfader.
 *
 * Composition is multiplicative and stays continuous — `gain = clamp(deckFader * crossfaderContribution,
 * 0, 1)` — and no contributor is rounded here. Quantization to the sixteen-step output register
 * happens exactly once, downstream of this service, because rounding each contributor separately
 * would compound two roundings and cost levels that cannot be spared.
 */
@Injectable()
export class MixerService {
  private readonly _crossfaderPosition = signal<CrossfaderPosition>(0);
  /** Continuous, −1…+1, rests at 0. Never reduced to output steps. */
  readonly crossfaderPosition: Signal<CrossfaderPosition> = this._crossfaderPosition.asReadonly();

  /** The two decks the fader spans — the first two entries of DECKS. Null if DECKS ever composes
   *  fewer than two decks. */
  readonly crossfaderPair: readonly [string, string] | null =
    DECKS.length >= 2 ? [DECKS[0].id, DECKS[1].id] : null;

  /** A deck's own fader contributor, keyed by deck id. Absent means full — the seam for an on-screen
   *  per-deck fader that does not exist yet. */
  private readonly deckFaders = signal<ReadonlyMap<string, number>>(new Map());

  /** Memoized so `gainFor` returns the same `Signal` instance for the same id across calls — an
   *  `effect` reading it must not re-subscribe on every read. */
  private readonly gainSignals = new Map<string, Signal<number>>();

  /** Memoized for the same reason as `gainSignals` — an `effect` reading `deckFader` must not
   *  re-subscribe on every read. */
  private readonly deckFaderSignals = new Map<string, Signal<number>>();

  setCrossfaderPosition(position: CrossfaderPosition): void {
    this._crossfaderPosition.set(position);
  }

  /** A deck's own fader contributor. No on-screen control this iteration; the seam exists so one
   *  drops in later. */
  setDeckFader(deckId: string, gain: number): void {
    this.deckFaders.update((faders) => new Map(faders).set(deckId, gain));
  }

  /** A deck's own fader contributor, full resolution — what the on-screen channel fader renders and
   *  writes. 1 for a deck the model has not been told about, matching `deckFaderFor`. */
  deckFader(deckId: string): Signal<number> {
    let fader = this.deckFaderSignals.get(deckId);
    if (fader === undefined) {
      fader = computed(() => this.deckFaders().get(deckId) ?? 1);
      this.deckFaderSignals.set(deckId, fader);
    }
    return fader;
  }

  /** The composed, full-resolution gain for a deck. 1 for a deck id the model does not know. */
  gainFor(deckId: string): Signal<number> {
    let gain = this.gainSignals.get(deckId);
    if (gain === undefined) {
      gain = computed(() =>
        clamp(this.deckFaderFor(deckId) * this.crossfaderContributionFor(deckId), 0, 1)
      );
      this.gainSignals.set(deckId, gain);
    }
    return gain;
  }

  private deckFaderFor(deckId: string): number {
    return this.deckFaders().get(deckId) ?? 1;
  }

  /** 1 for a deck outside `crossfaderPair` — the crossfader has nothing to say about it. */
  private crossfaderContributionFor(deckId: string): number {
    const pair = this.crossfaderPair;
    if (pair === null) return 1;
    const [aId, bId] = pair;
    if (deckId === aId) return linearCrossfaderGain(this.crossfaderPosition(), 'a');
    if (deckId === bId) return linearCrossfaderGain(this.crossfaderPosition(), 'b');
    return 1;
  }
}
