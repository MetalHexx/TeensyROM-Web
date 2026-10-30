import { Injectable, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckHand, type HandTarget } from '../deck-hand';
import { DeckService } from '../deck.service';
import { DjSets } from '../sets/dj-sets';
import { DjStore } from '../dj-store';
import type { MappingStyleKind } from '../ports';
import { MixerService, type FilterKnob, type VoiceKnob } from '../mixer.service';
import { PANEL_RANGES } from '../mixer/panel-ranges';
import { NUDGE_DEFAULT_AMOUNT } from '../mixer/speed-excursion';
import { SPEED_FADER_RANGE } from '../mixer/speed-range';
import { DECK_SLOTS, type Slot } from '../slot';
import type { PanelFilterMode, PanelWaveform, VoiceSwitch } from '../dj-store';
import {
  VOICE_NUMBERS,
  VOICE_STRIP_CONTROLS,
  controlKey,
  type ControlIdentity,
  type DeckControlId,
  type SetControlId,
  type VoiceStripControl,
} from './mapping.models';

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
  | (ControlBase & {
      readonly nature: 'hold';
      /** The amount a fresh mapping of this hold starts with, or null for a hold that takes none
       *  (the voice holds). */
      readonly amountDefault: number | null;
      /** `amount` is the mapping's amount on a press, null on a release or for a hold with none. */
      set(held: boolean, amount: number | null): void;
    })
  | (ControlBase & {
      readonly nature: 'value';
      readonly min: number;
      readonly max: number;
      readonly home: number;
      /** The smallest move, or `null` for a continuous control. */
      readonly step: number | null;
      readonly defaults: ValueDefaults;
      /** The styles this control offers, when fewer than its nature's. */
      readonly styles?: readonly MappingStyleKind[];
      /** A selection that moves one place per tick or press: the engine ignores sensitivity, reads
       *  a step amount only for its sign (the direction), and never applies `absolute`. */
      readonly wholeSteps?: boolean;
      /** What a pitch bend strip mapped here drives as a hand; a control without one takes no
       *  pitch bend. */
      readonly hand?: HandTarget;
      read(): number;
      set(value: number): void;
    });

interface ValueRange {
  readonly min: number;
  readonly max: number;
  readonly home: number;
  readonly step: number | null;
}

const SPEED_RANGE: ValueRange = { ...SPEED_FADER_RANGE, step: null };
const KEY_RANGE: ValueRange = PANEL_RANGES.key;

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

const STEP_DEFAULTS = (sensitivity: number, stepAmount: number): ValueDefaults => ({
  ccStyle: 'relative-offset',
  sensitivity,
  stepAmount,
});

/** One panel control of a voice strip: how it is named, read and commanded. */
type VoiceStripEntry =
  | {
      readonly kind: 'knob';
      readonly knob: VoiceKnob;
      readonly name: string;
      readonly defaults: ValueDefaults;
    }
  | { readonly kind: 'waveform'; readonly waveform: PanelWaveform; readonly name: string }
  | { readonly kind: 'switch'; readonly switch: VoiceSwitch; readonly name: string };

const VOICE_STRIP: Record<VoiceStripControl, VoiceStripEntry> = {
  'wave-triangle': { kind: 'waveform', waveform: 'triangle', name: 'triangle' },
  'wave-sawtooth': { kind: 'waveform', waveform: 'sawtooth', name: 'sawtooth' },
  'wave-pulse': { kind: 'waveform', waveform: 'pulse', name: 'pulse' },
  'wave-noise': { kind: 'waveform', waveform: 'noise', name: 'noise' },
  coarse: {
    kind: 'knob',
    knob: 'coarse',
    name: 'coarse',
    defaults: STEP_DEFAULTS(1 / 192, 1 / 192),
  },
  fine: { kind: 'knob', knob: 'fine', name: 'fine', defaults: STEP_DEFAULTS(0.01, 0.05) },
  'pulse-width': {
    kind: 'knob',
    knob: 'pulseWidth',
    name: 'pulse width',
    defaults: STEP_DEFAULTS(0.005, 0.05),
  },
  attack: { kind: 'knob', knob: 'attack', name: 'attack', defaults: STEP_DEFAULTS(1 / 30, 1 / 30) },
  decay: { kind: 'knob', knob: 'decay', name: 'decay', defaults: STEP_DEFAULTS(1 / 30, 1 / 30) },
  sustain: {
    kind: 'knob',
    knob: 'sustain',
    name: 'sustain',
    defaults: STEP_DEFAULTS(1 / 30, 1 / 30),
  },
  release: {
    kind: 'knob',
    knob: 'release',
    name: 'release',
    defaults: STEP_DEFAULTS(1 / 30, 1 / 30),
  },
  ring: { kind: 'switch', switch: 'ring', name: 'ring' },
  sync: { kind: 'switch', switch: 'sync', name: 'sync' },
  filter: { kind: 'switch', switch: 'filter', name: 'filter' },
};

