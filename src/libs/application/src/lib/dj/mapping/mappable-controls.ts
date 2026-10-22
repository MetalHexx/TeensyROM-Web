import { Injectable, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckService } from '../deck.service';
import { DjStore } from '../dj-store';
import { MixerService } from '../mixer.service';
import { DECK_SLOTS, type Slot } from '../slot';
import { controlKey, type ControlIdentity, type DeckControlId } from './mapping.models';

/** The defaults a value control offers when a CC source is mapped onto it. `sensitivity` is the
 *  fraction of the range one relative tick moves; `stepAmount` is the fraction one step press
 *  moves. */
export interface ValueDefaults {
  readonly ccStyle: 'absolute' | 'relative-offset';
  readonly sensitivity: number;
  readonly stepAmount: number;
}

interface ControlBase {
  readonly identity: ControlIdentity;
  readonly name: string;
}

/** One control a MIDI source can drive: how to read it and how to command it, through the same
 *  deck and mixer commands the screen uses. */
export type MappableControl =
  | (ControlBase & { readonly nature: 'trigger'; fire(): void })
  | (ControlBase & { readonly nature: 'state'; read(): boolean; set(on: boolean): void })
  | (ControlBase & { readonly nature: 'hold'; set(held: boolean): void })
  | (ControlBase & {
      readonly nature: 'value';
      readonly min: number;
      readonly max: number;
      readonly home: number;
      /** The smallest move, or `null` for a continuous control. */
      readonly step: number | null;
      readonly defaults: ValueDefaults;
      read(): number;
      set(value: number): void;
    });

interface ValueRange {
  readonly min: number;
  readonly max: number;
  readonly home: number;
  readonly step: number | null;
}

const VOICES = [1, 2, 3] as const;

const SPEED_RANGE: ValueRange = { min: 0.5, max: 1.5, home: 1, step: null };
const KEY_RANGE: ValueRange = { min: -12, max: 12, home: 0, step: 1 };

const SEEK_DEFAULTS: ValueDefaults = {
  ccStyle: 'relative-offset',
  sensitivity: 0.005,
  stepAmount: 0.05,
};
const SPEED_DEFAULTS: ValueDefaults = {
  ccStyle: 'relative-offset',
  sensitivity: 0.01,
  stepAmount: 0.05,
};
const KEY_DEFAULTS: ValueDefaults = {
  ccStyle: 'relative-offset',
  sensitivity: 1 / 24,
  stepAmount: 1 / 24,
};

function trigger(identity: ControlIdentity, name: string, fire: () => void): MappableControl {
  return { identity, name, nature: 'trigger', fire };
}

function state(
  identity: ControlIdentity,
  name: string,
  read: () => boolean,
  set: (on: boolean) => void
): MappableControl {
  return { identity, name, nature: 'state', read, set };
}

function hold(
  identity: ControlIdentity,
  name: string,
  set: (held: boolean) => void
): MappableControl {
  return { identity, name, nature: 'hold', set };
}

function value(
  identity: ControlIdentity,
  name: string,
  range: ValueRange,
  defaults: ValueDefaults,
  read: () => number,
  set: (value: number) => void
): MappableControl {
  return { identity, name, nature: 'value', ...range, defaults, read, set };
}

/**
 * Every control a MIDI source can drive, declared once: the 18 deck controls for each deck. Each
 * entry reads from `DjStore` and commands through `DeckService` or `MixerService`, so a mapped
 * control is gated exactly like its on-screen twin. The list holds no component and no mapping.
 */
@Injectable({ providedIn: 'root' })
export class MappableControls {
  private readonly djStore = inject(DjStore);
  private readonly deckService = inject(DeckService);
  private readonly mixerService = inject(MixerService);

  readonly all: readonly MappableControl[];

  private readonly byKey: ReadonlyMap<string, MappableControl>;

  constructor() {
    this.all = DECK_SLOTS.flatMap((slot) => this.deckControls(slot));
    this.byKey = new Map(this.all.map((control) => [controlKey(control.identity), control]));
  }

