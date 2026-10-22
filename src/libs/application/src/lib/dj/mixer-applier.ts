import {
  Injectable,
  Injector,
  effect,
  inject,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { readSidField, SID_REGISTER_COUNT } from '@sidablist/core';
import type { SidField } from '@sidablist/core';
import {
  DjStore,
  type PanelFilterMode,
  type PanelWaveform,
  type SwitchLock,
  type VoiceSwitch,
} from './dj-store';
import { DeckRuntime } from './deck-runtime';
import { DECK_SLOTS, type Slot } from './slot';
import { voicePitchMultiplier } from './mixer/pitch';

/** Matches `DeckRuntime`'s refusal to hand out a slot whose engine bundle was never built. */
const UNBUILT_SLOT = /has not been built/;

const WAVEFORM_BITS: Record<PanelWaveform, number> = {
  triangle: 1,
  sawtooth: 2,
  pulse: 4,
  noise: 8,
};

const FILTER_TYPE_BITS: Record<PanelFilterMode, number> = {
  'low-pass': 1,
  'band-pass': 2,
  'high-pass': 4,
};

/** The field each voice switch sits on. */
const SWITCH_FIELDS = { ring: 'ringMod', sync: 'sync', filter: 'filtered' } as const;

const VOICE_OFFSET_KNOBS = ['pulseWidth', 'attack', 'decay', 'sustain', 'release'] as const;

const VOICE_SWITCH_LOCKS = [
  ['ring', 'ringLock'],
  ['sync', 'syncLock'],
  ['filter', 'filterLock'],
] as const;

/**
 * Turns each deck's stored SID panel into engine calls: each voice's pitch multiplier (Key, Coarse
 * and Fine as one), its pulse-width and envelope offsets, and its waveform and switch locks; the
 * deck's cutoff and resonance offsets and filter-mode lock. The library does the arithmetic,
 * clamps each field and composes the result with the tune; this class only hands over the panel.
 *
 * One effect per slot re-applies the whole deck whenever its panel changes. Every library call is
 * idempotent, so a full re-apply per change costs no extra writes.
 *
 * `applyDeck` reaches `DeckRuntime.requireSlot`, which throws until `DeckService`'s constructor has
 * built both slots. In the app that holds because `DjBootstrapService` injects `DeckService`
 * before it installs this; an unbuilt slot is still caught and warned about rather than thrown, so
 * construction order can never crash startup.
 */
@Injectable({ providedIn: 'root' })
export class MixerApplier {
  private readonly store = inject(DjStore);
  private readonly runtime = inject(DeckRuntime);
  private readonly injector = inject(Injector);

  private installed = false;
  private readonly warnedUnbuilt = new Set<Slot>();
  /** Scratch buffers for `tuneSwitchOn`, reused so a read allocates nothing. */
  private readonly written = new Uint8Array(SID_REGISTER_COUNT);
  private readonly sent = new Uint8Array(SID_REGISTER_COUNT);

  /** Installs the per-slot effects, once. Further calls are no-ops. */
  install(): void {
    if (this.installed) {
      return;
    }
    this.installed = true;

    runInInjectionContext(this.injector, () => {
      for (const slot of DECK_SLOTS) {
        const panel = this.store.deckPanel(slot);
        effect(() => {
          panel();
          untracked(() => this.applyDeck(slot));
        });
      }
    });
  }

  /** Synchronously pushes this slot's stored panel to its engine. Never throws: a failure is
   *  logged and confined to this slot. */
  applyDeck(slot: Slot): void {
    const panel = untracked(() => this.store.deckPanel(slot)());

    try {
      panel.voices.forEach((strip, voice) => {
        this.runtime.setVoicePitch(
          slot,
          voice,
          voicePitchMultiplier(panel.keySemitones, strip.coarse, strip.fine)
        );
        for (const knob of VOICE_OFFSET_KNOBS) {
          this.runtime.setFieldOffset(slot, { name: knob, voice }, Math.round(strip[knob]));
        }
        this.lock(
          slot,
          { name: 'waveform', voice },
          strip.waveformLock === null ? null : WAVEFORM_BITS[strip.waveformLock]
        );
        for (const [sw, lockKey] of VOICE_SWITCH_LOCKS) {
          this.lock(slot, { name: SWITCH_FIELDS[sw], voice }, switchValue(strip[lockKey]));
        }
      });

      this.runtime.setFieldOffset(slot, { name: 'cutoff' }, Math.round(panel.cutoff));
      this.runtime.setFieldOffset(slot, { name: 'resonance' }, Math.round(panel.resonance));
      this.lock(
        slot,
        { name: 'filterType' },
        panel.filterModeLock === null ? null : FILTER_TYPE_BITS[panel.filterModeLock]
      );
    } catch (error) {
      this.report(slot, error);
    }
  }

  /** Returns the deck's panel to home, clears its detected key, and pushes the result to the
   *  engine before returning, so the next tune plays at home settings from its first packet rather
   *  than waiting on the effect. */
  resetPanel(slot: Slot): void {
    this.store.resetDeckPanel({ slot, reason: 'tune-change' });
    this.applyDeck(slot);
  }

  /** Whether the tune itself has this switch on right now — what a press flips from. One read, on
   *  demand, never per frame. An unbuilt slot or a failed read reports like an apply failure and
   *  answers `false`. */
  tuneSwitchOn(slot: Slot, voice: number, sw: VoiceSwitch): boolean {
    try {
      this.runtime.readRegisters(slot, this.written, this.sent);
      return readSidField(this.written, { name: SWITCH_FIELDS[sw], voice }) !== 0;
    } catch (error) {
      this.report(slot, error);
      return false;
    }
  }

  /** Holds `field` at `value`, or hands it back to the tune when `value` is `null`. */
  private lock(slot: Slot, field: SidField, value: number | null): void {
    if (value === null) {
      this.runtime.releaseField(slot, field);
    } else {
      this.runtime.holdField(slot, field, value);
    }
  }

  private report(slot: Slot, error: unknown): void {
    if (error instanceof Error && UNBUILT_SLOT.test(error.message)) {
      if (!this.warnedUnbuilt.has(slot)) {
        this.warnedUnbuilt.add(slot);
        logWarn(`MixerApplier: deck ${slot} has no engine built yet — mixer values not applied.`);
      }
      return;
    }
    logError(`MixerApplier: applying deck ${slot} failed`, error);
  }
}

/** A switch lock as the field value to hold, `null` handing the field back to the tune. */
function switchValue(lock: SwitchLock): number | null {
  return lock === null ? null : lock ? 1 : 0;
}