const FILTER_KNOBS: readonly {
  readonly id: DeckControlId;
  readonly knob: FilterKnob;
  readonly name: string;
  readonly defaults: ValueDefaults;
}[] = [
  {
    id: 'filter-cutoff',
    knob: 'cutoff',
    name: 'Filter cutoff',
    defaults: STEP_DEFAULTS(0.005, 0.05),
  },
  {
    id: 'filter-resonance',
    knob: 'resonance',
    name: 'Filter resonance',
    defaults: STEP_DEFAULTS(1 / 30, 1 / 30),
  },
];

const FILTER_MODES: readonly {
  readonly id: DeckControlId;
  readonly mode: PanelFilterMode;
  readonly name: string;
}[] = [
  { id: 'filter-low-pass', mode: 'low-pass', name: 'Filter low-pass' },
  { id: 'filter-band-pass', mode: 'band-pass', name: 'Filter band-pass' },
  { id: 'filter-high-pass', mode: 'high-pass', name: 'Filter high-pass' },
];

function voiceControlId(voice: number, control: VoiceStripControl): DeckControlId {
  return `voice-${voice}-${control}` as DeckControlId;
}

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
  set: (held: boolean, amount: number | null) => void,
  amountDefault: number | null = null
): MappableControl {
  return { identity, name, nature: 'hold', amountDefault, set };
}

function value(
  identity: ControlIdentity,
  name: string,
  range: ValueRange,
  defaults: ValueDefaults,
  read: () => number,
  set: (value: number) => void,
  hand?: HandTarget
): MappableControl {
  return {
    identity,
    name,
    nature: 'value',
    ...range,
    defaults,
    read,
    set,
    ...(hand === undefined ? {} : { hand }),
  };
}

/** A selection over `count()` places, from 0 to `count() − 1` (0 when there are none). It moves
 *  one place per relative tick or step press and is never set to an absolute position. */
function wholeStepValue(
  identity: ControlIdentity,
  name: string,
  count: () => number,
  read: () => number,
  set: (index: number) => void
): MappableControl {
  return {
    identity,
    name,
    nature: 'value',
    min: 0,
    get max() {
      return Math.max(0, count() - 1);
    },
    home: 0,
    step: 1,
    defaults: { ccStyle: 'relative-offset', sensitivity: 1, stepAmount: 1 },
    styles: ['relative-offset', 'relative-signed', 'step', 'step-release'],
    wholeSteps: true,
    read,
    set,
  };
}

/**
 * Every control a MIDI source can drive, declared once: the transport, set, voice and SID panel
 * controls for each deck, and the set's own Select and Load controls. Each entry reads from
 * `DjStore` and commands through `DeckService`, `DjSets` or `MixerService`, so a mapped control is
 * gated exactly like its on-screen twin. The list holds no component and no mapping.
 */
@Injectable({ providedIn: 'root' })
export class MappableControls {
  private readonly djStore = inject(DjStore);
  private readonly deckService = inject(DeckService);
  private readonly mixerService = inject(MixerService);
  private readonly djSets = inject(DjSets);
  private readonly deckHand = inject(DeckHand);

  readonly all: readonly MappableControl[];

  private readonly byKey: ReadonlyMap<string, MappableControl>;