  find(identity: ControlIdentity): MappableControl | null {
    return this.byKey.get(controlKey(identity)) ?? null;
  }

  /** One deck's table: a row per control. */
  private deckControls(slot: Slot): MappableControl[] {
    const decks = this.deckService;
    const mixer = this.mixerService;
    const deck = this.djStore.deck(slot);
    const panel = this.djStore.deckPanel(slot);
    const transport = this.djStore.transportSummary(slot);
    const id = (control: DeckControlId): ControlIdentity => ({ owner: slot, control });
    const seek = this.coalescedSeek(slot);

    return [
      trigger(id('play-pause'), 'Play / Pause', () => void decks.togglePlayPause(slot)),
      trigger(id('stop'), 'Stop', () => decks.stop(slot)),
      trigger(id('subtune-previous'), 'Previous subtune', () => void decks.previousSubtune(slot)),
      trigger(id('subtune-next'), 'Next subtune', () => void decks.nextSubtune(slot)),
      value(
        id('seek'),
        'Seek',
        { min: 0, max: 100, home: 0, step: null },
        SEEK_DEFAULTS,
        () => seek.pending() ?? transport().scrubPercent,
        seek.request
      ),
      value(
        id('speed'),
        'Speed',
        SPEED_RANGE,
        SPEED_DEFAULTS,
        () => clamp(deck().speed, SPEED_RANGE.min, SPEED_RANGE.max),
        (speed) => decks.setSpeed(slot, speed)
      ),
      trigger(id('speed-jump-up'), 'Speed +50%', () => decks.jumpSpeed(slot, 'up')),
      trigger(id('speed-jump-home'), 'Speed home', () => decks.jumpSpeed(slot, 'home')),
      trigger(id('speed-jump-down'), 'Speed −50%', () => decks.jumpSpeed(slot, 'down')),
      state(
        id('repeat'),
        'Repeat track',
        () => deck().repeat,
        (on) => decks.setRepeat(slot, on)
      ),
      ...VOICES.map((n) =>
        state(
          id(`voice-${n}-mute`),
          `Voice ${n} mute`,
          () => deck().voices[n - 1].muted,
          (on) => decks.setVoiceMuted(slot, n - 1, on)
        )
      ),
      ...VOICES.map((n) =>
        hold(id(`voice-${n}-hold`), `Voice ${n} kill / punch-in`, (held) =>
          decks.setVoiceHeld(slot, n - 1, held)
        )
      ),
      trigger(id('clear-voice-mutes'), 'Clear voice mutes', () => decks.clearVoiceMutes(slot)),
      value(
        id('key'),
        'Key',
        KEY_RANGE,
        KEY_DEFAULTS,
        () => panel().keySemitones,
        (semitones) => mixer.setKeySemitones(slot, semitones)
      ),
    ];
  }

  /** A seek command that never queues: while one is in flight only the latest requested value is
   *  kept, and it is issued when the in-flight one settles, unless it is the same value. A knob
   *  turn would otherwise stack a replay jump per tick. `pending` is the latest requested value
   *  while a seek is unsettled, or `null`; a relative read starts from it, because the playhead
   *  does not move until the seek lands and each tick would otherwise restart from the same spot. */
  private coalescedSeek(slot: Slot): {
    request: (percent: number) => void;
    pending: () => number | null;
  } {
    let inFlight = false;
    let latest: number | null = null;
    let requested: number | null = null;

    const issue = (percent: number): void => {
      inFlight = true;
      latest = null;
      this.deckService
        .seek(slot, percent)
        .catch((error: unknown) =>
          logWarn(
            `MappableControls: seek on deck ${slot} failed — ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        )
        .finally(() => {
          inFlight = false;
          const next = latest;
          latest = null;
          if (next !== null && next !== percent) {
            issue(next);
          } else {
            requested = null;
          }
        });
    };

    return {
      request: (percent) => {
        requested = percent;
        if (inFlight) {
          latest = percent;
        } else {
          issue(percent);
        }
      },
      pending: () => requested,
    };
  }
}
