import { Injectable, inject } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import {
  DjStore,
  type KeyDisplayFormat,
  type PanelFilterMode,
  type PanelWaveform,
  type VoiceStripState,
  type VoiceSwitch,
} from './dj-store';
import { DeckLoops } from './deck-loops';
import { MixerApplier } from './mixer-applier';
import { PANEL_RANGES, bounded } from './mixer/panel-ranges';
import type { Slot } from './slot';

export type VoiceKnob =
  | 'coarse'
  | 'fine'
  | 'pulseWidth'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release';

export type FilterKnob = 'cutoff' | 'resonance';

const SWITCH_LOCKS = {
  ring: 'ringLock',
  sync: 'syncLock',
  filter: 'filterLock',
} as const satisfies Record<VoiceSwitch, keyof VoiceStripState>;

function isVoice(voice: number): boolean {
  return Number.isInteger(voice) && voice >= 0 && voice <= 2;
}

/**
 * The mixer's command surface: bounds each panel control's value and writes it to `DjStore`,
 * nothing else. `MixerApplier` turns the stored panel into engine calls; this service never
 * touches the engine. The one thing it asks the applier is what the tune itself has a switch at,
 * so a Ring, Sync or Filter press can lock to the opposite.
 *
 * Panel controls are refused while the deck has nothing shapeable loaded. Panic and the key
 * display format are always accepted. Non-finite values and a voice outside 0…2 are ignored.
 *
 * Every accepted write also reaches the settings in play: when a marker's own settings are in play
 * on the deck, `DeckLoops` keeps the result in that marker's copy.
 */
@Injectable({ providedIn: 'root' })
export class MixerService {
  private readonly store = inject(DjStore);
  private readonly applier = inject(MixerApplier);
  private readonly loops = inject(DeckLoops);

  /** One voice knob's offset, clamped to its range; Coarse and the envelope and pulse-width
   *  knobs snap to whole numbers, Fine keeps full resolution. */
  setVoiceKnob(slot: Slot, voice: number, knob: VoiceKnob, value: number): void {
    if (!isVoice(voice) || !Number.isFinite(value) || !this.canShape(slot, knob)) {
      return;
    }
    this.write(slot, () =>
      this.store.setVoiceStrip({
        slot,
        voice,
        patch: { [knob]: bounded(PANEL_RANGES[knob], value) },
      })
    );
  }

  /** The cutoff or resonance offset, snapped to a whole number and clamped to its range. */
  setFilterKnob(slot: Slot, knob: FilterKnob, value: number): void {
    if (!Number.isFinite(value) || !this.canShape(slot, knob)) {
      return;
    }
    this.write(slot, () =>
      this.store.setDeckPanel({ slot, patch: { [knob]: bounded(PANEL_RANGES[knob], value) } })
    );
  }

  /** Key offset, rounded to a whole semitone and clamped to ±12. */
  setKeySemitones(slot: Slot, semitones: number): void {
    if (!Number.isFinite(semitones) || !this.canShape(slot, 'key')) {
      return;
    }
    this.write(slot, () =>
      this.store.setDeckPanel({
        slot,
        patch: { keySemitones: bounded(PANEL_RANGES.key, semitones) },
      })
    );
  }

  /** A press on a waveform button: the locked waveform hands back to the tune; any other locks
   *  to it, moving the lock if another waveform held it. */
  pressWaveform(slot: Slot, voice: number, waveform: PanelWaveform): void {
    if (!isVoice(voice) || !this.canShape(slot, 'waveform')) {
      return;
    }
    const current = this.strip(slot, voice).waveformLock;
    this.write(slot, () =>
      this.store.setVoiceStrip({
        slot,
        voice,
        patch: { waveformLock: current === waveform ? null : waveform },
      })
    );
  }

