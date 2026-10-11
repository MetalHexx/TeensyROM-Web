import { Injectable, inject } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { clamp } from '@sidablist/core';
import type { SidFilterMode } from '@sidablist/core';
import { DjStore, type KeyDisplayFormat } from './dj-store';
import type { Slot } from './slot';
import { KEY_SEMITONE_RANGE } from './mixer/scale-taper';

type ShapingKnob = 'cutoff' | 'resonance' | 'pulseWidth';

/**
 * The mixer's command surface: bounds each control's value and writes it to `DjStore`, nothing
 * else. `MixerApplier` turns the stored values into engine values; this service never touches the
 * engine.
 *
 * Tune-shaping controls (knobs, key, filter mode) are refused while the deck has nothing shapeable
 * loaded. Level, the crossfader and the key display format are always accepted. Non-finite numbers
 * are ignored.
 */
@Injectable({ providedIn: 'root' })
export class MixerService {
  private readonly store = inject(DjStore);

  /** Deck level, clamped to 0…1. */
  setLevel(slot: Slot, level: number): void {
    if (!Number.isFinite(level)) {
      return;
    }
    this.store.setDeckMix({ slot, patch: { level: clamp(level, 0, 1) } });
  }

  /** Crossfader position, clamped to −1 (hard A) … +1 (hard B). */
  setCrossfader(position: number): void {
    if (!Number.isFinite(position)) {
      return;
    }
    this.store.setCrossfader({ position: clamp(position, -1, 1) });
  }

  /** One tune-shaping knob's position, clamped to −1…+1. */
  setKnob(slot: Slot, knob: ShapingKnob, position: number): void {
    if (!Number.isFinite(position) || !this.canShape(slot, knob)) {
      return;
    }
    this.store.setDeckMix({ slot, patch: { [knob]: clamp(position, -1, 1) } });
  }

  /** Key offset, rounded to a whole semitone and clamped to ±12. */
  setKeySemitones(slot: Slot, semitones: number): void {
    if (!Number.isFinite(semitones) || !this.canShape(slot, 'key')) {
      return;
    }
    this.store.setDeckMix({
      slot,
      patch: { keySemitones: clamp(Math.round(semitones), -KEY_SEMITONE_RANGE, KEY_SEMITONE_RANGE) },
    });
  }

  /** The SID filter mode override; `null` plays the tune's own filter-mode bits. */
  setFilterMode(slot: Slot, mode: SidFilterMode | null): void {
    if (!this.canShape(slot, 'filter mode')) {
      return;
    }
    this.store.setDeckMix({ slot, patch: { filterMode: mode } });
  }

  setKeyDisplayFormat(format: KeyDisplayFormat): void {
    this.store.setKeyDisplayFormat({ format });
  }

  private canShape(slot: Slot, control: string): boolean {
    if (this.store.canShape(slot)()) {
      return true;
    }
    logWarn(`MixerService: deck ${slot} has nothing shapeable loaded — ${control} change refused.`);
    return false;
  }
}
