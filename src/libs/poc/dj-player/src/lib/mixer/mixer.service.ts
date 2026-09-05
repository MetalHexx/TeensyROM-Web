import { computed, Injectable, signal, type Signal } from '@angular/core';
import { clamp } from '../engine/engine-utils';
import { DECKS } from '../deck/deck.config';
import { linearCrossfaderGain } from './crossfader-curve';
import type { CrossfaderPosition } from './crossfader-curve';
import { keyCoefficientFor, KEY_SEMITONE_RANGE, scaleCoefficientFor } from './scale-taper';
import type { ScalePosition } from './scale-taper';
import type { SidFilterMode } from '../asid/register-frame';
import type { KeyDisplayFormat } from './key-display';

/** The three tapered knobs. Key is separate — it is stored in semitones, not a position. */
export type ScaleControl = 'cutoff' | 'resonance' | 'pulseWidth';

/** Joins a deck id and a control name into one map key — the composite identity `scalePositions`
 *  (and its memoized signal caches) are keyed by. */
function scaleKey(deckId: string, control: ScaleControl): string {
  return `${deckId}:${control}`;
}

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

  /**
   * Session state only — signals, no `localStorage`, nothing persisted, nothing keyed to the loaded
   * tune. The same rule `-0.10` set for the channel fader: a control that came back from storage
   * while the fader beside it reset would be the arbitrary half of one mixer.
   */
  private readonly scalePositions = signal<ReadonlyMap<string, ScalePosition>>(new Map());
  /** Memoized per `scaleKey(deckId, control)` — an `effect` reading `scalePosition` must not
   *  re-subscribe on every read, same as `deckFaderSignals`. */
  private readonly scalePositionSignals = new Map<string, Signal<ScalePosition>>();
  /** Memoized per `scaleKey(deckId, control)` — the seam `scaleCoefficient`'s own doc calls out:
   *  a fresh `computed` per call would re-subscribe the deck host's effect on every run. */
  private readonly scaleCoefficientSignals = new Map<string, Signal<number>>();

  private readonly keySemitonesByDeck = signal<ReadonlyMap<string, number>>(new Map());
  private readonly keySemitoneSignals = new Map<string, Signal<number>>();
  private readonly keyCoefficientSignals = new Map<string, Signal<number>>();

  private readonly filterModes = signal<ReadonlyMap<string, SidFilterMode | null>>(new Map());
  private readonly filterModeSignals = new Map<string, Signal<SidFilterMode | null>>();

  /** Page-level, not per-deck — one operator preference for how the Key knob's home readout shows
   *  a tune's detected key. Session state only, same as everything else on this service. */
  private readonly _keyDisplayFormat = signal<KeyDisplayFormat>('camelot');
  readonly keyDisplayFormat: Signal<KeyDisplayFormat> = this._keyDisplayFormat.asReadonly();

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
      fader = computed(() => this.deckFaderFor(deckId));
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

  /** A deck's own cutoff/resonance/pulse-width knob position, full resolution — what the on-screen
   *  control renders and writes. */
  setScalePosition(deckId: string, control: ScaleControl, position: ScalePosition): void {
    const key = scaleKey(deckId, control);
    this.scalePositions.update((positions) => new Map(positions).set(key, position));
  }

  /** 0 (home) for a deck/control pair the model has not been told about. */
  scalePosition(deckId: string, control: ScaleControl): Signal<ScalePosition> {
    const key = scaleKey(deckId, control);
    let position = this.scalePositionSignals.get(key);
    if (position === undefined) {
      position = computed(() => this.scalePositions().get(key) ?? 0);
      this.scalePositionSignals.set(key, position);
    }
    return position;
  }

  /**
   * The stored position, taper-applied. A `computed` over the stored position, memoized per
   * (deck, control) key exactly like `gainFor` — a fresh `computed` per call would make the deck
   * host's effect re-subscribe on every run.
   */
  scaleCoefficient(deckId: string, control: ScaleControl): Signal<number> {
    const key = scaleKey(deckId, control);
    let coefficient = this.scaleCoefficientSignals.get(key);
    if (coefficient === undefined) {
      coefficient = computed(() => scaleCoefficientFor(this.scalePosition(deckId, control)()));
      this.scaleCoefficientSignals.set(key, coefficient);
    }
    return coefficient;
  }

  /** A deck's own Key offset, stored in semitones rather than a taper position — clamped to
   *  ±`KEY_SEMITONE_RANGE` and rounded to the nearest integer, matching `keyCoefficientFor`'s own
   *  bound. */
  setKeySemitones(deckId: string, semitones: number): void {
    const clamped = clamp(Math.round(semitones), -KEY_SEMITONE_RANGE, KEY_SEMITONE_RANGE);
    this.keySemitonesByDeck.update((semitonesByDeck) => new Map(semitonesByDeck).set(deckId, clamped));
  }

  /** 0 (home) for a deck the model has not been told about. */
  keySemitones(deckId: string): Signal<number> {
    let semitones = this.keySemitoneSignals.get(deckId);
    if (semitones === undefined) {
      semitones = computed(() => this.keySemitonesByDeck().get(deckId) ?? 0);
      this.keySemitoneSignals.set(deckId, semitones);
    }
    return semitones;
  }

  /** The stored semitone offset, taper-applied — memoized per deck for the same reason as
   *  `scaleCoefficient`. */
  keyCoefficient(deckId: string): Signal<number> {
    let coefficient = this.keyCoefficientSignals.get(deckId);
    if (coefficient === undefined) {
      coefficient = computed(() => keyCoefficientFor(this.keySemitones(deckId)()));
      this.keyCoefficientSignals.set(deckId, coefficient);
    }
    return coefficient;
  }

  /** A deck's own forced filter mode — `null` means the tune's own bits pass through untouched. */
  setFilterMode(deckId: string, mode: SidFilterMode | null): void {
    this.filterModes.update((modes) => new Map(modes).set(deckId, mode));
  }

  /** `null` (home — no override) for a deck the model has not been told about. */
  filterMode(deckId: string): Signal<SidFilterMode | null> {
    let mode = this.filterModeSignals.get(deckId);
    if (mode === undefined) {
      mode = computed(() => this.filterModes().get(deckId) ?? null);
      this.filterModeSignals.set(deckId, mode);
    }
    return mode;
  }

  setKeyDisplayFormat(format: KeyDisplayFormat): void {
    this._keyDisplayFormat.set(format);
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