  /** Locks the voice to `waveform`, or — when `locked` is false — releases the lock only if it is
   *  that waveform's. */
  setWaveformLocked(slot: Slot, voice: number, waveform: PanelWaveform, locked: boolean): void {
    if (!isVoice(voice) || !this.canShape(slot, 'waveform')) {
      return;
    }
    if (!locked && this.strip(slot, voice).waveformLock !== waveform) {
      return;
    }
    this.write(slot, () =>
      this.store.setVoiceStrip({ slot, voice, patch: { waveformLock: locked ? waveform : null } })
    );
  }

  /** A press on a filter-mode button, with the waveform rule applied to the deck's filter mode. */
  pressFilterMode(slot: Slot, mode: PanelFilterMode): void {
    if (!this.canShape(slot, 'filter mode')) {
      return;
    }
    const current = this.store.deckPanel(slot)().filterModeLock;
    this.write(slot, () =>
      this.store.setDeckPanel({ slot, patch: { filterModeLock: current === mode ? null : mode } })
    );
  }

  /** Locks the filter mode to `mode`, or — when `locked` is false — releases the lock only if it
   *  is that mode's. */
  setFilterModeLocked(slot: Slot, mode: PanelFilterMode, locked: boolean): void {
    if (!this.canShape(slot, 'filter mode')) {
      return;
    }
    if (!locked && this.store.deckPanel(slot)().filterModeLock !== mode) {
      return;
    }
    this.write(slot, () =>
      this.store.setDeckPanel({ slot, patch: { filterModeLock: locked ? mode : null } })
    );
  }

  /** A press on Ring, Sync or Filt: a locked switch hands back to the tune; an unlocked one locks
   *  to the opposite of what the tune has it at right now. */
  pressSwitch(slot: Slot, voice: number, sw: VoiceSwitch): void {
    if (!isVoice(voice) || !this.canShape(slot, sw)) {
      return;
    }
    const lockKey = SWITCH_LOCKS[sw];
    const lock =
      this.strip(slot, voice)[lockKey] === null ? this.oppositeOfTune(slot, voice, sw) : null;
    this.write(slot, () => this.store.setVoiceStrip({ slot, voice, patch: { [lockKey]: lock } }));
  }

  /** Locks the switch to the opposite of the tune's state — unless it is already locked, which
   *  stays as it is — or, when `locked` is false, hands it back. */
  setSwitchLocked(slot: Slot, voice: number, sw: VoiceSwitch, locked: boolean): void {
    if (!isVoice(voice) || !this.canShape(slot, sw)) {
      return;
    }
    const lockKey = SWITCH_LOCKS[sw];
    if (locked && this.strip(slot, voice)[lockKey] !== null) {
      return;
    }
    const lock = locked ? this.oppositeOfTune(slot, voice, sw) : null;
    this.write(slot, () => this.store.setVoiceStrip({ slot, voice, patch: { [lockKey]: lock } }));
  }

  /** Returns the deck's whole panel to home. Speed, mutes and the other deck are untouched. A
   *  marker's own settings in play go home with it, and the marker stays independent. */
  panic(slot: Slot): void {
    this.write(slot, () => this.store.resetDeckPanel({ slot, reason: 'panic' }));
  }

  setKeyDisplayFormat(format: KeyDisplayFormat): void {
    this.store.setKeyDisplayFormat({ format });
  }

  /** Runs an accepted write, then lets the settings in play keep its result. */
  private write(slot: Slot, write: () => void): void {
    write();
    this.loops.saveSettingsInPlay(slot);
  }

  private strip(slot: Slot, voice: number): VoiceStripState {
    return this.store.deckPanel(slot)().voices[voice];
  }

  private oppositeOfTune(slot: Slot, voice: number, sw: VoiceSwitch): boolean {
    return !this.applier.tuneSwitchOn(slot, voice, sw);
  }

  private canShape(slot: Slot, control: string): boolean {
    if (this.store.canShape(slot)()) {
      return true;
    }
    logWarn(`MixerService: deck ${slot} has nothing shapeable loaded — ${control} change refused.`);
    return false;
  }
}