  constructor() {
    this.all = [...DECK_SLOTS.flatMap((slot) => this.deckControls(slot)), ...this.setControls()];
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
    const loops = this.djStore.deckLoops(slot);
    const id = (control: DeckControlId): ControlIdentity => ({ owner: slot, control });
    const warnOnFailure = (what: string, command: Promise<void>): Promise<void> =>
      command.catch((error: unknown) =>
        logWarn(
          `MappableControls: ${what} on deck ${slot} failed — ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    const seek = this.coalescedSeek(slot);

    return [
      trigger(id('play-pause'), 'Play / Pause', () => void decks.togglePlayPause(slot)),
      trigger(id('stop'), 'Stop', () => decks.stop(slot)),
      trigger(id('subtune-previous'), 'Previous subtune', () => void decks.previousSubtune(slot)),
      trigger(id('subtune-next'), 'Next subtune', () => void decks.nextSubtune(slot)),
      trigger(id('set-previous'), 'Previous in the set', () => void decks.previousRow(slot)),
      trigger(id('set-next'), 'Next in the set', () => void decks.nextRow(slot)),
      value(
        id('seek'),
        'Seek',
        { min: 0, max: 100, home: 0, step: null },
        SEEK_DEFAULTS,
        // Read from the engine on demand: the store holds no per-frame playhead.
        () => seek.pending() ?? decks.playheadPercent(slot),
        seek.request,
        this.deckHand.handFor(slot)
      ),
      value(
        id('speed'),
        'Speed',
        SPEED_RANGE,
        SPEED_DEFAULTS,
        () => clamp(deck().faderSpeed, SPEED_RANGE.min, SPEED_RANGE.max),
        (speed) => decks.setSpeed(slot, speed)
      ),
      trigger(id('speed-jump-up'), 'Speed +50%', () => decks.jumpSpeed(slot, 'up')),
      trigger(id('speed-jump-home'), 'Speed home', () => decks.jumpSpeed(slot, 'home')),
      trigger(id('speed-jump-down'), 'Speed −50%', () => decks.jumpSpeed(slot, 'down')),
      hold(
        id('speed-nudge-up'),
        'Nudge up',
        (held, amount) => decks.setNudge(slot, 'up', held, amount ?? NUDGE_DEFAULT_AMOUNT),
        NUDGE_DEFAULT_AMOUNT
      ),
      hold(
        id('speed-nudge-down'),
        'Nudge down',
        (held, amount) => decks.setNudge(slot, 'down', held, amount ?? NUDGE_DEFAULT_AMOUNT),
        NUDGE_DEFAULT_AMOUNT
      ),
      wholeStepValue(
        id('loop-select'),
        'Loop select',
        () => loops().markers.length,
        () =>
          Math.max(
            0,
            loops().markers.findIndex((marker) => marker.id === loops().selectedId)
          ),
        (index) => decks.selectMarkerAt(slot, index)
      ),
      trigger(id('loop-toggle'), 'Loop toggle', () =>
        warnOnFailure('loop toggle', decks.toggleMarker(slot))
      ),
      trigger(id('loop-play-now'), 'Play now', () =>
        warnOnFailure('play now', decks.playMarkerNow(slot))
      ),
      trigger(id('loop-add'), 'Add cue', () => decks.addMarker(slot)),
      trigger(id('loop-stop'), 'Stop loop', () => decks.stopMarkerLoop(slot)),
      trigger(id('loop-set-end'), 'Set loop end', () => decks.setMarkerEnd(slot)),
      trigger(id('loop-clear-end'), 'Clear loop end', () => decks.clearMarkerEnd(slot)),
      trigger(id('loop-global'), 'Loop GBL', () => decks.toggleMarkerGlobal(slot)),
      trigger(id('loop-start-snap-previous'), 'Snap loop start back', () =>
        warnOnFailure('loop start snap', decks.snapMarker(slot, 'start', 'previous'))
      ),
      trigger(id('loop-start-snap-next'), 'Snap loop start forward', () =>
        warnOnFailure('loop start snap', decks.snapMarker(slot, 'start', 'next'))
      ),
      trigger(id('loop-end-snap-previous'), 'Snap loop end back', () =>
        warnOnFailure('loop end snap', decks.snapMarker(slot, 'end', 'previous'))
      ),
      trigger(id('loop-end-snap-next'), 'Snap loop end forward', () =>
        warnOnFailure('loop end snap', decks.snapMarker(slot, 'end', 'next'))
      ),
      state(
        id('repeat'),
        'Repeat track',
        () => deck().repeat,
        (on) => decks.setRepeat(slot, on)
      ),
      ...VOICE_NUMBERS.map((n) =>
        state(
          id(`voice-${n}-mute`),
          `Voice ${n} mute`,
          () => deck().voices[n - 1].muted,
          (on) => decks.setVoiceMuted(slot, n - 1, on)
        )
      ),
      ...VOICE_NUMBERS.map((n) =>
        hold(id(`voice-${n}-hold`), `Voice ${n} kill / punch-in`, (held) =>
          decks.setVoiceHeld(slot, n - 1, held)
        )
      ),
      value(
        id('key'),
        'Key',
        KEY_RANGE,
        KEY_DEFAULTS,
        () => panel().keySemitones,
        (semitones) => mixer.setKeySemitones(slot, semitones)
      ),
      ...VOICE_NUMBERS.flatMap((n) =>
        VOICE_STRIP_CONTROLS.map((control) => this.voiceStripControl(slot, n, control))
      ),
      ...this.deckPanelControls(slot),
    ];
  }

  /** The set's table: the Select knob and a Load button per deck. Select steps over real rows
   *  only, so a row still fetching never makes the knob stick or skip. */
  private setControls(): MappableControl[] {
    const decks = this.deckService;
    const sets = this.djSets;
    const card = this.djStore.setCardSummary();
    const id = (control: SetControlId): ControlIdentity => ({ owner: 'set', control });

    return [
      wholeStepValue(
        id('set-select'),
        'Select',
        () => card().realRowCount,
        () => card().selectedRowIndex ?? 0,
        (index) => sets.selectRowAt(index)
      ),
      trigger(id('set-load-a'), 'Load A', () => void decks.loadSelected('A')),
      trigger(id('set-load-b'), 'Load B', () => void decks.loadSelected('B')),
    ];
  }

  /** One control of voice `n`'s strip, commanded through the mixer on voice `n − 1`. */
  private voiceStripControl(slot: Slot, n: number, control: VoiceStripControl): MappableControl {
    const mixer = this.mixerService;
    const panel = this.djStore.deckPanel(slot);
    const identity: ControlIdentity = { owner: slot, control: voiceControlId(n, control) };
    const entry = VOICE_STRIP[control];
    const name = `Voice ${n} ${entry.name}`;

    switch (entry.kind) {
      case 'knob':
        return value(
          identity,
          name,
          PANEL_RANGES[entry.knob],
          entry.defaults,
          () => panel().voices[n - 1][entry.knob],
          (offset) => mixer.setVoiceKnob(slot, n - 1, entry.knob, offset)
        );
      case 'waveform':
        return state(
          identity,
          name,
          () => panel().voices[n - 1].waveformLock === entry.waveform,
          (on) => mixer.setWaveformLocked(slot, n - 1, entry.waveform, on)
        );
      case 'switch': {
        const lock = `${entry.switch}Lock` as const;
        return state(
          identity,
          name,
          () => panel().voices[n - 1][lock] !== null,
          (on) => mixer.setSwitchLocked(slot, n - 1, entry.switch, on)
        );
      }
    }
  }

  /** The filter knobs and modes and the Panic button: the panel controls a deck has once. */
  private deckPanelControls(slot: Slot): MappableControl[] {
    const mixer = this.mixerService;
    const panel = this.djStore.deckPanel(slot);
    const id = (control: DeckControlId): ControlIdentity => ({ owner: slot, control });

    return [
      ...FILTER_KNOBS.map(({ id: control, knob, name, defaults }) =>
        value(
          id(control),
          name,
          PANEL_RANGES[knob],
          defaults,
          () => panel()[knob],
          (offset) => mixer.setFilterKnob(slot, knob, offset)
        )
      ),
      ...FILTER_MODES.map(({ id: control, mode, name }) =>
        state(
          id(control),
          name,
          () => panel().filterModeLock === mode,
          (on) => mixer.setFilterModeLocked(slot, mode, on)
        )
      ),
      trigger(id('panic'), 'Panic', () => mixer.panic(slot)),
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
